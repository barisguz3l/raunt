// Rehberli rutinler: her hareket kendi süresiyle (ısınma, esneme, kondisyon devresi).
// Araştırma: ısınmada kas başına < 60 sn statik germe; uzun germeler seans sonuna (RAMP sırası).

import type { ContentStore } from '../content/contentStore'
import type { ProgramBlock } from '../content/types'
import type { TimerConfig } from '../engine/timeline'

export interface RoutineItem {
  exerciseId: string
  sec: number
}

export interface Routine {
  id: 'warmup' | 'stretch' | 'conditioning'
  restSec: number
  sets: number
  items: RoutineItem[]
}

export const ROUTINES: Record<Routine['id'], Routine> = {
  // RAMP: nabzı yükselt (ip, yüksek diz) → harekete hazırla (eklem açma, bacak sallama) → gölge
  warmup: {
    id: 'warmup',
    restSec: 10,
    sets: 1,
    items: [
      { exerciseId: 'ip', sec: 120 },
      { exerciseId: 'isinma', sec: 90 },
      { exerciseId: 'bacaksallama', sec: 60 },
      { exerciseId: 'highknee', sec: 30 },
      { exerciseId: 'golge', sec: 90 },
    ],
  },
  stretch: {
    id: 'stretch',
    restSec: 5,
    sets: 1,
    items: [
      { exerciseId: 'kalcafleks', sec: 60 },
      { exerciseId: 'doksan', sec: 60 },
      { exerciseId: 'kelebek', sec: 60 },
      { exerciseId: 'guvercin', sec: 60 },
      { exerciseId: 'bacakarkasi', sec: 60 },
      { exerciseId: 'kedideve', sec: 45 },
      { exerciseId: 'gogus', sec: 45 },
    ],
  },
  // Başlangıç devresi: 30 sn iş, plank kısa (bel güvenliği), 2 set
  conditioning: {
    id: 'conditioning',
    restSec: 20,
    sets: 2,
    items: [
      { exerciseId: 'squat', sec: 30 },
      { exerciseId: 'sinav', sec: 30 },
      { exerciseId: 'highknee', sec: 30 },
      { exerciseId: 'mekik', sec: 30 },
      { exerciseId: 'climber', sec: 30 },
      { exerciseId: 'plank', sec: 20 },
    ],
  },
}

export function routineConfig(store: ContentStore, r: Routine): TimerConfig {
  const items = Array.from({ length: r.sets }, () => r.items).flat()
  return {
    prepSec: 10,
    rounds: items.length,
    roundSec: 30,
    warnSec: 3,
    restSec: r.restSec,
    roundSecs: items.map((i) => i.sec),
    labels: items.map((i) => store.exercise(i.exerciseId)?.nameTr ?? i.exerciseId),
  }
}

export function routineMinutes(r: Routine): number {
  const n = r.items.length * r.sets
  return Math.round((r.items.reduce((s, i) => s + i.sec, 0) * r.sets + r.restSec * (n - 1) + 10) / 60)
}

/** Program bloğu → zamanlayıcı (timerHint varsa). */
/** Blok zamanlayıcısı. cycle ≥ 2: aynı şablon, raunt sayısı +1 (en fazla +2) — yavaş, kurallı ilerleme. */
export function blockConfig(b: ProgramBlock, cycle = 1): TimerConfig | null {
  const h = b.timerHint
  if (!h) return null
  const extra = h.rounds >= 2 ? Math.min(2, Math.max(0, cycle - 1)) : 0
  return {
    prepSec: 10,
    rounds: h.rounds + extra,
    roundSec: h.roundSec,
    warnSec: h.roundSec >= 60 ? 10 : 3,
    restSec: h.restSec,
  }
}

/** Bloğun antrenman türü (kalori ve başlık için). */
export function blockKind(b: ProgramBlock): 'shadow' | 'routine' | 'timer' {
  const refs = b.exerciseRefs ?? []
  if (refs.includes('golge')) return 'shadow'
  if (refs.some((r) => ['ip', 'isinma', 'kelebek', 'bacakarkasi', 'kalcafleks', 'sinav', 'plank', 'mekik'].includes(r))) return 'routine'
  return 'timer'
}
