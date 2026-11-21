import { useEffect, useRef, useState, type ReactNode } from 'react'

interface Props {
  onConfirm: () => void
  holdMs?: number
  children: ReactNode
  label: string
  className?: string
}

/**
 * Uzun basışla onaylanan buton (kazara bitirmeyi önler, spec F-105).
 * Onay bir zamanlayıcıyla verilir (kare hızından bağımsız); dolum animasyonu yalnızca görsel.
 * Klavyede Enter/Boşluk basılı tutma da çalışır.
 */
export function HoldButton({ onConfirm, holdMs = 1200, children, label, className }: Props) {
  const [progress, setProgress] = useState(0)
  const startRef = useRef<number | null>(null)
  const rafRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const confirmRef = useRef(onConfirm)
  confirmRef.current = onConfirm

  const stop = () => {
    startRef.current = null
    clearTimeout(timerRef.current)
    cancelAnimationFrame(rafRef.current)
    setProgress(0)
  }

  const begin = () => {
    if (startRef.current != null) return
    startRef.current = performance.now()
    timerRef.current = setTimeout(() => {
      stop()
      confirmRef.current()
    }, holdMs)
    const draw = () => {
      if (startRef.current == null) return
      setProgress(Math.min(1, (performance.now() - startRef.current) / holdMs))
      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)
  }

  useEffect(
    () => () => {
      clearTimeout(timerRef.current)
      cancelAnimationFrame(rafRef.current)
    },
    [],
  )

  return (
    <button
      type="button"
      className={['hold-button', className].filter(Boolean).join(' ')}
      aria-label={label}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId)
        begin()
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onPointerLeave={stop}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          begin()
        }
      }}
      onKeyUp={stop}
      onContextMenu={(e) => e.preventDefault()}
      style={{ ['--hold' as string]: progress }}
    >
      <span className="hold-fill" aria-hidden="true" />
      <span className="hold-text">{children}</span>
    </button>
  )
}
