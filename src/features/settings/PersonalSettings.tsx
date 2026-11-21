import { useEffect, useState } from 'react'
import { settingsStore, useSettings } from '../../core/settings/settings'
import { Stepper } from '../../design/Stepper'
import { Toggle } from '../../design/Toggle'
import { tr } from '../../i18n/tr'

const t = tr.settings

/** Metin alanı: yazarken yerel durum, odaktan çıkınca kaydet (her tuşta IndexedDB'ye yazma). */
function TextField({ label, value, placeholder, onSave, multiline }: { label: string; value: string; placeholder?: string; onSave: (v: string) => void; multiline?: boolean }) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  return (
    <label className="field">
      <span>{label}</span>
      {multiline ? (
        <textarea rows={2} value={v} placeholder={placeholder} maxLength={200} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onSave(v.trim())} />
      ) : (
        <input value={v} placeholder={placeholder} maxLength={40} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onSave(v.trim())} />
      )}
    </label>
  )
}

export function PersonalSettings() {
  const s = useSettings()
  const [w, setW] = useState(s.weightKg?.toString() ?? '')
  useEffect(() => setW(s.weightKg?.toString() ?? ''), [s.weightKg])

  const saveWeight = () => {
    const n = Number(w.replace(',', '.'))
    void settingsStore.update({ weightKg: w.trim() && Number.isFinite(n) && n >= 30 && n <= 250 ? Math.round(n * 10) / 10 : null })
  }

  return (
    <>
      <h2 className="section-title">{t.me}</h2>
      <div className="card setting-group">
        <TextField label={t.name} value={s.name} placeholder={t.namePh} onSave={(name) => void settingsStore.update({ name })} />
        <label className="field">
          <span>{t.weight}</span>
          <input inputMode="decimal" value={w} placeholder="—" onChange={(e) => setW(e.target.value)} onBlur={saveWeight} />
          <small className="card-muted">{t.weightHint}</small>
        </label>
        <Stepper
          label={t.weeklyGoal}
          value={s.weeklyGoal}
          display={(v) => `${v} / hafta`}
          min={1}
          max={7}
          stepUp={(v) => v + 1}
          stepDown={(v) => v - 1}
          onChange={(weeklyGoal) => void settingsStore.update({ weeklyGoal })}
        />
        <label className="field">
          <span>{t.trainingTime}</span>
          <input type="time" value={s.trainingTime} onChange={(e) => /^\d{2}:\d{2}$/.test(e.target.value) && void settingsStore.update({ trainingTime: e.target.value })} />
        </label>
        <Toggle label={t.ramadan} hint={t.ramadanHint} checked={s.ramadan} onChange={(ramadan) => void settingsStore.update({ ramadan })} />
        <Toggle label={t.gamification} hint={t.gamificationHint} checked={s.gamification} onChange={(gamification) => void settingsStore.update({ gamification })} />
      </div>

      <h2 className="section-title">{t.habit}</h2>
      <div className="card setting-group">
        <TextField label={t.ifThen} value={s.ifThen} placeholder={t.ifThenPh} multiline onSave={(ifThen) => void settingsStore.update({ ifThen })} />
        <TextField label={t.obstacle} value={s.obstaclePlan} placeholder={t.obstaclePh} multiline onSave={(obstaclePlan) => void settingsStore.update({ obstaclePlan })} />
      </div>
    </>
  )
}
