// Uyarlanan tempo: antrenman sonunda "Tempo nasıldı?" cevabına göre bir kademe değiştir.

import type { Tempo } from './comboScheduler'

export const TEMPO_ORDER: Tempo[] = ['slow', 'medium', 'fast', 'master']
export type TempoFeel = 'easy' | 'right' | 'hard'

/** "Rahattı" bir kademe hızlı, "Yetişemedim" bir kademe yavaş, "Tam iyiydi" aynı. Uçlarda sabit kalır. */
export function adjustTempo(tempo: Tempo, feel: TempoFeel): Tempo {
  const i = Math.max(0, TEMPO_ORDER.indexOf(tempo))
  const d = feel === 'easy' ? 1 : feel === 'hard' ? -1 : 0
  return TEMPO_ORDER[Math.min(TEMPO_ORDER.length - 1, Math.max(0, i + d))]
}
