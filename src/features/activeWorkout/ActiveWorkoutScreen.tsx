import { useCallback, useEffect, useRef, useState } from 'react'
import { formatClock } from '../../core/engine/timeline'
import type { Clock } from '../../core/engine/clock'
import { callCount, callsAround } from '../../core/engine/coachTimeline'
import { comboCallCounts } from '../../core/engine/comboMemory'
import { getContentStore } from '../../core/content/contentStore'
import { turkishVoice, voice } from '../../core/audio/voiceService'
import { settingsStore, useSettings } from '../../core/settings/settings'
import { buildPlanTimeline, timelinePhrases, type WorkoutPlan } from './plan'
import { ComboBand } from './ComboBand'
import { PadScene } from '../pad/PadScene'
import { CameraMirror } from '../camera/CameraMirror'
import { VisionSession } from '../camera/visionSession'
import { VisionSummary } from '../camera/VisionSummary'
import { GhostRival } from '../camera/GhostRival'
import type { VisionStats } from '../../core/vision/matching'
import { cueMoves } from '../combos/comboModel'

import { WorkoutSummary } from './WorkoutSummary'
import { phaseStyle } from '../../design/tokens'
import { HoldButton } from '../../design/HoldButton'
import { tr } from '../../i18n/tr'
import { useWorkoutRunner } from './useWorkoutRunner'

interface Props {
  plan: WorkoutPlan
  onClose: () => void
  onRestart: () => void
  /** Dokunuşun içinde ses motorunu yeniden başlatmayı dener. */
  onRetryAudio?: () => void
  clock?: Clock
  audioOk?: boolean
}

const w = tr.workout

export function ActiveWorkoutScreen({ plan, onClose, onRestart, onRetryAudio, clock, audioOk = true }: Props) {
  const store = getContentStore()
  const [startedAt] = useState(() => new Date())
  // Çizelge bir kez kurulur (ayar değişse de antrenman ortasında değişmez)
  const [timeline] = useState(() => buildPlanTimeline(plan, store, settingsStore.get()))
  const { snapshot: s, engine, controls, wakeOk, autoPaused } = useWorkoutRunner(timeline, clock)
  const settings = useSettings()
  const coach = !!plan.coach
  const calls = coach ? callsAround(timeline, s.elapsed) : {}

  // Koç sesi kliplerini önceden yükle (hazırlık fazında biter)
  const [voiceWarning, setVoiceWarning] = useState<string | null>(null)
  useEffect(() => {
    if (!coach) return
    if (settings.voiceSource === 'system') {
      if (!turkishVoice()) setVoiceWarning(tr.coach.voiceMissing)
      return
    }
    void voice.preload(timelinePhrases(timeline)).then((missing) => {
      if (missing > 0) setVoiceWarning(tr.coach.clipsMissing(missing))
    })
  }, [])
  const paused = s.status === 'paused'

  // Devam ederken 3-2-1: eldivenle telefona yürüyüp geri dönmek için zaman (Fable önerisi #3)
  const [resumeIn, setResumeIn] = useState<number | null>(null)
  useEffect(() => {
    if (resumeIn === null) return
    if (resumeIn === 0) {
      setResumeIn(null)
      if (engine.snapshot().status === 'paused') controls.toggle()
      if (coach) voice.speak(['devam'])
      return
    }
    const id = setTimeout(() => setResumeIn((n) => (n === null ? null : n - 1)), 1000)
    return () => clearTimeout(id)
  }, [resumeIn])
  const pauseOrResume = () => {
    if (resumeIn !== null) return setResumeIn(null)
    if (paused && s.elapsed > 0) setResumeIn(3)
    else controls.toggle()
  }
  const done = s.status === 'done'
  const phaseKey = done ? 'done' : s.phase
  const style = phaseStyle[phaseKey]
  const between = s.phase === 'prep' || s.phase === 'rest'

  // Faz değişiminde kısa beyaz parlama (ses duyulmasa da geçiş fark edilsin)
  const [flash, setFlash] = useState(0)
  const prevPhase = useRef(phaseKey)
  useEffect(() => {
    if (prevPhase.current !== phaseKey) {
      prevPhase.current = phaseKey
      if (settings.phaseFlash && phaseKey !== 'warn') setFlash((n) => n + 1)
    }
  }, [phaseKey, settings.phaseFlash])

  // Klavye kısayolları (masaüstünde deneme için): Boşluk = duraklat/devam, → = atla
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('button, summary')) return
      if (e.code === 'Space') {
        e.preventDefault()
        pauseOrResume()
      } else if (e.code === 'ArrowRight') controls.skip()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [controls])

  const progress = s.phaseDuration > 0 ? 1 - s.remaining / s.phaseDuration : 1
  const soundProblem = !audioOk && settings.bellSet !== 'silent'
  // Dinlenmede: sıradaki kombonun bir hareketinin sık yapılan hatası (raunda göre döner)
  const restTip = (() => {
    if (!coach || !between || !calls.next) return null
    const ms = cueMoves(store, calls.next.comboId).filter((m) => m.mistakes?.length)
    if (!ms.length) return null
    const m = ms[s.round % ms.length]
    return `${m.nameTr}: ${m.mistakes[s.round % m.mistakes.length]}`
  })()
  // Ayna: gölge boks, kombo, refleks ve zamanlayıcıda (torba/lapa/rutinde değil)
  const mirrorAllowed = ['combo', 'shadow', 'reflex', 'timer'].includes(plan.kind)
  const [mirrorError, setMirrorError] = useState<string | null>(null)
  const mirror = mirrorAllowed && settings.cameraMirror && !mirrorError
  // Yapay zekâ koç (aynada): tek oturum, çizelgeyle aynı saat
  const [vision] = useState(() => new VisionSession(() => settingsStore.get().voiceVolume > 0))
  const ai = mirror && settings.poseAI
  const elapsedFn = useCallback(() => engine.elapsed(), [engine])
  const curStance =
    timeline.cues.some((c) => c.type === 'call' && c.comboId === 'move:switch' && c.round === s.round && c.t <= s.elapsed) && !between
      ? settings.stance === 'orthodox'
        ? 'southpaw'
        : 'orthodox'
      : settings.stance
  useEffect(() => {
    if (!ai) return
    const c = calls.current
    vision.setContext({
      elapsed: s.elapsed,
      inRound: s.phase === 'round' || s.phase === 'warn',
      round: s.round,
      stance: curStance,
      call: c ? { t: c.t, comboId: c.comboId, speakSec: c.speakSec, windowSec: c.windowSec } : undefined,
    })
  })
  const [visionStats, setVisionStats] = useState<VisionStats | null>(null)
  useEffect(() => {
    if (done && ai) void vision.finish().then(setVisionStats)
  }, [done])
  const labels = timeline.config.labels
  const label = labels ? labels[Math.min(s.round, labels.length) - 1] : undefined

  if (done) {
    return (
      <div className="workout-summary-screen" role="dialog" aria-modal="true" aria-label={tr.summary.kicker}>
        {visionStats && (
          <div className="summary" style={{ paddingBottom: 0 }}>
            <VisionSummary stats={visionStats} ghost={{ dodged: vision.dodged, caught: vision.caught }} />
          </div>
        )}
        <WorkoutSummary
          plan={plan}
          startedAt={startedAt}
          actual={engine.actual()}
          calls={coach ? callCount(timeline, engine.elapsed()) : 0}
          comboCounts={coach ? comboCallCounts(timeline, engine.elapsed()) : undefined}
          onDone={onClose}
          onRestart={onRestart}
        />
      </div>
    )
  }

  return (
    <div
      className="workout"
      data-phase={phaseKey}
      data-paused={paused || undefined}
      data-coach={coach || undefined}
      data-pad={plan.coach?.pad || undefined}
      data-mirror={mirror || undefined}
      style={{ ['--phase' as string]: style.color, ['--phase-text' as string]: style.text }}
      role="dialog"
      aria-modal="true"
      aria-label={tr.timer.setupTitle}
    >
      {mirror && (
        <CameraMirror
          inRound={s.phase === 'round' || s.phase === 'warn'}
          paused={paused}
          onError={setMirrorError}
          ai={ai ? { session: vision, elapsed: elapsedFn, skeleton: settings.poseSkeleton } : undefined}
        />
      )}
      {ai && settings.ghostRival && coach && (
        <GhostRival
          session={vision}
          elapsed={s.elapsed}
          inRound={s.phase === 'round' || s.phase === 'warn'}
          paused={paused}
          stance={curStance}
          call={calls.current ? { t: calls.current.t, comboId: calls.current.comboId, speakSec: calls.current.speakSec, windowSec: calls.current.windowSec } : undefined}
          seed={plan.coach?.seed ?? 1}
        />
      )}
      {mirrorAllowed && (
        <button
          type="button"
          className="mirror-toggle"
          aria-pressed={mirror}
          onClick={() => {
            setMirrorError(null)
            void settingsStore.update({ cameraMirror: !mirror })
          }}
        >
          {mirror ? tr.camera.toggleOn : tr.camera.toggle}
        </button>
      )}
      {flash > 0 && <div key={flash} className="phase-flash" aria-hidden="true" />}
      <header className="workout-top">
        {plan.title && <div className="workout-title">{plan.title}</div>}
        <div className="workout-phase" aria-live="assertive">
          {paused ? w.paused : style.label}
        </div>
        {!done && (
          <div className="workout-round tabular">{between ? w.next(s.round) : w.round(s.round, s.totalRounds)}</div>
        )}
        <ol className="round-dots" aria-hidden="true">
          {Array.from({ length: s.totalRounds }, (_, i) => {
            const n = i + 1
            const state = done || n < s.round ? 'done' : n === s.round && !between ? 'now' : 'todo'
            return <li key={n} data-state={state} />
          })}
        </ol>
      </header>

      {done ? (
        <main className="workout-done">
          <div className="workout-done-title">{w.finished}</div>
          <p className="tabular">
            {(() => {
              const a = engine.actual()
              return w.summary(a.roundsCompleted, formatClock(a.workSec), formatClock(a.totalSec))
            })()}
          </p>
          {coach && <p>{tr.coach.callsDone(callCount(timeline, engine.elapsed()))}</p>}
        </main>
      ) : (
        <main className="workout-center">
          <div className="workout-clock tabular" role="timer" aria-label={formatClock(s.remaining)}>
            {formatClock(s.remaining)}
          </div>
          <div className="workout-progress" aria-hidden="true">
            <span style={{ transform: `scaleX(${Math.min(1, Math.max(0, progress))})` }} />
          </div>
          {label && <div className="workout-label">{between ? w.nextLabel(label) : label}</div>}
          <div className="workout-sub">{paused && autoPaused ? w.autoPaused : between || label ? '' : w.roundsLeft(s.roundsLeft)}</div>
          {plan.coach?.pad && !paused && (() => {
            const cue = between ? calls.next : (calls.current ?? undefined)
            return (
              <PadScene
                moves={cue ? cueMoves(store, cue.comboId) : []}
                stance={
                  timeline.cues.some((c) => c.type === 'call' && c.comboId === 'move:switch' && c.round === s.round && c.t <= s.elapsed) && !between
                    ? settings.stance === 'orthodox'
                      ? 'southpaw'
                      : 'orthodox'
                    : settings.stance
                }
                cueT={between ? undefined : cue?.t}
                speakSec={cue?.speakSec}
                elapsed={s.elapsed}
                preview={between}
              />
            )
          })()}
          {coach && between && restTip && (
            <p className="workout-tip">
              <span>{w.watchFor}</span> {restTip}
            </p>
          )}
          {coach && <ComboBand current={between ? undefined : calls.current} last={between ? undefined : calls.last} next={calls.next} elapsed={s.elapsed} showNext={between} />}
        </main>
      )}

      <footer className="workout-controls">
        {done ? (
          <div className="workout-row">
            <button type="button" className="workout-btn" onClick={onClose}>
              {w.close}
            </button>
            <button type="button" className="workout-btn workout-btn-strong" onClick={onRestart}>
              {w.again}
            </button>
          </div>
        ) : (
          <>
            <button type="button" className="workout-pause" onClick={pauseOrResume}>
              {resumeIn !== null ? w.resumeIn(resumeIn) : paused ? `▶\uFE0E ${w.resume}` : `❚❚ ${w.pause}`}
            </button>
            <div className="workout-row">
              <button type="button" className="workout-btn" onClick={controls.skip}>
                {w.skip} ⏭︎
              </button>
              <HoldButton className="workout-btn" label={w.finishHold} onConfirm={controls.finish}>
                ■ {w.finishHold}
              </HoldButton>
            </div>
            {soundProblem && (
              <div className="workout-alert" role="alert">
                <p>{w.soundOff}</p>
                {onRetryAudio && (
                  <button type="button" className="workout-btn workout-btn-strong" onClick={onRetryAudio}>
                    {w.retrySound}
                  </button>
                )}
                <details>
                  <summary>{w.soundHelp}</summary>
                  <ul>
                    {tr.sound.trouble.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </details>
              </div>
            )}
            {wakeOk === false && <p className="workout-note">{w.wakeOff}</p>}
            {voiceWarning && <p className="workout-note">{voiceWarning}</p>}
            {mirrorError && <p className="workout-note">{mirrorError}</p>}
          </>
        )}
      </footer>
    </div>
  )
}
