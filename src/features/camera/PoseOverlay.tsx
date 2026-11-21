import { useEffect, useState, useSyncExternalStore } from 'react'
import { LM, toScreen, type Pose } from '../../core/vision/pose'
import { tr } from '../../i18n/tr'
import { detect, loadPoseLandmarker } from './poseEngine'
import type { VisionSession } from './visionSession'

interface Props {
  video: HTMLVideoElement | null
  session: VisionSession
  paused: boolean
  /** Antrenman süresi (sn): olaylar çizelgeyle aynı saatte */
  elapsed: () => number
  skeleton: boolean
}

const BONES: [number, number][] = [
  [LM.lSh, LM.rSh],
  [LM.lSh, LM.lEl],
  [LM.lEl, LM.lWr],
  [LM.rSh, LM.rEl],
  [LM.rEl, LM.rWr],
  [LM.lSh, LM.lHip],
  [LM.rSh, LM.rHip],
  [LM.lHip, LM.rHip],
  [LM.lHip, LM.lKnee],
  [LM.lKnee, LM.lAnk],
  [LM.rHip, LM.rKnee],
  [LM.rKnee, LM.rAnk],
]

/** Yapay zekâ katmanı: duruş algılama döngüsü + iskelet + anlık geri bildirim. */
export function PoseOverlay({ video, session, paused, elapsed, skeleton }: Props) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const version = useSyncExternalStore(
    (cb) => session.subscribe(cb),
    () => session.lastPose,
  )

  useEffect(() => {
    let alive = true
    let raf = 0
    let last = 0
    if (!video) return
    void loadPoseLandmarker()
      .then((lm) => {
        if (!alive) return
        setState('ready')
        const loop = (now: number) => {
          if (!alive) return
          raf = requestAnimationFrame(loop)
          // ~20 kare/sn yeter; telefonu ısıtmasın
          if (paused || now - last < 50 || video.readyState < 2) return
          last = now
          const pose = detect(lm, video, now)
          if (pose) session.frame(elapsed(), pose)
        }
        raf = requestAnimationFrame(loop)
      })
      .catch(() => alive && setState('error'))
    return () => {
      alive = false
      cancelAnimationFrame(raf)
    }
  }, [video, paused, session, elapsed])

  const pose: Pose | null = version
  const fb = session.feedback

  return (
    <>
      {skeleton && pose && (
        <svg className="pose-skeleton" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
          {BONES.map(([a, b]) => {
            const p = toScreen(pose.img[a])
            const q = toScreen(pose.img[b])
            const vis = Math.min(pose.img[a].v ?? 1, pose.img[b].v ?? 1)
            return vis > 0.4 ? <line key={`${a}-${b}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} /> : null
          })}
          {[LM.lWr, LM.rWr].map((i) => {
            const p = toScreen(pose.img[i])
            return <circle key={i} cx={p.x} cy={p.y} r={0.018} />
          })}
        </svg>
      )}
      {state === 'loading' && <p className="pose-status">{tr.vision.loading}</p>}
      {state === 'error' && <p className="pose-status">{tr.vision.error}</p>}
      {state === 'ready' && pose && !session.fullBody && <p className="pose-status">{tr.vision.stepBack}</p>}
      {state === 'ready' && !pose && <p className="pose-status">{tr.vision.notSeen}</p>}
      {fb && (
        <p className="pose-feedback" data-tone={fb.tone} role="status">
          {fb.text}
        </p>
      )}
    </>
  )
}
