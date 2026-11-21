import { describe, expect, it } from 'vitest'
import { getContentStore } from '../../core/content/contentStore'
import { activeStep, padSpec, screenSide, ZONES } from './padLayout'

const store = getContentStore()
const mv = (id: string) => store.move(id)!

describe('PadLayout (Ek A.3)', () => {
  it('jab normal duruşta sol, solak duruşta sağ (ayna)', () => {
    const o = padSpec(mv('jab'), 'orthodox')
    const s = padSpec(mv('jab'), 'southpaw')
    expect(o).toMatchObject({ x: 0.4, y: 0.28, kind: 'left', side: 'left', label: '1' })
    expect(s.side).toBe('right')
    expect(s.x).toBeCloseTo(0.6)
  })

  it('düz sağ lapa, kroşe yana döner, aparkat aşağı bakar', () => {
    expect(padSpec(mv('cross'), 'orthodox')).toMatchObject({ side: 'right', kind: 'right' })
    expect(padSpec(mv('lead_hook'), 'orthodox')).toMatchObject({ x: ZONES['side-high'].x, rot: -75, side: 'left' })
    expect(padSpec(mv('rear_hook'), 'orthodox').rot).toBe(75)
    expect(padSpec(mv('lead_uppercut'), 'orthodox')).toMatchObject({ rot: 180, arrowUp: true })
  })

  it('tekmeler turuncu tekme lapası; alçak/orta/yüksek', () => {
    const low = padSpec(mv('low_kick_rear'), 'orthodox')
    expect([low.kind, padSpec(mv('mid_kick_rear'), 'orthodox').kind]).toEqual(['kick', 'kick'])
    expect(low.y).toBe(0.8)
    expect(padSpec(mv('mid_kick_rear'), 'orthodox').y).toBe(0.58)
    expect(padSpec(mv('high_kick_rear'), 'orthodox').y).toBe(0.26)
    expect(low.side).toBe('right')
    expect(padSpec(mv('low_kick_lead'), 'orthodox').side).toBe('left')
    expect(padSpec(mv('low_kick_rear'), 'southpaw').side).toBe('left')
  })

  it('itme tekmesi ve diz: iki lapa merkezde', () => {
    expect(padSpec(mv('teep_lead'), 'orthodox')).toMatchObject({ kind: 'both', side: 'center', x: 0.5 })
    expect(padSpec(mv('knee_rear'), 'orthodox')).toMatchObject({ kind: 'both', side: 'center' })
  })

  it('savunma kırmızı eldiven, ayak çalışması lapasız', () => {
    expect(padSpec(mv('slip'), 'orthodox').kind).toBe('defense')
    expect(padSpec(mv('step_in'), 'orthodox').kind).toBe('none')
  })

  it('tüm hareketlerin geçerli bir yerleşimi var', () => {
    for (const m of store.content.moves) {
      const p = padSpec(m, 'orthodox')
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThanOrEqual(1)
      expect(p.label.length).toBeGreaterThan(0)
    }
  })

  it('duruş eşlemesi ve etkin adım zamanlaması', () => {
    expect(screenSide('lead', 'orthodox')).toBe('left')
    expect(screenSide('rear', 'southpaw')).toBe('left')
    expect(activeStep(3, 10, 1.5, 9.9)).toBe(-1)
    expect(activeStep(3, 10, 1.5, 10.1)).toBe(0)
    expect(activeStep(3, 10, 1.5, 10.6)).toBe(1)
    expect(activeStep(3, 10, 1.5, 14)).toBe(2)
  })
})
