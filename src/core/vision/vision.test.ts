import { describe, expect, it } from 'vitest'
import { getContentStore } from '../content/contentStore'
import { armExtension, kickHeight, LM, type P3, type Pose } from './pose'
import { PoseTracker, type VisionEvent } from './tracker'
import { expectedSteps, fatiguePct, kickLevel, limbSide, matchCombo } from './matching'

// ---- Sentetik duruş: önden bakan, gardda bir kişi.
// img: görüntü (aynalanmamış: kişinin SOLU görüntünün SAĞINDA, x büyük).
// world: metre, kalça merkezli, y aşağı, z kameraya doğru küçük.
type Over = Partial<Record<number, { img?: Partial<P3>; world?: Partial<P3> }>>

function basePose(): Pose {
  const img: P3[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, v: 1 }))
  const world: P3[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, v: 1 }))
  const set = (i: number, ix: number, iy: number, wx: number, wy: number, wz = 0) => {
    img[i] = { x: ix, y: iy, z: 0, v: 1 }
    world[i] = { x: wx, y: wy, z: wz, v: 1 }
  }
  set(LM.nose, 0.5, 0.22, 0, -0.62)
  set(LM.lEar, 0.535, 0.2, 0.07, -0.64)
  set(LM.rEar, 0.465, 0.2, -0.07, -0.64)
  set(LM.lSh, 0.6, 0.33, 0.17, -0.45)
  set(LM.rSh, 0.4, 0.33, -0.17, -0.45)
  // gard: dirsekler aşağıda, bilekler çene önünde
  set(LM.lEl, 0.6, 0.43, 0.19, -0.2, -0.05)
  set(LM.rEl, 0.4, 0.43, -0.19, -0.2, -0.05)
  set(LM.lWr, 0.54, 0.25, 0.08, -0.5, -0.2)
  set(LM.rWr, 0.46, 0.25, -0.08, -0.5, -0.2)
  set(LM.lHip, 0.56, 0.6, 0.1, 0)
  set(LM.rHip, 0.44, 0.6, -0.1, 0)
  set(LM.lKnee, 0.57, 0.76, 0.11, 0.42)
  set(LM.rKnee, 0.43, 0.76, -0.11, 0.42)
  set(LM.lAnk, 0.58, 0.92, 0.12, 0.84, -0.15) // sol ayak önde
  set(LM.rAnk, 0.42, 0.92, -0.12, 0.84, 0.1)
  return { img, world }
}

function pose(over: Over = {}): Pose {
  const p = basePose()
  for (const [k, v] of Object.entries(over)) {
    const i = Number(k)
    if (v?.img) p.img[i] = { ...p.img[i], ...v.img }
    if (v?.world) p.world[i] = { ...p.world[i], ...v.world }
  }
  return p
}

/** Sol direkt: dirsek ve bilek omuz hizasında öne uzanır. */
const leftJab = (k: number): Over => ({
  [LM.lEl]: { world: { x: 0.17, y: -0.45, z: -0.29 * k }, img: { x: 0.6, y: 0.33 } },
  [LM.lWr]: { world: { x: 0.17, y: -0.45, z: -0.62 * k }, img: { x: 0.6 - 0.02 * k, y: 0.33 } },
})
const rightJab = (k: number): Over => ({
  [LM.rEl]: { world: { x: -0.17, y: -0.45, z: -0.29 * k }, img: { x: 0.4, y: 0.33 } },
  [LM.rWr]: { world: { x: -0.17, y: -0.45, z: -0.62 * k }, img: { x: 0.4 + 0.02 * k, y: 0.33 } },
})

function run(frames: [number, Pose][]): VisionEvent[] {
  const tr = new PoseTracker()
  return frames.flatMap(([t, p]) => tr.update(t, p))
}

/** 3 sn sakin duruş (kalibrasyon), ardından verilen kareler. */
function withCalib(extra: [number, Pose][]): [number, Pose][] {
  const calm: [number, Pose][] = Array.from({ length: 31 }, (_, i) => [i * 0.1, pose()])
  return [...calm, ...extra.map(([t, p]) => [t + 3.1, p] as [number, Pose])]
}

describe('Duruş ölçümleri', () => {
  it('gardda kol açılması düşük, direkte ≈ 1', () => {
    expect(armExtension(pose().world, 'left')).toBeLessThan(0.68)
    expect(armExtension(pose(leftJab(1)).world, 'left')).toBeGreaterThan(0.95)
  })

  it('tekme yüksekliği: yerde ≈ 0, kalça hizası ≈ 1', () => {
    expect(kickHeight(pose().world, 'right')).toBeLessThan(0.1)
    const mid = pose({ [LM.rAnk]: { world: { x: -0.7, y: 0, z: 0 } }, [LM.rKnee]: { world: { x: -0.35, y: 0, z: 0 } } })
    expect(kickHeight(mid.world, 'right')).toBeGreaterThan(0.9)
    expect(kickLevel(0.6)).toBe('low')
    expect(kickLevel(1)).toBe('mid')
    expect(kickLevel(1.4)).toBe('high')
  })
})

describe('Olay takibi', () => {
  it('sol direkt algılanır (taraf, tür, hız) ve gard dönüşü ölçülür', () => {
    const ev = run(
      withCalib([
        [0, pose()],
        [0.05, pose(leftJab(0.5))],
        [0.1, pose(leftJab(1))],
        [0.15, pose(leftJab(1))],
        [0.4, pose()],
      ]),
    )
    const p = ev.find((e) => e.type === 'punch')
    expect(p).toMatchObject({ type: 'punch', side: 'left', kind: 'straight' })
    expect(p && p.type === 'punch' && p.speed).toBeGreaterThan(1.1)
    expect(ev.some((e) => e.type === 'returned' && e.side === 'left')).toBe(true)
  })

  it('1-2: önce sol, sonra sağ direkt sırayla algılanır', () => {
    const ev = run(
      withCalib([
        [0, pose()],
        [0.1, pose(leftJab(1))],
        [0.3, pose()],
        [0.4, pose(rightJab(1))],
        [0.6, pose()],
      ]),
    )
    expect(ev.filter((e) => e.type === 'punch').map((e) => (e.type === 'punch' ? e.side : ''))).toEqual(['left', 'right'])
  })

  it('sol kroşe: kol bükük, bilek hızla yana → kroşe', () => {
    // Dirsek omuz hizasına kalkar, bilek yüzün önünden yana savrulur (kol ≈ 90°)
    const hook = (k: number): Over => ({
      [LM.lEl]: { world: { x: 0.42, y: -0.45, z: -0.1 }, img: { x: 0.72, y: 0.33 } },
      [LM.lWr]: { world: { x: 0.42 - 0.3 * k, y: -0.45, z: -0.35 }, img: { x: 0.68 - 0.2 * k, y: 0.3 } },
    })
    const ev = run(withCalib([[0, pose()], [0.05, pose(hook(0))], [0.1, pose(hook(1))], [0.4, pose()]]))
    expect(ev.find((e) => e.type === 'punch')).toMatchObject({ side: 'left', kind: 'hook' })
  })

  it('kol açık kaldıkça ikinci yumruk sayılmaz', () => {
    const ev = run(withCalib([[0, pose()], [0.1, pose(leftJab(1))], [0.2, pose(leftJab(1))], [0.3, pose(leftJab(1))]]))
    expect(ev.filter((e) => e.type === 'punch')).toHaveLength(1)
  })

  it('gard 1 sn aşağıda kalınca uyarı, yumruk sırasında uyarı yok', () => {
    const lowL: Over = { [LM.lWr]: { img: { x: 0.62, y: 0.55 }, world: { x: 0.2, y: -0.05, z: -0.05 } } }
    const ev = run(withCalib([[0, pose(lowL)], [0.5, pose(lowL)], [1.1, pose(lowL)]]))
    expect(ev.some((e) => e.type === 'guardDown' && e.side === 'left')).toBe(true)
  })

  it('kalibrasyondan sonra çene kalkması ve kafa kaçırma', () => {
    const chin: Over = { [LM.nose]: { img: { x: 0.5, y: 0.17 } } }
    const ev1 = run(withCalib([[0, pose(chin)]]))
    expect(ev1.some((e) => e.type === 'chinUp')).toBe(true)
    // Kişi kendi soluna kaçar → görüntüde burun sağa (x büyür)
    const slip: Over = { [LM.nose]: { img: { x: 0.58, y: 0.24 } } }
    const ev2 = run(withCalib([[0, pose(slip)]]))
    expect(ev2.find((e) => e.type === 'slip')).toMatchObject({ dir: 'left' })
  })

  it('arka ayak tekmesi yüksekliğiyle algılanır', () => {
    const up = (h: number): Over => ({ [LM.rAnk]: { world: { x: -0.84 * h, y: 0.84 - 0.84 * h * 1.1, z: 0 } } })
    const ev = run(withCalib([[0, pose(up(0.6))], [0.1, pose(up(1))], [0.2, pose(up(0.2))], [0.3, pose()]]))
    const k = ev.find((e) => e.type === 'kick')
    expect(k).toMatchObject({ side: 'right' })
  })
})

describe('Kombo eşleştirme', () => {
  const store = getContentStore()
  const moves = (code: string) => store.comboMoves(store.content.combos.find((c) => c.code === code)!)

  it('normal duruşta ön el sol, solak duruşta sağ', () => {
    expect(limbSide('lead', 'orthodox')).toBe('left')
    expect(limbSide('lead', 'southpaw')).toBe('right')
  })

  it('1-2 sırayla algılanınca tamam; ters elle başlayınca "diğer el"', () => {
    const steps = expectedSteps(moves('1-2'), 'orthodox')
    const p = (side: 'left' | 'right', t: number): VisionEvent => ({ type: 'punch', t, side, kind: 'straight', speed: 2 })
    expect(matchCombo(steps, [p('left', 1), p('right', 1.3)])).toMatchObject({ matched: 2, complete: true, wrongHand: false })
    expect(matchCombo(steps, [p('right', 1), p('left', 1.3)])).toMatchObject({ complete: false, wrongHand: true })
  })

  it('yorgunluk yüzdesi', () => {
    expect(fatiguePct([3, 2.7, 2.4])).toBe(80)
    expect(fatiguePct([3])).toBeNull()
  })
})
