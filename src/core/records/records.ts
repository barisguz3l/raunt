// Kullanıcı kayıtları (IndexedDB): seanslar, testler, ölçümler, ders günlüğü, program kaydı.

import { getRepo } from '../persistence/db'

export type SessionKind = 'timer' | 'combo' | 'shadow' | 'bag' | 'reflex' | 'pad' | 'routine' | 'gym' | 'walk'

export interface SessionLog {
  id: string
  /** ISO zaman damgası */
  startedAt: string
  endedAt: string
  /** Yerel takvim günü (YYYY-MM-DD) — haftalık hesaplar için */
  day: string
  kind: SessionKind
  title: string
  programSessionId?: string
  totalSec: number
  workSec: number
  rounds: number
  /** "Çağrılan" kombo/hareket sayısı (atılan değil; sensör yok) */
  calls: number
  rpe?: number
  soreness?: number
  backPain?: boolean
  notes?: string
  kcalLow?: number
  kcalHigh?: number
}

export interface TestResult {
  id: string
  testId: string
  variant?: string
  value: number
  date: string // YYYY-MM-DD
  testSet?: 'baslangic' | 'final' | 'ara'
  backPain?: boolean
  notes?: string
}

export interface Measurement {
  id: string
  date: string
  weightKg?: number
  waistCm?: number
}

export interface LessonJournal {
  id: string
  date: string
  learned: string
  correction: string
  soreness: number
  repeatTomorrow: string
  rpe?: number
  minutes?: number
  /** Hocanın düzeltmesi hızlı seçimden (koç ipucuyla eşleşir) */
  focus?: 'guardUp' | 'chinDown' | 'breathe' | 'relax' | null
  /** Derste kafaya darbe aldı mı */
  headHit?: boolean
}

export interface Enrollment {
  programId: string
  startDate: string
  /** Kaçıncı blok (1 = ilk 3 hafta). Her yeni blokta raunt sayısı artar. */
  cycle?: number
}

export const newId = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`

const sortDesc = <T extends { date?: string; startedAt?: string }>(a: T[]) =>
  a.sort((x, y) => (y.startedAt ?? y.date ?? '').localeCompare(x.startedAt ?? x.date ?? ''))

export const records = {
  sessions: async () => sortDesc(await getRepo().all<SessionLog>('sessions')),
  saveSession: (s: SessionLog) => getRepo().put('sessions', s),
  deleteSession: (id: string) => getRepo().delete('sessions', id),
  tests: async () => sortDesc(await getRepo().all<TestResult>('testResults')),
  saveTest: (t: TestResult) => getRepo().put('testResults', t),
  deleteTest: (id: string) => getRepo().delete('testResults', id),
  measurements: async () => sortDesc(await getRepo().all<Measurement>('measurements')),
  saveMeasurement: (m: Measurement) => getRepo().put('measurements', m),
  journals: async () => sortDesc(await getRepo().all<LessonJournal>('journals')),
  saveJournal: (j: LessonJournal) => getRepo().put('journals', j),
  enrollment: () => getRepo().getKV<Enrollment>('program.enrollment'),
  setEnrollment: (e: Enrollment | null) => getRepo().setKV('program.enrollment', e),
}

/** Basit olay yayını: kayıt değişince ekranlar yeniden yüklensin. */
const listeners = new Set<() => void>()
export function onRecordsChanged(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
export function notifyRecordsChanged() {
  listeners.forEach((l) => l())
}
