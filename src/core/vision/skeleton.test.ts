import { describe, expect, it } from 'vitest'
import { LM, type P3, type Pose } from './pose'
import { normalizeFrame, similarity, SK_JOINTS, type SkeletonClip } from './skeleton'

function pose(scale: number, dx: number): Pose {
  const img: P3[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, v: 1 }))
  const put = (i: number, x: number, y: number) => (img[i] = { x: 0.5 + dx + x * scale, y: 0.4 + y * scale, z: 0, v: 1 })
  put(LM.nose, 0, -0.15)
  put(LM.lSh, 0.1, 0)
  put(LM.rSh, -0.1, 0)
  put(LM.lWr, 0.05, -0.1)
  put(LM.rWr, -0.05, -0.1)
  put(LM.lEl, 0.12, 0.1)
  put(LM.rEl, -0.12, 0.1)
  put(LM.lHip, 0.07, 0.3)
  put(LM.rHip, -0.07, 0.3)
  put(LM.lKnee, 0.08, 0.5)
  put(LM.rKnee, -0.08, 0.5)
  put(LM.lAnk, 0.09, 0.7)
  put(LM.rAnk, -0.09, 0.7)
  return { img, world: img }
}

const clip = (frames: number[][]): SkeletonClip => ({ id: 'x', date: '', fps: 20, frames })

describe('İskelet kaydı', () => {
  it('uzaklık ve konumdan bağımsız: yakın/uzak, sol/sağ aynı kare', () => {
    const a = normalizeFrame(pose(1, 0))
    const b = normalizeFrame(pose(0.5, 0.15))
    expect(a).toHaveLength(SK_JOINTS.length * 2)
    a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 2))
  })

  it('aynalı: kişinin sol omzu ekranda solda (x < 0)', () => {
    const f = normalizeFrame(pose(1, 0))
    expect(f[2]).toBeLessThan(0) // sol omuz x
    expect(f[4]).toBeGreaterThan(0) // sağ omuz x
  })

  it('aynı hareket benzerlik ≈ 100, farklı hareket daha düşük', () => {
    const f = normalizeFrame(pose(1, 0))
    const g = [...f]
    g[10] += 1.2 // sol bilek çok farklı
    expect(similarity(clip([f, f]), clip([f, f]))).toBe(100)
    expect(similarity(clip([f, f]), clip([g, g]))).toBeLessThan(80)
  })
})
