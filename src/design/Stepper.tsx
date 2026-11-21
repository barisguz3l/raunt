import { tr } from '../i18n/tr'

interface Props {
  label: string
  value: number
  display: (v: number) => string
  onChange: (v: number) => void
  min: number
  max: number
  /** Mevcut değere göre bir sonraki/önceki değer. */
  stepUp: (v: number) => number
  stepDown: (v: number) => number
}

/** Eldivenle kullanılabilir artı/eksi kontrolü (64 px butonlar). */
export function Stepper({ label, value, display, onChange, min, max, stepUp, stepDown }: Props) {
  const dec = () => onChange(Math.max(min, stepDown(value)))
  const inc = () => onChange(Math.min(max, stepUp(value)))
  return (
    <div className="stepper" role="group" aria-label={label}>
      <span className="stepper-label">{label}</span>
      <div className="stepper-controls">
        <button type="button" onClick={dec} disabled={value <= min} aria-label={tr.timer.decrease(label)}>
          −
        </button>
        <output className="stepper-value tabular" aria-live="polite">
          {display(value)}
        </output>
        <button type="button" onClick={inc} disabled={value >= max} aria-label={tr.timer.increase(label)}>
          +
        </button>
      </div>
    </div>
  )
}

/** Süre adımları: kısa sürelerde ince, uzunlarda kaba adım. */
export function timeSteps(fine: number, coarse: number, threshold: number) {
  return {
    stepUp: (v: number) => v + (v >= threshold ? coarse : fine),
    stepDown: (v: number) => v - (v > threshold ? coarse : fine),
  }
}
