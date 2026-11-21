import { compareTest, estimateKcal, formatDiff, nutritionPlan, shiftTime } from './health'
import { buildIcs } from './ics'
import type { SessionLog } from './records'
import { activityByDay, hardDaysInRow, loadSpike, weekStart, weeklyStreak, weeklySummaries } from './stats'

const s = (day: string, min: number, rpe = 6): SessionLog => ({
  id: day + min,
  startedAt: day + 'T18:00:00Z',
  endedAt: day + 'T19:00:00Z',
  day,
  kind: 'combo',
  title: 't',
  totalSec: min * 60,
  workSec: min * 60,
  rounds: 3,
  calls: 10,
  rpe,
})

describe('İlerleme hesapları', () => {
  it('hafta başı Pazartesi', () => {
    expect(weekStart('2026-11-19')).toBe('2026-11-16')
    expect(weekStart('2026-11-16')).toBe('2026-11-16')
    expect(weekStart('2026-11-22')).toBe('2026-11-16')
  })

  it('sRPE yükü = RPE × dakika; ders günlüğü de sayılır', () => {
    const m = activityByDay([s('2026-11-17', 40, 6)], [{ id: 'j', date: '2026-11-16', learned: '', correction: '', soreness: 3, repeatTomorrow: '', minutes: 60, rpe: 7 }])
    expect(m.get('2026-11-17')!.load).toBe(240)
    expect(m.get('2026-11-16')!.load).toBe(420)
  })

  it('haftalık özet ve seri (bu hafta henüz bitmedi → seriyi bozmaz)', () => {
    const sessions = [
      ...['2026-11-02', '2026-11-04', '2026-11-06'].map((d) => s(d, 30)),
      ...['2026-11-09', '2026-11-11', '2026-11-13'].map((d) => s(d, 30)),
      s('2026-11-17', 30),
    ]
    const byDay = activityByDay(sessions)
    const w = weeklySummaries(byDay, '2026-11-19', 3)
    expect(w.map((x) => x.sessions)).toEqual([3, 3, 1])
    expect(weeklyStreak(byDay, '2026-11-19', 3).streak).toBe(2)
  })

  it('donma hakkı: bir kaçırılan hafta seriyi bozmaz, iki kaçırma bozar', () => {
    const weeksOk = ['2026-10-05', '2026-10-12', '2026-10-26', '2026-11-02'] // 19 Ekim kaçırıldı
    const sessions = weeksOk.flatMap((w) => [0, 2, 4].map((d) => s(new Date(Date.parse(w) + d * 864e5).toISOString().slice(0, 10), 30)))
    const r = weeklyStreak(activityByDay(sessions), '2026-11-09', 3)
    expect(r.freezesUsed).toBe(1)
    expect(r.streak).toBe(4)
  })

  it('ani yük artışı uyarısı (> 1,5×) — yüzde risk değil', () => {
    const weeks = [100, 120, 110, 100, 300].map((load, i) => ({ week: String(i), sessions: 3, minutes: 0, load }))
    expect(loadSpike(weeks).spike).toBe(true)
    expect(loadSpike(weeks.map((w) => ({ ...w, load: 100 }))).spike).toBe(false)
    expect(loadSpike(weeks.slice(-2)).spike).toBe(false)
  })

  it('arka arkaya yoğun günler', () => {
    const byDay = activityByDay(['2026-11-17', '2026-11-18', '2026-11-19'].map((d) => s(d, 60, 7)))
    expect(hardDaysInRow(byDay, '2026-11-19')).toBe(3)
  })
})

describe('Sağlık ve beslenme', () => {
  it('MET kalori aralığı (tahmini)', () => {
    // gölge boks 9,3 MET × 70 kg × 0,5 sa = 325,5 → %±15
    expect(estimateKcal('shadow', 70, 1800)).toEqual({ low: 277, high: 374 })
    expect(estimateKcal('shadow', 70, 1800, 9).high).toBeGreaterThan(374)
  })

  it('spec M8 kabul: antrenman 19:00 → öğle 16:00–16:30, su 18:00, akşam en geç 20:30 (60 dk antrenman)', () => {
    expect(nutritionPlan('19:00', 90)).toEqual({ lunchFrom: '16:00', lunchUntil: '16:30', waterBefore: '18:00', dinnerUntil: '21:30' })
    expect(shiftTime('00:30', -60)).toBe('23:30')
  })

  it('test karşılaştırma: şınav 3 → 7 = +4 (+%133); bel çevresi düşük iyi', () => {
    const c = compareTest(3, 7, true)
    expect(c).toEqual({ diff: 4, pct: 133, improved: true })
    expect(formatDiff(c.diff, c.pct)).toBe('+4 (+%133)')
    expect(compareTest(90, 87, false).improved).toBe(true)
  })

  it('.ics alarmlı etkinlik', () => {
    const ics = buildIcs([{ date: '2026-11-17', start: '19:00', minutes: 55, title: 'Raunt: Teknik', alarmBefore: 30 }], new Date(Date.UTC(2026, 10, 18)))
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('DTSTART:20261117T190000')
    expect(ics).toContain('DTEND:20261117T195500')
    expect(ics).toContain('TRIGGER:-PT30M')
    expect(ics.split('\r\n').every((l) => l.length <= 75)).toBe(true)
  })
})
