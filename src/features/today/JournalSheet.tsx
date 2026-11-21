import { useState } from 'react'
import { newId, notifyRecordsChanged, records } from '../../core/records/records'
import { BigButton } from '../../design/BigButton'
import { Sheet } from '../../design/Sheet'
import { tr } from '../../i18n/tr'
import { settingsStore } from '../../core/settings/settings'
import { Toggle } from '../../design/Toggle'

type Focus = 'guardUp' | 'chinDown' | 'breathe' | 'relax'
const FOCI: Focus[] = ['guardUp', 'chinDown', 'breathe', 'relax']

/** S-11 Ders günlüğü: 4 soru + zorluk + süre. Cevap sonraki ev gününde "Ders tekrarı" olarak görünür. */
export function JournalSheet({ date, onClose }: { date: string; onClose: () => void }) {
  const j = tr.journal
  const [learned, setLearned] = useState('')
  const [correction, setCorrection] = useState('')
  const [soreness, setSoreness] = useState<number>(3)
  const [repeat, setRepeat] = useState('')
  const [rpe, setRpe] = useState<number>(6)
  const [minutes, setMinutes] = useState(60)
  const [focus, setFocus] = useState<Focus | null>(null)
  const [headHit, setHeadHit] = useState(false)

  const save = async () => {
    await records.saveJournal({ id: newId('j'), date, learned, correction, soreness, repeatTomorrow: repeat, rpe, minutes, focus, headHit })
    // Hocanın düzeltmesi bir sonraki ev antrenmanında koçun odağı olur
    if (focus) await settingsStore.update({ coachFocus: focus })
    notifyRecordsChanged()
    onClose()
  }

  return (
    <Sheet title={j.title} onClose={onClose}>
      <div style={{ display: 'grid', gap: 14 }}>
        <label className="field">
          <span>{j.learned}</span>
          <textarea className="textarea" value={learned} onChange={(e) => setLearned(e.target.value)} placeholder="sol direkt, kroşe, ön diz…" />
        </label>
        <label className="field">
          <span>{j.correction}</span>
          <textarea className="textarea" value={correction} onChange={(e) => setCorrection(e.target.value)} placeholder="Gard düşüyor, ayak dönmüyor…" />
        </label>
        <div>
          <p className="card-muted" style={{ margin: '0 0 8px' }}>
            {j.focusLabel}
          </p>
          <div className="chips" role="group" aria-label={j.focusLabel}>
            {FOCI.map((f) => (
              <button key={f} type="button" className="chip" aria-pressed={focus === f} onClick={() => setFocus(focus === f ? null : f)}>
                {j.focus[f]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="setting-label">{j.soreness}</div>
          <div className="scale" role="group" aria-label={j.soreness}>
            {Array.from({ length: 11 }, (_, i) => i).map((n) => (
              <button key={n} type="button" aria-pressed={soreness === n} onClick={() => setSoreness(n)}>
                {n}
              </button>
            ))}
          </div>
          {soreness >= 7 && <p className="notice">{tr.safety.soreness}</p>}
        </div>
        <label className="field">
          <span>{j.repeat}</span>
          <textarea className="textarea" value={repeat} onChange={(e) => setRepeat(e.target.value)} placeholder="1-2-3 ve ön diz, gard yukarı…" />
        </label>
        <div>
          <div className="setting-label">{j.rpe}</div>
          <div className="scale" role="group" aria-label={j.rpe}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" aria-pressed={rpe === n} onClick={() => setRpe(n)}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <Toggle label={j.headHit} checked={headHit} onChange={setHeadHit} />
        {headHit && <p className="notice">{tr.safety.concussion}</p>}
        <label className="field">
          <span>{j.minutes}</span>
          <input type="number" min={15} max={180} value={minutes} onChange={(e) => setMinutes(Number(e.target.value) || 60)} />
        </label>
        <BigButton variant="success" onClick={() => void save()}>{j.save}</BigButton>
      </div>
    </Sheet>
  )
}
