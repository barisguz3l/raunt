import { useEffect, useMemo, useState } from 'react'
import { StickFigure } from '../../animations/StickFigure'
import { getContentStore } from '../../core/content/contentStore'
import type { Combo, Exercise, Move } from '../../core/content/types'
import { useSettings } from '../../core/settings/settings'
import { spokenPhrase } from '../../core/speech/stanceMapper'
import { tr } from '../../i18n/tr'
import { ComboDetail } from '../combos/ComboDetail'
import { ComboList } from '../combos/ComboList'
import { ComboEditor } from '../combos/ComboEditor'
import { BigButton } from '../../design/BigButton'
import { comboTokens, tokenLabel } from '../combos/comboModel'
import type { WorkoutPlan } from '../activeWorkout/plan'
import { SkeletonRecorder } from '../camera/SkeletonRecorder'

type View =
  | { kind: 'home' }
  | { kind: 'combos' }
  | { kind: 'combo'; combo: Combo; from: View }
  | { kind: 'exercise'; ex: Exercise }
  | { kind: 'move'; move: Move }
  | { kind: 'glossary' }
  | { kind: 'editor'; combo?: Combo; preset?: { nameTr: string; moveIds: string[] } }

const l = tr.library
const norm = (s: string) => s.toLocaleLowerCase('tr-TR')

export function LibraryScreen({ shared, onStart }: { shared?: { nameTr: string; moveIds: string[] } | null; onStart?: (plan: WorkoutPlan) => void }) {
  const store = getContentStore()
  const { content } = store
  const s = useSettings()
  const [view, setView] = useState<View>(shared ? { kind: 'editor', preset: shared } : { kind: 'home' })
  // Görünüm değişince sayfa başına dön (detay ortadan açılmasın)
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [view])
  const [q, setQ] = useState('')
  const groups = [...new Set(content.exercises.map((e) => e.group))]

  const results = useMemo(() => {
    const n = norm(q.trim())
    if (!n) return null
    return {
      ex: content.exercises.filter((e) => norm(e.nameTr + ' ' + e.steps.join(' ')).includes(n)),
      mv: content.moves.filter((m) => norm(m.nameTr + ' ' + m.shortTr).includes(n)),
    }
  }, [q, content])

  const back = () => setView({ kind: 'home' })

  if (view.kind === 'editor')
    return <ComboEditor initial={view.combo} preset={view.preset} onDone={(c) => setView(c ? { kind: 'combo', combo: c, from: { kind: 'combos' } } : { kind: 'combos' })} />
  if (view.kind === 'combo')
    return <ComboDetail combo={view.combo} onBack={() => setView(view.from)} onEdit={(c) => setView({ kind: 'editor', combo: c })} onStart={onStart} />
  if (view.kind === 'combos')
    return (
      <section className="screen" aria-labelledby="combos-title">
        <button type="button" className="back-link" onClick={back}>
          ‹ {l.back}
        </button>
        <h1 id="combos-title" className="screen-title">
          {tr.combos.title}
        </h1>
        <BigButton style={{ marginBottom: 12 }} onClick={() => setView({ kind: 'editor' })}>
          {tr.editor.newCombo}
        </BigButton>
        <ComboList mode="browse" coachApproved={s.coachApproved} onOpen={(combo) => setView({ kind: 'combo', combo, from: { kind: 'combos' } })} />
      </section>
    )
  if (view.kind === 'exercise') return <ExerciseCard ex={view.ex} onBack={back} onCombo={(c) => setView({ kind: 'combo', combo: c, from: view })} />
  if (view.kind === 'move') return <MoveCard move={view.move} onBack={back} onCombo={(c) => setView({ kind: 'combo', combo: c, from: view })} />
  if (view.kind === 'glossary')
    return (
      <section className="screen" aria-labelledby="gl-title">
        <button type="button" className="back-link" onClick={back}>
          ‹ {l.back}
        </button>
        <h1 id="gl-title" className="screen-title">
          {l.glossary}
        </h1>
        <p className="card-muted">{l.glossaryHint}</p>
        {Object.keys(l.categories).map((cat) => (
          <div key={cat}>
            <h2 className="section-title">{l.categories[cat]}</h2>
            {content.moves
              .filter((m) => m.category === cat)
              .map((m) => (
                <button key={m.id} type="button" className="combo-row" onClick={() => setView({ kind: 'move', move: m })}>
                  <span className="combo-row-main">
                    <strong>{m.nameTr}</strong>
                    <span className="card-muted">
                      {l.says}: “{spokenPhrase(m, s.stance, 'names', s.nameStyle)}”{m.pad ? ` · ${m.pad}` : ''}
                    </span>
                  </span>
                  {m.coachApproval && <span className="badge badge-lock">🔒</span>}
                  <span aria-hidden="true">›</span>
                </button>
              ))}
          </div>
        ))}
      </section>
    )

  return (
    <section className="screen" aria-labelledby="library-title">
      <h1 id="library-title" className="screen-title">
        {l.title}
      </h1>
      <input className="search" type="search" placeholder={l.search} aria-label={l.search} value={q} onChange={(e) => setQ(e.target.value)} />

      {results ? (
        <>
          {results.ex.length + results.mv.length === 0 && <div className="card empty">{l.noResults}</div>}
          {results.ex.map((e) => (
            <button key={e.id} type="button" className="combo-row" onClick={() => setView({ kind: 'exercise', ex: e })}>
              <span className="combo-row-main">
                <strong>{e.nameTr}</strong>
                <span className="card-muted">{e.group}</span>
              </span>
              <span aria-hidden="true">›</span>
            </button>
          ))}
          {results.mv.map((m) => (
            <button key={m.id} type="button" className="combo-row" onClick={() => setView({ kind: 'move', move: m })}>
              <span className="combo-row-main">
                <strong>{m.nameTr}</strong>
                <span className="card-muted">{l.categories[m.category]}</span>
              </span>
              <span aria-hidden="true">›</span>
            </button>
          ))}
        </>
      ) : (
        <>
          <ul className="mode-list" style={{ marginTop: 4 }}>
            <li>
              <button type="button" className="mode-row" onClick={() => setView({ kind: 'combos' })}>
                <span>
                  <strong>{tr.combos.title}</strong>
                  <span>
                    {[1, 2, 3].map((x) => `${tr.coach.level(x)}: ${content.combos.filter((c) => c.level === x).length}`).join(', ') +
                      `, ${content.combos.filter((c) => c.requiresCoachApproval).length} kilitli`}
                  </span>
                </span>
              </button>
            </li>
            <li>
              <button type="button" className="mode-row" data-corner="blue" onClick={() => setView({ kind: 'glossary' })}>
                <span>
                  <strong>{l.glossary}</strong>
                  <span>{l.glossaryHint}</span>
                </span>
              </button>
            </li>
          </ul>

          {groups.map((g) => (
            <div key={g}>
              <h2 className="section-title">
                {g} <small>{l.count(content.exercises.filter((e) => e.group === g).length)}</small>
              </h2>
              <div className="h-scroll">
                {content.exercises
                  .filter((e) => e.group === g)
                  .map((e) => (
                    <button key={e.id} type="button" className="tech-card" onClick={() => setView({ kind: 'exercise', ex: e })}>
                      <StickFigure animKey={e.animationKey || 'guard'} size={96} paused />
                      <strong>{e.nameTr}</strong>
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </>
      )}
    </section>
  )
}

function relatedCombos(animationKey: string): Combo[] {
  const store = getContentStore()
  return store.content.combos.filter((c) => store.comboMoves(c).some((m) => m.animationKey === animationKey)).slice(0, 8)
}

function ExerciseCard({ ex, onBack, onCombo }: { ex: Exercise; onBack: () => void; onCombo: (c: Combo) => void }) {
  const s = useSettings()
  const [mirror, setMirror] = useState(s.stance === 'southpaw')
  const [paused, setPaused] = useState(false)
  const combos = relatedCombos(ex.animationKey)
  return (
    <section className="screen" aria-labelledby="ex-title">
      <button type="button" className="back-link" onClick={onBack}>
        ‹ {l.back}
      </button>
      <div className="anim-stage">
        <StickFigure animKey={ex.animationKey || 'guard'} mirror={mirror} paused={paused} size={240} />
        <div className="anim-controls">
          <button type="button" className="chip" aria-pressed={paused} onClick={() => setPaused(!paused)}>
            {paused ? `▶ ${l.play}` : `❚❚ ${l.pause}`}
          </button>
          <button type="button" className="chip" aria-pressed={mirror} onClick={() => setMirror(!mirror)}>
            {l.mirror}
          </button>
        </div>
      </div>
      <div className="screen-kicker">{ex.group}</div>
      <h1 id="ex-title" className="screen-title">
        {ex.nameTr}
      </h1>
      <h2 className="section-title">{l.steps}</h2>
      <ol className="steps">
        {ex.steps.map((st, i) => (
          <li key={i}>{st}</li>
        ))}
      </ol>
      <SkeletonRecorder storeKey={`ex:${ex.id}`} />
      {ex.commonMistakes && (
        <>
          <h2 className="section-title">{l.mistakes}</h2>
          <div className="card card-muted">{ex.commonMistakes}</div>
        </>
      )}
      {ex.coachingCue && (
        <>
          <h2 className="section-title">{l.cue}</h2>
          <div className="card">{ex.coachingCue}</div>
        </>
      )}
      {(ex.id === 'plank' || ex.id === 'mekik') && <p className="notice">{tr.safety.plank}</p>}
      {ex.referenceVideos?.length ? (
        <>
          <h2 className="section-title">{l.videos}</h2>
          {ex.referenceVideos.map((v) => (
            <a key={v.youtubeId} className="combo-row" href={`https://www.youtube.com/watch?v=${v.youtubeId}`} target="_blank" rel="noopener noreferrer">
              <span className="combo-row-main">
                <strong>{v.title}</strong>
                <span className="card-muted">{v.turkish ? 'Türkçe' : ''}</span>
              </span>
              <span aria-hidden="true">↗</span>
            </a>
          ))}
        </>
      ) : null}
      {combos.length > 0 && <RelatedCombos combos={combos} onCombo={onCombo} />}
      <p className="card-muted" style={{ fontSize: 13, marginTop: 20 }}>
        {l.disclaimer}
      </p>
    </section>
  )
}

function MoveCard({ move, onBack, onCombo }: { move: Move; onBack: () => void; onCombo: (c: Combo) => void }) {
  const s = useSettings()
  const store = getContentStore()
  const combos = store.content.combos.filter((c) => c.steps.some((x) => x.move === move.id)).slice(0, 8)
  return (
    <section className="screen" aria-labelledby="mv-title">
      <button type="button" className="back-link" onClick={onBack}>
        ‹ {l.back}
      </button>
      <div className="anim-stage">
        <StickFigure animKey={move.animationKey} mirror={s.stance === 'southpaw'} size={220} />
      </div>
      <div className="screen-kicker">{l.categories[move.category]}</div>
      <h1 id="mv-title" className="screen-title">
        {move.nameTr}
      </h1>
      <div className="pill-row" style={{ marginTop: 0 }}>
        <span className="pill">“{spokenPhrase(move, s.stance, 'names', s.nameStyle)}”</span>
        {move.pad ? <span className="pill">#{move.pad}</span> : null}
        {move.coachApproval && <span className="pill badge-lock">🔒 {l.locked}</span>}
      </div>
      {move.coachApproval && !s.coachApproved && <p className="notice">{tr.safety.kickLock}</p>}
      <h2 className="section-title">{l.steps}</h2>
      <ol className="steps">
        {move.steps.map((st, i) => (
          <li key={i}>{st}</li>
        ))}
      </ol>
      <SkeletonRecorder storeKey={`move:${move.id}`} />
      <h2 className="section-title">{l.mistakes}</h2>
      <ul className="steps">
        {move.mistakes.map((m, i) => (
          <li key={i}>{m}</li>
        ))}
      </ul>
      {combos.length > 0 && <RelatedCombos combos={combos} onCombo={onCombo} />}
    </section>
  )
}

function RelatedCombos({ combos, onCombo }: { combos: Combo[]; onCombo: (c: Combo) => void }) {
  const store = getContentStore()
  return (
    <>
      <h2 className="section-title">{l.related}</h2>
      {combos.map((c) => (
        <button key={c.id} type="button" className="combo-row" onClick={() => onCombo(c)}>
          <span className="combo-row-main">
            <strong className="combo-code">{tokenLabel(comboTokens(store, c))}</strong>
            <span>{c.nameTr}</span>
          </span>
          <span aria-hidden="true">›</span>
        </button>
      ))}
    </>
  )
}
