// Lapa avı oyun mantığı (saf, testli): hedef üretimi, isabet kontrolü, skor.

import { LM, shoulderWidth, toScreen, type Pose, type Side } from './pose'

export interface HuntTarget {
  id: number
  /** Ekran (aynalı) 0..1 */
  x: number
  y: number
  /** Hangi el vurmalı (kişinin kendi eli) */
  hand: Side
  bornAt: number
  /** Yarıçap, ekran genişliği cinsinden */
  r: number
}

export interface HuntResult {
  hits: number
  misses: number
  reactionsMs: number[]
}

export const HUNT = { lifeSec: 2.4, gapSec: 0.35, durationSec: 60 }

/**
 * Yeni hedef: yüzün çevresinde, elin kendi tarafında (aynada sol el ekranın solunda).
 * Kafa hizasından göğse kadar; omuz genişliğinin 0,6–1,4 katı yanda.
 */
/** object-fit: cover ile ekranda görünen video bölgesi (0..1). */
export function visibleBounds(videoW: number, videoH: number, boxW: number, boxH: number) {
  const va = videoW / videoH
  const ba = boxW / boxH
  if (!videoW || !videoH || !boxW || !boxH) return { x0: 0, x1: 1, y0: 0, y1: 1 }
  if (va > ba) {
    const f = ba / va // yatay kırpma
    return { x0: 0.5 - f / 2, x1: 0.5 + f / 2, y0: 0, y1: 1 }
  }
  const f = va / ba
  return { x0: 0, x1: 1, y0: 0.5 - f / 2, y1: 0.5 + f / 2 }
}

export function makeTarget(
  id: number,
  pose: Pose,
  t: number,
  rand: () => number,
  bounds = { x0: 0, x1: 1, y0: 0, y1: 1 },
): HuntTarget {
  const nose = toScreen(pose.img[LM.nose])
  const sw = shoulderWidth(pose.img)
  const hand: Side = rand() < 0.5 ? 'left' : 'right'
  // Aynada kişinin solu ekranın solunda
  const dir = hand === 'left' ? -1 : 1
  const mx = (bounds.x1 - bounds.x0) * 0.1
  const my = (bounds.y1 - bounds.y0) * 0.08
  const x = clamp(nose.x + dir * sw * (0.6 + rand() * 0.8), bounds.x0 + mx, bounds.x1 - mx)
  const y = clamp(nose.y + sw * (-0.3 + rand() * 1.1), bounds.y0 + my, bounds.y1 - my)
  return { id, x, y, hand, bornAt: t, r: Math.max(0.05, sw * 0.32) }
}

/** Doğru el hedefin içinde mi (bilek, ekran koordinatı). */
export function isHit(target: HuntTarget, pose: Pose): boolean {
  const wr = toScreen(pose.img[target.hand === 'left' ? LM.lWr : LM.rWr])
  if ((pose.img[target.hand === 'left' ? LM.lWr : LM.rWr].v ?? 1) < 0.4) return false
  return Math.hypot(wr.x - target.x, wr.y - target.y) <= target.r
}

export const avgMs = (r: HuntResult) => (r.reactionsMs.length ? Math.round(r.reactionsMs.reduce((a, b) => a + b, 0) / r.reactionsMs.length) : null)

/** Skor: isabet × 100 − ortalama tepki (ms)/10, en az 0. Hız ve isabet birlikte ödüllendirilir. */
export function huntScore(r: HuntResult): number {
  const avg = avgMs(r) ?? 0
  return Math.max(0, Math.round(r.hits * 100 - avg / 10 - r.misses * 20))
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
