// Kalori tahmini (MET, spec §6.8), beslenme/su planlayıcı (§2.14), test karşılaştırma.

import type { SessionKind } from './records'

/** 2024 Adult Compendium of Physical Activities'ten başlangıç değerleri (spec §6.8). */
export const MET: Record<SessionKind, number> = {
  timer: 7.3, // kickboks
  combo: 9.3, // boks, simüle raunt (gölge)
  shadow: 9.3,
  bag: 5.8, // torba
  reflex: 7.3,
  pad: 7.8,
  routine: 4.0, // ısınma/esneme/kondisyon karışık
  gym: 7.3,
  walk: 3.0,
}

/** kcal = MET × kg × saat; RPE ≤ 4 ×0,8, ≥ 8 ×1,1; ±%15 aralık olarak. */
export function estimateKcal(kind: SessionKind, weightKg: number, workSec: number, rpe?: number): { low: number; high: number } {
  const factor = rpe == null ? 1 : rpe <= 4 ? 0.8 : rpe >= 8 ? 1.1 : 1
  const mid = MET[kind] * weightKg * (workSec / 3600) * factor
  return { low: Math.round(mid * 0.85), high: Math.round(mid * 1.15) }
}

/** "HH:MM" ± dakika. */
export function shiftTime(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number)
  let t = h * 60 + m + minutes
  t = ((t % 1440) + 1440) % 1440
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

export interface NutritionPlan {
  /** Karbonhidratlı öğle: antrenmandan 3 – 2,5 saat önce */
  lunchFrom: string
  lunchUntil: string
  /** 500 ml su: antrenmandan 1 saat önce */
  waterBefore: string
  /** Proteinli akşam: antrenman bitişinden en geç 1 saat sonra */
  dinnerUntil: string
}

export function nutritionPlan(trainingStart: string, durationMin: number): NutritionPlan {
  return {
    lunchFrom: shiftTime(trainingStart, -180),
    lunchUntil: shiftTime(trainingStart, -150),
    waterBefore: shiftTime(trainingStart, -60),
    dinnerUntil: shiftTime(trainingStart, durationMin + 60),
  }
}

/** Test karşılaştırması: fark ve yüzde; "düşük daha iyi" testlerde işaret ters yorumlanır. */
export function compareTest(first: number, last: number, higherIsBetter: boolean | null) {
  const diff = Math.round((last - first) * 10) / 10
  const pct = first !== 0 ? Math.round(((last - first) / Math.abs(first)) * 100) : null
  const improved = higherIsBetter == null ? null : higherIsBetter ? diff > 0 : diff < 0
  return { diff, pct, improved }
}

export function formatDiff(diff: number, pct: number | null): string {
  const sign = diff > 0 ? '+' : ''
  return pct == null ? `${sign}${diff}` : `${sign}${diff} (${pct > 0 ? '+' : ''}%${pct})`
}
