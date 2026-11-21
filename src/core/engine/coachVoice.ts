// Koç araya girer (Fable önerisi #1–2): hazırlık, dinlenme, son raunt, son on saniye ve
// raunt içi kısa teknik ipuçları. Ses paketinde zaten bulunan sistem ifadelerini kullanır (yeni klip yok).
// Çağrılar "say:<anahtar>" kimlikli 'call' olayı olarak çizelgeye girer; ekran bunları kombo saymaz.

import { SYSTEM_PHRASES, type SystemPhraseKey } from '../speech/vocabulary'
import type { CueEvent, Timeline } from './timeline'

export type TipKey = 'guardUp' | 'chinDown' | 'breathe' | 'relax'
export const TIP_KEYS: TipKey[] = ['guardUp', 'chinDown', 'breathe', 'relax']

export interface CoachVoiceOptions {
  phraseMs: (phrase: string) => number
  rand: () => number
  /** Hocanın son düzeltmesi: bu ipucu 3 kat sık söylenir */
  focus?: TipKey | null
  /** Raunt içi ipuçları arası en az süre (sn) */
  tipEverySec?: number
}

export const isSayCue = (c: CueEvent) => c.type === 'call' && c.comboId.startsWith('say:')

const COUNTDOWN = 3
const MARGIN = 0.35

export function addCoachVoice(tl: Timeline, o: CoachVoiceOptions): Timeline {
  const say = (key: SystemPhraseKey, t: number): CueEvent => {
    const phrase = SYSTEM_PHRASES[key]
    return { t, type: 'call', round: 0, comboId: `say:${key}`, phrases: [phrase], speakSec: o.phraseMs(phrase) / 1000, windowSec: 0.3 }
  }
  const dur = (key: SystemPhraseKey) => o.phraseMs(SYSTEM_PHRASES[key]) / 1000
  const out: CueEvent[] = []
  const rounds = tl.config.rounds

  for (const seg of tl.segments) {
    const len = seg.end - seg.start
    if (seg.phase === 'prep' && len >= 6) {
      // Geri sayım bip'lerinden önce biter
      out.push(say('getReady', Math.max(seg.start + 0.6, seg.end - COUNTDOWN - dur('getReady') - MARGIN)))
    }
    if (seg.phase === 'rest') {
      if (len >= 6) out.push(say('rest', seg.start + 1.2))
      const nextRound = seg.round + 1
      if (nextRound === rounds && rounds > 1 && len >= 10) out.push(say('lastRound', seg.end - COUNTDOWN - dur('lastRound') - MARGIN))
    }
    if (seg.phase === 'warn' && len >= 8) out.push(say('tenSeconds', seg.start + 0.6))
  }

  // Sabit konuşmalarla çakışan kombo çağrıları çıkarılır (iki ses üst üste binmesin)
  const busy = out.map((c) => [c.t - MARGIN, c.t + (c.type === 'call' ? c.speakSec : 0) + MARGIN] as const)
  const overlaps = (a: number, b: number) => busy.some(([x, y]) => a < y && b > x)
  const kept = tl.cues.filter(
    (c) => c.type !== 'call' || isSayCue(c) || !overlaps(c.t, c.t + c.speakSec + Math.min(c.windowSec, 1)),
  )

  // Raunt içi ipuçları: çağrılar arasındaki yeterli boşluklara, en az tipEverySec arayla
  const tips: CueEvent[] = []
  const every = o.tipEverySec ?? 45
  const weights = TIP_KEYS.map((k) => (k === o.focus ? 3 : 1))
  const pickTip = (): TipKey => {
    let r = o.rand() * weights.reduce((a, b) => a + b, 0)
    for (let i = 0; i < TIP_KEYS.length; i++) {
      r -= weights[i]
      if (r < 0) return TIP_KEYS[i]
    }
    return TIP_KEYS[0]
  }
  for (const seg of tl.segments) {
    if (seg.phase !== 'round') continue
    let lastTip = seg.start + 10 // raunt başında hemen değil
    const inRound = kept.filter((c) => c.type === 'call' && c.t >= seg.start && c.t < seg.end) as (CueEvent & { type: 'call' })[]
    // Boşluklar: [önceki çağrının bitişi, sonraki çağrı]
    const edges: [number, number][] = []
    let cursor = seg.start + 2
    for (const c of inRound) {
      edges.push([cursor, c.t])
      cursor = c.t + c.speakSec + c.windowSec
    }
    edges.push([cursor, seg.end - 1])
    for (const [a, b] of edges) {
      if (a - lastTip < every) continue
      const key = pickTip()
      const d = dur(key)
      if (b - a >= d + 2 * MARGIN) {
        tips.push(say(key, a + MARGIN))
        lastTip = a
      }
    }
  }

  const order = (c: CueEvent) => (c.type === 'phase' ? 0 : c.type === 'bell' ? 1 : 2)
  const cues = [...kept, ...out, ...tips].sort((a, b) => a.t - b.t || order(a) - order(b))
  return { ...tl, cues }
}
