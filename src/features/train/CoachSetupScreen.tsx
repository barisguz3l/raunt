import { useEffect, useMemo, useRef, useState } from 'react'
import { audio } from '../../core/audio/audioService'
import { voice } from '../../core/audio/voiceService'
import { getContentStore } from '../../core/content/contentStore'
import { filterAllowed, speechFor, type RoundRule } from '../../core/engine/comboScheduler'
import { clampConfig, type TimerConfig } from '../../core/engine/timeline'
import { getRepo } from '../../core/persistence/db'
import { settingsStore, useSettings } from '../../core/settings/settings'
import { BigButton } from '../../design/BigButton'
import { ChoiceGroup } from '../../design/ChoiceGroup'
import { Toggle } from '../../design/Toggle'
import { tr } from '../../i18n/tr'
import { ComboList } from '../combos/ComboList'
import { resolveCombo } from '../combos/comboModel'
import type { WorkoutPlan } from '../activeWorkout/plan'
import { TimerSettingsCard } from './TimerSettingsCard'

export type CoachKind = 'combo' | 'shadow' | 'bag' | 'reflex' | 'pad'

interface SetupState {
  config: TimerConfig
  source: 'level' | 'picked'
  levels: number[]
  picked: string[]
  rules?: RoundRule[]
  switchStance?: boolean
  reflexGap?: 'short' | 'medium' | 'long'
}

const RULES: RoundRule[] = ['punchesOnly', 'leadHand', 'noKicks', 'bodyWork', 'kickFinish', 'defenseFirst', 'any']
const GAPS = { short: [1, 3], medium: [2, 6], long: [4, 8] } as const

const DEFAULTS: Record<CoachKind, SetupState> = {
  combo: {
    config: { prepSec: 10, rounds: 3, roundSec: 120, warnSec: 10, restSec: 30 },
    source: 'level',
    levels: [1],
    picked: [],
  },
  shadow: {
    config: { prepSec: 10, rounds: 3, roundSec: 120, warnSec: 10, restSec: 45 },
    source: 'level',
    levels: [1],
    picked: [],
  },
  bag: {
    config: { prepSec: 10, rounds: 3, roundSec: 120, warnSec: 10, restSec: 45 },
    source: 'level',
    levels: [1],
    picked: [],
  },
  reflex: {
    config: { prepSec: 10, rounds: 3, roundSec: 60, warnSec: 10, restSec: 30 },
    source: 'level',
    levels: [1],
    picked: [],
    reflexGap: 'medium',
  },
  pad: {
    config: { prepSec: 10, rounds: 3, roundSec: 90, warnSec: 10, restSec: 45 },
    source: 'level',
    levels: [1],
    picked: [],
  },
}

const key = (k: CoachKind) => `coach.setup.${k}`
const t = tr.coach

interface Props {
  kind: CoachKind
  onBack: () => void
  onStart: (plan: WorkoutPlan) => void
}

export function CoachSetupScreen({ kind, onBack, onStart }: Props) {
  const store = getContentStore()
  const s = useSettings()
  const [st, setSt] = useState<SetupState>(DEFAULTS[kind])
  const [picking, setPicking] = useState(false)

  // Kayıtlı kurulum gelmeden kullanıcı bir şey değiştirdiyse onun seçimi korunur
  const touched = useRef(false)
  useEffect(() => {
    void getRepo()
      .getKV<SetupState>(key(kind))
      .then(
        (saved) =>
          saved &&
          !touched.current &&
          setSt({
            ...DEFAULTS[kind],
            ...saved,
            config: clampConfig(saved.config),
          }),
      )
  }, [kind])

  const update = (patch: Partial<SetupState>) => {
    touched.current = true
    setSt((x) => {
      const n = { ...x, ...patch }
      void getRepo().setKV(key(kind), n)
      return n
    })
  }

  const candidateIds = useMemo(
    () =>
      st.source === 'level'
        ? store
            .allCombos()
            .filter((c) => st.levels.includes(c.level))
            .map((c) => c.id)
        : st.picked.filter((id) => store.combo(id)),
    [store, st.source, st.levels, st.picked],
  )
  const voicing = {
    stance: s.stance,
    callMode: s.callMode,
    nameStyle: s.nameStyle,
  }
  const resolved = candidateIds.map((id) => resolveCombo(store, store.combo(id)!, voicing))
  const allowed = filterAllowed(resolved, s.coachApproved)
  const lockedCount = resolved.length - allowed.length

  const reflex = kind === 'reflex'
  const rules = st.rules ?? []
  const canStart = reflex || allowed.length > 0

  const listen = async () => {
    const first = allowed[0]
    if (!first) return
    await audio.unlock()
    await voice.preload(first.phrases)
    voice.speak(first.phrases, 0, speechFor(s.tempo))
  }

  const start = () => {
    const gap = GAPS[st.reflexGap ?? 'medium']
    const config: TimerConfig =
      !reflex && rules.length
        ? {
            ...st.config,
            labels: Array.from({ length: st.config.rounds }, (_, i) => t.rules[rules[i % rules.length]]),
          }
        : st.config
    onStart({
      kind,
      config,
      title: t.title[kind],
      coach: {
        comboIds: reflex ? [] : allowed.map((c) => c.combo.id),
        selection: s.selection,
        tempo: s.tempo,
        callMode: s.callMode,
        seed: Math.floor(Math.random() * 2 ** 31),
        rules: !reflex && rules.length ? rules : undefined,
        switchStance: !reflex && st.switchStance ? true : undefined,
        reflex: reflex || undefined,
        reflexGap: reflex ? [gap[0], gap[1]] : undefined,
        pad: kind === 'pad' || undefined,
      },
    })
  }

  if (picking) {
    const sel = new Set(st.picked)
    return (
      <section className="screen" aria-labelledby="pick-title">
        <button type="button" className="back-link" onClick={() => setPicking(false)}>
          ‹ {t.title[kind]}
        </button>
        <h1 id="pick-title" className="screen-title">
          {t.pickCombos}
        </h1>
        <ComboList
          mode="pick"
          coachApproved={s.coachApproved}
          selected={sel}
          onToggle={(c) =>
            update({
              picked: sel.has(c.id) ? st.picked.filter((x) => x !== c.id) : [...st.picked, c.id],
            })
          }
        />
        <div className="sticky-bottom">
          <BigButton onClick={() => setPicking(false)}>
            {t.done} ({t.pickedCount(st.picked.length)})
          </BigButton>
        </div>
      </section>
    )
  }

  return (
    <section className="screen" aria-labelledby="coach-title">
      <button type="button" className="back-link" onClick={onBack}>
        ‹ {tr.timer.back}
      </button>
      <h1 id="coach-title" className="screen-title">
        {t.title[kind]}
      </h1>
      <p className="card-muted" style={{ marginTop: -8 }}>
        {t.intro[kind]}
      </p>

      <div className="card setting-group">
        <ChoiceGroup
          label={t.callMode}
          layout="row"
          value={s.callMode}
          onChange={(v) => void settingsStore.update({ callMode: v })}
          options={[
            { value: 'numbers', label: t.numbers, hint: t.numbersHint },
            { value: 'names', label: t.names, hint: t.namesHint },
          ]}
        />
        <ChoiceGroup
          label={t.tempo}
          layout="row"
          value={s.tempo}
          onChange={(v) => void settingsStore.update({ tempo: v })}
          options={(['slow', 'medium', 'fast', 'master'] as const).map((v) => ({
            value: v,
            label: t.tempos[v],
          }))}
        />
        <ChoiceGroup
          label={t.selection}
          layout="row"
          value={s.selection}
          onChange={(v) => void settingsStore.update({ selection: v })}
          options={(['random', 'sequential'] as const).map((v) => ({
            value: v,
            label: t.selections[v],
          }))}
        />
      </div>

      {reflex ? (
        <div className="card setting-group">
          <ChoiceGroup
            label={t.reflexGap}
            layout="row"
            value={st.reflexGap ?? 'medium'}
            onChange={(v) => update({ reflexGap: v })}
            options={(['short', 'medium', 'long'] as const).map((v) => ({
              value: v,
              label: t.reflexGaps[v],
            }))}
          />
        </div>
      ) : (
        <>
          <h2 className="section-title">{t.source}</h2>
          <div className="card setting-group">
            <ChoiceGroup
              label={t.source}
              layout="row"
              value={st.source}
              onChange={(v) => update({ source: v })}
              options={[
                { value: 'level', label: t.byLevel },
                { value: 'picked', label: t.picked },
              ]}
            />
            {st.source === 'level' ? (
              <div className="chips" role="group" aria-label={t.levels}>
                {[1, 2, 3].map((l) => (
                  <button
                    key={l}
                    type="button"
                    className="chip"
                    aria-pressed={st.levels.includes(l)}
                    onClick={() =>
                      update({
                        levels: st.levels.includes(l) ? st.levels.filter((x) => x !== l) : [...st.levels, l].sort(),
                      })
                    }
                  >
                    {t.level(l)}
                  </button>
                ))}
              </div>
            ) : (
              <BigButton variant="neutral" onClick={() => setPicking(true)}>
                {t.pickCombos} ({st.picked.length})
              </BigButton>
            )}
            <p className="card-muted" style={{ margin: 0 }} aria-live="polite">
              {allowed.length ? t.poolCount(allowed.length, lockedCount) : t.emptyPool}
            </p>
            <BigButton variant="neutral" disabled={!allowed.length} onClick={() => void listen()} aria-label={t.listenHint}>
              {t.listen}
            </BigButton>
          </div>

          <h2 className="section-title">{t.extras}</h2>
          <div className="card setting-group">
            <div>
              <strong>{t.rulesLabel}</strong>
              <p className="card-muted" style={{ margin: '4px 0 8px' }}>
                {t.rulesHint}
              </p>
              <div className="chips" role="group" aria-label={t.rulesLabel}>
                {RULES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className="chip"
                    aria-pressed={rules.includes(r)}
                    onClick={() =>
                      update({
                        rules: rules.includes(r) ? rules.filter((x) => x !== r) : [...rules, r],
                      })
                    }
                  >
                    {rules.includes(r) ? `${rules.indexOf(r) + 1}. ` : ''}
                    {t.rules[r]}
                  </button>
                ))}
              </div>
            </div>
            <Toggle
              label={t.switchStance}
              hint={t.switchStanceHint}
              checked={!!st.switchStance}
              onChange={(v) => update({ switchStance: v })}
            />
          </div>
        </>
      )}

      {kind !== 'bag' && kind !== 'pad' && (
        <div className="card setting-group" style={{ marginTop: 16 }}>
          <Toggle
            label={tr.camera.setupLabel}
            hint={tr.camera.setupHint}
            checked={s.cameraMirror}
            onChange={(v) => void settingsStore.update({ cameraMirror: v })}
          />
        </div>
      )}

      <h2 className="section-title">{t.timer}</h2>
      <TimerSettingsCard config={st.config} onChange={(config) => update({ config })} />

      <p className="notice">{tr.safety.warmup}</p>
      <BigButton size="primary" disabled={!canStart} onClick={start} style={{ marginTop: 12 }}>
        {t.start}
      </BigButton>
    </section>
  )
}
