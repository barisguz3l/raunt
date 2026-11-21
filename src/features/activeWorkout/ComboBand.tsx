import { getContentStore } from '../../core/content/contentStore'
import type { CallCue } from '../../core/engine/coachTimeline'
import { useSettings } from '../../core/settings/settings'
import { spokenPhrase } from '../../core/speech/stanceMapper'
import { tr } from '../../i18n/tr'
import { cueMoves } from '../combos/comboModel'

interface Props {
  current?: CallCue
  /** Penceresi bitmiş son çağrı: bir sonraki gelene kadar soluk gösterilir. */
  last?: CallCue
  next?: CallCue
  elapsed: number
  /** Dinlenme/hazırlıkta sıradaki komboyu önizle. */
  showNext: boolean
}

/**
 * Mevcut kombo bandı (spec §3.3): numaralar dev, altında Türkçe adlar.
 * Konuşma sırasında vurgulanır; uygulama penceresinde sakin görünür.
 */
export function ComboBand({ current, last, next, elapsed, showNext }: Props) {
  const store = getContentStore()
  const s = useSettings()
  const cue = showNext ? next : (current ?? last)
  const faded = !showNext && !current
  if (!cue) return <div className="combo-band" aria-hidden="true" />

  const moves = cueMoves(store, cue.comboId)
  const tokens = moves.length ? moves.map((m) => m.shortTr) : cue.phrases
  const names = moves.length ? moves.map((m) => spokenPhrase(m, s.stance, 'names', s.nameStyle)) : cue.phrases
  const speaking = !showNext && elapsed < cue.t + cue.speakSec

  return (
    <div
      className="combo-band"
      data-speaking={speaking || undefined}
      data-preview={showNext || undefined}
      data-faded={faded || undefined}
      aria-live="polite"
    >
      {showNext && <div className="combo-band-label">{tr.coach.nextCombo}</div>}
      <ol className="combo-band-code tabular" aria-label={tokens.join(', ')}>
        {tokens.map((tk, i) => (
          <li key={i}>{tk}</li>
        ))}
      </ol>
      <div className="combo-band-names">{names.join(', ')}</div>
    </div>
  )
}
