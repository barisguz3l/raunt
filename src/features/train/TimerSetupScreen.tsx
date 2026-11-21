import { useEffect, useMemo, useState } from 'react'
import { getContentStore } from '../../core/content/contentStore'
import {
  deleteUserPreset,
  durationLabel,
  extraPresets,
  listUserPresets,
  loadLastConfig,
  sameConfig,
  saveUserPreset,
  toConfig,
  type UserPreset,
} from '../../core/engine/presets'
import { clampConfig, type TimerConfig } from '../../core/engine/timeline'
import { BigButton } from '../../design/BigButton'
import { TimerSettingsCard } from './TimerSettingsCard'
import { tr } from '../../i18n/tr'

interface Props {
  onBack: () => void
  onStart: (config: TimerConfig) => void
}

const t = tr.timer

export function TimerSetupScreen({ onBack, onStart }: Props) {
  const systemPresets = useMemo(() => [...getContentStore().content.timerPresets, ...extraPresets], [])
  const [config, setConfig] = useState<TimerConfig>(() => toConfig(systemPresets[0]))
  const [userPresets, setUserPresets] = useState<UserPreset[]>([])
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')

  useEffect(() => {
    void listUserPresets().then(setUserPresets)
    void loadLastConfig().then((c) => c && setConfig(clampConfig(c)))
  }, [])


  const presetButton = (p: { id: string; nameTr: string } & TimerConfig, removable = false) => {
    const active = sameConfig(config, toConfig(p))
    return (
      <div key={p.id} className="preset-row">
        <button type="button" className="preset-chip" aria-pressed={active} onClick={() => setConfig(toConfig(p))}>
          {p.nameTr}
        </button>
        {removable ? (
          <button
            type="button"
            className="icon-button"
            aria-label={t.deletePreset(p.nameTr)}
            onClick={async () => {
              await deleteUserPreset(p.id)
              setUserPresets(await listUserPresets())
            }}
          >
            ✕
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <section className="screen" aria-labelledby="timer-setup-title">
      <button type="button" className="back-link" onClick={onBack}>
        ‹ {t.back}
      </button>
      <h1 id="timer-setup-title" className="screen-title">
        {t.setupTitle}
      </h1>

      <h2 className="section-title">{t.settings}</h2>
      <TimerSettingsCard config={config} onChange={setConfig} />

      <BigButton size="primary" onClick={() => onStart(config)}>
        {t.start}
      </BigButton>

      <h2 className="section-title">{t.presets}</h2>
      <div className="preset-list">{systemPresets.map((p) => presetButton(p))}</div>

      <h2 className="section-title">{t.myPresets}</h2>
      {userPresets.length ? <div className="preset-list">{userPresets.map((p) => presetButton(p, true))}</div> : null}
      {naming ? (
        <form
          className="card"
          style={{ display: 'grid', gap: 12, marginTop: 12 }}
          onSubmit={async (e) => {
            e.preventDefault()
            await saveUserPreset(name, config)
            setUserPresets(await listUserPresets())
            setNaming(false)
            setName('')
          }}
        >
          <label className="field">
            <span>{t.presetName}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus placeholder={`${config.rounds} x ${durationLabel(config.roundSec)}`} />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <BigButton variant="neutral" onClick={() => setNaming(false)}>{t.cancel}</BigButton>
            <BigButton variant="success" type="submit">{t.save}</BigButton>
          </div>
        </form>
      ) : (
        <BigButton variant="neutral" onClick={() => setNaming(true)} style={{ marginTop: 8 }}>
          {t.savePreset}
        </BigButton>
      )}
    </section>
  )
}
