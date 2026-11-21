import { audio } from '../../core/audio/audioService'
import { voice } from '../../core/audio/voiceService'
import { getContentStore } from '../../core/content/contentStore'
import type { Combo } from '../../core/content/types'
import { useSettings } from '../../core/settings/settings'
import { spokenPhrase } from '../../core/speech/stanceMapper'
import { BigButton } from '../../design/BigButton'
import { tr } from '../../i18n/tr'
import { comboTokens, isLocked } from './comboModel'
import { deleteUserCombo, shareLink } from './userCombos'
import type { WorkoutPlan } from '../activeWorkout/plan'

/** Web Share varsa paylaş; yoksa bağlantıyı panoya kopyala. */
async function share(combo: Combo) {
  const url = shareLink(combo)
  try {
    if (navigator.share) await navigator.share({ title: combo.nameTr, text: 'Raunt kombinasyonu', url })
    else {
      await navigator.clipboard.writeText(url)
      alert(tr.editor.copied)
    }
  } catch {
    /* kullanıcı vazgeçti */
  }
}

interface Props {
  combo: Combo
  onBack: () => void
  onEdit?: (c: Combo) => void
  onStart?: (plan: WorkoutPlan) => void
}

/** S-07 Kombo detay: adımlar (numara + duruşa göre ad), açıklama, Dinle. */
export function ComboDetail({ combo, onBack, onEdit, onStart }: Props) {
  const store = getContentStore()
  const s = useSettings()
  const moves = store.comboMoves(combo)
  const locked = isLocked(store, combo)
  const tokens = comboTokens(store, combo)
  const phrases = moves.map((m) => spokenPhrase(m, s.stance, s.callMode, s.nameStyle))

  const listen = async () => {
    await audio.unlock()
    await voice.preload(phrases)
    voice.speak(phrases)
  }

  return (
    <section className="screen" aria-labelledby="combo-title">
      <button type="button" className="back-link" onClick={onBack}>
        ‹ {tr.combos.back}
      </button>
      <ol className="combo-hero tabular" aria-hidden="true">
        {tokens.map((tk, i) => (
          <li key={i}>{tk}</li>
        ))}
      </ol>
      <h1 id="combo-title" className="screen-title" style={{ marginTop: 4 }}>
        {combo.nameTr}
      </h1>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <span className="badge">{tr.coach.level(combo.level)}</span>
        <span className="badge">{tr.combos.focus[combo.focus]}</span>
        {locked && <span className="badge badge-lock">🔒 {tr.combos.locked}</span>}
      </div>
      {combo.description && <p className="card-muted">{combo.description}</p>}
      {locked && !s.coachApproved && <p className="notice">{tr.safety.kickLock} {tr.combos.lockedHint}</p>}

      <h2 className="section-title">{tr.combos.steps}</h2>
      <ol className="step-list">
        {moves.map((m, i) => (
          <li key={i} className="list-row">
            <span>
              <strong className="tabular" style={{ marginRight: 10 }}>{tokens[i] ?? i + 1}</strong>
              {m.nameTr}
            </span>
            <span className="card-muted">“{phrases[i]}”</span>
          </li>
        ))}
      </ol>

      {onStart && (
        <>
          <BigButton
            size="primary"
            style={{ marginTop: 20 }}
            disabled={locked && !s.coachApproved}
            onClick={() =>
              onStart({
                kind: 'combo',
                title: combo.nameTr,
                config: { prepSec: 10, rounds: 3, roundSec: 120, warnSec: 10, restSec: 45 },
                coach: { comboIds: [combo.id], selection: 'sequential', tempo: s.tempo, callMode: s.callMode, seed: 1 },
              })
            }
          >
            {tr.combos.train}
          </BigButton>
          <p className="card-muted" style={{ margin: '6px 0 0' }}>
            {tr.combos.trainHint}
          </p>
          {moves.length >= 3 && (
            <>
              <BigButton
                variant="neutral"
                style={{ marginTop: 12 }}
                disabled={locked && !s.coachApproved}
                onClick={() =>
                  onStart({
                    kind: 'combo',
                    title: `${combo.nameTr}: parça parça`,
                    config: { prepSec: 10, rounds: 2, roundSec: 150, warnSec: 10, restSec: 45 },
                    coach: { comboIds: [combo.id], selection: 'sequential', tempo: 'slow', callMode: s.callMode, seed: 1, chain: true },
                  })
                }
              >
                {tr.combos.chain}
              </BigButton>
              <p className="card-muted" style={{ margin: '6px 0 0' }}>
                {tr.combos.chainHint(tokens[0], tokens.slice(0, 2).join('-'), tokens.join('-'))}
              </p>
            </>
          )}
        </>
      )}
      <BigButton variant="neutral" onClick={() => void listen()} style={{ marginTop: 12 }}>
        {tr.coach.listen}
      </BigButton>
      <div style={{ display: 'grid', gridTemplateColumns: combo.isSystem ? '1fr' : '1fr 1fr 1fr', gap: 10, marginTop: 10 }}>
        <BigButton variant="neutral" onClick={() => void share(combo)}>
          {tr.editor.share}
        </BigButton>
        {!combo.isSystem && (
          <>
            <BigButton variant="neutral" onClick={() => onEdit?.(combo)}>
              {tr.editor.edit}
            </BigButton>
            <BigButton
              variant="neutral"
              onClick={async () => {
                if (!confirm(tr.editor.deleteConfirm)) return
                await deleteUserCombo(combo.id)
                onBack()
              }}
            >
              {tr.editor.delete}
            </BigButton>
          </>
        )}
      </div>
    </section>
  )
}
