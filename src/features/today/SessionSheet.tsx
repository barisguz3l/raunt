import { useState } from 'react'
import { getContentStore } from '../../core/content/contentStore'
import type { ProgramDay } from '../../core/content/types'
import { blockConfig, blockKind, ROUTINES, routineConfig, routineMinutes, type Routine } from '../../core/program/routines'
import type { TimerConfig } from '../../core/engine/timeline'

/** Süresi verilmemiş bölüm için hazır rutin: kondisyon devresi, ısınma, soğuma/esneme. */
const routineFor = (title: string): Routine['id'] | null =>
  /kondisyon devresi/i.test(title) ? 'conditioning' : /^ısınma$/i.test(title.trim()) ? 'warmup' : /soğuma|esneme/i.test(title) ? 'stretch' : null
import { estimateKcal } from '../../core/records/health'
import { newId, notifyRecordsChanged, records } from '../../core/records/records'
import { settingsStore } from '../../core/settings/settings'
import { BigButton } from '../../design/BigButton'
import { Sheet } from '../../design/Sheet'
import { tr } from '../../i18n/tr'
import type { WorkoutPlan } from '../activeWorkout/plan'

interface Props {
  day: ProgramDay
  date: string
  onClose: () => void
  onStart: (p: WorkoutPlan) => void
  /** Program bloğu (1, 2, 3…) */
  cycle?: number
}

/** S-03 Seans detay: bloklar, maddeler, zamanlayıcılı bloklar için Başlat; tümünü tamamladım. */
export function SessionSheet({ day, date, onClose, onStart, cycle = 1 }: Props) {
  const store = getContentStore()
  // Gölge boks bölümü: haftaya uygun seviyedeki kombinasyonlarla sesli koç (1. hafta seviye 1, sonra 1–2)
  const shadowPlan = (config: TimerConfig, title: string): WorkoutPlan => {
    const st = settingsStore.get()
    const levels = day.week >= 2 || cycle > 1 ? [1, 2] : [1]
    return {
      kind: 'shadow',
      config,
      title,
      programSessionId: day.sessionId,
      coach: {
        comboIds: store.allCombos().filter((c) => levels.includes(c.level)).map((c) => c.id),
        selection: 'random',
        tempo: st.tempo,
        callMode: st.callMode,
        seed: Math.floor(Math.random() * 2 ** 31),
      },
    }
  }
  const [rpe, setRpe] = useState<number | null>(null)
  const [saved, setSaved] = useState(false)

  const complete = async () => {
    const minutes = day.plannedMinutes ?? 30
    const w = settingsStore.get().weightKg
    const kcal = w ? estimateKcal('routine', w, minutes * 60, rpe ?? undefined) : null
    const startedAt = new Date(date + 'T' + settingsStore.get().trainingTime + ':00')
    await records.saveSession({
      id: newId('s'),
      startedAt: startedAt.toISOString(),
      endedAt: new Date(startedAt.getTime() + minutes * 60000).toISOString(),
      day: date,
      kind: 'routine',
      title: day.titleTr,
      programSessionId: day.sessionId,
      totalSec: minutes * 60,
      workSec: minutes * 60,
      rounds: 0,
      calls: 0,
      rpe: rpe ?? undefined,
      kcalLow: kcal?.low,
      kcalHigh: kcal?.high,
    })
    notifyRecordsChanged()
    setSaved(true)
  }

  return (
    <Sheet title={day.titleTr} onClose={onClose}>
      <div className="pill-row" style={{ marginTop: 0 }}>
        {day.plannedMinutes ? <span className="pill">{tr.day.planned(day.plannedMinutes)}</span> : null}
        {day.rpeTarget ? <span className="pill">{tr.day.rpe(day.rpeTarget)}</span> : null}
      </div>
      {day.note && <p className="notice">{day.note}</p>}
      <h3 className="section-title" style={{ marginTop: 8 }}>{tr.day.blocks}</h3>
      <ol className="block-list">
        {day.blocks.map((b, i) => {
          const cfg = blockConfig(b, cycle)
          return (
            <li key={i} className="card block-card">
              <div className="block-head">
                <span className="badge">
                  {b.startMin}–{b.endMin}. dk
                </span>
                <strong>{b.titleTr}</strong>
              </div>
              <ul>
                {b.items.map((it, j) => (
                  <li key={j}>{it}</li>
                ))}
              </ul>
              {b.exerciseRefs?.length ? (
                <div className="chips" style={{ marginTop: 6 }}>
                  {b.exerciseRefs.map((r) => (
                    <span key={r} className="badge">
                      {store.exercise(r)?.nameTr ?? r}
                    </span>
                  ))}
                </div>
              ) : null}
              {cfg && (
                <BigButton
                  onClick={() => onStart(blockKind(b) === 'shadow' ? shadowPlan(cfg, b.titleTr) : { kind: 'timer', config: cfg, title: b.titleTr, programSessionId: day.sessionId })}
                  style={{ marginTop: 10 }}
                >
                  {tr.day.blockStart}: {cfg.rounds} × {Math.round(cfg.roundSec / 60) || cfg.roundSec + ' sn'}
                  {cfg.roundSec >= 60 ? ' dk' : ''}
                </BigButton>
              )}
              {!cfg && routineFor(b.titleTr) && (
                <BigButton
                  variant="neutral"
                  style={{ marginTop: 10 }}
                  onClick={() => {
                    const id = routineFor(b.titleTr)!
                    onStart({ kind: 'routine', config: routineConfig(store, ROUTINES[id]), title: tr.routines[id], programSessionId: day.sessionId })
                  }}
                >
                  {tr.day.routineStart(tr.routines[routineFor(b.titleTr)!], routineMinutes(ROUTINES[routineFor(b.titleTr)!]))}
                </BigButton>
              )}
            </li>
          )
        })}
      </ol>

      <div className="card" style={{ marginTop: 12 }}>
        <strong>{tr.day.completeAll}</strong>
        <p className="card-muted" style={{ margin: '4px 0 10px' }}>{tr.day.completeHint}</p>
        <div className="scale" role="group" aria-label={tr.summary.rpe}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" aria-pressed={rpe === n} onClick={() => setRpe(n)}>
              {n}
            </button>
          ))}
        </div>
        <BigButton variant="success" style={{ marginTop: 12 }} disabled={saved} onClick={() => void complete()}>
          {saved ? `✓ ${tr.day.blockDone}` : tr.day.completeAll}
        </BigButton>
      </div>
    </Sheet>
  )
}
