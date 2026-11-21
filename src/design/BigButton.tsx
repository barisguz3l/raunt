import type { ButtonHTMLAttributes } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'accent' | 'neutral' | 'success'
  size?: 'normal' | 'primary'
}

/** Eldivenle kullanılabilir buton: min 64 px, primary 96 px yükseklik. */
export function BigButton({ variant = 'accent', size = 'normal', className, ...rest }: Props) {
  return (
    <button
      type="button"
      {...rest}
      data-variant={variant}
      data-size={size}
      className={['big-button', className].filter(Boolean).join(' ')}
    />
  )
}
