import { useState } from 'react'
import { audio } from '../../core/audio/audioService'
import { bellSetIds, bellSets, type BellSetId } from '../../core/audio/bells'
import { settingsStore, useSettings } from '../../core/settings/settings'
import { BigButton } from '../../design/BigButton'
import { Toggle } from '../../design/Toggle'
import { tr } from '../../i18n/tr'

const t = tr.sound

/** Dokunuşun içinde: motoru aç, sonra çal. */
async function preview(set: BellSetId) {
  const ok = await audio.unlock()
  if (ok) audio.play('roundStart', 0, set)
  return ok
}

export function SoundSettings() {
  const s = useSettings()
  const [test, setTest] = useState<'idle' | 'asking' | 'ok' | 'trouble'>('idle')

  return (
    <>
      <h2 className="section-title">{t.title}</h2>

      <div className="card setting-group">
        <div className="setting-label" id="bellset-label">
          {t.bellSet}
        </div>
        <div role="radiogroup" aria-labelledby="bellset-label" className="choice-list">
          {bellSetIds.map((id) => (
            <div key={id} className="choice-row">
              <button
                type="button"
                role="radio"
                aria-checked={s.bellSet === id}
                className="choice"
                onClick={() => void settingsStore.update({ bellSet: id })}
              >
                <span className="choice-dot" aria-hidden="true" />
                {bellSets[id].nameTr}
              </button>
              {id !== 'silent' && (
                <button type="button" className="icon-button" aria-label={`${bellSets[id].nameTr}: ${t.listen}`} onClick={() => void preview(id)}>
                  ▶
                </button>
              )}
            </div>
          ))}
        </div>
        {s.bellSet === 'silent' && <p className="card-muted">{t.silentNote}</p>}

        <label className="slider">
          <span>
            {t.bellVolume} <output className="tabular">{Math.round(s.bellVolume * 100)}%</output>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(s.bellVolume * 100)}
            onChange={(e) => void settingsStore.update({ bellVolume: Number(e.target.value) / 100 })}
          />
        </label>
        <label className="slider">
          <span>
            {t.voiceVolume} <output className="tabular">{Math.round(s.voiceVolume * 100)}%</output>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(s.voiceVolume * 100)}
            onChange={(e) => void settingsStore.update({ voiceVolume: Number(e.target.value) / 100 })}
          />
        </label>
      </div>

      <div className="card setting-group" style={{ marginTop: 12 }}>
        <div className="setting-label" id="music-label">
          {t.musicMode}
        </div>
        <div role="radiogroup" aria-labelledby="music-label" className="choice-list">
          {(
            [
              ['mix', t.musicMix, t.musicMixHint],
              ['always', t.musicAlways, t.musicAlwaysHint],
            ] as const
          ).map(([mode, label, hint]) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={s.musicMode === mode}
              className="choice choice-tall"
              onClick={() => void settingsStore.update({ musicMode: mode })}
            >
              <span className="choice-dot" aria-hidden="true" />
              <span>
                <strong>{label}</strong>
                <small>{hint}</small>
              </span>
            </button>
          ))}
        </div>
        {!audio.sessionSupported && <p className="card-muted">{t.musicUnsupported}</p>}
      </div>

      <div className="card setting-group" style={{ marginTop: 12 }}>
        <div className="setting-label">{t.test}</div>
        {test === 'idle' || test === 'ok' ? (
          <>
            <BigButton
              variant="neutral"
              onClick={async () => {
                await preview(s.bellSet === 'silent' ? 'classic' : s.bellSet)
                setTest('asking')
              }}
            >
              🔔 {t.testRun}
            </BigButton>
            {test === 'ok' && <p className="card-muted">✅ {t.testOk}</p>}
          </>
        ) : test === 'asking' ? (
          <>
            <p style={{ margin: 0, fontWeight: 700 }}>{t.heard}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <BigButton variant="neutral" onClick={() => setTest('trouble')}>
                {t.no}
              </BigButton>
              <BigButton variant="success" onClick={() => setTest('ok')}>
                {t.yes}
              </BigButton>
            </div>
          </>
        ) : (
          <div className="notice" role="alert">
            <strong>{t.troubleTitle}</strong>
            <ol style={{ margin: '8px 0 12px', paddingLeft: 20, display: 'grid', gap: 6 }}>
              {t.trouble.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ol>
            <BigButton variant="neutral" onClick={() => setTest('idle')}>
              {t.testRun}
            </BigButton>
          </div>
        )}
      </div>

      <h2 className="section-title">{t.workoutTitle}</h2>
      <div className="card setting-group">
        <Toggle
          label={t.coachChatter}
          hint={s.coachFocus ? `${t.coachChatterHint} ${t.coachFocusNow(tr.journal.focus[s.coachFocus])}` : t.coachChatterHint}
          checked={s.coachChatter}
          onChange={(v) => void settingsStore.update({ coachChatter: v })}
        />
        <Toggle label={t.autoPause} hint={t.autoPauseHint} checked={s.autoPause} onChange={(v) => void settingsStore.update({ autoPause: v })} />
        <Toggle label={t.phaseFlash} hint={t.phaseFlashHint} checked={s.phaseFlash} onChange={(v) => void settingsStore.update({ phaseFlash: v })} />
      </div>
    </>
  )
}

