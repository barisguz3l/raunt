import { act, render, screen } from '@testing-library/react'
import { FakeClock } from '../../core/engine/clock'
import { getContentStore } from '../../core/content/contentStore'
import { settingsStore } from '../../core/settings/settings'
import { ActiveWorkoutScreen } from './ActiveWorkoutScreen'
import { buildPlanTimeline, timelinePhrases, type WorkoutPlan } from './plan'
import { hasClip } from '../../core/audio/voiceService'

let frames: FrameRequestCallback[] = []
beforeEach(async () => {
  frames = []
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb))
  vi.stubGlobal('cancelAnimationFrame', () => {})
  await act(() => settingsStore.update({ coachApproved: false, stance: 'orthodox', nameStyle: 'leftRight', voiceSource: 'clips' }))
})
afterEach(() => vi.unstubAllGlobals())
const flush = () =>
  act(() => {
    const f = frames
    frames = []
    f.forEach((cb) => cb(0))
  })

const store = getContentStore()
const plan = (comboCodes: string[], callMode: 'numbers' | 'names' = 'numbers'): WorkoutPlan => ({
  kind: 'combo',
  config: { prepSec: 10, rounds: 2, roundSec: 60, warnSec: 10, restSec: 20 },
  coach: {
    comboIds: comboCodes.map((code) => store.content.combos.find((c) => c.code === code)!.id),
    selection: 'sequential',
    tempo: 'slow',
    callMode,
    seed: 1,
  },
})

describe('Kombo koçu antrenmanı', () => {
  it('çizelgedeki her çağrı ifadesinin ses klibi var', () => {
    for (const mode of ['numbers', 'names'] as const) {
      for (const stance of ['orthodox', 'southpaw'] as const) {
        const tl = buildPlanTimeline(plan(store.content.combos.map((c) => c.code), mode), store, { ...settingsStore.get(), stance, coachApproved: true })
        const missing = timelinePhrases(tl).filter((p) => !hasClip(p))
        expect(missing).toEqual([])
      }
    }
  })

  it('rauntta kombo bandı: büyük kod + Türkçe adlar; hazırlıkta sıradaki önizlenir', () => {
    const clock = new FakeClock(0)
    render(<ActiveWorkoutScreen plan={plan(['1-2-3-LKR'])} onClose={vi.fn()} onRestart={vi.fn()} clock={clock} />)
    flush()
    // Hazırlık: sıradaki kombo önizleme
    expect(screen.getByLabelText('1, 2, 3, Arka alçak')).toBeInTheDocument()
    clock.advance(10 + 1.5 + 0.1) // ilk çağrı: raunt başı + 1,5 sn
    flush()
    expect(screen.getByLabelText('1, 2, 3, Arka alçak')).toBeInTheDocument()
    expect(screen.getByText('sol direkt, sağ direkt, sol kroşe, arka alçak tekme')).toBeInTheDocument()
  })

  it('kilitli kombo planlansa bile onaysız çağrılmaz', () => {
    const tl = buildPlanTimeline(plan(['1-2-HKR', '1-2']), store, settingsStore.get())
    const ids = new Set(tl.cues.flatMap((c) => (c.type === 'call' && !c.comboId.startsWith('say:') ? [c.comboId] : [])))
    expect([...ids].map((id) => store.combo(id)!.code)).toEqual(['1-2'])
  })

  it('bitişte çağrılan kombo sayısı', () => {
    const clock = new FakeClock(0)
    render(<ActiveWorkoutScreen plan={plan(['1-2'])} onClose={vi.fn()} onRestart={vi.fn()} clock={clock} />)
    flush()
    clock.advance(500)
    flush()
    expect(screen.getByText('çağrılan kombo')).toBeInTheDocument()
  })
})
