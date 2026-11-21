// Kombinasyonlar ön/arka (lead/rear) saklanır; konuşmada duruşa göre adlandırılır (spec §4.2.1).
// Sayılar (1-6) duruştan bağımsızdır. Saf fonksiyonlar.

import type { Move } from '../content/types'

export type Stance = 'orthodox' | 'southpaw'
export type CallMode = 'numbers' | 'names'
/** Kroşe/aparkat adı: "sol/sağ kroşe" veya "ön/arka kroşe". */
export type NameStyle = 'leftRight' | 'frontRear'

/** Ön el/ayak hangi taraf? Normal duruş (orthodox): ön = sol. Solak duruş (southpaw): ön = sağ. */
export function sideOf(limb: Move['limb'], stance: Stance): 'sol' | 'sağ' | null {
  if (limb === 'none') return null
  const leadIsLeft = stance === 'orthodox'
  const isLead = limb === 'lead'
  return isLead === leadIsLeft ? 'sol' : 'sağ'
}

/** Bir hareketin söylenecek (ve ekranda yazılacak) Türkçe ifadesi. */
export function spokenPhrase(move: Move, stance: Stance, mode: CallMode, style: NameStyle = 'leftRight'): string {
  if (mode === 'numbers') return move.speak.numbers
  if (!move.speak.sideWord) return move.speak.names
  const prefix = style === 'frontRear' ? (move.limb === 'lead' ? 'ön' : 'arka') : sideOf(move.limb, stance)
  return prefix ? `${prefix} ${move.speak.names}` : move.speak.names
}

/** Kombonun tüm adımları için ifadeler. */
export function comboPhrases(moves: Move[], stance: Stance, mode: CallMode, style: NameStyle = 'leftRight'): string[] {
  return moves.map((m) => spokenPhrase(m, stance, mode, style))
}
