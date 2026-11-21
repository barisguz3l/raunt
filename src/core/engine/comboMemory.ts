// Unutma eğrisi (aralıklı tekrar): her kombonun kaç kez çağrıldığı ve en son ne zaman.
// Uzun süredir çağrılmayan kombolar rastgele seçimde daha sık gelir. Saf fonksiyonlar, birim testli.

import { isSayCue } from './coachVoice'
import type { Timeline } from './timeline'

export interface ComboStat {
  count: number
  /** YYYY-AA-GG */
  lastDate: string
}
export type ComboStats = Record<string, ComboStat>

/** Hocanın kombinasyonu (ders günlüğünden): 7 gün boyunca iki kat ağırlık. */
export interface LessonCombo {
  comboId: string
  /** Dersin tarihi YYYY-AA-GG */
  date: string
}

export const LESSON_BOOST_DAYS = 7

const ISO = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 86_400_000
const utc = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
/** a'dan b'ye gün sayısı (b sonra ise pozitif). */
export const daysBetween = (a: string, b: string) => Math.round((utc(b) - utc(a)) / DAY_MS)

/** Hocanın kombinasyonu bugün hâlâ "taze" mi (ders günü dahil 7 gün). */
export const lessonActive = (lesson: LessonCombo | null | undefined, today: string) => {
  if (!lesson) return false
  const age = daysBetween(lesson.date, today)
  return age >= 0 && age < LESSON_BOOST_DAYS
}

/** Bir çağrı kimliğinin ait olduğu kombo: "chain:<id>:<n>" → <id>; "move:" ve "say:" kombo değildir. */
export function comboIdOfCall(callId: string): string | null {
  if (callId.startsWith('say:') || callId.startsWith('move:')) return null
  const ch = /^chain:(.+):\d+$/.exec(callId)
  return ch ? ch[1] : callId
}

/** Geçen süreye kadar (dahil) çağrılan kombolar ve sayıları. */
export function comboCallCounts(tl: Timeline, upTo = Infinity): Record<string, number> {
  const out: Record<string, number> = {}
  for (const c of tl.cues) {
    if (c.type !== 'call' || isSayCue(c) || c.t > upTo) continue
    const id = comboIdOfCall(c.comboId)
    if (id) out[id] = (out[id] ?? 0) + 1
  }
  return out
}

/** Antrenman sonunda istatistiği günceller (yeni nesne döner). */
export function mergeComboStats(stats: ComboStats, counts: Record<string, number>, date: string): ComboStats {
  const out: ComboStats = { ...stats }
  for (const [id, n] of Object.entries(counts)) {
    if (!(n > 0)) continue
    const prev = out[id]
    out[id] = { count: (prev?.count ?? 0) + n, lastDate: prev && prev.lastDate > date ? prev.lastDate : date }
  }
  return out
}

/**
 * Rastgele seçim ağırlığı: hiç çağrılmamış 2; yoksa 1 + min(3, sonÇağrıdanBeriGün / 3).
 * Hocanın kombinasyonu dersten sonraki 7 gün içinde ×2.
 */
export function comboWeight(id: string, stats: ComboStats, today: string, lesson?: LessonCombo | null): number {
  const st = stats[id]
  let w = !st || st.count <= 0 ? 2 : 1 + Math.min(3, Math.max(0, daysBetween(st.lastDate, today)) / 3)
  if (lesson?.comboId === id && lessonActive(lesson, today)) w *= 2
  return w
}

/** Bozuk kayıtları ayıklar (IndexedDB'den ya da yedekten gelen veri). */
export function sanitizeStats(raw: unknown): ComboStats {
  const out: ComboStats = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    const s = v as Partial<ComboStat> | null
    if (s && typeof s.count === 'number' && Number.isFinite(s.count) && s.count >= 0 && typeof s.lastDate === 'string' && ISO.test(s.lastDate)) {
      out[id] = { count: Math.round(s.count), lastDate: s.lastDate }
    }
  }
  return out
}

export function sanitizeLesson(raw: unknown): LessonCombo | null {
  const r = raw as Partial<LessonCombo> | null
  return r && typeof r.comboId === 'string' && typeof r.date === 'string' && ISO.test(r.date) ? { comboId: r.comboId, date: r.date } : null
}
