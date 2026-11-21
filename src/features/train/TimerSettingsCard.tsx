import { durationLabel } from '../../core/engine/presets'
import { buildTimeline, clampConfig, formatClock, LIMITS, workSeconds, type TimerConfig } from '../../core/engine/timeline'
import { Stepper, timeSteps } from '../../design/Stepper'
import { tr } from '../../i18n/tr'

const t = tr.timer
const secOrNone = (v: number) => (v === 0 ? t.none : durationLabel(v))

interface Props {
  config: TimerConfig
  onChange: (c: TimerConfig) => void
}

/** Raunt sayısı / süreleri için artı-eksi kartı + toplam süre. */
export function TimerSettingsCard({ config, onChange }: Props) {
  const set = (patch: Partial<TimerConfig>) => onChange(clampConfig({ ...config, ...patch }))
  return (
    <>
      <div className="card stepper-card">
        <Stepper label={t.rounds} value={config.rounds} display={String} onChange={(v) => set({ rounds: v })}
          min={LIMITS.rounds.min} max={LIMITS.rounds.max} stepUp={(v) => v + 1} stepDown={(v) => v - 1} />
        <Stepper label={t.roundTime} value={config.roundSec} display={durationLabel} onChange={(v) => set({ roundSec: v })}
          min={LIMITS.roundSec.min} max={LIMITS.roundSec.max} {...timeSteps(10, 30, 60)} />
        <Stepper label={t.restTime} value={config.restSec} display={secOrNone} onChange={(v) => set({ restSec: v })}
          min={LIMITS.restSec.min} max={LIMITS.restSec.max} {...timeSteps(5, 15, 60)} />
        <Stepper label={t.prepTime} value={config.prepSec} display={secOrNone} onChange={(v) => set({ prepSec: v })}
          min={LIMITS.prepSec.min} max={LIMITS.prepSec.max} {...timeSteps(5, 5, 60)} />
        <Stepper label={t.warnTime} value={config.warnSec} display={secOrNone} onChange={(v) => set({ warnSec: v })}
          min={LIMITS.warnSec.min} max={Math.min(LIMITS.warnSec.max, config.roundSec - 1)} {...timeSteps(1, 5, 5)} />
      </div>
      <p className="card-muted tabular" style={{ margin: '12px 4px' }}>
        {t.total(formatClock(buildTimeline(config).totalSec), formatClock(workSeconds(config)))}
      </p>
    </>
  )
}
