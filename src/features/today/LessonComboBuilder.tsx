import { useState, type Dispatch, type SetStateAction } from 'react'
import { getContentStore } from '../../core/content/contentStore'
import type { Move, MoveCategory } from '../../core/content/types'
import { useSettings } from '../../core/settings/settings'
import { spokenPhrase } from '../../core/speech/stanceMapper'
import { tr } from '../../i18n/tr'

const cats: MoveCategory[] = ['punch', 'kick', 'knee', 'defense']
export const LESSON_MAX_STEPS = 6
const l = tr.lessonCombo

/** Ders günlüğünde kısa kombinasyon seçici (2–6 adım). Kombo editörünün hareket ızgarasıyla aynı. */
export function LessonComboBuilder({ steps, onChange }: { steps: Move[]; onChange: Dispatch<SetStateAction<Move[]>> }) {
  const store = getContentStore()
  const s = useSettings()
  const [cat, setCat] = useState<MoveCategory>('punch')
  const full = steps.length >= LESSON_MAX_STEPS

  return (
    <div className="lesson-builder">
      <div className="setting-label">{l.journalTitle}</div>
      <p className="card-muted" style={{ margin: '4px 0 10px' }}>
        {l.journalHint}
      </p>
      <div className="card lesson-strip" aria-live="polite">
        {steps.length ? (
          <ol className="lesson-steps tabular">
            {steps.map((m, i) => (
              <li key={i}>{m.shortTr}</li>
            ))}
          </ol>
        ) : (
          <span className="card-muted">{l.empty}</span>
        )}
        <div className="lesson-strip-foot">
          <small className="card-muted">{l.count(steps.length)}</small>
          <span>
            <button type="button" className="link-button" disabled={!steps.length} onClick={() => onChange((xs) => xs.slice(0, -1))}>
              {l.undo}
            </button>
            <button type="button" className="link-button" disabled={!steps.length} onClick={() => onChange([])}>
              {l.clear}
            </button>
          </span>
        </div>
      </div>
      {steps.some((m) => m.coachApproval) && <p className="notice">{tr.safety.kickLock}</p>}
      <div className="chips" role="group" aria-label={l.journalTitle} style={{ margin: '10px 0 8px' }}>
        {cats.map((c) => (
          <button key={c} type="button" className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>
            {tr.library.categories[c]}
          </button>
        ))}
      </div>
      <div className="move-grid move-grid-compact">
        {store.content.moves
          .filter((m) => m.category === cat)
          .map((m) => (
            <button key={m.id} type="button" className="move-tile" disabled={full} onClick={() => onChange((xs) => (xs.length >= LESSON_MAX_STEPS ? xs : [...xs, m]))}>
              <b>{m.shortTr}</b>
              <small>{spokenPhrase(m, s.stance, 'names', s.nameStyle)}</small>
            </button>
          ))}
      </div>
      {steps.length === 1 && <p className="card-muted">{l.tooShort}</p>}
    </div>
  )
}
