// Rakip saldırısı (lapa modu): kombo çağrılarının arasına savunma çağrıları ("kaç", "blok"…) ekler.
// Ekranda kırmızı eldiven gelir (PadScene, "move:<id>"), ses ifadeyi söyler. Saf, tohumlu, birim testli.
//
//   - Her raunt içinde yaklaşık her 12–20 sn'de bir savunma.
//   - Önce çağrılar arasındaki boşluğa konur (boşluk ≥ ifade + 1,5 sn).
//   - Hızlı tempoda boşluklar dardır: savunma zamanı 3 sn geçtiyse sıradaki kombo çağrısının yerine geçer.
//   - Hiçbir çağrıyla çakışmaz; rauntun sonunu aşmaz.

import type { CueEvent, Timeline } from './timeline'

export interface DefenseMove {
  id: string
  phrase: string
  durationMs: number
}

export interface OpponentOptions {
  moves: DefenseMove[]
  phraseMs: (phrase: string) => number
  rand: () => number
  minEverySec?: number
  maxEverySec?: number
  /** Söyleyiş (tempoya göre) */
  rate?: number
  wordGap?: number
}

type Call = CueEvent & { type: 'call' }

/** Savunma için gereken boşluk: ifade + 1,5 sn (hareket + nefes). */
export const DEFENSE_SLACK_SEC = 1.5
export const OPPONENT_MARGIN_SEC = 0.35
const REPLACE_AFTER_SEC = 3

export const isComboCall = (c: CueEvent) => c.type === 'call' && !c.comboId.startsWith('say:') && !c.comboId.startsWith('move:')

export function insertOpponentCalls(tl: Timeline, o: OpponentOptions): Timeline {
  if (!o.moves.length) return tl
  const minE = o.minEverySec ?? 12
  const maxE = Math.max(minE, o.maxEverySec ?? 20)
  const rate = o.rate ?? 1
  const interval = () => minE + o.rand() * (maxE - minE)
  const removed = new Set<CueEvent>()
  const added: Call[] = []
  let last = ''

  const pick = () => {
    let m = o.moves[Math.floor(o.rand() * o.moves.length)]
    if (m.id === last && o.moves.length > 1) m = o.moves[(o.moves.indexOf(m) + 1) % o.moves.length]
    return m
  }
  const speak = (m: DefenseMove) => o.phraseMs(m.phrase) / 1000 / rate
  const make = (m: DefenseMove, t: number, round: number): Call => {
    last = m.id
    const speakSec = speak(m)
    return { t, type: 'call', round, comboId: `move:${m.id}`, phrases: [m.phrase], speakSec, windowSec: m.durationMs / 1000 + 0.2, rate: o.rate, wordGap: o.wordGap }
  }

  for (let r = 1; r <= tl.config.rounds; r++) {
    const parts = tl.segments.filter((s) => s.round === r && (s.phase === 'round' || s.phase === 'warn'))
    if (!parts.length) continue
    const start = parts[0].start
    const end = parts[parts.length - 1].end
    const calls = tl.cues.filter((c): c is Call => c.type === 'call' && c.t >= start && c.t < end)
    // İlk savunma rauntun ilk 7–12 sn'sinde
    let due = start + minE * 0.6 + o.rand() * (maxE - minE) * 0.3
    let cursor = start + 1.5
    for (let i = 0; i <= calls.length; i++) {
      const next = calls[i] as Call | undefined
      const b = next ? next.t : end
      if (due < b) {
        const m = pick()
        const need = speak(m) + DEFENSE_SLACK_SEC
        const t = Math.max(cursor + OPPONENT_MARGIN_SEC, due)
        if (b - t >= need) {
          added.push(make(m, t, r))
          due = t + interval()
        } else if (next && isComboCall(next) && next.t - due >= REPLACE_AFTER_SEC) {
          // Boşluk dar: bu kombo çağrısının yerine savunma; yer, sonraki çağrıya kadar
          const until = calls[i + 1]?.t ?? end
          if (until - next.t >= need) {
            removed.add(next)
            const d = make(m, next.t, r)
            added.push(d)
            due = d.t + interval()
            cursor = d.t + d.speakSec + d.windowSec
            continue
          }
        }
      }
      if (next) cursor = Math.max(cursor, next.t + next.speakSec + next.windowSec)
    }
  }
  if (!added.length) return tl
  const order = (c: CueEvent) => (c.type === 'phase' ? 0 : c.type === 'bell' ? 1 : 2)
  const cues = [...tl.cues.filter((c) => !removed.has(c)), ...added].sort((a, b) => a.t - b.t || order(a) - order(b))
  return { ...tl, cues }
}
