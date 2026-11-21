// Kameranın geçmiş seans özetleri (bellekte; açılışta IndexedDB'den yüklenir).

import { getRepo } from '../../core/persistence/db'
import { habitsFrom, type Habits } from '../../core/vision/coachAdapt'
import type { VisionHistoryItem } from './visionSession'

let history: VisionHistoryItem[] = []
let habits: Habits = habitsFrom([])

export async function loadVisionHistory() {
  history = (await getRepo().getKV<VisionHistoryItem[]>('vision.history')) ?? []
  habits = habitsFrom(history.map((h) => h.stats))
}

export const visionHistory = () => history
export const visionHabits = () => habits
