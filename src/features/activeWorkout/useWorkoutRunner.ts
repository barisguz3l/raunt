import { useEffect, useMemo, useRef, useState } from 'react'
import { audio } from '../../core/audio/audioService'
import { voice } from '../../core/audio/voiceService'
import { systemClock, type Clock } from '../../core/engine/clock'
import { SoundScheduler } from '../../core/engine/soundScheduler'
import type { Timeline } from '../../core/engine/timeline'
import { WorkoutEngine, type Snapshot } from '../../core/engine/workoutEngine'
import { ScreenWake } from '../../core/device/wakeLock'
import { MediaControls } from '../../core/device/mediaSession'
import { settingsStore } from '../../core/settings/settings'

export interface Controls {
  toggle(): void
  skip(): void
  finish(): void
}

export interface Runner {
  snapshot: Snapshot
  engine: WorkoutEngine
  controls: Controls
  wakeOk: boolean | null
  /** Uygulamadan çıkıldığı için otomatik duraklatıldı mı. */
  autoPaused: boolean
}

/** Arka plan/düşük kare hızında da adım atılsın diye rAF'e ek yedek aralık. */
const BACKUP_INTERVAL_MS = 250

/** Tüm planlı sesleri (zil + koç) iptal et. */
function cancelAllSound() {
  audio.cancelScheduled()
  voice.cancel()
}

/**
 * Motoru ekrana ve sese bağlar. Ziller ve kombo çağrıları kare anında değil, SoundScheduler ile
 * ses saatine önceden planlanır; duraklat/atla bu planı iptal edip yeniden kurar.
 */
export function useWorkoutRunner(timeline: Timeline, clock: Clock = systemClock): Runner {
  const ref = useRef<{ engine: WorkoutEngine; sched: SoundScheduler } | null>(null)
  if (!ref.current) ref.current = { engine: new WorkoutEngine(timeline, clock), sched: new SoundScheduler(timeline) }
  const { engine, sched } = ref.current
  const [snapshot, setSnapshot] = useState<Snapshot>(() => engine.snapshot())
  const [wakeOk, setWakeOk] = useState<boolean | null>(null)
  const [autoPaused, setAutoPaused] = useState(false)
  const stepRef = useRef<() => void>(() => {})

  const controls = useMemo<Controls>(() => {
    const replan = () => {
      cancelAllSound()
      sched.reset(engine.elapsed())
      stepRef.current()
    }
    return {
      toggle: () => {
        engine.toggle()
        setAutoPaused(false)
        replan()
      },
      skip: () => {
        engine.skip()
        replan()
      },
      finish: () => {
        engine.finish()
        cancelAllSound()
        stepRef.current()
      },
    }
  }, [engine, sched])

  useEffect(() => {
    const wake = new ScreenWake()
    const media = new MediaControls({ toggle: controls.toggle, skip: controls.skip })
    void wake.enable().then(setWakeOk)
    engine.start()
    let raf = 0
    let lastKey = ''
    let stopped = false

    const step = () => {
      if (stopped) return
      const { snapshot: s } = engine.tick()
      if (engine.state === 'running') {
        for (const p of sched.take(engine.elapsed())) {
          if (p.kind === 'bell') audio.play(p.sound, p.delay)
          else voice.speak(p.phrases, p.delay)
        }
      }
      // Yalnızca görünen değer değişince yeniden çiz (≈10 Hz)
      const key = `${s.status}|${s.phase}|${s.round}|${Math.ceil(s.remaining * 10)}`
      if (key !== lastKey) {
        lastKey = key
        setSnapshot(s)
        media.update(s)
      }
      if (s.status === 'done') {
        stopped = true
        void wake.disable()
        media.clear()
      }
    }
    stepRef.current = step

    const frame = () => {
      step()
      if (!stopped) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    const interval = setInterval(step, BACKUP_INTERVAL_MS)

    // Uygulamadan çıkınca duraklat (iOS web'de arka planda ses/zamanlayıcı güvenilir değil)
    const onHide = () => {
      if (engine.state === 'running' && settingsStore.get().autoPause) {
        engine.pause()
        cancelAllSound()
        setAutoPaused(true)
        step()
      }
    }
    const onVis = () => {
      if (document.visibilityState === 'hidden') onHide()
      else step()
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', onHide)

    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', onHide)
      cancelAllSound()
      media.clear()
      void wake.disable()
    }
  }, [engine, sched, controls])

  return { snapshot, engine, controls, wakeOk, autoPaused }
}
