// Zamanlayıcı çizelgesine kombo çağrılarını ekler. Ses ve ekran aynı çizelgeden beslenir (spec §4.2).

import {
  ComboPicker,
  filterAllowed,
  planReflexCalls,
  planRoundCalls,
  poolForRule,
  seededRandom,
  type ReflexMove,
  type ResolvedCombo,
  type RoundRule,
  type Selection,
  type Tempo,
} from './comboScheduler'
import { buildTimeline, type CueEvent, type Timeline, type TimerConfig } from './timeline'
import { isSayCue } from './coachVoice'

export interface CoachOptions {
  pool: ResolvedCombo[]
  selection: Selection
  tempo: Tempo
  coachApproved: boolean
  /** İfadenin konuşma süresi (ms) — ses paketi manifestinden. */
  phraseMs: (phrase: string) => number
  seed: number
  /** Raunt kuralları (raunt sırasıyla döner). */
  rules?: RoundRule[]
  /** Raunt ortasında duruş değiştir: ikinci yarı için ters duruşla adlandırılmış havuz. */
  switchPool?: ResolvedCombo[]
  /** Duruş değiştir komutunun ifadesi */
  switchPhrase?: string
  /** Refleks modu: kombo yerine tek hareketler */
  reflex?: { moves: ReflexMove[]; minGap?: number; maxGap?: number }
}

export type CallCue = CueEvent & { type: 'call' }

export function buildCoachTimeline(config: TimerConfig, coach: CoachOptions): Timeline {
  const tl = buildTimeline(config)
  const rand = seededRandom(coach.seed)
  const calls: CueEvent[] = []
  const push = (r: number, c: { t: number; comboId: string; phrases: string[]; speakSec: number; windowSec: number; rate?: number; wordGap?: number }) =>
    calls.push({ t: c.t, type: 'call', round: r, comboId: c.comboId, phrases: c.phrases, speakSec: c.speakSec, windowSec: c.windowSec, rate: c.rate, wordGap: c.wordGap })
  const roundBounds = (r: number) => {
    const parts = tl.segments.filter((s) => s.round === r && (s.phase === 'round' || s.phase === 'warn'))
    return [parts[0].start, parts[parts.length - 1].end] as const
  }

  if (coach.reflex) {
    for (let r = 1; r <= tl.config.rounds; r++) {
      const [start, end] = roundBounds(r)
      for (const c of planReflexCalls(start, end, coach.reflex.moves, rand, coach.phraseMs, { ...coach.reflex, tempo: coach.tempo })) push(r, c)
    }
  } else {
    const pool = filterAllowed(coach.pool, coach.coachApproved)
    if (!pool.length) return tl
    const altPool = coach.switchPool ? filterAllowed(coach.switchPool, coach.coachApproved) : null
    // Kural başına tek seçici: sıralı mod ve "son 3 tekrar yok" kuralı raunttan raunda sürsün
    const pickers = new Map<string, ComboPicker>()
    const pickerFor = (p: ResolvedCombo[], rule: RoundRule, key: string) => {
      let pk = pickers.get(key + rule)
      if (!pk) {
        pk = new ComboPicker(poolForRule(p, rule), coach.selection, rand)
        pickers.set(key + rule, pk)
      }
      return pk
    }
    for (let r = 1; r <= tl.config.rounds; r++) {
      const [start, end] = roundBounds(r)
      const rule = coach.rules?.length ? coach.rules[(r - 1) % coach.rules.length] : 'any'
      const picker = pickerFor(pool, rule, 'a')
      if (altPool?.length && coach.switchPhrase && end - start >= 40) {
        // İlk yarı normal duruş, ortada "duruş değiştir", ikinci yarı ters duruşla adlandırma
        const mid = start + (end - start) / 2
        for (const c of planRoundCalls(start, mid, picker, coach.tempo, coach.phraseMs)) push(r, c)
        const sp = coach.phraseMs(coach.switchPhrase) / 1000
        push(r, { t: mid, comboId: 'move:switch', phrases: [coach.switchPhrase], speakSec: sp, windowSec: 1.5 })
        // planRoundCalls ilk çağrıyı başlangıçtan 1,5 sn sonra koyar → komut + 1,5 sn hazırlık payı
        for (const c of planRoundCalls(mid + sp, end, pickerFor(altPool, rule, 'b'), coach.tempo, coach.phraseMs)) push(r, c)
      } else {
        for (const c of planRoundCalls(start, end, picker, coach.tempo, coach.phraseMs)) push(r, c)
      }
    }
  }
  const cues = [...tl.cues, ...calls].sort((a, b) => a.t - b.t || order(a) - order(b))
  return { ...tl, cues }
}

const order = (c: CueEvent) => (c.type === 'phase' ? 0 : c.type === 'bell' ? 1 : 2)

/**
 * Ekranda gösterilecek çağrılar: `current` = penceresi süren çağrı, `last` = en son başlamış çağrı
 * (penceresi bitmiş olsa da; aralarda soluk gösterilir), `next` = sıradaki.
 */
export function callsAround(tl: Timeline, elapsed: number): { current?: CallCue; last?: CallCue; next?: CallCue } {
  let last: CallCue | undefined
  let next: CallCue | undefined
  for (const c of tl.cues) {
    if (c.type !== 'call' || isSayCue(c)) continue
    if (c.t <= elapsed) last = c
    else {
      next = c
      break
    }
  }
  const current = last && elapsed <= last.t + last.speakSec + last.windowSec ? last : undefined
  return { current, last, next }
}

export function callCount(tl: Timeline, upTo = Infinity): number {
  return tl.cues.filter((c) => c.type === 'call' && !isSayCue(c) && c.t <= upTo).length
}
