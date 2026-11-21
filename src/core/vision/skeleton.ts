// İskelet kaydı: video yerine 13 eklemin konumu (yüz yok, çok küçük yer). Saf, testli.

import { LM, toScreen, type Pose } from './pose'

/** Kaydedilen eklemler (sırası önemli). */
export const SK_JOINTS = [LM.nose, LM.lSh, LM.rSh, LM.lEl, LM.rEl, LM.lWr, LM.rWr, LM.lHip, LM.rHip, LM.lKnee, LM.rKnee, LM.lAnk, LM.rAnk] as const

/** Çizim için kemikler: SK_JOINTS içindeki sıra numaraları. */
export const SK_BONES: [number, number][] = [
  [1, 2],
  [1, 3],
  [3, 5],
  [2, 4],
  [4, 6],
  [1, 7],
  [2, 8],
  [7, 8],
  [7, 9],
  [9, 11],
  [8, 10],
  [10, 12],
]

export interface SkeletonClip {
  id: string
  date: string
  fps: number
  /** Her kare: [x0, y0, x1, y1, …] — omuz ortası merkez, omuz genişliği = 1, ekran (aynalı) yönünde */
  frames: number[][]
}

/** Bir kareyi boyut ve konumdan bağımsız hale getirir (uzak/yakın durman fark etmesin). */
export function normalizeFrame(pose: Pose): number[] {
  const pts = SK_JOINTS.map((i) => toScreen(pose.img[i]))
  const ls = pts[1]
  const rs = pts[2]
  const cx = (ls.x + rs.x) / 2
  const cy = (ls.y + rs.y) / 2
  const sw = Math.max(1e-3, Math.hypot(ls.x - rs.x, ls.y - rs.y))
  return pts.flatMap((p) => [round((p.x - cx) / sw), round((p.y - cy) / sw)])
}

const round = (v: number) => Math.round(v * 1000) / 1000

/** Kareyi çizim kutusuna yerleştir: omuz ortası (cx, cy), omuz genişliği `scale` px. */
export function framePoints(frame: number[], cx: number, cy: number, scale: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  for (let i = 0; i < frame.length; i += 2) out.push({ x: cx + frame[i] * scale, y: cy + frame[i + 1] * scale })
  return out
}

/**
 * İki kaydın kabaca benzerliği (0–100): bilek yollarının ortalama farkı. Süre farkı yeniden örneklemeyle giderilir.
 * Teknik puan değildir; "geçen haftaya göre ne kadar değişti" göstergesi.
 */
export function similarity(a: SkeletonClip, b: SkeletonClip): number {
  const n = 30
  const sample = (c: SkeletonClip, k: number) => c.frames[Math.min(c.frames.length - 1, Math.round((k / (n - 1)) * (c.frames.length - 1)))]
  let sum = 0
  for (let k = 0; k < n; k++) {
    const fa = sample(a, k)
    const fb = sample(b, k)
    if (!fa || !fb) continue
    for (const j of [5, 6]) sum += Math.hypot(fa[j * 2] - fb[j * 2], fa[j * 2 + 1] - fb[j * 2 + 1])
  }
  const avg = sum / (n * 2)
  return Math.max(0, Math.round(100 - avg * 60))
}
