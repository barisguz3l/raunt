import { describe, expect, it } from 'vitest'
import { huntScore, isHit, makeTarget } from './hunt'
import { LM, type P3, type Pose } from './pose'

function pose(wrists: { l?: [number, number]; r?: [number, number] } = {}): Pose {
  const img: P3[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, v: 1 }))
  img[LM.nose] = { x: 0.5, y: 0.25, z: 0, v: 1 }
  img[LM.lSh] = { x: 0.6, y: 0.35, z: 0, v: 1 } // kişinin solu görüntünün sağında
  img[LM.rSh] = { x: 0.4, y: 0.35, z: 0, v: 1 }
  if (wrists.l) img[LM.lWr] = { x: wrists.l[0], y: wrists.l[1], z: 0, v: 1 }
  if (wrists.r) img[LM.rWr] = { x: wrists.r[0], y: wrists.r[1], z: 0, v: 1 }
  return { img, world: img }
}

describe('Lapa avı', () => {
  it('sol el hedefi aynada yüzün solunda, sağ el hedefi sağında çıkar', () => {
    const p = pose()
    const left = makeTarget(1, p, 0, () => 0.1) // rand < 0,5 → sol el
    const right = makeTarget(2, p, 0, () => 0.9)
    expect(left.hand).toBe('left')
    expect(left.x).toBeLessThan(0.5)
    expect(right.hand).toBe('right')
    expect(right.x).toBeGreaterThan(0.5)
  })

  it('isabet yalnızca doğru elle', () => {
    const p = pose()
    const t = makeTarget(1, p, 0, () => 0.1)
    // Ekran x = 1 − görüntü x: hedefin üstüne sol bileği koy
    expect(isHit(t, pose({ l: [1 - t.x, t.y] }))).toBe(true)
    expect(isHit(t, pose({ r: [1 - t.x, t.y], l: [0.9, 0.9] }))).toBe(false)
  })

  it('skor isabeti ve hızı ödüllendirir', () => {
    expect(huntScore({ hits: 10, misses: 0, reactionsMs: [500] })).toBeGreaterThan(huntScore({ hits: 10, misses: 0, reactionsMs: [900] }))
    expect(huntScore({ hits: 10, misses: 2, reactionsMs: [500] })).toBeLessThan(huntScore({ hits: 10, misses: 0, reactionsMs: [500] }))
  })
})
