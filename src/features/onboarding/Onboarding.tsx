import { useEffect, useRef, useState } from 'react'
import { getContentStore } from '../../core/content/contentStore'
import { isoWeekday, nextMonday, toISODate } from '../../core/program/schedule'
import { notifyRecordsChanged, records } from '../../core/records/records'
import { settingsStore, useSettings } from '../../core/settings/settings'
import { BigButton } from '../../design/BigButton'
import { ChoiceGroup } from '../../design/ChoiceGroup'
import { Stepper } from '../../design/Stepper'
import { tr } from '../../i18n/tr'

const o = tr.onboarding
const STEPS = 6

/** İlk açılış: hoş geldin → sağlık notu → duruş → hedef → program → alışkanlık planı. */
export function Onboarding() {
  const s = useSettings()
  const [i, setI] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    root.current?.scrollTo(0, 0)
  }, [i])
  const [name, setName] = useState(s.name)
  const [weight, setWeight] = useState(s.weightKg?.toString() ?? '')
  const today = toISODate(new Date())
  const [startDate, setStartDate] = useState(() => (isoWeekday(today) === 1 ? today : nextMonday(today)))
  const [enroll, setEnroll] = useState(true)
  const [ifThen, setIfThen] = useState(s.ifThen)
  const [obstacle, setObstacle] = useState(s.obstaclePlan)

  const [error, setError] = useState<string | null>(null)
  const finish = async () => {
    const n = Number(weight.replace(',', '.'))
    try {
      // Önce program kaydı, sonra "karşılama bitti" (Bugün ekranı doğru kartla açılsın)
      if (enroll) {
        const existing = await records.enrollment()
        if (!existing) await records.setEnrollment({ programId: getContentStore().content.program.id, startDate })
        notifyRecordsChanged()
      }
      if (location.hash !== '#/kutuphane') history.replaceState(null, '', '#/bugun')
      await settingsStore.update({
        name: name.trim(),
        weightKg: weight.trim() && n >= 30 && n <= 250 ? Math.round(n * 10) / 10 : s.weightKg,
        ifThen: ifThen.trim(),
        obstaclePlan: obstacle.trim(),
        onboardingDone: true,
      })
    } catch {
      setError(o.saveError)
    }
  }

  const canNext = i !== 1 || s.healthAccepted
  const next = () => (i < STEPS - 1 ? setI(i + 1) : void finish())

  return (
    <div ref={root} className="onboarding" role="dialog" aria-modal="true" aria-labelledby="ob-title">
      <div className="onboarding-top">
        {i > 0 ? (
          <button type="button" className="back-link" onClick={() => setI(i - 1)}>
            ‹ {o.back}
          </button>
        ) : (
          <span />
        )}
        <ol className="onboarding-dots" aria-label={o.step(i + 1, STEPS)}>
          {Array.from({ length: STEPS }, (_, k) => (
            <li key={k} data-on={k <= i || undefined} />
          ))}
        </ol>
      </div>

      <div className="onboarding-body" key={i}>
        {i === 0 && (
          <>
            <img className="onboarding-logo" src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" width={96} height={96} />
            <h1 id="ob-title" className="onboarding-title">
              {o.welcomeTitle}
            </h1>
            <p className="onboarding-text">{o.welcomeText}</p>
            <ul className="onboarding-points">
              {o.welcomePoints.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </>
        )}

        {i === 1 && (
          <>
            <h1 id="ob-title" className="onboarding-title">
              {o.healthTitle}
            </h1>
            <p className="notice">{tr.safety.healthNote}</p>
            <p className="notice">{tr.safety.backPain}</p>
            <p className="notice">{tr.safety.kickLock}</p>
            <label className="check-row">
              <input type="checkbox" checked={s.healthAccepted} onChange={(e) => void settingsStore.update({ healthAccepted: e.target.checked })} />
              <span>{o.healthAccept}</span>
            </label>
          </>
        )}

        {i === 2 && (
          <>
            <h1 id="ob-title" className="onboarding-title">
              {o.stanceTitle}
            </h1>
            <label className="field">
              <span>{o.nameLabel}</span>
              <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder={tr.settings.namePh} />
            </label>
            <ChoiceGroup
              label={tr.profile.stance}
              value={s.stance}
              onChange={(stance) => void settingsStore.update({ stance })}
              options={[
                { value: 'orthodox', label: tr.profile.orthodox, hint: tr.profile.orthodoxHint },
                { value: 'southpaw', label: tr.profile.southpaw, hint: tr.profile.southpawHint },
              ]}
            />
            <p className="card-muted">{o.stanceText}</p>
          </>
        )}

        {i === 3 && (
          <>
            <h1 id="ob-title" className="onboarding-title">
              {o.goalTitle}
            </h1>
            <p className="onboarding-text">{o.goalText}</p>
            <Stepper
              label={tr.settings.weeklyGoal}
              value={s.weeklyGoal}
              display={(v) => `${v} / hafta`}
              min={1}
              max={7}
              stepUp={(v) => v + 1}
              stepDown={(v) => v - 1}
              onChange={(weeklyGoal) => void settingsStore.update({ weeklyGoal })}
            />
            <label className="field">
              <span>{o.timeLabel}</span>
              <input type="time" value={s.trainingTime} onChange={(e) => /^\d{2}:\d{2}$/.test(e.target.value) && void settingsStore.update({ trainingTime: e.target.value })} />
            </label>
            <label className="field">
              <span>{o.weightLabel}</span>
              <input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="—" />
              {weight.trim() !== '' && !(Number(weight.replace(',', '.')) >= 30 && Number(weight.replace(',', '.')) <= 250) && (
                <small className="card-muted">{o.weightInvalid}</small>
              )}
            </label>
          </>
        )}

        {i === 4 && (
          <>
            <h1 id="ob-title" className="onboarding-title">
              {o.programTitle}
            </h1>
            <p className="onboarding-text">{o.programText}</p>
            <ChoiceGroup
              label={o.programTitle}
              value={enroll ? 'yes' : 'no'}
              onChange={(v) => setEnroll(v === 'yes')}
              options={[
                { value: 'yes', label: o.programStart },
                { value: 'no', label: o.programLater },
              ]}
            />
            {enroll && (
              <label className="field">
                <span>{tr.day.startDate}</span>
                <input type="date" value={startDate} onChange={(e) => e.target.value && setStartDate(e.target.value)} />
              </label>
            )}
          </>
        )}

        {i === 5 && (
          <>
            <h1 id="ob-title" className="onboarding-title">
              {o.habitTitle}
            </h1>
            <p className="onboarding-text">{o.habitText}</p>
            <label className="field">
              <span>{tr.settings.ifThen}</span>
              <textarea rows={3} value={ifThen} maxLength={200} placeholder={tr.settings.ifThenPh} onChange={(e) => setIfThen(e.target.value)} />
            </label>
            <label className="field">
              <span>{tr.settings.obstacle}</span>
              <textarea rows={3} value={obstacle} maxLength={200} placeholder={tr.settings.obstaclePh} onChange={(e) => setObstacle(e.target.value)} />
            </label>
          </>
        )}
      </div>

      <div className="onboarding-actions">
        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
        <BigButton size="primary" disabled={!canNext} onClick={next}>
          {i === STEPS - 1 ? o.finish : o.next}
        </BigButton>
      </div>
    </div>
  )
}
