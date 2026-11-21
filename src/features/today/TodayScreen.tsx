import { useMemo, useState } from 'react'
import { getContentStore } from '../../core/content/contentStore'
import type { ProgramDay } from '../../core/content/types'
import { routineConfig, ROUTINES } from '../../core/program/routines'
import { addDays, isoWeekday, nextMonday, programPosition, toISODate } from '../../core/program/schedule'
import { nutritionPlan } from '../../core/records/health'
import { buildIcs } from '../../core/records/ics'
import { saveFile } from '../../core/files'
import { notifyRecordsChanged, records } from '../../core/records/records'
import { activityByDay, hardDaysInRow, loadSpike, weeklyStreak, weeklySummaries } from '../../core/records/stats'
import { useRecords } from '../../core/records/useRecords'
import { useSettings } from '../../core/settings/settings'
import { BigButton } from '../../design/BigButton'
import { Ring } from '../../design/Ring'
import { tr } from '../../i18n/tr'
import type { WorkoutPlan } from '../activeWorkout/plan'
import { JournalSheet } from './JournalSheet'
import { SessionSheet } from './SessionSheet'

interface Props {
  today?: string
  onStart?: (plan: WorkoutPlan) => void
  onNavigate?: (tab: 'ilerleme' | 'antrenman' | 'kutuphane' | 'ayarlar') => void
}

const t = tr.day
/** Bölüm şeridi etiketi: virgül/iki noktadan önceki kısım; "Çarşamba dersi tekrarı" → "Ders tekrarı". */
const blockLabel = (title: string) => {
  if (/ders(i|in)? tekrar/i.test(title)) return 'Ders tekrarı'
  return title.split(/[,:(+]/)[0].trim()
}

const typeOf = (d?: ProgramDay) => (!d ? 'rest' : d.type === 'gym' ? 'gym' : d.type === 'home' ? 'home' : 'rest')
const dotColor = { gym: '#3b82f6', home: '#22c55e', rest: '#f5c518' }

export function TodayScreen({ today = toISODate(new Date()), onStart, onNavigate }: Props) {
  const store = getContentStore()
  const program = store.content.program
  const s = useSettings()
  const rec = useRecords()
  const [startDate, setStartDate] = useState(() => (isoWeekday(today) === 1 ? today : nextMonday(today)))
  const [sheet, setSheet] = useState<{ kind: 'session'; day: ProgramDay; date: string } | { kind: 'journal'; date: string } | null>(null)

  const start = rec.enrollment?.startDate ?? null
  const pos = start ? programPosition(start, today, program.weeks) : null
  const day = pos?.kind === 'active' ? store.programDay(pos.week, pos.dayOfWeek) : undefined
  const isTestDay = pos?.kind === 'active' && program.testDays.some((d) => d.week === pos.week && d.dayOfWeek === pos.dayOfWeek)

  const byDay = useMemo(() => activityByDay(rec.sessions, rec.journals), [rec.sessions, rec.journals])
  const weeks = useMemo(() => weeklySummaries(byDay, today, 6), [byDay, today])
  const streak = useMemo(() => weeklyStreak(byDay, today, s.weeklyGoal), [byDay, today, s.weeklyGoal])
  const spike = loadSpike(weeks)
  const hard = hardDaysInRow(byDay, today)
  const totalMin = rec.sessions.reduce((a, x) => a + Math.round(x.totalSec / 60), 0) + rec.journals.reduce((a, j) => a + (j.minutes ?? 60), 0)
  const doneToday = byDay.has(today)
  const journalToday = rec.journals.some((j) => j.date === today)
  const lastSoreness = rec.journals[0]?.date === addDays(today, -1) ? rec.journals[0].soreness : undefined
  const lessonRepeat = rec.journals.find((j) => j.date === addDays(today, -1))?.repeatTomorrow
  // Son 4 günün en yeni ders günlüğündeki hoca düzeltmesi ve kafa darbesi
  const recentJournal = rec.journals.find((j) => j.date >= addDays(today, -4) && j.date <= today)
  const coachSaid = recentJournal?.correction?.trim() || (recentJournal?.focus ? tr.journal.focus[recentJournal.focus] : '')
  const headHitRecent = rec.journals.some((j) => j.headHit && j.date >= addDays(today, -2))

  const dayType = typeOf(day)
  const nut = nutritionPlan(s.trainingTime, day?.plannedMinutes ?? 60)

  const tomorrow = pos?.kind === 'active' ? store.programDay(Math.floor((pos.dayIndex + 1) / 7) + 1, ((pos.dayIndex + 1) % 7) + 1) : undefined

  const exportIcs = () => {
    if (!start) return
    const items = program.days
      .filter((d) => d.type !== 'gym')
      .map((d) => ({
        date: addDays(start, (d.week - 1) * 7 + d.dayOfWeek - 1),
        start: s.trainingTime,
        minutes: d.plannedMinutes ?? 30,
        title: `Raunt: ${d.titleTr}`,
        description: d.blocks.map((b) => b.titleTr).join(', '),
        alarmBefore: 30,
      }))
    void saveFile(new File([buildIcs(items)], 'raunt-program.ics', { type: 'text/calendar' }))
  }

  const enroll = async () => {
    await records.setEnrollment({ programId: program.id, startDate })
    notifyRecordsChanged()
  }

  const weekDates = start && pos?.kind === 'active' ? Array.from({ length: 7 }, (_, i) => addDays(start, (pos.week - 1) * 7 + i)) : []

  return (
    <section className="screen" aria-labelledby="today-title">
      <div className="screen-kicker">{new Date(today + 'T12:00:00').toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
      <h1 id="today-title" className="screen-title">
        {t.hello(s.name)}
      </h1>

      {!rec.loaded ? null : !start ? (
        <article className="hero" aria-label={t.enrollTitle}>
          <div className="hero-kicker">{t.week(1, program.weeks)}</div>
          <div className="hero-title">{t.enrollTitle}</div>
          <p className="card-muted" style={{ marginTop: 0 }}>
            {t.enrollText}
          </p>
          <label className="field" style={{ margin: '12px 0 16px' }}>
            <span>{t.startDate}</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <BigButton size="primary" onClick={() => void enroll()}>
            {t.enroll}
          </BigButton>
        </article>
      ) : pos?.kind === 'before' ? (
        <div className="card">{t.beforeStart(pos.daysUntilStart)}</div>
      ) : pos?.kind === 'after' ? (
        <article className="hero">
          <div className="hero-title">{t.programDoneTitle}</div>
          <p className="card-muted" style={{ marginTop: 0 }}>
            {t.programDone}
          </p>
          <BigButton
            size="primary"
            onClick={async () => {
              const cycle = (rec.enrollment?.cycle ?? 1) + 1
              await records.setEnrollment({ programId: program.id, startDate: isoWeekday(today) === 1 ? today : nextMonday(today), cycle })
              notifyRecordsChanged()
            }}
          >
            {t.nextBlock((rec.enrollment?.cycle ?? 1) + 1)}
          </BigButton>
          <p className="card-muted">{t.nextBlockHint}</p>
          <BigButton variant="neutral" onClick={() => onNavigate?.('ilerleme')}>
            {t.goTests}
          </BigButton>
        </article>
      ) : (
        <article className="hero" aria-label="Bugünün seansı" data-corner={dayType === 'home' ? undefined : 'blue'}>
          <div className="hero-kicker">
            {(rec.enrollment?.cycle ?? 1) > 1 && `${t.block(rec.enrollment!.cycle!)}, `}
            {pos?.kind === 'active' && t.week(pos.week, program.weeks)}, {tr.weekdays[(pos?.kind === 'active' ? pos.dayOfWeek : 1) - 1]}
          </div>
          <div className="hero-title">{day?.titleTr}</div>
          <p className="pill-row">
            {[
              dayType === 'gym' ? t.typeGym : dayType === 'home' ? t.typeHome : t.typeRest,
              day?.plannedMinutes ? t.planned(day.plannedMinutes) : null,
              day?.rpeTarget ? t.rpe(day.rpeTarget) : null,
            ]
              .filter(Boolean)
              .join(', ')}
            {isTestDay && <span className="badge badge-accent">{t.typeTest}</span>}
          </p>
          {dayType === 'home' && day && day.blocks.length > 1 && (
            <div aria-label="Seansın bölümleri">
              <div className="block-strip" aria-hidden="true">
                {day.blocks.map((b) => (
                  <span key={b.startMin} style={{ flex: Math.max(1, b.endMin - b.startMin) }} />
                ))}
              </div>
              <ol className="block-strip-legend">
                {day.blocks.map((b) => {
                  const len = Math.max(1, b.endMin - b.startMin)
                  const wide = len / (day.plannedMinutes || 60) >= 0.18
                  return (
                    <li key={b.startMin} style={{ flex: len }} title={b.titleTr}>
                      {wide ? blockLabel(b.titleTr) : ''}
                    </li>
                  )
                })}
              </ol>
            </div>
          )}
          {lessonRepeat && dayType === 'home' && (
            <p className="card-muted" style={{ marginTop: 0 }}>
              <strong>{t.lessonRepeat}:</strong> {lessonRepeat}
            </p>
          )}
          {coachSaid && dayType === 'home' && (
            <p className="coach-said">
              <strong>{t.coachSaid}</strong> {coachSaid}
            </p>
          )}
          {headHitRecent && <p className="notice">{tr.safety.concussion} {t.headHitToday}</p>}
          {doneToday && <p className="done-note">✓ {t.doneToday}</p>}
          {dayType === 'gym' ? (
            <BigButton size="primary" onClick={() => setSheet({ kind: 'journal', date: today })}>
              {journalToday ? `✓ ${t.journalDone}` : t.journal}
            </BigButton>
          ) : dayType === 'home' && day ? (
            <BigButton size="primary" onClick={() => setSheet({ kind: 'session', day, date: today })}>
              {t.start}
            </BigButton>
          ) : (
            <>
              <p className="card-muted">{t.restText}</p>
              <BigButton
                onClick={() => onStart?.({ kind: 'routine', config: routineConfig(store, ROUTINES.stretch), title: tr.routines.stretch })}
              >
                {t.stretchNow}
              </BigButton>
            </>
          )}
          {isTestDay && (
            <button type="button" className="link-button" onClick={() => onNavigate?.('ilerleme')}>
              {t.testDay} ›
            </button>
          )}
        </article>
      )}

      {weekDates.length > 0 && (
        <div className="week-strip" style={{ marginTop: 14 }} aria-label="Bu hafta">
          {weekDates.map((d, i) => {
            const pd = pos?.kind === 'active' ? store.programDay(pos.week, i + 1) : undefined
            const ty = typeOf(pd)
            return (
              <button
                key={d}
                type="button"
                className="day-dot"
                data-today={d === today || undefined}
                data-done={byDay.has(d) || undefined}
                data-type={ty}
                style={{ ['--dot' as string]: dotColor[ty] }}
                onClick={() => pd && (ty === 'gym' ? setSheet({ kind: 'journal', date: d }) : setSheet({ kind: 'session', day: pd, date: d }))}
                aria-label={`${tr.weekdays[i]}: ${pd?.titleTr ?? ''}`}
              >
                <span>{tr.weekdaysShort[i]}</span>
                <i />
              </button>
            )
          })}
        </div>
      )}

      {weekDates.length > 0 && <p className="week-legend">Kare salon dersi, daire ev antrenmanı, kesikli çizgi dinlenme günü. Dolu işaret: yapıldı.</p>}

      {(spike.spike || hard >= 6 || (lastSoreness ?? 0) >= 7 || s.ramadan) && (
        <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          {spike.spike && <p className="notice" style={{ margin: 0 }}>{tr.safety.spike}</p>}
          {hard >= 6 && <p className="notice" style={{ margin: 0 }}>{tr.safety.restDay}</p>}
          {(lastSoreness ?? 0) >= 7 && <p className="notice" style={{ margin: 0 }}>{tr.safety.soreness}</p>}
          {((lastSoreness ?? 0) >= 7 || hard >= 6) && (
            <BigButton
              variant="success"
              onClick={() => onStart?.({ kind: 'routine', config: routineConfig(store, ROUTINES.stretch), title: tr.routines.stretch })}
            >
              {t.lightInstead}
            </BigButton>
          )}
          {s.ramadan && <p className="notice" style={{ margin: 0 }}>{t.ramadan}</p>}
        </div>
      )}

      <h2 className="section-title">İlerleme</h2>
      <div className="ring-wrap">
        <Ring value={weeks[weeks.length - 1]?.sessions ?? 0} max={s.weeklyGoal} sub={t.weekGoal} />
        <div className="stat-grid" style={{ flex: 1, gridTemplateColumns: '1fr 1fr' }}>
          <div className="stat">
            <b>{streak.streak}</b>
            <span>{t.streak}</span>
          </div>
          <div className="stat">
            <b>{totalMin}</b>
            <span>{t.totalMin}</span>
          </div>
        </div>
      </div>

      {dayType !== 'gym' && pos?.kind === 'active' && (
        <>
          <h2 className="section-title">{t.nutrition}</h2>
          <div className="card fuel-card">
            <div style={{ display: 'grid', gap: 6, fontWeight: 700 }}>
              <span>{t.lunch(nut.lunchFrom, nut.lunchUntil)}</span>
              <span>{t.water(nut.waterBefore)}</span>
              <span>{t.dinner(nut.dinnerUntil)}</span>
            </div>
            <small className="card-muted">{t.nutritionNote}</small>
          </div>
        </>
      )}

      {tomorrow && (
        <>
          <h2 className="section-title">{t.tomorrow}</h2>
          <div className="list-row">
            <span>
              <strong>{tomorrow.titleTr}</strong>
              <br />
              <small className="card-muted">{typeOf(tomorrow) === 'gym' ? t.typeGym : typeOf(tomorrow) === 'home' ? t.typeHome : t.typeRest}</small>
            </span>
            {tomorrow.plannedMinutes ? <span className="badge">{t.planned(tomorrow.plannedMinutes)}</span> : null}
          </div>
        </>
      )}

      {start && (
        <button type="button" className="big-button" data-variant="neutral" style={{ marginTop: 16 }} onClick={exportIcs}>
          {t.calendar}
        </button>
      )}

      <p className="card-muted" style={{ marginTop: 16, fontSize: 13 }}>
        {tr.safety.warmup}
      </p>

      {sheet?.kind === 'session' && (
        <SessionSheet cycle={rec.enrollment?.cycle ?? 1} day={sheet.day} date={sheet.date} onClose={() => setSheet(null)} onStart={(p) => { setSheet(null); onStart?.(p) }} />
      )}
      {sheet?.kind === 'journal' && <JournalSheet date={sheet.date} onClose={() => setSheet(null)} />}
    </section>
  )
}
