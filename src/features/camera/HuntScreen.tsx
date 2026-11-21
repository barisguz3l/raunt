import { useEffect, useRef, useState } from 'react'
import { audio } from '../../core/audio/audioService'
import { getRepo } from '../../core/persistence/db'
import { avgMs, HUNT, huntScore, isHit, makeTarget, visibleBounds, type HuntResult, type HuntTarget } from '../../core/vision/hunt'
import { tr } from '../../i18n/tr'
import { detect, loadPoseLandmarker } from './poseEngine'

const h = tr.hunt

type Phase = 'intro' | 'loading' | 'countdown' | 'play' | 'done' | 'error'

/** Lapa avı: aynada yüzünün çevresinde hedefler; doğru elle vur, tepki süren ölçülür. */
export function HuntScreen({ onClose }: { onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [phase, setPhase] = useState<Phase>('intro')
  const [error, setError] = useState('')
  const [count, setCount] = useState(3)
  const [target, setTarget] = useState<HuntTarget | null>(null)
  const [result, setResult] = useState<HuntResult>({ hits: 0, misses: 0, reactionsMs: [] })
  const [left, setLeft] = useState(HUNT.durationSec)
  const [best, setBest] = useState<number | null>(null)
  const [flash, setFlash] = useState(0)
  const stream = useRef<MediaStream | null>(null)

  useEffect(() => {
    void getRepo()
      .getKV<number>('hunt.best')
      .then((b) => setBest(b ?? null))
    return () => stream.current?.getTracks().forEach((t) => t.stop())
  }, [])

  const start = async () => {
    void audio.unlock()
    setPhase('loading')
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false })
      stream.current = s
      if (video.current) {
        video.current.srcObject = s
        await video.current.play().catch(() => undefined)
      }
      await loadPoseLandmarker()
      setResult({ hits: 0, misses: 0, reactionsMs: [] })
      setLeft(HUNT.durationSec)
      setCount(3)
      setPhase('countdown')
    } catch (e) {
      setError((e as Error).name === 'NotAllowedError' ? tr.camera.denied : tr.vision.error)
      setPhase('error')
    }
  }

  // Geri sayım
  useEffect(() => {
    if (phase !== 'countdown') return
    if (count === 0) {
      setPhase('play')
      return
    }
    audio.play('tick')
    const id = setTimeout(() => setCount((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [phase, count])

  // Oyun döngüsü
  useEffect(() => {
    if (phase !== 'play') return
    let alive = true
    let raf = 0
    let last = 0
    let id = 0
    let cur: HuntTarget | null = null
    let nextAt = 0
    const t0 = performance.now()
    let seed = (Date.now() & 0xffff) + 1
    const rand = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    const res: HuntResult = { hits: 0, misses: 0, reactionsMs: [] }
    void loadPoseLandmarker().then((lm) => {
      const loop = (now: number) => {
        if (!alive) return
        raf = requestAnimationFrame(loop)
        const t = (now - t0) / 1000
        const remain = Math.max(0, HUNT.durationSec - t)
        setLeft(Math.ceil(remain))
        if (remain <= 0) {
          alive = false
          setTarget(null)
          setResult({ ...res })
          void finish(res)
          return
        }
        if (now - last < 50 || !video.current || video.current.readyState < 2) return
        last = now
        const pose = detect(lm, video.current, now)
        if (!pose) return
        if (!cur && t >= nextAt) {
          const v = video.current
          cur = makeTarget(++id, pose, t, rand, visibleBounds(v.videoWidth, v.videoHeight, window.innerWidth, window.innerHeight))
          setTarget(cur)
        }
        if (cur) {
          if (isHit(cur, pose)) {
            res.hits++
            res.reactionsMs.push(Math.round((t - cur.bornAt) * 1000))
            audio.play('tick')
            setFlash((f) => f + 1)
            cur = null
            setTarget(null)
            nextAt = t + HUNT.gapSec
            setResult({ ...res })
          } else if (t - cur.bornAt > HUNT.lifeSec) {
            res.misses++
            cur = null
            setTarget(null)
            nextAt = t + HUNT.gapSec
            setResult({ ...res })
          }
        }
      }
      raf = requestAnimationFrame(loop)
    })
    return () => {
      alive = false
      cancelAnimationFrame(raf)
    }
  }, [phase])

  const finish = async (res: HuntResult) => {
    audio.play('finish')
    const score = huntScore(res)
    const prev = (await getRepo().getKV<number>('hunt.best')) ?? 0
    if (score > prev) await getRepo().setKV('hunt.best', score)
    setBest(Math.max(score, prev))
    setPhase('done')
  }

  const score = huntScore(result)
  const vw = video.current?.videoWidth || 640
  const vh = video.current?.videoHeight || 480
  const avg = avgMs(result)

  return (
    <div className="hunt" role="dialog" aria-modal="true" aria-label={h.title}>
      <video ref={video} className="mirror-video" playsInline muted autoPlay aria-hidden="true" />
      {target && phase === 'play' && (
        <svg className="pose-skeleton" viewBox={`0 0 ${vw} ${vh}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <g key={target.id} className="hunt-target" data-hand={target.hand}>
            <circle cx={target.x * vw} cy={target.y * vh} r={target.r * vw} />
            <text x={target.x * vw} y={target.y * vh + vw * 0.025} textAnchor="middle" fontSize={vw * 0.07}>
              {target.hand === 'left' ? h.left : h.right}
            </text>
          </g>
        </svg>
      )}
      {flash > 0 && phase === 'play' && <div key={flash} className="hunt-flash" aria-hidden="true" />}

      <header className="hunt-top">
        <button type="button" className="mirror-toggle" style={{ position: 'static' }} onClick={onClose}>
          {h.close}
        </button>
        {phase === 'play' && (
          <div className="hunt-hud tabular">
            <span>{h.time(left)}</span>
            <span>{h.hits(result.hits)}</span>
          </div>
        )}
      </header>

      {phase === 'intro' && (
        <div className="hunt-panel">
          <h1 className="onboarding-title">{h.title}</h1>
          <p>{h.intro}</p>
          {best != null && <p className="card-muted">{h.best(best)}</p>}
          <button type="button" className="big-button" data-variant="accent" data-size="primary" onClick={() => void start()}>
            {h.start}
          </button>
        </div>
      )}
      {phase === 'loading' && <p className="pose-status">{tr.vision.loading}</p>}
      {phase === 'countdown' && <div className="hunt-count tabular">{count}</div>}
      {phase === 'error' && (
        <div className="hunt-panel">
          <p>{error}</p>
          <button type="button" className="big-button" data-variant="neutral" onClick={onClose}>
            {h.close}
          </button>
        </div>
      )}
      {phase === 'done' && (
        <div className="hunt-panel">
          <h1 className="onboarding-title">{h.score(score)}</h1>
          <dl className="hunt-result">
            <div>
              <dt>{h.hitsLabel}</dt>
              <dd>{result.hits}</dd>
            </div>
            <div>
              <dt>{h.missesLabel}</dt>
              <dd>{result.misses}</dd>
            </div>
            <div>
              <dt>{h.reaction}</dt>
              <dd>{avg != null ? `${avg} ms` : '—'}</dd>
            </div>
          </dl>
          {best != null && <p className="card-muted">{score >= best ? h.newBest : h.best(best)}</p>}
          <button type="button" className="big-button" data-variant="accent" data-size="primary" onClick={() => setPhase('countdown')}>
            {h.again}
          </button>
          <button type="button" className="big-button" data-variant="neutral" style={{ marginTop: 10 }} onClick={onClose}>
            {h.close}
          </button>
        </div>
      )}
    </div>
  )
}
