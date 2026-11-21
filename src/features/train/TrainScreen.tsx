import { useState } from 'react'
import { getContentStore } from '../../core/content/contentStore'
import type { TimerConfig } from '../../core/engine/timeline'
import { ROUTINES, routineConfig, routineMinutes, type Routine } from '../../core/program/routines'
import { BigButton } from '../../design/BigButton'
import { Sheet } from '../../design/Sheet'
import { tr } from '../../i18n/tr'
import type { WorkoutPlan } from '../activeWorkout/plan'
import { CoachSetupScreen, type CoachKind } from './CoachSetupScreen'
import { TimerSetupScreen } from './TimerSetupScreen'
import { HuntScreen } from '../camera/HuntScreen'

type Mode = keyof typeof tr.train.modes
const coachModes: Partial<Record<Mode, CoachKind>> = { combo: 'combo', shadow: 'shadow', bag: 'bag', reflex: 'reflex', pad: 'pad' }
const routineModes: Partial<Record<Mode, Routine['id']>> = { warmup: 'warmup', stretch: 'stretch', conditioning: 'conditioning' }

// Köşe rengi türü anlatır: kırmızı = vuruş çalışması, mavi = hazırlık ve toparlanma
const GROUPS: { title: string; corner: 'red' | 'blue'; modes: Mode[] }[] = [
  { title: tr.train.groups.box, corner: 'red', modes: ['combo', 'pad', 'shadow', 'bag', 'reflex', 'hunt', 'timer'] },
  { title: tr.train.groups.body, corner: 'blue', modes: ['warmup', 'conditioning', 'stretch'] },
]

interface Props {
  onStart: (plan: WorkoutPlan) => void
}

export function TrainScreen({ onStart }: Props) {
  const store = getContentStore()
  const [view, setView] = useState<Mode | null>(null)
  const [routine, setRoutine] = useState<Routine | null>(null)

  if (view === 'timer')
    return <TimerSetupScreen onBack={() => setView(null)} onStart={(config: TimerConfig) => onStart({ kind: 'timer', config })} />
  if (view === 'hunt') return <HuntScreen onClose={() => setView(null)} />
  const ck = view ? coachModes[view] : undefined
  if (ck) return <CoachSetupScreen kind={ck} onBack={() => setView(null)} onStart={onStart} />

  const open = (m: Mode) => {
    const r = routineModes[m]
    if (r) setRoutine(ROUTINES[r])
    else setView(m)
  }

  return (
    <section className="screen" aria-labelledby="train-title">
      <h1 id="train-title" className="screen-title">
        {tr.train.title}
      </h1>
      {GROUPS.map((g) => (
        <div key={g.title}>
          <h2 className="section-title">{g.title}</h2>
          <ul className="mode-list">
            {g.modes.map((m) => {
              const r = routineModes[m]
              return (
                <li key={m}>
                  <button type="button" className="mode-row" data-corner={g.corner} onClick={() => open(m)}>
                    <span>
                      <strong>{tr.train.modes[m]}</strong>
                      <span>{tr.train.modeHints[m]}</span>
                    </span>
                    {r && <em>{tr.routines.minutes(routineMinutes(ROUTINES[r]))}</em>}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}

      {routine && (
        <Sheet title={tr.routines[routine.id]} onClose={() => setRoutine(null)}>
          <p className="card-muted" style={{ marginTop: 0 }}>
            {tr.routines[`${routine.id}Hint`]}. Toplam {tr.routines.minutes(routineMinutes(routine))}.
          </p>
          <ol className="steps">
            {routine.items.map((it) => (
              <li key={it.exerciseId}>
                <span>{store.exercise(it.exerciseId)?.nameTr ?? it.exerciseId}</span>
                <small>{it.sec} sn</small>
              </li>
            ))}
          </ol>
          {routine.sets > 1 && <p className="card-muted">Bu liste {routine.sets} kez tekrarlanır.</p>}
          {routine.id === 'conditioning' && <p className="notice">{tr.safety.plank}</p>}
          <BigButton
            size="primary"
            onClick={() => {
              const r = routine
              setRoutine(null)
              onStart({ kind: 'routine', config: routineConfig(store, r), title: tr.routines[r.id] })
            }}
          >
            {tr.train.routineStart}
          </BigButton>
        </Sheet>
      )}
    </section>
  )
}
