import { useEffect, useRef, useState } from 'react'
import { tr } from '../../i18n/tr'

interface Props {
  /** Raunt sürüyor mu (hareket uyarısı yalnızca rauntta) */
  inRound: boolean
  /** Duraklatılmışsa ölçüm durur */
  paused: boolean
}

const c = tr.camera

/**
 * Ayna modu: ön kamera tam ekran, aynalanmış (sağ elin ekranda sağda).
 * Görüntü cihazdan çıkmaz, kaydedilmez. Hareket ölçer: 64×48 tuvalde ardışık kare farkı.
 */
export function CameraMirror({ inRound, paused }: Props) {
  const video = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [energy, setEnergy] = useState(0)
  const [still, setStill] = useState(false)

  // Kamerayı aç / kapat
  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(c.unsupported)
      return
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        if (video.current) {
          video.current.srcObject = s
          void video.current.play().catch(() => undefined)
        }
      })
      .catch((e: Error) => setError(e.name === 'NotAllowedError' ? c.denied : c.failed))
    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  // Hareket ölçer (saniyede ~8 kare)
  const stillSince = useRef<number | null>(null)
  useEffect(() => {
    if (paused) return
    const cv = document.createElement('canvas')
    cv.width = 64
    cv.height = 48
    const ctx = cv.getContext('2d', { willReadFrequently: true })
    let prev: Uint8ClampedArray | null = null
    let smooth = 0
    const id = setInterval(() => {
      const v = video.current
      if (!ctx || !v || v.readyState < 2) return
      ctx.drawImage(v, 0, 0, 64, 48)
      const cur = ctx.getImageData(0, 0, 64, 48).data
      if (prev) {
        let diff = 0
        for (let i = 0; i < cur.length; i += 4) diff += Math.abs(cur[i + 1] - prev[i + 1]) // yeşil kanal ≈ parlaklık
        const e = Math.min(1, diff / (64 * 48) / 18)
        smooth = smooth * 0.7 + e * 0.3
        setEnergy(smooth)
        const now = performance.now()
        if (smooth < 0.08) {
          stillSince.current ??= now
          setStill(now - stillSince.current > 6000)
        } else {
          stillSince.current = null
          setStill(false)
        }
      }
      prev = new Uint8ClampedArray(cur)
    }, 125)
    return () => clearInterval(id)
  }, [paused])

  return (
    <>
      <video ref={video} className="mirror-video" playsInline muted autoPlay aria-hidden="true" />
      {error && (
        <p className="mirror-error" role="alert">
          {error}
        </p>
      )}
      {!error && (
        <div className="mirror-meter" aria-label={c.meter} role="meter" aria-valuenow={Math.round(energy * 100)} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ transform: `scaleY(${Math.max(0.04, energy)})` }} />
        </div>
      )}
      {!error && inRound && !paused && still && (
        <p className="mirror-still" role="status">
          {c.still}
        </p>
      )}
    </>
  )
}
