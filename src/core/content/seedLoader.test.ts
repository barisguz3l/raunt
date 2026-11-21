import { bundledSeed, loadBundledContent, parseSeed, SeedError, validateReferences } from './seedLoader'
import { ContentStore } from './contentStore'

describe('SeedLoader', () => {
  const content = loadBundledContent()

  it('M0 kabul: tüm seed dosyaları beklenen sayılarla yüklenir', () => {
    expect(content.moves).toHaveLength(31)
    expect(content.combos).toHaveLength(42)
    expect(content.exercises).toHaveLength(31)
    expect(content.program.days).toHaveLength(21)
    expect(content.tests).toHaveLength(7)
    expect(content.timerPresets).toHaveLength(8)
  })

  it('referans bütünlüğü: hata yok', () => {
    expect(validateReferences(content)).toEqual([])
  })

  it('kombo seviye dağılımı 16/16/10', () => {
    const byLevel = [1, 2, 3].map((l) => content.combos.filter((c) => c.level === l).length)
    expect(byLevel).toEqual([16, 16, 10])
  })

  it('hoca onayı gerektiren 4 kombo', () => {
    const codes = content.combos.filter((c) => c.requiresCoachApproval).map((c) => c.code).sort()
    expect(codes).toEqual(['1-1-2-MKR', '1-2-HKR', '1-2-MKR', '3-2-LKR-MKR'].sort())
  })

  it('pad numaraları 1-6 tam ve tekil', () => {
    const pads = content.moves.filter((m) => m.pad != null).map((m) => m.pad).sort()
    expect(pads).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('program: 3 hafta × 7 gün, 9 salon günü, 2 test günü', () => {
    const p = content.program
    expect(p.weeks).toBe(3)
    for (let w = 1; w <= 3; w++) {
      const days = p.days.filter((d) => d.week === w).map((d) => d.dayOfWeek).sort()
      expect(days).toEqual([1, 2, 3, 4, 5, 6, 7])
    }
    expect(p.days.filter((d) => d.type === 'gym')).toHaveLength(9)
    expect(p.testDays).toEqual([
      { week: 1, dayOfWeek: 2, testSet: 'baslangic' },
      { week: 3, dayOfWeek: 6, testSet: 'final' },
    ])
  })

  it('bozuk kombo referansı yakalanır', () => {
    const bad = structuredClone(content)
    bad.combos[0].steps.push({ move: 'olmayan_hareket' })
    expect(validateReferences(bad).some((e) => e.includes('olmayan_hareket'))).toBe(true)
  })

  it('bozuk egzersiz referansı yakalanır', () => {
    const bad = structuredClone(content)
    const day = bad.program.days.find((d) => d.blocks.length > 0)!
    day.blocks[0].exerciseRefs = ['yok_boyle']
    expect(validateReferences(bad).some((e) => e.includes('yok_boyle'))).toBe(true)
  })

  it('eksik dizi SeedError verir', () => {
    expect(() => parseSeed({ ...bundledSeed, moves: {} })).toThrow(SeedError)
  })
})

describe('ContentStore', () => {
  const store = new ContentStore(loadBundledContent())

  it('id ile erişim ve kombo hareketleri', () => {
    expect(store.move('jab')?.pad).toBe(1)
    const combo = store.content.combos.find((c) => c.code === '1-2-3')!
    expect(store.comboMoves(combo).map((m) => m.id)).toEqual(['jab', 'cross', 'lead_hook'])
  })

  it('program günü: Hafta 1 Salı ev günü', () => {
    const d = store.programDay(1, 2)!
    expect(d.type).not.toBe('gym')
  })
})
