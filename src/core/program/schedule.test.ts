import { addDays, isoWeekday, nextMonday, programPosition } from './schedule'

describe('program takvimi', () => {
  it('16 Kasım 2026 Pazartesi', () => {
    expect(isoWeekday('2026-11-16')).toBe(1)
    expect(isoWeekday('2026-11-22')).toBe(7)
  })

  it('spec M8 kabul: 16.11 başlangıçta 17.11 = Hafta 1 Salı', () => {
    expect(programPosition('2026-11-16', '2026-11-17', 3)).toEqual({ kind: 'active', week: 1, dayOfWeek: 2, dayIndex: 1 })
  })

  it('son gün ve sonrası', () => {
    expect(programPosition('2026-11-16', '2026-12-06', 3)).toMatchObject({ kind: 'active', week: 3, dayOfWeek: 7 })
    expect(programPosition('2026-11-16', '2026-12-07', 3)).toEqual({ kind: 'after', daysSinceEnd: 1 })
  })

  it('başlangıçtan önce', () => {
    expect(programPosition('2026-11-23', '2026-11-18', 3)).toEqual({ kind: 'before', daysUntilStart: 5 })
  })

  it('ay ve yıl geçişi', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
    expect(nextMonday('2026-11-18')).toBe('2026-11-23')
    expect(nextMonday('2026-11-16')).toBe('2026-11-16')
  })
})
