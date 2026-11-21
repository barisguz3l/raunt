// Duruş verisi ve temel ölçümler (MediaPipe Pose, 33 nokta). Saf TS, kameradan bağımsız, birim testli.
//
// İki koordinat takımı:
//   img   — görüntüye göre 0..1 (x sağa, y aşağı). Kamera görüntüsü AYNALANMAMIŞ: kişinin solu görüntünün sağında.
//   world — kalça merkezli, metre (x sağa, y aşağı, z kameraya doğru küçülür).
// "left/right" her zaman KİŞİNİN kendi sol/sağı (MediaPipe ile aynı).

export interface P3 {
  x: number
  y: number
  z: number
  /** görünürlük 0..1 */
  v?: number
}

export interface Pose {
  img: P3[]
  world: P3[]
}

export type Side = 'left' | 'right'

export const LM = {
  nose: 0,
  lEar: 7,
  rEar: 8,
  lSh: 11,
  rSh: 12,
  lEl: 13,
  rEl: 14,
  lWr: 15,
  rWr: 16,
  lHip: 23,
  rHip: 24,
  lKnee: 25,
  rKnee: 26,
  lAnk: 27,
  rAnk: 28,
} as const

export const sideIdx = (side: Side) =>
  side === 'left'
    ? { sh: LM.lSh, el: LM.lEl, wr: LM.lWr, hip: LM.lHip, knee: LM.lKnee, ank: LM.lAnk }
    : { sh: LM.rSh, el: LM.rEl, wr: LM.rWr, hip: LM.rHip, knee: LM.rKnee, ank: LM.rAnk }

export const dist = (a: P3, b: P3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
export const dist2 = (a: P3, b: P3) => Math.hypot(a.x - b.x, a.y - b.y)
const mid = (a: P3, b: P3): P3 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 })

/** Görüntüde omuz genişliği (ölçek birimi). */
export const shoulderWidth = (img: P3[]) => Math.max(1e-3, dist2(img[LM.lSh], img[LM.rSh]))

export const visible = (p: Pose, idx: number[], min = 0.5) => idx.every((i) => (p.img[i]?.v ?? 1) >= min)

/** Kol açılması: omuz–bilek / (üst kol + ön kol), 3B (dünya). Düz kol ≈ 1, gard ≈ 0,4–0,6. */
export function armExtension(world: P3[], side: Side): number {
  const s = sideIdx(side)
  const len = dist(world[s.sh], world[s.el]) + dist(world[s.el], world[s.wr])
  return len > 0 ? dist(world[s.sh], world[s.wr]) / len : 0
}

/** Dirsek açısı (derece): 180 düz, 90 bükülü. */
export function elbowAngle(world: P3[], side: Side): number {
  const s = sideIdx(side)
  const a = world[s.sh]
  const b = world[s.el]
  const c = world[s.wr]
  const v1 = [a.x - b.x, a.y - b.y, a.z - b.z]
  const v2 = [c.x - b.x, c.y - b.y, c.z - b.z]
  const dot = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]
  const n = Math.hypot(...v1) * Math.hypot(...v2)
  return n > 0 ? (Math.acos(Math.max(-1, Math.min(1, dot / n))) * 180) / Math.PI : 180
}

/** El gardda mı: bilek omuz çizgisinin üstünde (görüntüde), yüzden çok uzak değil. */
export function handUp(img: P3[], side: Side): boolean {
  const s = sideIdx(side)
  const sw = shoulderWidth(img)
  const shY = (img[LM.lSh].y + img[LM.rSh].y) / 2
  // Eldiven çenedeyken bilek eldivenin altında kalır (gerçek fotoğrafla ayarlandı)
  return img[s.wr].y < shY + 0.4 * sw
}

/** Gard düşük: en az bir el omuz çizgisinin belirgin altında. */
export function guardDown(img: P3[]): { left: boolean; right: boolean } {
  return { left: !handUp(img, 'left'), right: !handUp(img, 'right') }
}

/** Baş eğimi ölçüsü: (burun.y − kulak ortası.y) / omuz genişliği. Çene kalkınca küçülür. */
export function headPitch(img: P3[]): number {
  const ears = mid(img[LM.lEar], img[LM.rEar])
  return (img[LM.nose].y - ears.y) / shoulderWidth(img)
}

/** Baş, kalça merkezine göre yanda (görüntü x, omuz genişliği cinsinden). Kafa kaçırmada büyür. */
export function headOffset(img: P3[]): number {
  const hips = mid(img[LM.lHip], img[LM.rHip])
  return (img[LM.nose].x - hips.x) / shoulderWidth(img)
}

/** Tekme yüksekliği: 0 = ayak yerde, 1 = kalça hizası, >1,3 ≈ baş. Dünya koordinatı. */
export function kickHeight(world: P3[], side: Side): number {
  const s = sideIdx(side)
  const legLen = dist(world[s.hip], world[s.knee]) + dist(world[s.knee], world[s.ank])
  if (legLen <= 0) return 0
  return (world[s.hip].y + legLen - world[s.ank].y) / legLen
}

/** Diz yüksekliği: diz kalçaya ne kadar yaklaştı (0 ayakta, 1 kalça hizası). */
export function kneeHeight(world: P3[], side: Side): number {
  const s = sideIdx(side)
  const thigh = dist(world[s.hip], world[s.knee])
  if (thigh <= 0) return 0
  return (world[s.hip].y + thigh - world[s.knee].y) / thigh
}

/** Öndeki ayak (kameraya daha yakın, dünya z küçük). Fark küçükse belirsiz. */
export function leadFoot(world: P3[]): Side | null {
  const d = world[LM.lAnk].z - world[LM.rAnk].z
  if (Math.abs(d) < 0.08) return null
  return d < 0 ? 'left' : 'right'
}

/** Ayak açıklığı / omuz genişliği (dünya). Duruşta ≈ 1–1,5. */
export function stanceWidth(world: P3[]): number {
  const sw = Math.max(1e-3, dist(world[LM.lSh], world[LM.rSh]))
  return dist(world[LM.lAnk], world[LM.rAnk]) / sw
}

/** Ekranda (aynalı görüntü) bir noktanın konumu: 0..1. */
export const toScreen = (p: P3) => ({ x: 1 - p.x, y: p.y })
