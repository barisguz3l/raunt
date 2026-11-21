import { getContentStore } from '../content/contentStore'
import { comboPhrases } from '../speech/stanceMapper'
import { buildCoachTimeline, callsAround, callCount } from './coachTimeline'
import {
  ComboPicker,
  filterAllowed,
  isKickCombo,
  planRoundCalls,
  recoverySec,
  seededRandom,
  speakSec,
  TEMPO,
  windowSec,
  WORD_GAP_SEC,
  type ResolvedCombo,
  type Tempo,
} from './comboScheduler'

const store = getContentStore()
const resolve = (filter: (c: (typeof store.content.combos)[number]) => boolean = () => true): ResolvedCombo[] =>
  store.content.combos.filter(filter).map((combo) => {
    const moves = store.comboMoves(combo)
    return { combo, moves, phrases: comboPhrases(moves, 'orthodox', 'names') }
  })
const all = resolve()
const byCode = (code: string) => all.find((c) => c.combo.code === code)!
const phraseMs = () => 400 // her ifade 0,4 sn varsay

describe('ComboScheduler: süreler', () => {
  it('pencere = Σ süre × çarpan + toparlanma (tekme/diz +0,5, savunma +0,2)', () => {
    const c = byCode('1-2-3-LKR') // 350+400+450+900 = 2100 ms, tekme
    expect(recoverySec(c.moves)).toBe(0.5)
    expect(windowSec(c.moves, 'slow')).toBeCloseTo(2.1 * 1.6 + 0.5)
    expect(windowSec(c.moves, 'master')).toBeCloseTo(2.1 * 0.85 + 0.5)
    const plain = byCode('1-2')
    expect(recoverySec(plain.moves)).toBe(0)
    expect(windowSec(plain.moves, 'fast')).toBeCloseTo(0.75)
  })

  it('konuşma süresi ifadeler + aralar', () => {
    expect(speakSec(['bir', 'iki', 'üç'], phraseMs)).toBeCloseTo(1.2 + 2 * WORD_GAP_SEC)
  })

  it('M3 kabul (3): tempo seviyeleri ölçülür ve tabloya uyar', () => {
    const c = byCode('1-2-3') // 1200 ms, toparlanma yok
    const sp = speakSec(c.phrases, phraseMs)
    const intervals = (['slow', 'medium', 'fast', 'master'] as Tempo[]).map((tempo) => {
      const picker = new ComboPicker([c], 'sequential', seededRandom(1))
      const calls = planRoundCalls(0, 120, picker, tempo, phraseMs)
      const gaps = calls.slice(1).map((x, i) => x.t - calls[i].t)
      // Tüm aralıklar eşit ve formüle uygun
      const expected = sp + 1.2 * TEMPO[tempo].multiplier + TEMPO[tempo].gapSec
      for (const g of gaps) expect(g).toBeCloseTo(expected)
      return gaps[0]
    })
    // Yavaş > Orta > Hızlı > Usta
    expect(intervals[0]).toBeGreaterThan(intervals[1])
    expect(intervals[1]).toBeGreaterThan(intervals[2])
    expect(intervals[2]).toBeGreaterThan(intervals[3])
  })

  it('son çağrının penceresi raunt bitişini aşmaz', () => {
    const picker = new ComboPicker(all, 'random', seededRandom(3))
    const calls = planRoundCalls(10, 130, picker, 'fast', phraseMs)
    const last = calls[calls.length - 1]
    expect(last.t + last.speakSec + last.windowSec).toBeLessThanOrEqual(130)
    expect(calls[0].t).toBe(11.5)
  })
})

describe('ComboScheduler: seçim', () => {
  it('sıralı mod döngüyle gider; sığmayan kombo sonraki rauntta ilk gelir', () => {
    const pool = [byCode('1-2'), byCode('1-2-3'), byCode('2-3')]
    const picker = new ComboPicker(pool, 'sequential', seededRandom(1))
    expect([1, 2, 3, 4].map(() => picker.next().combo.code)).toEqual(['1-2', '1-2-3', '2-3', '1-2'])
    picker.undo()
    expect(picker.next().combo.code).toBe('1-2')
  })

  it('rastgele: aynı kombo üst üste yok, son 3 tekrarlanmaz, üst üste tekmeli yok (1000 seçim)', () => {
    const pool = filterAllowed(all, false)
    const picker = new ComboPicker(pool, 'random', seededRandom(42))
    const picks = Array.from({ length: 1000 }, () => picker.next())
    for (let i = 1; i < picks.length; i++) {
      expect(picks[i].combo.id).not.toBe(picks[i - 1].combo.id)
      if (i >= 3) expect(picks.slice(i - 3, i).map((p) => p.combo.id)).not.toContain(picks[i].combo.id)
      expect(isKickCombo(picks[i]) && isKickCombo(picks[i - 1])).toBe(false)
    }
    // Çeşitlilik: havuzun çoğu kullanılmış
    expect(new Set(picks.map((p) => p.combo.id)).size).toBeGreaterThan(pool.length * 0.9)
  })

  it('ağırlık: ağırlığı 0 olan kombo hiç gelmez, ağırlığı yüksek olan daha sık gelir', () => {
    const pool = [byCode('1-2'), byCode('1-2-3'), byCode('2-3'), byCode('1-1-2'), { ...byCode('2-3-2'), weight: 0 }, { ...byCode('1-2-3-2'), weight: 5 }]
    const picker = new ComboPicker(pool, 'random', seededRandom(7))
    const counts: Record<string, number> = {}
    for (let i = 0; i < 2000; i++) {
      const c = picker.next().combo.code
      counts[c] = (counts[c] ?? 0) + 1
    }
    expect(counts['2-3-2'] ?? 0).toBe(0)
    expect(counts['1-2-3-2']).toBeGreaterThan(counts['1-2'])
  })

  it('aynı tohum → aynı sıra (tekrarlanabilir)', () => {
    const a = new ComboPicker(all, 'random', seededRandom(5))
    const b = new ComboPicker(all, 'random', seededRandom(5))
    expect(Array.from({ length: 20 }, () => a.next().combo.id)).toEqual(Array.from({ length: 20 }, () => b.next().combo.id))
  })

  it('tek kombo havuzunda kısıtlar gevşer, takılmaz', () => {
    const picker = new ComboPicker([byCode('1-2')], 'random', seededRandom(1))
    expect([1, 2, 3].map(() => picker.next().combo.code)).toEqual(['1-2', '1-2', '1-2'])
  })
})

describe('Hoca onayı kilidi', () => {
  it('M3 kabul (4): onay kapalıyken 4 kilitli kombo havuzda yok', () => {
    const locked = all.filter((c) => c.combo.requiresCoachApproval)
    expect(locked.map((c) => c.combo.code).sort()).toEqual(['1-1-2-MKR', '1-2-HKR', '1-2-MKR', '3-2-LKR-MKR'].sort())
    const allowed = filterAllowed(all, false)
    expect(allowed).toHaveLength(38)
    expect(allowed.some((c) => c.combo.requiresCoachApproval)).toBe(false)
    expect(filterAllowed(all, true)).toHaveLength(42)
  })

  it('bayrağı eksik ama kilitli hareket içeren kombo da filtrelenir', () => {
    const sneaky = { ...byCode('1-2-MKR'), combo: { ...byCode('1-2-MKR').combo, requiresCoachApproval: false } }
    expect(filterAllowed([sneaky], false)).toHaveLength(0)
  })
})

describe('Kombo çizelgesi', () => {
  const config = { prepSec: 10, rounds: 3, roundSec: 120, warnSec: 10, restSec: 30 }
  const opts = { pool: all, selection: 'random' as const, tempo: 'medium' as const, coachApproved: false, phraseMs, seed: 11 }

  it('çağrılar yalnızca raunt içinde, kilitliler yok', () => {
    const tl = buildCoachTimeline(config, opts)
    const calls = tl.cues.filter((c) => c.type === 'call')
    expect(calls.length).toBeGreaterThan(30)
    for (const c of calls) {
      if (c.type !== 'call') continue
      const seg = tl.segments.find((s) => s.round === c.round && s.phase === 'round')!
      const end = tl.segments.filter((s) => s.round === c.round).at(-1)!.end
      expect(c.t).toBeGreaterThanOrEqual(seg.start)
      expect(c.t + c.speakSec + c.windowSec).toBeLessThanOrEqual(end)
      expect(store.combo(c.comboId)!.requiresCoachApproval).toBe(false)
    }
  })

  it('ekran için şu anki/sıradaki çağrı', () => {
    const tl = buildCoachTimeline(config, opts)
    const first = tl.cues.find((c) => c.type === 'call')!
    expect(callsAround(tl, first.t - 0.1)).toMatchObject({ current: undefined, next: { t: first.t } })
    expect(callsAround(tl, first.t + 0.1).current?.t).toBe(first.t)
    expect(callCount(tl, first.t)).toBe(1)
  })

  it('havuz boşsa (hepsi kilitli) çağrısız zamanlayıcı', () => {
    const locked = all.filter((c) => c.combo.requiresCoachApproval)
    const tl = buildCoachTimeline(config, { ...opts, pool: locked })
    expect(tl.cues.some((c) => c.type === 'call')).toBe(false)
  })
})

describe('M4: refleks, kurallı raunt, duruş değişimi', () => {
  const config = { prepSec: 0, rounds: 2, roundSec: 120, warnSec: 10, restSec: 20 }
  const base = { pool: all, selection: 'random' as const, tempo: 'medium' as const, coachApproved: false, phraseMs, seed: 3 }

  it('refleks: tek hareket, aralıklar 2–6 sn + pencere, savunma da var', () => {
    const moves = store.content.moves
      .filter((m) => !m.coachApproval && m.category !== 'footwork')
      .map((m) => ({ id: m.id, phrase: m.speak.names, category: m.category, durationMs: m.durationMsEstimate }))
    const tl = buildCoachTimeline(config, { ...base, reflex: { moves } })
    const calls = tl.cues.filter((c) => c.type === 'call')
    expect(calls.length).toBeGreaterThan(20)
    for (const c of calls) if (c.type === 'call') expect(c.phrases).toHaveLength(1)
    const ids = calls.map((c) => (c.type === 'call' ? c.comboId : ''))
    expect(ids.some((id) => ['move:block', 'move:slip', 'move:roll', 'move:step_back', 'move:parry', 'move:leg_check'].includes(id))).toBe(true)
    for (let i = 1; i < calls.length; i++) {
      const a = calls[i - 1]
      const b = calls[i]
      if (a.type !== 'call' || b.type !== 'call' || a.round !== b.round) continue
      const gap = b.t - (a.t + a.speakSec + a.windowSec)
      expect(gap).toBeGreaterThanOrEqual(2 - 1e-9)
      expect(gap).toBeLessThanOrEqual(6 + 1e-9)
    }
  })

  it('kurallı raunt: 1. raunt sadece yumruk, 2. raunt tekmeyle bitiş', () => {
    const tl = buildCoachTimeline(config, { ...base, rules: ['punchesOnly', 'kickFinish'] })
    for (const c of tl.cues) {
      if (c.type !== 'call') continue
      const moves = store.comboMoves(store.combo(c.comboId)!)
      if (c.round === 1) expect(moves.every((m) => m.category === 'punch')).toBe(true)
      else expect(moves[moves.length - 1].category).toBe('kick')
    }
  })

  it('raunt ortası duruş değişimi: komut ortada, ikinci yarı ters duruşla adlandırılır, raunt sınırı aşılmaz', () => {
    const pool = resolve((c) => c.code === '1-2-3')
    const alt = pool.map((c) => ({ ...c, phrases: comboPhrases(c.moves, 'southpaw', 'names') }))
    const tl = buildCoachTimeline(
      { prepSec: 0, rounds: 1, roundSec: 120, warnSec: 0, restSec: 0 },
      { ...base, pool, switchPool: alt, switchPhrase: 'duruş değiştir' },
    )
    const calls = tl.cues.filter((c) => c.type === 'call')
    const sw = calls.find((c) => c.type === 'call' && c.comboId === 'move:switch')!
    expect(sw.t).toBe(60)
    for (const c of calls) {
      if (c.type !== 'call' || c.comboId === 'move:switch') continue
      expect(c.t + c.speakSec + c.windowSec).toBeLessThanOrEqual(120)
      expect(c.phrases[2]).toBe(c.t < 60 ? 'sol kroşe' : 'sağ kroşe')
    }
  })
})
