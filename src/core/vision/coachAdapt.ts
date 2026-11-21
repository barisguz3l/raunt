// Davranışa göre koç: kameranın son seanslarda gördüklerinden kombo ağırlığı ve ipucu odağı. Saf, testli.

import type { Move } from '../content/types'
import type { Stance } from '../speech/stanceMapper'
import { expectedSteps, type VisionStats } from './matching'
import type { Side } from './pose'
import type { PunchKind } from './tracker'

export interface Habits {
  /** Algılanan yumruklarda pay (0..1); veri azsa null */
  kindShare: Record<PunchKind, number> | null
  sideShare: Record<Side, number> | null
  /** Seans başına ortalama gard düşmesi / çene kalkması */
  guardDropsPerSession: number
  chinUpsPerSession: number
}

const MIN_PUNCHES = 30

/** Son seansların özetinden alışkanlıklar. */
export function habitsFrom(history: VisionStats[]): Habits {
  const recent = history.slice(-10)
  const kinds = { straight: 0, hook: 0, uppercut: 0 }
  const sides = { left: 0, right: 0 }
  let guard = 0
  let chin = 0
  for (const s of recent) {
    kinds.straight += s.punchKinds.straight
    kinds.hook += s.punchKinds.hook
    kinds.uppercut += s.punchKinds.uppercut
    sides.left += s.bySide.left
    sides.right += s.bySide.right
    guard += s.guardDrops
    chin += s.chinUps
  }
  const total = kinds.straight + kinds.hook + kinds.uppercut
  const sideTotal = sides.left + sides.right
  return {
    kindShare: total >= MIN_PUNCHES ? { straight: kinds.straight / total, hook: kinds.hook / total, uppercut: kinds.uppercut / total } : null,
    sideShare: sideTotal >= MIN_PUNCHES ? { left: sides.left / sideTotal, right: sides.right / sideTotal } : null,
    guardDropsPerSession: recent.length ? guard / recent.length : 0,
    chinUpsPerSession: recent.length ? chin / recent.length : 0,
  }
}

/**
 * Kombo ağırlık çarpanı: az kullandığın vuruş türü (%15 altı) ya da el (%35 altı) içeren kombolar
 * daha sık gelir. En fazla ×2. Veri yoksa ×1.
 */
export function habitBoost(moves: Move[], stance: Stance, h: Habits): number {
  let boost = 1
  const steps = expectedSteps(moves, stance)
  const kinds = new Set(steps.filter((s) => s.kind === 'punch').map((s) => s.punch!))
  const sides = new Set(steps.filter((s) => s.kind === 'punch' && s.side).map((s) => s.side!))
  if (h.kindShare) for (const k of kinds) if (h.kindShare[k] < 0.15) boost += 0.5
  if (h.sideShare) for (const sd of sides) if (h.sideShare[sd] < 0.35) boost += 0.5
  return Math.min(2, boost)
}

/** İpucu odağı: hocanın düzeltmesi yoksa kameranın en sık gördüğü sorun. */
export function suggestedFocus(h: Habits): 'guardUp' | 'chinDown' | null {
  if (h.guardDropsPerSession >= 4) return 'guardUp'
  if (h.chinUpsPerSession >= 3) return 'chinDown'
  return null
}
