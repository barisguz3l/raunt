// Ses paketinde bulunması gereken tüm ifadeler. Hem üretim betiği (scripts/generate-voice.mjs)
// hem de uygulama aynı listeyi kullanır; böylece eksik klip olmaz.

import type { Move } from '../content/types'
import { spokenPhrase, type CallMode, type NameStyle, type Stance } from './stanceMapper.ts'

/** Hareket dışı koç cümleleri (sistem). Anahtar → ifade. */
export const SYSTEM_PHRASES = {
  getReady: 'hazır ol',
  roundStart: 'raunt başlıyor',
  lastRound: 'son raunt',
  tenSeconds: 'son on saniye',
  rest: 'dinlen',
  finished: 'antrenman bitti, harika iş',
  guardUp: 'gard yukarı',
  breathe: 'nefes al',
  chinDown: 'çene içeri',
  relax: 'omuzlar gevşek',
  paused: 'duraklatıldı',
  resume: 'devam',
  // Yapay zekâ koç (aynada)
  otherHand: 'diğer el',
  good: 'güzel',
  hit: 'isabet',
  dodged: 'kaçtın',
  caught: 'yakalandın',
} as const

export type SystemPhraseKey = keyof typeof SYSTEM_PHRASES

export function movePhrases(moves: Move[]): string[] {
  const out = new Set<string>()
  const stances: Stance[] = ['orthodox', 'southpaw']
  const modes: CallMode[] = ['numbers', 'names']
  const styles: NameStyle[] = ['leftRight', 'frontRear']
  for (const m of moves) for (const st of stances) for (const mo of modes) for (const sy of styles) out.add(spokenPhrase(m, st, mo, sy))
  return [...out]
}

export function allPhrases(moves: Move[]): string[] {
  return [...new Set([...movePhrases(moves), ...Object.values(SYSTEM_PHRASES)])].sort((a, b) => a.localeCompare(b, 'tr'))
}
