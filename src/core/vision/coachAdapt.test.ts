import { describe, expect, it } from 'vitest'
import { getContentStore } from '../content/contentStore'
import { habitBoost, habitsFrom, suggestedFocus } from './coachAdapt'
import { emptyStats, type VisionStats } from './matching'

const store = getContentStore()
const moves = (code: string) => store.comboMoves(store.content.combos.find((c) => c.code === code)!)

function stats(p: Partial<VisionStats>): VisionStats {
  return { ...emptyStats(), ...p }
}

describe('Davranışa göre koç', () => {
  it('az veri varken ağırlık değişmez', () => {
    const h = habitsFrom([stats({ punchKinds: { straight: 5, hook: 0, uppercut: 0 }, bySide: { left: 3, right: 2 } })])
    expect(h.kindShare).toBeNull()
    expect(habitBoost(moves('1-2-3'), 'orthodox', h)).toBe(1)
  })

  it('hiç kroşe atmayana kroşeli kombolar daha sık gelir', () => {
    const h = habitsFrom([stats({ punchKinds: { straight: 40, hook: 2, uppercut: 8 }, bySide: { left: 25, right: 25 } })])
    expect(habitBoost(moves('1-2-3'), 'orthodox', h)).toBeGreaterThan(1) // 3 = sol kroşe
    expect(habitBoost(moves('1-2'), 'orthodox', h)).toBe(1)
  })

  it('sağ eli az kullanana sağ elli kombolar; en fazla ×2', () => {
    const h = habitsFrom([stats({ punchKinds: { straight: 30, hook: 1, uppercut: 1 }, bySide: { left: 30, right: 2 } })])
    expect(habitBoost(moves('1-2-3'), 'orthodox', h)).toBe(2)
  })

  it('gard sık düşüyorsa odak "gard yukarı"', () => {
    expect(suggestedFocus(habitsFrom([stats({ guardDrops: 6 }), stats({ guardDrops: 4 })]))).toBe('guardUp')
    expect(suggestedFocus(habitsFrom([stats({ chinUps: 4 })]))).toBe('chinDown')
    expect(suggestedFocus(habitsFrom([stats({})]))).toBeNull()
  })
})
