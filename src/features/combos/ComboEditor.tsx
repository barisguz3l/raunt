import { useState } from 'react'
import { audio } from '../../core/audio/audioService'
import { voice } from '../../core/audio/voiceService'
import { getContentStore } from '../../core/content/contentStore'
import type { Combo, Move, MoveCategory } from '../../core/content/types'
import { useSettings } from '../../core/settings/settings'
import { spokenPhrase } from '../../core/speech/stanceMapper'
import { BigButton } from '../../design/BigButton'
import { tr } from '../../i18n/tr'
import { autoName, parseShare, saveUserCombo, validateSteps } from './userCombos'

interface Props {
  initial?: Combo
  preset?: { nameTr: string; moveIds: string[] }
  onDone: (c: Combo | null) => void
}

const e = tr.editor
const cats: MoveCategory[] = ['punch', 'kick', 'knee', 'defense', 'footwork']

/** S-07b Kombo editörü: kategoriye göre hareket seç, sırala, dinle, kaydet (2–8 adım). */
export function ComboEditor({ initial, preset, onDone }: Props) {
  const store = getContentStore()
  const s = useSettings()
  const startIds = initial ? initial.steps.map((x) => x.move) : (preset?.moveIds ?? [])
  const [steps, setSteps] = useState<Move[]>(startIds.map((id) => store.move(id)).filter((m): m is Move => !!m))
  const [name, setName] = useState(initial?.nameTr ?? preset?.nameTr ?? '')
  const [cat, setCat] = useState<MoveCategory>('punch')
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const [paste, setPaste] = useState('')
  const [pasteErr, setPasteErr] = useState(false)
  // Safari'de açılan paylaşım: ana ekrandaki uygulamanın verisi ayrı (iOS)
  const inBrowserTab = !!preset && !(window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone)
  const applyPaste = (text: string) => {
    setPaste(text)
    const i = text.indexOf('#/kombo/')
    const p = i >= 0 ? parseShare(text.slice(i)) : null
    setPasteErr(!!text.trim() && !p)
    if (!p) return
    setSteps(p.moveIds.map((id) => store.move(id)).filter((m): m is Move => !!m))
    if (p.nameTr) setName(p.nameTr)
  }
  const err = validateSteps(steps)
  const locked = steps.some((m) => m.coachApproval)

  const move = (i: number, d: number) =>
    setSteps((xs) => {
      const j = i + d
      if (j < 0 || j >= xs.length) return xs
      const n = [...xs]
      ;[n[i], n[j]] = [n[j], n[i]]
      return n
    })

  const listen = async () => {
    const phrases = steps.map((m) => spokenPhrase(m, s.stance, s.callMode, s.nameStyle))
    await audio.unlock()
    await voice.preload(phrases)
    voice.speak(phrases)
  }

  return (
    <section className="screen" aria-labelledby="ed-title">
      <button type="button" className="back-link" onClick={() => onDone(null)}>
        ‹ {tr.combos.back}
      </button>
      <h1 id="ed-title" className="screen-title">
        {initial ? e.editTitle : e.title}
      </h1>

      {inBrowserTab && <p className="notice">{e.safariNote}</p>}
      {!initial && !preset && (
        <label className="field" style={{ marginBottom: 12 }}>
          <span>{e.pasteLabel}</span>
          <input value={paste} onChange={(ev) => applyPaste(ev.target.value)} placeholder={e.pastePh} inputMode="url" />
          {pasteErr && <small className="card-muted">{e.pasteErr}</small>}
        </label>
      )}
      <div className="card editor-strip" aria-live="polite">
        {steps.length === 0 ? (
          <span className="card-muted">{e.empty}</span>
        ) : (
          <ol className="editor-steps">
            {steps.map((m, i) => (
              <li key={i}>
                <span className="editor-step-name">
                  <b>{i + 1}.</b> {spokenPhrase(m, s.stance, 'names', s.nameStyle)}
                  {m.coachApproval && ' 🔒'}
                </span>
                <span className="editor-step-actions">
                  <button type="button" aria-label={e.up} onClick={() => move(i, -1)} disabled={i === 0}>
                    ↑
                  </button>
                  <button type="button" aria-label={e.down} onClick={() => move(i, 1)} disabled={i === steps.length - 1}>
                    ↓
                  </button>
                  <button type="button" aria-label={e.remove} onClick={() => setSteps((xs) => xs.filter((_, k) => k !== i))}>
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
      {locked && <p className="notice">{tr.safety.kickLock}</p>}

      <h2 className="section-title">{e.add}</h2>
      <div className="chips" role="group" aria-label={e.add}>
        {cats.map((c) => (
          <button key={c} type="button" className="chip" aria-pressed={cat === c} onClick={() => setCat(c)}>
            {tr.library.categories[c]}
          </button>
        ))}
      </div>
      <div className="move-grid">
        {store.content.moves
          .filter((m) => m.category === cat)
          .map((m) => (
            <button key={m.id} type="button" className="move-tile" disabled={steps.length >= 8} onClick={() => setSteps((xs) => [...xs, m])}>
              <b>{m.shortTr}</b>
              <small>{spokenPhrase(m, s.stance, 'names', s.nameStyle)}</small>
              {m.coachApproval && <i>🔒</i>}
            </button>
          ))}
      </div>

      <label className="field" style={{ marginTop: 16 }}>
        <span>{e.name}</span>
        <input value={name} onChange={(ev) => setName(ev.target.value.replace(/\|/g, ''))} maxLength={40} placeholder={steps.length ? autoName(steps) : e.namePh} />
      </label>
      {err && steps.length > 0 && <p className="card-muted">{err}</p>}
      {saveErr && (
        <p className="notice" role="alert">
          {saveErr}
        </p>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginTop: 14 }}>
        <BigButton variant="neutral" disabled={!steps.length} onClick={() => void listen()}>
          {tr.coach.listen}
        </BigButton>
        <BigButton
          disabled={!!err || saving}
          onClick={async () => {
            if (saving) return
            setSaving(true)
            setSaveErr(null)
            try {
              onDone(await saveUserCombo({ id: initial?.id, nameTr: name, moves: steps }))
            } catch {
              setSaveErr(e.saveErr)
              setSaving(false)
            }
          }}
        >
          {e.save}
        </BigButton>
      </div>
    </section>
  )
}
