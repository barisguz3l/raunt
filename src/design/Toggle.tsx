import type { ReactNode } from 'react'

interface Props {
  label: string
  hint?: ReactNode
  checked: boolean
  onChange: (v: boolean) => void
}

/** Açık/kapalı anahtarı (role="switch"), tüm satır dokunulabilir. */
export function Toggle({ label, hint, checked, onChange }: Props) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="toggle-row" onClick={() => onChange(!checked)}>
      <span>
        <strong>{label}</strong>
        {hint ? <small>{hint}</small> : null}
      </span>
      <span className="toggle" aria-hidden="true" />
    </button>
  )
}
