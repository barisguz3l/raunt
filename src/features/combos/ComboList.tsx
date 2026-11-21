import { useMemo, useState } from 'react'
import { getContentStore } from '../../core/content/contentStore'
import type { Combo, ComboFocus } from '../../core/content/types'
import { tr } from '../../i18n/tr'
import { comboTokens, emptyFilter, filterCombos, isLocked, tokenLabel, type ComboFilter } from './comboModel'
import { useCombosVersion } from './userCombos'

const t = tr.combos

interface Props {
  /** "browse": satıra dokununca detay. "pick": çoklu seçim. */
  mode: 'browse' | 'pick'
  onOpen?: (c: Combo) => void
  selected?: Set<string>
  onToggle?: (c: Combo) => void
  coachApproved: boolean
}

export function ComboList({ mode, onOpen, selected, onToggle, coachApproved }: Props) {
  const store = getContentStore()
  const [f, setF] = useState<ComboFilter>(emptyFilter)
  const version = useCombosVersion()
  const list = useMemo(() => filterCombos(store, store.allCombos(), f), [store, f, version])
  const focuses = Object.keys(t.focus) as ComboFocus[]

  const toggleLevel = (l: number) =>
    setF((x) => ({ ...x, levels: x.levels.includes(l) ? x.levels.filter((y) => y !== l) : [...x.levels, l] }))

  return (
    <div>
      <input
        className="search"
        type="search"
        placeholder={t.search}
        aria-label={t.search}
        value={f.query}
        onChange={(e) => setF((x) => ({ ...x, query: e.target.value }))}
      />
      <div className="chips" role="group" aria-label={tr.coach.levels}>
        {[1, 2, 3].map((l) => (
          <button key={l} type="button" className="chip" aria-pressed={f.levels.includes(l)} onClick={() => toggleLevel(l)}>
            {tr.coach.level(l)}
          </button>
        ))}
        <button type="button" className="chip" aria-pressed={f.lockedOnly} onClick={() => setF((x) => ({ ...x, lockedOnly: !x.lockedOnly }))}>
          🔒 {t.lockedOnly}
        </button>
      </div>
      <div className="chips" role="group" aria-label={t.focusLabel}>
        {focuses.map((fo) => (
          <button key={fo} type="button" className="chip" aria-pressed={f.focus === fo} onClick={() => setF((x) => ({ ...x, focus: x.focus === fo ? null : fo }))}>
            {t.focus[fo]}
          </button>
        ))}
      </div>
      <p className="card-muted" style={{ margin: '4px 4px 10px' }} aria-live="polite">
        {t.count(list.length)}
      </p>
      {list.length === 0 && <div className="card card-muted">{t.none}</div>}
      <ul className="combo-list">
        {list.map((c) => {
          const locked = isLocked(store, c)
          const disabled = mode === 'pick' && locked && !coachApproved
          const checked = selected?.has(c.id) ?? false
          return (
            <li key={c.id}>
              <button
                type="button"
                className="combo-row"
                disabled={disabled}
                {...(mode === 'pick' ? { role: 'checkbox', 'aria-checked': checked } : {})}
                onClick={() => (mode === 'pick' ? onToggle?.(c) : onOpen?.(c))}
              >
                {mode === 'pick' && <span className="check" aria-hidden="true">{checked ? '✓' : ''}</span>}
                <span className="combo-row-main">
                  <strong className="combo-code tabular">{tokenLabel(comboTokens(store, c))}</strong>
                  <span>{c.nameTr}</span>
                </span>
                <span className="combo-row-meta">
                  {!c.isSystem && <span className="badge">Benim</span>}
                  <span className="badge">S{c.level}</span>
                  {locked && (
                    <span className="badge badge-lock" title={t.locked} aria-label={t.locked}>
                      🔒
                    </span>
                  )}
                  {mode === 'browse' && <span aria-hidden="true">›</span>}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
