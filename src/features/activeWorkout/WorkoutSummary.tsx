import { useState } from 'react'
import { formatClock } from '../../core/engine/timeline'
import { estimateKcal } from '../../core/records/health'
import { newId, notifyRecordsChanged, records, type SessionKind } from '../../core/records/records'
import { toISODate } from '../../core/program/schedule'
import { useSettings } from '../../core/settings/settings'
import { BigButton } from '../../design/BigButton'
import { Toggle } from '../../design/Toggle'
import { tr } from '../../i18n/tr'
import type { WorkoutPlan } from './plan'

interface Props {
  plan: WorkoutPlan
  startedAt: Date
  actual: { roundsCompleted: number; workSec: number; totalSec: number }
  calls: number
  onDone: () => void
  onRestart: () => void
}

const s = tr.summary

export function kindForPlan(p: WorkoutPlan): SessionKind {
  return p.kind
}

/** S-10 Antrenman sonu: RPE, kas ağrısı, bel ağrısı, not, tahmini kalori, su + protein kartı. */
export function WorkoutSummary({ plan, startedAt, actual, calls, onDone, onRestart }: Props) {
  const settings = useSettings()
  const [rpe, setRpe] = useState<number | null>(null)
  const [soreness, setSoreness] = useState<number | null>(null)
  const [backPain, setBackPain] = useState(false)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const kcal = settings.weightKg ? estimateKcal(plan.kind, settings.weightKg, actual.workSec, rpe ?? undefined) : null

  const save = async () => {
    setSaving(true)
    const end = new Date()
    await records.saveSession({
      id: newId('s'),
      startedAt: startedAt.toISOString(),
      endedAt: end.toISOString(),
      day: toISODate(startedAt),
      kind: plan.kind,
      title: plan.title ?? tr.summary.kindTitle[plan.kind],
      programSessionId: plan.programSessionId,
      totalSec: Math.round(actual.totalSec),
      workSec: Math.round(actual.workSec),
      rounds: actual.roundsCompleted,
      calls,
      rpe: rpe ?? undefined,
      soreness: soreness ?? undefined,
      backPain,
      notes: notes.trim() || undefined,
      kcalLow: kcal?.low,
      kcalHigh: kcal?.high,
    })
    notifyRecordsChanged()
    onDone()
  }

  return (
    <div className="summary">
      <div className="summary-head">
        <div className="summary-title">{tr.workout.finished}</div>
      </div>
      <div className="stat-grid">
        <div className="stat">
          <b>{actual.roundsCompleted}</b>
          <span>{s.rounds}</span>
        </div>
        <div className="stat">
          <b className="tabular">{formatClock(actual.workSec)}</b>
          <span>{s.work}</span>
        </div>
        <div className="stat">
          <b>{calls || formatClock(actual.totalSec)}</b>
          <span>{calls ? s.calls : s.total}</span>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="setting-label">{s.rpe}</div>
        <p className="card-muted" style={{ margin: '4px 0 10px' }}>{s.rpeHint}</p>
        <div className="scale" role="group" aria-label={s.rpe}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" aria-pressed={rpe === n} onClick={() => setRpe(n)}>
              {n}
            </button>
          ))}
        </div>
        <div className="setting-label" style={{ marginTop: 16 }}>{s.soreness}</div>
        <div className="scale" role="group" aria-label={s.soreness}>
          {Array.from({ length: 11 }, (_, i) => i).map((n) => (
            <button key={n} type="button" aria-pressed={soreness === n} onClick={() => setSoreness(n)}>
              {n}
            </button>
          ))}
        </div>
        {soreness != null && soreness >= 7 && <p className="notice" style={{ marginTop: 12 }}>{tr.safety.soreness}</p>}
        <div style={{ marginTop: 12 }}>
          <Toggle label={s.backPain} checked={backPain} onChange={setBackPain} />
        </div>
        {backPain && <p className="notice">{tr.safety.backPain}</p>}
        <label className="field" style={{ marginTop: 8 }}>
          <span>{s.notes}</span>
          <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder={s.notesHint} />
        </label>
      </div>

      <div className="card fuel-card" style={{ marginTop: 12 }}>
        <strong>{s.fuelTitle}</strong>
        <p className="card-muted" style={{ margin: '6px 0 0' }}>{s.fuel}</p>
        <p className="card-muted" style={{ margin: '8px 0 0' }}>
          {kcal ? s.kcal(kcal.low, kcal.high) : s.kcalNoWeight}
        </p>
        {kcal && <small className="card-muted">{tr.safety.kcal}</small>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginTop: 16 }}>
        <BigButton variant="neutral" onClick={onRestart}>{tr.workout.again}</BigButton>
        <BigButton variant="success" onClick={() => void save()} disabled={saving}>{s.save}</BigButton>
      </div>
    </div>
  )
}
