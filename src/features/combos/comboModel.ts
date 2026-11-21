import type { ContentStore } from '../../core/content/contentStore'
import type { Combo, ComboFocus, Move } from '../../core/content/types'
import type { ResolvedCombo } from '../../core/engine/comboScheduler'
import { comboPhrases, type CallMode, type NameStyle, type Stance } from '../../core/speech/stanceMapper'

export interface ComboFilter {
  query: string
  levels: number[] // boş = tümü
  focus: ComboFocus | null
  lockedOnly: boolean
}

export const emptyFilter: ComboFilter = { query: '', levels: [], focus: null, lockedOnly: false }

export function isLocked(store: ContentStore, combo: Combo): boolean {
  return combo.requiresCoachApproval || store.comboMoves(combo).some((m) => m.coachApproval)
}

const norm = (s: string) => s.toLocaleLowerCase('tr-TR')

export function filterCombos(store: ContentStore, combos: Combo[], f: ComboFilter): Combo[] {
  const q = norm(f.query.trim())
  return combos.filter((c) => {
    if (f.levels.length && !f.levels.includes(c.level)) return false
    if (f.focus && c.focus !== f.focus) return false
    if (f.lockedOnly && !isLocked(store, c)) return false
    if (!q) return true
    const moves = store.comboMoves(c)
    const hay = [c.nameTr, c.code, c.description ?? '', ...moves.map((m) => m.nameTr), ...moves.map((m) => m.shortTr)].map(norm).join(' ')
    return q.split(/\s+/).every((w) => hay.includes(w))
  })
}

export interface Voicing {
  stance: Stance
  callMode: CallMode
  nameStyle: NameStyle
}

export function resolveCombo(store: ContentStore, combo: Combo, v: Voicing): ResolvedCombo {
  const moves = store.comboMoves(combo)
  return { combo, moves, phrases: comboPhrases(moves, v.stance, v.callMode, v.nameStyle) }
}

/** Ekrandaki Türkçe kod: ["1", "2", "3", "Arka alçak"] (iç kod "1-2-3-LKR" gösterilmez). */
export function comboTokens(store: ContentStore, combo: Combo): string[] {
  return store.comboMoves(combo).map((m) => m.shortTr)
}

export const tokenLabel = (tokens: string[]) => tokens.join(' - ')

/**
 * Bir çağrının hareketleri: "move:<id>" (refleks/duruş değiştir), "chain:<komboId>:<n>" (zincirin ilk n adımı)
 * veya kombo kimliği. "say:" (koç konuşması) için boş.
 */
export function cueMoves(store: ContentStore, comboId: string): Move[] {
  if (comboId.startsWith('say:')) return []
  if (comboId.startsWith('move:')) {
    const mv = store.move(comboId.slice(5))
    return mv ? [mv] : []
  }
  const ch = /^chain:(.+):(\d+)$/.exec(comboId)
  if (ch) {
    const c = store.combo(ch[1])
    return c ? store.comboMoves(c).slice(0, Number(ch[2])) : []
  }
  const c = store.combo(comboId)
  return c ? store.comboMoves(c) : []
}
