// Kombo hafızası: çağrı istatistiği (kv "combo.stats") ve hocanın kombinasyonu (kv "lesson.combo").
// Açılışta bir kez okunur, bellekte abone olunabilir. Anahtar-değer deposunda olduğu için JSON yedeğine girer.

import { useSyncExternalStore } from 'react'
import { mergeComboStats, sanitizeLesson, sanitizeStats, type ComboStats, type LessonCombo } from '../engine/comboMemory'
import { getRepo } from '../persistence/db'

export const STATS_KEY = 'combo.stats'
export const LESSON_KEY = 'lesson.combo'

interface State {
  stats: ComboStats
  lesson: LessonCombo | null
}

let state: State = { stats: {}, lesson: null }
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export const comboMemory = {
  get: () => state,
  subscribe(fn: () => void) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
  async load() {
    const repo = getRepo()
    const [stats, lesson] = await Promise.all([repo.getKV(STATS_KEY), repo.getKV(LESSON_KEY)])
    state = { stats: sanitizeStats(stats), lesson: sanitizeLesson(lesson) }
    emit()
  },
  /** Antrenman kaydedilince: çağrılan kombolar ve sayıları. */
  async recordCalls(counts: Record<string, number>, date: string) {
    if (!Object.keys(counts).length) return
    // Başka sekmede/önceki yüklemede yazılanı ezmemek için en güncel kaydın üzerine ekle
    const fresh = sanitizeStats(await getRepo().getKV(STATS_KEY))
    const stats = mergeComboStats({ ...state.stats, ...fresh }, counts, date)
    state = { ...state, stats }
    emit()
    await getRepo().setKV(STATS_KEY, stats)
  },
  async setLesson(lesson: LessonCombo) {
    state = { ...state, lesson }
    emit()
    await getRepo().setKV(LESSON_KEY, lesson)
  },
}

export function useComboMemory(): State {
  return useSyncExternalStore(comboMemory.subscribe, comboMemory.get, comboMemory.get)
}
