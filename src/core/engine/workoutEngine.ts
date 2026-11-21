// Durum makinesi: idle → running ⇄ paused → done. Süre her zaman saatten hesaplanır
// (sayaç biriktirilmez), böylece kaçan kareler veya arka plan süreyi bozmaz.

import type { Clock } from './clock'
import { segmentAt, type CueEvent, type Timeline, type WorkoutPhase } from './timeline'

export type EngineStatus = 'idle' | 'running' | 'paused' | 'done'

export interface Snapshot {
  status: EngineStatus
  phase: WorkoutPhase
  round: number
  totalRounds: number
  /** Ekrandaki sayaç: raunt+uyarı boyunca rauntun kalan süresi, diğer fazlarda fazın kalanı. */
  remaining: number
  /** Sayaç fazının toplam süresi (ilerleme çubuğu için). */
  phaseDuration: number
  elapsed: number
  total: number
  /** Kalan raunt sayısı (mevcut raunt dahil değil). */
  roundsLeft: number
}

export interface FiredCue {
  cue: CueEvent
  /** Olayın planlanan zamanından ne kadar geç işlendiği (sn). */
  lateBy: number
}

export class WorkoutEngine {
  private anchor = 0 // elapsed = now - anchor (çalışırken)
  private pausedElapsed = 0
  private status: EngineStatus = 'idle'
  private nextCue = 0
  /** Duraklatılan toplam süre (istatistik için). */
  pausedTotal = 0
  private pausedAt = 0

  constructor(
    readonly timeline: Timeline,
    private clock: Clock,
  ) {}

  get state(): EngineStatus {
    return this.status
  }

  elapsed(): number {
    if (this.status === 'running') return Math.min(this.clock.now() - this.anchor, this.timeline.totalSec)
    // paused/done/idle: donmuş değer (doğal bitişte totalSec, erken bitişte o anki süre)
    return this.pausedElapsed
  }

  start() {
    if (this.status !== 'idle') return
    this.anchor = this.clock.now()
    this.status = 'running'
  }

  pause() {
    if (this.status !== 'running') return
    this.pausedElapsed = this.elapsed()
    this.pausedAt = this.clock.now()
    this.status = 'paused'
  }

  resume() {
    if (this.status !== 'paused') return
    this.pausedTotal += this.clock.now() - this.pausedAt
    this.anchor = this.clock.now() - this.pausedElapsed
    this.status = 'running'
  }

  toggle() {
    if (this.status === 'running') this.pause()
    else if (this.status === 'paused') this.resume()
  }

  /**
   * Bir sonraki faza atla (raunt → dinlenme, dinlenme → sonraki raunt).
   * Uyarı fazı rauntun parçasıdır; rauntta atlamak dinlenmeye geçirir.
   */
  skip() {
    if (this.status === 'idle' || this.status === 'done') return
    const now = this.elapsed()
    const segs = this.timeline.segments
    const cur = segmentAt(this.timeline, now)
    let target = this.timeline.totalSec
    if (cur) {
      const after = segs.filter((s) => s.start >= cur.end - 1e-9 && !(cur.phase === 'round' && s.phase === 'warn' && s.round === cur.round))
      target = after.length ? after[0].start : this.timeline.totalSec
    }
    // Atlanan aralıktaki olaylar çalınmaz; hedef andaki olaylar çalınır.
    while (this.nextCue < this.timeline.cues.length && this.timeline.cues[this.nextCue].t < target - 1e-9) this.nextCue++
    this.setElapsed(target)
  }

  /** Gerçekleşen: tamamlanan raunt sayısı ve rauntlarda geçen süre (dinlenme/hazırlık hariç). */
  actual(): { roundsCompleted: number; workSec: number; totalSec: number } {
    const e = this.elapsed()
    let workSec = 0
    let roundsCompleted = 0
    for (let r = 1; r <= this.timeline.config.rounds; r++) {
      const parts = this.timeline.segments.filter((s) => s.round === r && (s.phase === 'round' || s.phase === 'warn'))
      if (!parts.length) continue
      const start = parts[0].start
      const end = parts[parts.length - 1].end
      workSec += Math.max(0, Math.min(e, end) - start)
      if (e >= end - 1e-9) roundsCompleted++
    }
    return { roundsCompleted, workSec, totalSec: e }
  }

  /** Antrenmanı erken bitir. */
  finish() {
    if (this.status === 'done') return
    this.pausedElapsed = this.elapsed()
    this.status = 'done'
    this.nextCue = this.timeline.cues.length
  }

  private setElapsed(e: number) {
    if (this.status === 'running') this.anchor = this.clock.now() - e
    else this.pausedElapsed = e
  }

  /** Her karede çağrılır: zamanı gelen olayları döndürür ve durum özetini verir. */
  tick(): { snapshot: Snapshot; fired: FiredCue[] } {
    const fired: FiredCue[] = []
    if (this.status === 'running' || this.status === 'paused') {
      const e = this.elapsed()
      const cues = this.timeline.cues
      while (this.nextCue < cues.length && cues[this.nextCue].t <= e + 1e-9) {
        const cue = cues[this.nextCue++]
        fired.push({ cue, lateBy: e - cue.t })
      }
      if (e >= this.timeline.totalSec) {
        this.pausedElapsed = this.timeline.totalSec
        this.status = 'done'
      }
    }
    return { snapshot: this.snapshot(), fired }
  }

  snapshot(): Snapshot {
    const tl = this.timeline
    const e = this.elapsed()
    const total = tl.totalSec
    const base = { status: this.status, elapsed: e, total, totalRounds: tl.config.rounds }
    const seg = this.status === 'done' ? undefined : segmentAt(tl, e)
    if (!seg) {
      return { ...base, phase: 'done', round: tl.config.rounds, remaining: 0, phaseDuration: 0, roundsLeft: 0 }
    }
    let start = seg.start
    let end = seg.end
    if (seg.phase === 'round' || seg.phase === 'warn') {
      // Sayaç rauntun tamamını gösterir (uyarı dahil).
      const parts = tl.segments.filter((s) => s.round === seg.round && (s.phase === 'round' || s.phase === 'warn'))
      start = parts[0].start
      end = parts[parts.length - 1].end
    }
    const roundsLeft = seg.phase === 'prep' ? tl.config.rounds : tl.config.rounds - seg.round
    return { ...base, phase: seg.phase, round: seg.phase === 'rest' ? seg.round + 1 : seg.round, remaining: end - e, phaseDuration: end - start, roundsLeft }
  }
}
