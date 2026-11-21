// Antrenman boyunca yapay zekâ koçu: olayları çizelgeyle birleştirir, anlık geri bildirim verir, istatistik tutar.

import { voice } from '../../core/audio/voiceService'
import { getContentStore } from '../../core/content/contentStore'
import { getRepo } from '../../core/persistence/db'
import type { Stance } from '../../core/speech/stanceMapper'
import { emptyStats, expectedSteps, matchCombo, type ExpectedStep, type VisionStats } from '../../core/vision/matching'
import { LM, type Pose } from '../../core/vision/pose'
import { PoseTracker, type VisionEvent } from '../../core/vision/tracker'
import { tr } from '../../i18n/tr'
import { cueMoves } from '../combos/comboModel'
import { settingsStore } from '../../core/settings/settings'
import { suggestedFocus } from '../../core/vision/coachAdapt'
import { loadVisionHistory, visionHabits } from './visionStore'

export interface CallInfo {
  t: number
  comboId: string
  speakSec: number
  windowSec: number
}

export interface Feedback {
  text: string
  tone: 'warn' | 'good' | 'info'
  until: number
}

export interface VisionContext {
  elapsed: number
  inRound: boolean
  round: number
  stance: Stance
  call?: CallInfo
}

export interface VisionHistoryItem {
  date: string
  stats: VisionStats
}

const v = tr.vision
const SAY_GAP = { guard: 8, chin: 10, other: 6 }

export class VisionSession {
  readonly tracker = new PoseTracker()
  readonly stats: VisionStats = emptyStats()
  feedback: Feedback | null = null
  lastPose: Pose | null = null
  /** Tüm vücut görünüyor mu (ayak bilekleri dahil) */
  fullBody = true
  /** Etkin çağrıda sırayla algılanan adım sayısı (hayalet rakipte isabet) */
  progress = 0
  /** Son olaylar (hayalet rakibin saldırısına tepki) */
  recent: VisionEvent[] = []
  /** Hayalet rakip: kaçılan / yakalanan saldırılar */
  dodged = 0
  caught = 0
  private ctx: VisionContext = { elapsed: 0, inRound: false, round: 1, stance: 'orthodox' }
  private active: { call: CallInfo; steps: ExpectedStep[]; events: VisionEvent[]; firstPunchChecked: boolean } | null = null
  private lastSay: Record<string, number> = {}
  private roundSpeeds = new Map<number, number[]>()
  private returns: number[] = []
  private lastActiveT = 0
  private listeners = new Set<() => void>()

  constructor(private voiceOn: () => boolean) {}

  subscribe(fn: () => void) {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  private emit() {
    this.listeners.forEach((l) => l())
  }

  setContext(ctx: VisionContext) {
    this.ctx = ctx
    const c = ctx.call
    // Yeni çağrı: beklenen adımları hazırla (koç konuşmaları "say:" hariç)
    if (c && !c.comboId.startsWith('say:') && this.active?.call.t !== c.t) {
      this.closeActive()
      const moves = cueMoves(getContentStore(), c.comboId)
      if (moves.length) this.active = { call: c, steps: expectedSteps(moves, ctx.stance), events: [], firstPunchChecked: false }
      this.progress = 0
    }
    if (this.active && ctx.elapsed > this.active.call.t + this.active.call.speakSec + this.active.call.windowSec + 1) this.closeActive()
  }

  private closeActive() {
    const a = this.active
    if (!a) return
    this.active = null
    this.stats.calls++
    const r = matchCombo(a.steps, a.events)
    if (r.complete) {
      this.stats.completed++
      this.show(v.good, 'good', 0.9)
    }
  }

  say(key: string, phrase: string, gap: number) {
    const now = this.ctx.elapsed
    if (now - (this.lastSay[key] ?? -99) < gap) return
    // Koç bir kombo söylerken araya girme
    const c = this.ctx.call
    if (c && now >= c.t - 0.3 && now <= c.t + c.speakSec + 0.2) return
    this.lastSay[key] = now
    if (this.voiceOn()) voice.speak([phrase])
  }

  show(text: string, tone: Feedback['tone'], sec = 1.4) {
    this.feedback = { text, tone, until: this.ctx.elapsed + sec }
  }

  /** Her karede çağrılır (t: antrenman süresi, sn). */
  frame(t: number, pose: Pose) {
    this.lastPose = pose
    this.fullBody = (pose.img[LM.lAnk].v ?? 1) > 0.4 && (pose.img[LM.rAnk].v ?? 1) > 0.4
    const events = this.tracker.update(t, pose)
    for (const e of events) this.handle(e)
    if (events.length) {
      this.recent = [...this.recent, ...events].filter((e) => e.t > t - 4)
      if (this.active) this.progress = matchCombo(this.active.steps, this.active.events).matched
    }
    if (this.feedback && this.ctx.elapsed > this.feedback.until) this.feedback = null
    this.emit()
  }

  private handle(e: VisionEvent) {
    const inRound = this.ctx.inRound
    if (inRound && (e.type === 'punch' || e.type === 'kick' || e.type === 'knee')) {
      if (e.t - this.lastActiveT < 3) this.stats.activeSec += e.t - this.lastActiveT
      this.lastActiveT = e.t
    }
    switch (e.type) {
      case 'punch': {
        if (!inRound) break
        this.stats.punches++
        this.stats.punchKinds[e.kind]++
        this.stats.bySide[e.side]++
        const arr = this.roundSpeeds.get(this.ctx.round) ?? []
        arr.push(e.speed)
        this.roundSpeeds.set(this.ctx.round, arr)
        const a = this.active
        if (a) {
          a.events.push(e)
          if (!a.firstPunchChecked) {
            a.firstPunchChecked = true
            const first = a.steps.find((s) => s.kind === 'punch')
            if (first?.side && first.side !== e.side && a.steps[0]?.kind === 'punch') {
              this.show(v.otherHand, 'warn')
              this.say('hand', 'diğer el', SAY_GAP.other)
            }
          }
        }
        break
      }
      case 'returned':
        this.returns.push(e.sec)
        break
      case 'kick':
        if (!inRound) break
        this.stats.kicks++
        this.stats.maxKickHeight = Math.max(this.stats.maxKickHeight, e.height)
        this.active?.events.push(e)
        break
      case 'knee':
      case 'slip':
      case 'block':
        if (e.type === 'slip') this.stats.slips++
        if (e.type === 'block') this.stats.blocks++
        this.active?.events.push(e)
        break
      case 'guardDown':
        if (!inRound) break
        this.stats.guardDrops++
        this.show(v.guard, 'warn')
        this.say('guard', 'gard yukarı', SAY_GAP.guard)
        break
      case 'chinUp':
        if (!inRound) break
        this.stats.chinUps++
        this.show(v.chin, 'warn')
        this.say('chin', 'çene içeri', SAY_GAP.chin)
        break
    }
  }

  /** Antrenman sonu: istatistikleri tamamla ve geçmişe yaz. */
  async finish(): Promise<VisionStats> {
    this.closeActive()
    this.stats.roundSpeed = [...this.roundSpeeds.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, xs]) => Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 100) / 100)
    this.stats.returnSecAvg = this.returns.length ? Math.round((this.returns.reduce((s, x) => s + x, 0) / this.returns.length) * 100) / 100 : null
    this.stats.activeSec = Math.round(this.stats.activeSec)
    if (this.stats.punches + this.stats.kicks > 0) {
      const repo = getRepo()
      const hist = (await repo.getKV<VisionHistoryItem[]>('vision.history')) ?? []
      hist.push({ date: new Date().toISOString(), stats: this.stats })
      await repo.setKV('vision.history', hist.slice(-120))
      await loadVisionHistory()
      const focus = suggestedFocus(visionHabits())
      if (focus && !settingsStore.get().coachFocus) await settingsStore.update({ coachFocus: focus })
    }
    return this.stats
  }
}
