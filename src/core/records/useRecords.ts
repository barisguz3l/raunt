import { useEffect, useState } from 'react'
import { onRecordsChanged, records, type Enrollment, type LessonJournal, type Measurement, type SessionLog, type TestResult } from './records'

export interface RecordsState {
  loaded: boolean
  sessions: SessionLog[]
  journals: LessonJournal[]
  tests: TestResult[]
  measurements: Measurement[]
  enrollment: Enrollment | null
}

const empty: RecordsState = { loaded: false, sessions: [], journals: [], tests: [], measurements: [], enrollment: null }

/** Tüm kullanıcı kayıtlarını yükler; kayıt değişince yeniler. */
export function useRecords(): RecordsState {
  const [state, setState] = useState<RecordsState>(empty)
  useEffect(() => {
    let alive = true
    const load = async () => {
      const [sessions, journals, tests, measurements, enrollment] = await Promise.all([
        records.sessions(),
        records.journals(),
        records.tests(),
        records.measurements(),
        records.enrollment(),
      ])
      if (alive) setState({ loaded: true, sessions, journals, tests, measurements, enrollment: enrollment ?? null })
    }
    void load()
    const off = onRecordsChanged(() => void load())
    return () => {
      alive = false
      off()
    }
  }, [])
  return state
}
