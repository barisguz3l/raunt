import { describe, expect, it } from 'vitest'
import { comboCallCounts, comboIdOfCall, comboWeight, daysBetween, lessonActive, mergeComboStats, sanitizeLesson, sanitizeStats } from './comboMemory'
import { buildTimeline, type CueEvent } from './timeline'
import { adjustTempo } from './tempoFeedback'

describe('Unutma eğrisi', () => {
  it('gün farkı', () => {
    expect(daysBetween('2026-11-01', '2026-11-10')).toBe(9)
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1)
    expect(daysBetween('2026-11-10', '2026-11-01')).toBe(-9)
  })

  it('ağırlık: hiç çağrılmamış 2, bugün 1, 3 günde +1, en fazla 4', () => {
    const stats = { a: { count: 5, lastDate: '2026-11-21' }, b: { count: 2, lastDate: '2026-11-18' }, c: { count: 1, lastDate: '2026-10-01' } }
    expect(comboWeight('yok', stats, '2026-11-21')).toBe(2)
    expect(comboWeight('a', stats, '2026-11-21')).toBe(1)
    expect(comboWeight('b', stats, '2026-11-21')).toBe(2)
    expect(comboWeight('c', stats, '2026-11-21')).toBe(4)
    // Gelecek tarihli kayıt (saat kayması) ağırlığı düşürmez
    expect(comboWeight('a', stats, '2026-11-20')).toBe(1)
  })

  it('hocanın kombinasyonu 7 gün boyunca ×2', () => {
    const lesson = { comboId: 'u1', date: '2026-11-20' }
    expect(comboWeight('u1', {}, '2026-11-20', lesson)).toBe(4)
    expect(comboWeight('u1', {}, '2026-11-26', lesson)).toBe(4)
    expect(comboWeight('u1', {}, '2026-11-27', lesson)).toBe(2)
    expect(comboWeight('u1', {}, '2026-11-19', lesson)).toBe(2)
    expect(comboWeight('baska', {}, '2026-11-21', lesson)).toBe(2)
    expect(lessonActive(lesson, '2026-11-26')).toBe(true)
    expect(lessonActive(lesson, '2026-11-27')).toBe(false)
    expect(lessonActive(null, '2026-11-21')).toBe(false)
  })

  it('çağrı kimliği → kombo', () => {
    expect(comboIdOfCall('c_12')).toBe('c_12')
    expect(comboIdOfCall('chain:u_ab:2')).toBe('u_ab')
    expect(comboIdOfCall('move:slip')).toBeNull()
    expect(comboIdOfCall('say:rest')).toBeNull()
  })

  it('geçen süreye kadar çağrılar sayılır; koç konuşması ve tek hareket sayılmaz', () => {
    const tl = buildTimeline({ prepSec: 0, rounds: 1, roundSec: 60, warnSec: 0, restSec: 0 })
    const call = (t: number, comboId: string): CueEvent => ({ t, type: 'call', round: 1, comboId, phrases: ['x'], speakSec: 0.5, windowSec: 1 })
    tl.cues.push(call(2, 'a'), call(6, 'chain:b:1'), call(10, 'chain:b:2'), call(14, 'move:slip'), call(18, 'say:breathe'), call(22, 'a'), call(40, 'a'))
    expect(comboCallCounts(tl, 30)).toEqual({ a: 2, b: 2 })
    expect(comboCallCounts(tl)).toEqual({ a: 3, b: 2 })
  })

  it('birleştirme: sayı toplanır, son tarih ileri gider', () => {
    const s = mergeComboStats({ a: { count: 3, lastDate: '2026-11-01' } }, { a: 2, b: 1, c: 0 }, '2026-11-21')
    expect(s).toEqual({ a: { count: 5, lastDate: '2026-11-21' }, b: { count: 1, lastDate: '2026-11-21' } })
  })

  it('bozuk kayıtlar ayıklanır', () => {
    expect(sanitizeStats({ a: { count: 2, lastDate: '2026-11-01' }, b: { count: 'x' }, c: null, d: { count: 1, lastDate: 'dün' } })).toEqual({
      a: { count: 2, lastDate: '2026-11-01' },
    })
    expect(sanitizeStats('bozuk')).toEqual({})
    expect(sanitizeLesson({ comboId: 'u1', date: '2026-11-20' })).toEqual({ comboId: 'u1', date: '2026-11-20' })
    expect(sanitizeLesson({ comboId: 3 })).toBeNull()
  })
})

describe('Uyarlanan tempo', () => {
  it('rahattı → bir kademe hızlı, yetişemedim → bir kademe yavaş, uçlarda sabit', () => {
    expect(adjustTempo('slow', 'easy')).toBe('medium')
    expect(adjustTempo('medium', 'easy')).toBe('fast')
    expect(adjustTempo('fast', 'easy')).toBe('master')
    expect(adjustTempo('master', 'easy')).toBe('master')
    expect(adjustTempo('master', 'hard')).toBe('fast')
    expect(adjustTempo('medium', 'hard')).toBe('slow')
    expect(adjustTempo('slow', 'hard')).toBe('slow')
    expect(adjustTempo('fast', 'right')).toBe('fast')
  })
})
