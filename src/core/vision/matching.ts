// Çağrılan kombo ↔ algılanan olaylar. Dil: "algılandı" (CLAUDE.md: "çağrılan" ≠ "atılan").

import type { Move } from '../content/types'
import type { Stance } from '../speech/stanceMapper'
import type { Side } from './pose'
import type { PunchKind, VisionEvent } from './tracker'

export interface ExpectedStep {
  kind: 'punch' | 'kick' | 'knee' | 'defense' | 'other'
  side?: Side
  punch?: PunchKind
}

/** Ön/arka → kişinin sol/sağı (normal duruş: ön = sol). */
export const limbSide = (limb: 'lead' | 'rear', stance: Stance): Side => ((limb === 'lead') === (stance === 'orthodox') ? 'left' : 'right')

export function expectedSteps(moves: Move[], stance: Stance): ExpectedStep[] {
  return moves.map((m) => {
    const side = m.limb === 'lead' || m.limb === 'rear' ? limbSide(m.limb, stance) : undefined
    if (m.category === 'punch') {
      const punch: PunchKind = /uppercut/.test(m.id) ? 'uppercut' : /hook/.test(m.id) ? 'hook' : 'straight'
      return { kind: 'punch', side, punch }
    }
    if (m.category === 'kick') return { kind: 'kick', side }
    if (m.category === 'knee') return { kind: 'knee', side }
    if (m.category === 'defense') return { kind: 'defense' }
    return { kind: 'other' }
  })
}

export interface MatchResult {
  /** Adımların kaçı sırayla algılandı */
  matched: number
  total: number
  complete: boolean
  /** İlk el hareketi yanlış eldeyse */
  wrongHand: boolean
}

/**
 * Çağrı penceresindeki olayları adımlarla sırayla eşleştirir.
 * Yumruk türü (direkt/kroşe) iki boyutlu kamerada güvenilir değil → yalnızca el (taraf) zorunlu.
 */
export function matchCombo(steps: ExpectedStep[], events: VisionEvent[]): MatchResult {
  const acts = events.filter((e) => e.type === 'punch' || e.type === 'kick' || e.type === 'knee' || e.type === 'slip' || e.type === 'block')
  let i = 0
  let wrongHand = false
  let firstHandSeen = false
  for (const e of acts) {
    const st = steps[i]
    if (!st) break
    if (st.kind === 'other') {
      i++
      continue
    }
    if (e.type === 'punch' && !firstHandSeen) {
      firstHandSeen = true
      const firstPunch = steps.find((x) => x.kind === 'punch')
      if (firstPunch?.side && firstPunch.side !== e.side && st.kind === 'punch') wrongHand = true
    }
    const ok =
      (st.kind === 'punch' && e.type === 'punch' && (!st.side || st.side === e.side)) ||
      (st.kind === 'kick' && e.type === 'kick' && (!st.side || st.side === e.side)) ||
      (st.kind === 'knee' && (e.type === 'knee' || e.type === 'kick') && (!st.side || st.side === e.side)) ||
      (st.kind === 'defense' && (e.type === 'slip' || e.type === 'block'))
    if (ok) i++
  }
  while (steps[i]?.kind === 'other') i++
  const total = steps.filter((s) => s.kind !== 'other').length
  const matched = steps.slice(0, i).filter((s) => s.kind !== 'other').length
  return { matched, total, complete: matched === total, wrongHand }
}

/** Seans istatistikleri (özet ekranı ve "davranışa göre koç" için). */
export interface VisionStats {
  calls: number
  completed: number
  punches: number
  punchKinds: Record<PunchKind, number>
  bySide: Record<Side, number>
  /** Raunt başına ortalama tepe bilek hızı (m/sn) */
  roundSpeed: number[]
  returnSecAvg: number | null
  guardDrops: number
  chinUps: number
  kicks: number
  maxKickHeight: number
  slips: number
  blocks: number
  activeSec: number
}

export const emptyStats = (): VisionStats => ({
  calls: 0,
  completed: 0,
  punches: 0,
  punchKinds: { straight: 0, hook: 0, uppercut: 0 },
  bySide: { left: 0, right: 0 },
  roundSpeed: [],
  returnSecAvg: null,
  guardDrops: 0,
  chinUps: 0,
  kicks: 0,
  maxKickHeight: 0,
  slips: 0,
  blocks: 0,
  activeSec: 0,
})

/** Yorgunluk: son raundun hızı ilk raundun yüzde kaçı (en az 2 raunt gerekir). */
export function fatiguePct(roundSpeed: number[]): number | null {
  const r = roundSpeed.filter((x) => x > 0)
  if (r.length < 2) return null
  return Math.round((r[r.length - 1] / r[0]) * 100)
}

/** Kaba tekme seviyesi (ekranda "alçak / orta / yüksek"). */
export const kickLevel = (h: number): 'low' | 'mid' | 'high' => (h >= 1.25 ? 'high' : h >= 0.85 ? 'mid' : 'low')
