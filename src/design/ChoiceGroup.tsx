import { useId, type ReactNode } from 'react'

export interface Choice<T extends string> {
  value: T
  label: ReactNode
  hint?: ReactNode
}

interface Props<T extends string> {
  label: string
  value: T
  options: Choice<T>[]
  onChange: (v: T) => void
  /** "row": yan yana bölmeli (kısa seçenekler), "list": alt alta (açıklamalı). */
  layout?: 'row' | 'list'
}

/** Erişilebilir tek seçim grubu (radio). Büyük dokunma alanları. */
export function ChoiceGroup<T extends string>({ label, value, options, onChange, layout = 'list' }: Props<T>) {
  const id = useId()
  return (
    <div className="setting-group">
      <div className="setting-label" id={id}>
        {label}
      </div>
      <div role="radiogroup" aria-labelledby={id} className={layout === 'row' ? 'segmented' : 'choice-list'}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            className={layout === 'row' ? 'segment' : 'choice choice-tall'}
            onClick={() => onChange(o.value)}
          >
            {layout === 'list' && <span className="choice-dot" aria-hidden="true" />}
            <span>
              <strong>{o.label}</strong>
              {o.hint ? <small>{o.hint}</small> : null}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
