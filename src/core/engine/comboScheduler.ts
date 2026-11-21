// Kombinasyon çağrılarını raunt içine yerleştirir (spec §4.2.2–4.2.3). Saf, tohumlu (tekrarlanabilir).
//
//   pencere(kombo) = Σ süre(adım) × seviyeÇarpanı + toparlanma (tekme/diz +500 ms, savunma +200 ms)
//   sonrakiÇağrı   = çağrı süresi + pencere + seviyeBoşluğu

import type { Combo, Move } from '../content/types'

export type Tempo = 'slow' | 'medium' | 'fast' | 'master'
export type Selection = 'sequential' | 'random'

/**
 * Tempo hem çağrılar arası boşluğu hem de söyleyişi belirler:
 *   multiplier  uygulama penceresi çarpanı, gapSec çağrılar arası nefes
 *   rate        klip çalma hızı (1 = kayıt hızı; 1,2'yi aşınca ses incelir)
 *   wordGapSec  bir çağrıdaki kelimeler arası boşluk
 */
export const TEMPO: Record<Tempo, { multiplier: number; gapSec: number; rate: number; wordGapSec: number }> = {
  slow: { multiplier: 1.7, gapSec: 3.2, rate: 1, wordGapSec: 0.3 },
  medium: { multiplier: 1.25, gapSec: 2.0, rate: 1.07, wordGapSec: 0.16 },
  fast: { multiplier: 1.0, gapSec: 1.0, rate: 1.14, wordGapSec: 0.06 },
  master: { multiplier: 0.8, gapSec: 0.45, rate: 1.2, wordGapSec: 0 },
}

/** Söyleyiş ayarı (ses servisi ve "Dinle" düğmeleri için). */
export const speechFor = (tempo: Tempo) => ({ rate: TEMPO[tempo].rate, wordGap: TEMPO[tempo].wordGapSec })

/** Tempo verilmeyen konuşmalarda ifadeler arası boşluk (koçun araya girmesi vb.). */
export const WORD_GAP_SEC = 0.25
/** Raunt zilinden sonra ilk çağrıya kadar bekleme. */
export const FIRST_CALL_DELAY_SEC = 1.5

export interface ResolvedCombo {
  combo: Combo
  moves: Move[]
  /** Ekranda ve seste kullanılacak ifadeler (duruş/mod uygulanmış). */
  phrases: string[]
  /** Rastgele seçimde ağırlık (varsayılan 1). */
  weight?: number
}

export interface CallPlan {
  t: number
  comboId: string
  phrases: string[]
  /** Konuşma süresi (sn). */
  speakSec: number
  /** Uygulama penceresi (sn): konuşma bittikten sonra kullanıcının vuruş süresi. */
  windowSec: number
  /** Söyleyiş: klip hızı ve kelime arası boşluk (tempoya göre) */
  rate?: number
  wordGap?: number
}

export const isKickCombo = (c: ResolvedCombo) => c.moves.some((m) => m.category === 'kick')

export function recoverySec(moves: Move[]): number {
  let r = 0
  if (moves.some((m) => m.category === 'kick' || m.category === 'knee')) r += 0.5
  if (moves.some((m) => m.category === 'defense')) r += 0.2
  return r
}

export function windowSec(moves: Move[], tempo: Tempo): number {
  const sum = moves.reduce((s, m) => s + m.durationMsEstimate, 0) / 1000
  return sum * TEMPO[tempo].multiplier + recoverySec(moves)
}

export function speakSec(phrases: string[], phraseMs: (p: string) => number, tempo?: Tempo): number {
  if (!phrases.length) return 0
  const rate = tempo ? TEMPO[tempo].rate : 1
  const gap = tempo ? TEMPO[tempo].wordGapSec : WORD_GAP_SEC
  return phrases.reduce((s, p) => s + phraseMs(p) / 1000 / rate, 0) + gap * (phrases.length - 1)
}

/** Basit tohumlu rastgele sayı üreteci (mulberry32). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Hoca onayı kapalıysa kilitli kombolar havuza girmez (spec F-1200).
 * Hareketlerinden biri kilitliyse de kilitli sayılır (kullanıcı kombolarında bayrak eksik olabilir).
 */
export function filterAllowed(pool: ResolvedCombo[], coachApproved: boolean): ResolvedCombo[] {
  if (coachApproved) return pool
  return pool.filter((c) => !c.combo.requiresCoachApproval && !c.moves.some((m) => m.coachApproval))
}

/** Sıradaki komboyu seçer. Geçmiş: en yeni sonda. */
export class ComboPicker {
  private seqIndex = 0
  readonly history: string[] = []

  constructor(
    private pool: ResolvedCombo[],
    private selection: Selection,
    private rand: () => number,
  ) {
    if (!pool.length) throw new Error('Kombo havuzu boş')
  }

  next(): ResolvedCombo {
    const pick = this.selection === 'sequential' ? this.pool[this.seqIndex++ % this.pool.length] : this.randomPick()
    this.history.push(pick.combo.id)
    return pick
  }

  /** Son seçimi geri al (çağrı rauntun sonuna sığmadıysa). */
  undo() {
    this.history.pop()
    if (this.selection === 'sequential' && this.seqIndex > 0) this.seqIndex--
  }

  private randomPick(): ResolvedCombo {
    const last = this.history[this.history.length - 1]
    const recent = new Set(this.history.slice(-3))
    const lastWasKick = last ? isKickCombo(this.pool.find((c) => c.combo.id === last)!) : false
    // Kısıtlar sırayla gevşetilir: (1) son 3 yok + üst üste tekme yok, (2) son 1 yok + üst üste tekme yok, (3) son 1 yok, (4) hepsi
    const tiers: ((c: ResolvedCombo) => boolean)[] = [
      (c) => !recent.has(c.combo.id) && !(lastWasKick && isKickCombo(c)),
      (c) => c.combo.id !== last && !(lastWasKick && isKickCombo(c)),
      (c) => c.combo.id !== last,
      () => true,
    ]
    for (const ok of tiers) {
      const cands = this.pool.filter(ok)
      if (cands.length) return weighted(cands, this.rand)
    }
    return this.pool[0]
  }
}

function weighted(cands: ResolvedCombo[], rand: () => number): ResolvedCombo {
  const total = cands.reduce((s, c) => s + Math.max(0, c.weight ?? 1), 0)
  if (total <= 0) return cands[Math.floor(rand() * cands.length)]
  let r = rand() * total
  for (const c of cands) {
    r -= Math.max(0, c.weight ?? 1)
    if (r < 0) return c
  }
  return cands[cands.length - 1]
}

/** Bir raunt aralığına çağrıları yerleştirir. Son çağrı penceresi rauntun bitişini aşmaz. */
export function planRoundCalls(
  start: number,
  end: number,
  picker: ComboPicker,
  tempo: Tempo,
  phraseMs: (p: string) => number,
): CallPlan[] {
  const out: CallPlan[] = []
  let t = start + FIRST_CALL_DELAY_SEC
  for (let guard = 0; guard < 1000; guard++) {
    const c = picker.next()
    const sp = speakSec(c.phrases, phraseMs, tempo)
    const win = windowSec(c.moves, tempo)
    if (t + sp + win > end) {
      picker.undo() // çağrılmadı; sıradaki rauntta ilk o gelsin
      break
    }
    out.push({ t, comboId: c.combo.id, phrases: c.phrases, speakSec: sp, windowSec: win, ...speechFor(tempo) })
    t += sp + win + TEMPO[tempo].gapSec
  }
  return out
}

// ---------------------------------------------------------------------------
// Refleks modu (spec F-208): rastgele tek hareket, rastgele aralık (2–6 sn), savunma ağırlığı %20.

export interface ReflexMove {
  id: string
  phrase: string
  category: Move['category']
  durationMs: number
}

export function planReflexCalls(
  start: number,
  end: number,
  moves: ReflexMove[],
  rand: () => number,
  phraseMs: (p: string) => number,
  opts: { minGap?: number; maxGap?: number; defenseShare?: number; tempo?: Tempo } = {},
): CallPlan[] {
  const minGap = opts.minGap ?? 2
  const maxGap = opts.maxGap ?? 6
  const defenseShare = opts.defenseShare ?? 0.2
  const defense = moves.filter((m) => m.category === 'defense')
  const attack = moves.filter((m) => m.category !== 'defense')
  const out: CallPlan[] = []
  let t = start + FIRST_CALL_DELAY_SEC
  let last = ''
  for (let guard = 0; guard < 1000; guard++) {
    const pool = defense.length && (rand() < defenseShare || !attack.length) ? defense : attack
    if (!pool.length) break
    let m = pool[Math.floor(rand() * pool.length)]
    if (m.id === last && pool.length > 1) m = pool[(pool.indexOf(m) + 1) % pool.length]
    const sp = speakSec([m.phrase], phraseMs, opts.tempo)
    const win = m.durationMs / 1000 + (m.category === 'kick' || m.category === 'knee' ? 0.5 : 0)
    if (t + sp + win > end) break
    out.push({ t, comboId: `move:${m.id}`, phrases: [m.phrase], speakSec: sp, windowSec: win, ...(opts.tempo ? speechFor(opts.tempo) : {}) })
    last = m.id
    t += sp + win + minGap + rand() * (maxGap - minGap)
  }
  return out
}

// ---------------------------------------------------------------------------
// Kurallı raundlar (araştırma: "constraint rounds"): her raunda bir kural, havuz filtrelenir.

export type RoundRule = 'any' | 'punchesOnly' | 'leadHand' | 'kickFinish' | 'defenseFirst' | 'bodyWork' | 'noKicks'

export const RULE_FILTERS: Record<RoundRule, (c: ResolvedCombo) => boolean> = {
  any: () => true,
  punchesOnly: (c) => c.moves.every((m) => m.category === 'punch'),
  leadHand: (c) => c.moves.every((m) => m.limb !== 'rear'),
  kickFinish: (c) => c.moves[c.moves.length - 1]?.category === 'kick',
  defenseFirst: (c) => c.moves[0]?.category === 'defense',
  bodyWork: (c) => c.moves.some((m) => m.target === 'body' && m.category === 'punch'),
  noKicks: (c) => c.moves.every((m) => m.category !== 'kick'),
}

/** Kurala uyan havuz; boşsa tüm havuz (antrenman çağrısız kalmasın). */
export function poolForRule(pool: ResolvedCombo[], rule: RoundRule): ResolvedCombo[] {
  const f = pool.filter(RULE_FILTERS[rule])
  return f.length ? f : pool
}
