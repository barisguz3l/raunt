import { buildTimeline, clampConfig, formatClock, segmentAt, workSeconds } from './timeline'

// Spec M1 kabul (1): 3 raunt × 2 dk, 30 sn dinlenme, 10 sn hazırlık, 10 sn uyarı
const spec = { prepSec: 10, rounds: 3, roundSec: 120, warnSec: 10, restSec: 30 }

describe('TimelineBuilder', () => {
  const tl = buildTimeline(spec)

  it('toplam süre = hazırlık + 3×raunt + 2×dinlenme (son rauntta dinlenme yok)', () => {
    expect(tl.totalSec).toBe(10 + 3 * 120 + 2 * 30)
    expect(workSeconds(spec)).toBe(360)
  })

  it('faz sırası ve süreleri', () => {
    expect(tl.segments.map((s) => [s.phase, s.round, s.start, s.end])).toEqual([
      ['prep', 1, 0, 10],
      ['round', 1, 10, 120],
      ['warn', 1, 120, 130],
      ['rest', 1, 130, 160],
      ['round', 2, 160, 270],
      ['warn', 2, 270, 280],
      ['rest', 2, 280, 310],
      ['round', 3, 310, 420],
      ['warn', 3, 420, 430],
    ])
  })

  it('zil olayları doğru anlarda', () => {
    const bells = tl.cues.filter((c) => c.type === 'bell').map((c) => [c.t, c.type === 'bell' && c.sound])
    expect(bells).toEqual([
      [7, 'tick'], [8, 'tick'], [9, 'tick'],
      [10, 'roundStart'],
      [120, 'warn'],
      [130, 'roundEnd'],
      [157, 'tick'], [158, 'tick'], [159, 'tick'],
      [160, 'roundStart'],
      [270, 'warn'],
      [280, 'roundEnd'],
      [307, 'tick'], [308, 'tick'], [309, 'tick'],
      [310, 'roundStart'],
      [420, 'warn'],
      [430, 'finish'],
    ])
  })

  it('aynı anda faz olayı zilden önce gelir', () => {
    const at10 = tl.cues.filter((c) => c.t === 10)
    expect(at10[0].type).toBe('phase')
  })

  it('segmentAt sınırlarda bir sonraki fazı verir', () => {
    expect(segmentAt(tl, 9.99)?.phase).toBe('prep')
    expect(segmentAt(tl, 10)?.phase).toBe('round')
    expect(segmentAt(tl, 430)).toBeUndefined()
  })

  it('hazırlık ve uyarı 0 olabilir; tek raunt', () => {
    const t = buildTimeline({ prepSec: 0, rounds: 1, roundSec: 30, warnSec: 0, restSec: 60 })
    expect(t.segments).toEqual([{ phase: 'round', round: 1, start: 0, end: 30 }])
    expect(t.totalSec).toBe(30)
  })

  it('sınırlar uygulanır (spec F-101)', () => {
    expect(clampConfig({ prepSec: 99, rounds: 50, roundSec: 5, warnSec: 30, restSec: 999 })).toEqual({
      prepSec: 60, rounds: 30, roundSec: 10, warnSec: 9, restSec: 300,
    })
  })

  it('formatClock yukarı yuvarlar', () => {
    expect(formatClock(120)).toBe('02:00')
    expect(formatClock(119.2)).toBe('02:00')
    expect(formatClock(0.4)).toBe('00:01')
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(1800)).toBe('30:00')
  })
})

describe('Rutin: raunt başına süre ve etiket', () => {
  it('her hareket kendi süresiyle, uyarı kısa raunda sığar', () => {
    const tl = buildTimeline({ prepSec: 5, rounds: 3, roundSec: 30, warnSec: 5, restSec: 10, roundSecs: [20, 45, 8], labels: ['A', 'B', 'C'] })
    expect(tl.totalSec).toBe(5 + 20 + 10 + 45 + 10 + 8)
    expect(tl.config.labels).toEqual(['A', 'B', 'C'])
    const r3 = tl.segments.filter((s) => s.round === 3 && (s.phase === 'round' || s.phase === 'warn'))
    expect(r3[0].start).toBe(5 + 20 + 10 + 45 + 10)
    expect(r3[r3.length - 1].end).toBe(tl.totalSec)
    expect(workSeconds({ prepSec: 0, rounds: 2, roundSec: 30, warnSec: 0, restSec: 0, roundSecs: [10, 50] })).toBe(60)
  })
})
