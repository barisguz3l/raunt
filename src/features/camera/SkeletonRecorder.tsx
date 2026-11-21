import { useEffect, useRef, useState } from 'react'
import { audio } from '../../core/audio/audioService'
import { getRepo } from '../../core/persistence/db'
import { newId } from '../../core/records/records'
import { framePoints, normalizeFrame, similarity, SK_BONES, type SkeletonClip } from '../../core/vision/skeleton'
import { BigButton } from '../../design/BigButton'
import { tr } from '../../i18n/tr'
import { detect, loadPoseLandmarker } from './poseEngine'

const k = tr.skeleton
const REC_SEC = 5
const FPS = 20
const MAX_CLIPS = 6

/** Kütüphane: kendini iskelet olarak kaydet, oynat, ilk kayıtla karşılaştır. Video saklanmaz. */
export function SkeletonRecorder({ storeKey }: { storeKey: string }) {
  const key = `skeleton.${storeKey}`
  const [clips, setClips] = useState<SkeletonClip[]>([])
  const [recording, setRecording] = useState(false)
  const [compare, setCompare] = useState(false)

  useEffect(() => {
    void getRepo()
      .getKV<SkeletonClip[]>(key)
      .then((c) => setClips(c ?? []))
  }, [key])

  const save = async (clip: SkeletonClip) => {
    const next = [...clips, clip].slice(-MAX_CLIPS)
    setClips(next)
    await getRepo().setKV(key, next)
  }

  const remove = async (id: string) => {
    if (!confirm(k.deleteConfirm)) return
    const next = clips.filter((c) => c.id !== id)
    setClips(next)
    await getRepo().setKV(key, next)
  }

  const first = clips[0]
  const last = clips[clips.length - 1]

  return (
    <div className="skeleton-box">
      <h2 className="section-title">{k.title}</h2>
      <p className="card-muted" style={{ marginTop: 0 }}>
        {k.hint}
      </p>
      {last && (
        <>
          <SkeletonPlayer clips={compare && first && first !== last ? [first, last] : [last]} />
          {first && first !== last && (
            <>
              <button type="button" className="chip" aria-pressed={compare} onClick={() => setCompare(!compare)}>
                {k.compare}
              </button>
              {compare && <p className="card-muted">{k.similarity(similarity(first, last))}</p>}
            </>
          )}
          <ul className="skeleton-list">
            {clips.map((c, i) => (
              <li key={c.id}>
                <span>
                  {i + 1}. {new Date(c.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
                </span>
                <button type="button" className="link-button" onClick={() => void remove(c.id)}>
                  {k.delete}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <BigButton variant="success" onClick={() => setRecording(true)}>
        {k.record}
      </BigButton>
      {recording && (
        <RecorderOverlay
          onDone={(clip) => {
            setRecording(false)
            if (clip) void save(clip)
          }}
        />
      )}
    </div>
  )
}

function RecorderOverlay({ onDone }: { onDone: (c: SkeletonClip | null) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [state, setState] = useState<'loading' | 'count' | 'rec' | 'error'>('loading')
  const [count, setCount] = useState(3)
  const [err, setErr] = useState('')

  useEffect(() => {
    let stream: MediaStream | null = null
    let alive = true
    let raf = 0
    void audio.unlock()
    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
        if (!alive) return
        video.current!.srcObject = stream
        await video.current!.play().catch(() => undefined)
        const lm = await loadPoseLandmarker()
        for (let c = 3; c > 0 && alive; c--) {
          setState('count')
          setCount(c)
          audio.play('tick')
          await new Promise((r) => setTimeout(r, 1000))
        }
        if (!alive) return
        setState('rec')
        audio.play('roundStart')
        const frames: number[][] = []
        const t0 = performance.now()
        let last = 0
        await new Promise<void>((resolve) => {
          const loop = (now: number) => {
            if (!alive) return resolve()
            if (now - t0 >= REC_SEC * 1000) return resolve()
            raf = requestAnimationFrame(loop)
            if (now - last < 1000 / FPS || !video.current || video.current.readyState < 2) return
            last = now
            const p = detect(lm, video.current, now)
            if (p) frames.push(normalizeFrame(p))
          }
          raf = requestAnimationFrame(loop)
        })
        audio.play('roundEnd')
        if (alive) onDone(frames.length > 10 ? { id: newId('sk'), date: new Date().toISOString(), fps: FPS, frames } : null)
      } catch (e) {
        setErr((e as Error).name === 'NotAllowedError' ? tr.camera.denied : tr.vision.error)
        setState('error')
      }
    })()
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return (
    <div className="hunt" role="dialog" aria-modal="true" aria-label={k.title}>
      <video ref={video} className="mirror-video" playsInline muted autoPlay aria-hidden="true" />
      <header className="hunt-top">
        <button type="button" className="mirror-toggle" style={{ position: 'static' }} onClick={() => onDone(null)}>
          {tr.hunt.close}
        </button>
      </header>
      {state === 'loading' && <p className="pose-status">{tr.vision.loading}</p>}
      {state === 'count' && <div className="hunt-count tabular">{count}</div>}
      {state === 'rec' && <p className="pose-feedback" data-tone="warn">{k.recording}</p>}
      {state === 'error' && <p className="pose-status">{err}</p>}
    </div>
  )
}

/** İskelet oynatıcı: bir ya da iki kayıt (ilk soluk, son mavi) döngüde. */
export function SkeletonPlayer({ clips }: { clips: SkeletonClip[] }) {
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    const fps = clips[0]?.fps ?? 20
    const id = setInterval(() => setFrame((f) => f + 1), 1000 / fps)
    return () => clearInterval(id)
  }, [clips])
  const W = 200
  const H = 260
  return (
    <svg className="skeleton-player" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={k.title}>
      {clips.map((c, ci) => {
        const f = c.frames[frame % c.frames.length]
        if (!f) return null
        const pts = framePoints(f, W / 2, H * 0.32, 52)
        const color = clips.length > 1 && ci === 0 ? 'var(--rope)' : 'var(--blue)'
        return (
          <g key={c.id} stroke={color} strokeWidth={5} strokeLinecap="round" opacity={clips.length > 1 && ci === 0 ? 0.6 : 1}>
            {SK_BONES.map(([a, b]) => (
              <line key={`${a}-${b}`} x1={pts[a].x} y1={pts[a].y} x2={pts[b].x} y2={pts[b].y} />
            ))}
            <circle cx={pts[0].x} cy={pts[0].y} r={10} fill={color} stroke="none" />
            <circle cx={pts[5].x} cy={pts[5].y} r={6} fill="var(--red)" stroke="none" />
            <circle cx={pts[6].x} cy={pts[6].y} r={6} fill="var(--red)" stroke="none" />
          </g>
        )
      })}
    </svg>
  )
}
