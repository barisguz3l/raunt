import { useMemo, useState } from 'react'
import { getContentStore } from '../../core/content/contentStore'
import type { FitnessTest } from '../../core/content/types'
import { addDays, toISODate } from '../../core/program/schedule'
import { compareTest, formatDiff } from '../../core/records/health'
import { newId, notifyRecordsChanged, records, type TestResult } from '../../core/records/records'
import { activityByDay, weeklyStreak, weeklySummaries } from '../../core/records/stats'
import { useRecords } from '../../core/records/useRecords'
import { settingsStore, useSettings } from '../../core/settings/settings'
import { BigButton } from '../../design/BigButton'
import { Ring } from '../../design/Ring'
import { Sheet } from '../../design/Sheet'
import { Toggle } from '../../design/Toggle'
import { KickProgress } from '../camera/KickProgress'
import { tr } from '../../i18n/tr'

const p = tr.progress
const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })

export function ProgressScreen({ today = toISODate(new Date()) }: { today?: string }) {
  const store = getContentStore()
  const s = useSettings()
  const rec = useRecords()
  const [testSheet, setTestSheet] = useState<FitnessTest | null>(null)
  const [measureSheet, setMeasureSheet] = useState(false)

  const byDay = useMemo(() => activityByDay(rec.sessions, rec.journals), [rec.sessions, rec.journals])
  const weeks = useMemo(() => weeklySummaries(byDay, today, 6), [byDay, today])
  const streak = useMemo(() => weeklyStreak(byDay, today, s.weeklyGoal), [byDay, today, s.weeklyGoal])
  const maxLoad = Math.max(1, ...weeks.map((w) => w.load))
  const totalSessions = rec.sessions.length + rec.journals.length
  const totalMin = rec.sessions.reduce((a, x) => a + Math.round(x.totalSec / 60), 0) + rec.journals.reduce((a, j) => a + (j.minutes ?? 60), 0)

  const history = [
    ...rec.sessions.map((x) => ({ id: x.id, date: x.day, title: x.title, min: Math.round(x.totalSec / 60), rpe: x.rpe, kcal: x.kcalLow != null ? p.kcal(x.kcalLow, x.kcalHigh!) : '' })),
    ...rec.journals.map((j) => ({ id: j.id, date: j.date, title: p.lesson, min: j.minutes ?? 60, rpe: j.rpe, kcal: '' })),
  ].sort((a, b) => b.date.localeCompare(a.date))

  const nextExam = s.lastBeltExam ? addDays(s.lastBeltExam, 91) : null

  return (
    <section className="screen" aria-labelledby="progress-title">
      <h1 id="progress-title" className="screen-title">
        {p.title}
      </h1>

      <div className="ring-wrap">
        <Ring value={weeks[weeks.length - 1]?.sessions ?? 0} max={s.weeklyGoal} size={110} sub={tr.day.weekGoal} />
        <p className="card-muted" style={{ margin: 0 }}>
          {p.freezes(streak.freezesLeft)}
        </p>
      </div>
      <div className="stat-grid" style={{ marginTop: 16 }}>
        <div className="stat">
          <b>{s.gamification ? `${streak.streak}🔥` : streak.streak}</b>
          <span>{p.streak}</span>
        </div>
        <div className="stat">
          <b>{totalSessions}</b>
          <span>{p.sessions}</span>
        </div>
        <div className="stat">
          <b>{totalMin}</b>
          <span>{p.minutes}</span>
        </div>
      </div>

      <h2 className="section-title">{p.load}</h2>
      <div className="card">
        <div className="bars" role="img" aria-label={p.load}>
          {weeks.map((w) => (
            <div key={w.week} className="bar">
              <span className="bar-fill" style={{ height: `${Math.max(3, (w.load / maxLoad) * 100)}%` }} />
              <small>{fmtDate(w.week)}</small>
            </div>
          ))}
        </div>
        <p className="card-muted" style={{ marginBottom: 0 }}>{p.loadHint}</p>
      </div>

      <h2 className="section-title">
        {p.tests} <small>{p.retestHint.split('.')[0]}</small>
      </h2>
      {store.content.tests.map((t) => {
        const results = rec.tests.filter((r) => r.testId === t.id).sort((a, b) => a.date.localeCompare(b.date))
        const first = results[0]
        const last = results[results.length - 1]
        const cmp = first && last && results.length > 1 ? compareTest(first.value, last.value, t.higherIsBetter) : null
        return (
          <button key={t.id} type="button" className="combo-row" onClick={() => setTestSheet(t)}>
            <span className="combo-row-main">
              <strong>{t.nameTr}</strong>
              <span className="card-muted">
                {last ? `${p.last}: ${last.value} ${t.unit}${last.variant ? ` (${last.variant})` : ''}` : p.noTest}
              </span>
            </span>
            {cmp && (
              <span className="badge" style={cmp.improved ? { background: 'rgba(74,139,255,0.18)', color: '#bcd3ff' } : undefined}>
                {formatDiff(cmp.diff, cmp.pct)}
              </span>
            )}
            <span aria-hidden="true">›</span>
          </button>
        )
      })}

      <h2 className="section-title">{p.measurements}</h2>
      <div className="card">
        {rec.measurements.length ? (
          <div className="stat-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="stat">
              <b>{rec.measurements.find((m) => m.weightKg)?.weightKg ?? '–'}</b>
              <span>{p.weight}</span>
            </div>
            <div className="stat">
              <b>{rec.measurements.find((m) => m.waistCm)?.waistCm ?? '–'}</b>
              <span>{p.waist}</span>
            </div>
          </div>
        ) : null}
        <BigButton variant="neutral" style={{ marginTop: 10 }} onClick={() => setMeasureSheet(true)}>
          + {p.addMeasurement}
        </BigButton>
      </div>

      <KickProgress />

      <h2 className="section-title">{p.belt}</h2>
      <div className="card setting-group">
        <label className="field">
          <span>{p.beltNow}</span>
          <select value={s.belt} onChange={(e) => void settingsStore.update({ belt: e.target.value })}>
            {Object.entries(tr.belts).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{p.lastExam}</span>
          <input type="date" value={s.lastBeltExam ?? ''} onChange={(e) => void settingsStore.update({ lastBeltExam: e.target.value || null })} />
        </label>
        {nextExam && <strong>{p.nextExam(fmtDate(nextExam) + ' ' + nextExam.slice(0, 4))}</strong>}
        <small className="card-muted">{p.beltNote}</small>
      </div>

      <h2 className="section-title">{p.history}</h2>
      {history.length === 0 ? (
        <div className="card empty">{p.empty}</div>
      ) : (
        history.slice(0, 40).map((h) => (
          <div key={h.id} className="list-row">
            <span>
              <strong>{h.title}</strong>
              <br />
              <small className="card-muted">
                {fmtDate(h.date)}, {h.min} dk{h.rpe ? `, ${p.rpeShort(h.rpe)}` : ''}
              </small>
            </span>
            {h.kcal && <span className="badge">{h.kcal}</span>}
          </div>
        ))
      )}

      {testSheet && <TestSheet test={testSheet} results={rec.tests.filter((r) => r.testId === testSheet.id)} today={today} onClose={() => setTestSheet(null)} />}
      {measureSheet && <MeasureSheet today={today} onClose={() => setMeasureSheet(false)} />}
    </section>
  )
}

function TestSheet({ test, results, today, onClose }: { test: FitnessTest; results: TestResult[]; today: string; onClose: () => void }) {
  const [value, setValue] = useState('')
  const [variant, setVariant] = useState(test.variants?.[0] ?? '')
  const [backPain, setBackPain] = useState(false)
  const [set, setSet] = useState<'baslangic' | 'ara' | 'final'>(results.length ? 'ara' : 'baslangic')
  const sorted = [...results].sort((a, b) => a.date.localeCompare(b.date))
  const first = sorted[0]

  const save = async () => {
    const v = Number(value.replace(',', '.'))
    if (!Number.isFinite(v)) return
    await records.saveTest({ id: newId('t'), testId: test.id, variant: variant || undefined, value: v, date: today, testSet: set, backPain })
    notifyRecordsChanged()
    onClose()
  }

  return (
    <Sheet title={test.nameTr} onClose={onClose}>
      <div className="card">
        <strong>{p.protocol}</strong>
        <p className="card-muted" style={{ margin: '6px 0 0' }}>{test.protocol}</p>
        {test.safety && <p className="notice" style={{ marginBottom: 0 }}>{test.safety}</p>}
        {test.id === 'plank' && <p className="notice" style={{ marginBottom: 0 }}>{tr.safety.plank}</p>}
      </div>
      <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
        {test.variants?.length ? (
          <label className="field">
            <span>{p.variant}</span>
            <select value={variant} onChange={(e) => setVariant(e.target.value)}>
              {test.variants.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="field">
          <span>{p.value(test.unit)}</span>
          <input type="number" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
        </label>
        <label className="field">
          <span>{p.testSet}</span>
          <select value={set} onChange={(e) => setSet(e.target.value as typeof set)}>
            {Object.entries(p.sets).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        {test.id === 'plank' && <Toggle label={tr.summary.backPain} checked={backPain} onChange={setBackPain} />}
        {backPain && <p className="notice">{tr.safety.backPain}</p>}
        {first && value && Number.isFinite(Number(value.replace(',', '.'))) && (
          <p className="card-muted">
            {p.first}: {first.value} {test.unit} → {p.change}:{' '}
            <strong>{formatDiff(compareTest(first.value, Number(value.replace(',', '.')), test.higherIsBetter).diff, compareTest(first.value, Number(value.replace(',', '.')), test.higherIsBetter).pct)}</strong>
          </p>
        )}
        <BigButton variant="success" onClick={() => void save()} disabled={!value}>
          {p.save}
        </BigButton>
        {sorted.length > 0 && (
          <table className="mini-table">
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.date)}</td>
                  <td>{p.sets[r.testSet ?? 'ara']}</td>
                  <td className="tabular">
                    {r.value} {test.unit}
                    {r.backPain ? ' ⚠️' : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Sheet>
  )
}

function MeasureSheet({ today, onClose }: { today: string; onClose: () => void }) {
  const [w, setW] = useState('')
  const [waist, setWaist] = useState('')
  const save = async () => {
    const weightKg = w ? Number(w.replace(',', '.')) : undefined
    const waistCm = waist ? Number(waist.replace(',', '.')) : undefined
    await records.saveMeasurement({ id: newId('m'), date: today, weightKg, waistCm })
    if (weightKg && weightKg >= 30) await settingsStore.update({ weightKg })
    notifyRecordsChanged()
    onClose()
  }
  return (
    <Sheet title={p.addMeasurement} onClose={onClose}>
      <div style={{ display: 'grid', gap: 12 }}>
        <label className="field">
          <span>{p.weight}</span>
          <input type="number" inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} />
        </label>
        <label className="field">
          <span>{p.waist}</span>
          <input type="number" inputMode="decimal" value={waist} onChange={(e) => setWaist(e.target.value)} />
        </label>
        <small className="card-muted">{store().content.tests.find((t) => t.id === 'weight')?.protocol}</small>
        <BigButton variant="success" onClick={() => void save()} disabled={!w && !waist}>
          {p.save}
        </BigButton>
      </div>
    </Sheet>
  )
}

const store = () => getContentStore()
