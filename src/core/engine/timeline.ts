// Antrenmanı başlamadan önce zaman çizelgesine derler (spec §4.2).
// Ses ve görsel aynı çizelgeden beslenir. Saf fonksiyonlar, UI'dan bağımsız.

export type WorkoutPhase = 'prep' | 'round' | 'warn' | 'rest' | 'done'

export interface TimerConfig {
  prepSec: number
  rounds: number
  roundSec: number
  warnSec: number
  restSec: number
  /** İsteğe bağlı: raunt başına süre (rutinler: her hareketin kendi süresi). Uzunluk = rounds. */
  roundSecs?: number[]
  /** İsteğe bağlı: raunt başına etiket (ör. "Kelebek esnemesi"). */
  labels?: string[]
}

export const LIMITS = {
  prepSec: { min: 0, max: 60 },
  rounds: { min: 1, max: 30 },
  roundSec: { min: 10, max: 30 * 60 },
  warnSec: { min: 0, max: 60 },
  restSec: { min: 0, max: 5 * 60 },
} as const

export function clampConfig(c: TimerConfig): TimerConfig {
  const clamp = (v: number, k: keyof typeof LIMITS) =>
    Math.min(LIMITS[k].max, Math.max(LIMITS[k].min, Math.round(Number.isFinite(v) ? v : LIMITS[k].min)))
  const roundSec = clamp(c.roundSec, 'roundSec')
  const out: TimerConfig = {
    prepSec: clamp(c.prepSec, 'prepSec'),
    rounds: clamp(c.rounds, 'rounds'),
    roundSec,
    // Uyarı rauntun tamamını kaplayamaz.
    warnSec: Math.min(clamp(c.warnSec, 'warnSec'), roundSec - 1),
    restSec: clamp(c.restSec, 'restSec'),
  }
  if (c.roundSecs?.length) {
    // Rutin hareketleri 5 sn'ye kadar kısa olabilir
    out.roundSecs = Array.from({ length: out.rounds }, (_, i) => Math.max(5, Math.min(LIMITS.roundSec.max, Math.round(c.roundSecs![i] ?? roundSec))))
  }
  if (c.labels?.length) out.labels = c.labels.slice(0, out.rounds)
  return out
}

/** r. rauntun süresi (1 tabanlı). */
export const roundLength = (c: TimerConfig, r: number) => c.roundSecs?.[r - 1] ?? c.roundSec

export interface Segment {
  phase: Exclude<WorkoutPhase, 'done'>
  /** 1 tabanlı raunt numarası (hazırlık için 1, dinlenme için biten raunt). */
  round: number
  start: number
  end: number
}

export type BellSound = 'roundStart' | 'roundEnd' | 'warn' | 'tick' | 'finish'

export type CueKind =
  | { type: 'phase'; phase: WorkoutPhase; round: number }
  | { type: 'bell'; sound: BellSound }
  | { type: 'call'; round: number; comboId: string; phrases: string[]; speakSec: number; windowSec: number; rate?: number; wordGap?: number }

export type CueEvent = CueKind & { t: number }

export interface Timeline {
  config: TimerConfig
  segments: Segment[]
  cues: CueEvent[]
  totalSec: number
}

/** Son 3 sn geri sayım bip'i, raunt başlamadan önceki (hazırlık/dinlenme) fazın sonunda. */
const COUNTDOWN_BEEPS = 3

export function buildTimeline(input: TimerConfig): Timeline {
  const config = clampConfig(input)
  const { prepSec, rounds, warnSec, restSec } = config
  const segments: Segment[] = []
  const cues: CueEvent[] = []
  let t = 0

  const countdown = (endT: number, len: number) => {
    for (let i = Math.min(COUNTDOWN_BEEPS, len); i >= 1; i--) cues.push({ t: endT - i, type: 'bell', sound: 'tick' })
  }

  if (prepSec > 0) {
    segments.push({ phase: 'prep', round: 1, start: 0, end: prepSec })
    cues.push({ t: 0, type: 'phase', phase: 'prep', round: 1 })
    countdown(prepSec, prepSec)
    t = prepSec
  }

  for (let r = 1; r <= rounds; r++) {
    const len = roundLength(config, r)
    const w = Math.min(warnSec, len - 1)
    const roundEnd = t + len
    const warnStart = roundEnd - w
    segments.push({ phase: 'round', round: r, start: t, end: w > 0 ? warnStart : roundEnd })
    cues.push({ t, type: 'phase', phase: 'round', round: r })
    cues.push({ t, type: 'bell', sound: 'roundStart' })
    if (w > 0) {
      segments.push({ phase: 'warn', round: r, start: warnStart, end: roundEnd })
      cues.push({ t: warnStart, type: 'phase', phase: 'warn', round: r })
      cues.push({ t: warnStart, type: 'bell', sound: 'warn' })
    }
    t = roundEnd
    const last = r === rounds
    if (!last) cues.push({ t, type: 'bell', sound: 'roundEnd' })
    // Son rauntun ardından dinlenme yok.
    if (!last && restSec > 0) {
      segments.push({ phase: 'rest', round: r, start: t, end: t + restSec })
      cues.push({ t, type: 'phase', phase: 'rest', round: r })
      countdown(t + restSec, restSec)
      t += restSec
    }
  }

  cues.push({ t, type: 'phase', phase: 'done', round: rounds })
  cues.push({ t, type: 'bell', sound: 'finish' })
  // Aynı andaki olaylarda faz değişimi önce gelsin (kararlı sıralama).
  cues.sort((a, b) => a.t - b.t || (a.type === 'phase' ? -1 : 0) - (b.type === 'phase' ? -1 : 0))
  return { config, segments, cues, totalSec: t }
}

/** Toplam aktif çalışma süresi (raunt süreleri toplamı). */
export function workSeconds(c: TimerConfig): number {
  const k = clampConfig(c)
  let s = 0
  for (let r = 1; r <= k.rounds; r++) s += roundLength(k, r)
  return s
}

export function segmentAt(tl: Timeline, elapsed: number): Segment | undefined {
  return tl.segments.find((s) => elapsed >= s.start && elapsed < s.end)
}

/** "mm:ss" (tabular). Negatifler 0 kabul edilir; yukarı yuvarlanır ki 0:00 yalnızca bitişte görünsün. */
export function formatClock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec - 1e-9))
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
