import { describe, expect, it } from 'vitest'
import { getContentStore } from '../content/contentStore'
import { resolveCombo } from '../../features/combos/comboModel'
import { buildCoachTimeline } from './coachTimeline'
import { speakSec, TEMPO, type Tempo } from './comboScheduler'

const store = getContentStore()
const phraseMs = () => 500
const v = { stance: 'orthodox' as const, callMode: 'numbers' as const, nameStyle: 'leftRight' as const }
const pool = store.content.combos.filter((c) => c.level === 1 && !c.requiresCoachApproval).map((c) => resolveCombo(store, c, v))
const cfg = { prepSec: 10, rounds: 1, roundSec: 180, warnSec: 10, restSec: 30 }

function stats(tempo: Tempo) {
  const tl = buildCoachTimeline(cfg, { pool, selection: 'sequential', tempo, coachApproved: false, phraseMs, seed: 1 })
  const calls = tl.cues.filter((c): c is Extract<typeof c, { type: 'call' }> => c.type === 'call')
  const gaps = calls.slice(1).map((c, i) => c.t - calls[i].t)
  return { calls, avgGap: gaps.reduce((a, b) => a + b, 0) / gaps.length }
}

describe('Tempo: söyleyiş ve aralık', () => {
  it('hızlandıkça "bir, iki, üç" daha kısa sürede söylenir', () => {
    const ph = ['bir', 'iki', 'üç']
    const s = (['slow', 'medium', 'fast', 'master'] as Tempo[]).map((t) => speakSec(ph, phraseMs, t))
    for (let i = 1; i < s.length; i++) expect(s[i]).toBeLessThan(s[i - 1])
    // usta, yavaşın en fazla %70'i kadar sürer (fark kulakla duyulsun)
    expect(s[3]).toBeLessThan(s[0] * 0.7)
  })

  it('usta tempoda çağrılar yavaşın yarısından kısa aralıkla gelir', () => {
    const slow = stats('slow')
    const master = stats('master')
    expect(master.avgGap).toBeLessThan(slow.avgGap * 0.5)
    expect(master.calls.length).toBeGreaterThan(slow.calls.length * 1.8)
  })

  it('çağrılar söyleyiş ayarını sese taşır', () => {
    const { calls } = stats('fast')
    expect(calls[0].rate).toBe(TEMPO.fast.rate)
    expect(calls[0].wordGap).toBe(TEMPO.fast.wordGapSec)
  })
})
