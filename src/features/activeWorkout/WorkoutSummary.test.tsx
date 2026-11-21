import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { settingsStore } from '../../core/settings/settings'
import { comboMemory } from '../../core/records/comboMemoryStore'
import { WorkoutSummary } from './WorkoutSummary'
import type { WorkoutPlan } from './plan'

const coachPlan: WorkoutPlan = {
  kind: 'combo',
  config: { prepSec: 10, rounds: 2, roundSec: 60, warnSec: 10, restSec: 20 },
  coach: { comboIds: ['x'], selection: 'random', tempo: 'slow', callMode: 'numbers', seed: 1 },
}
const props = {
  startedAt: new Date('2026-11-21T18:00:00'),
  actual: { roundsCompleted: 2, workSec: 120, totalSec: 160 },
  calls: 10,
  onDone: () => {},
  onRestart: () => {},
}

describe('Antrenman sonu: tempo ve kombo hafızası', () => {
  beforeEach(async () => {
    await act(() => settingsStore.update({ tempo: 'slow' }))
  })

  it('"Rahattı" bir kademe hızlandırır, "Yetişemedim" başlangıç tempoya göre yavaşlatır', async () => {
    render(<WorkoutSummary plan={coachPlan} {...props} />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Rahattı' })))
    expect(settingsStore.get().tempo).toBe('medium')
    expect(screen.getByText('Bir dahaki sefere tempo: Orta.')).toBeTruthy()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Yetişemedim' })))
    expect(settingsStore.get().tempo).toBe('slow')
    expect(screen.getByText('Tempo aynı kalıyor: Yavaş.')).toBeTruthy()
  })

  it('zamanlayıcı antrenmanında soru yok', () => {
    render(<WorkoutSummary plan={{ kind: 'timer', config: coachPlan.config }} {...props} calls={0} />)
    expect(screen.queryByText('Tempo nasıldı?')).toBeNull()
  })

  it('kaydedince çağrılan kombolar hafızaya yazılır', async () => {
    const done = vi.fn()
    render(<WorkoutSummary plan={coachPlan} {...props} comboCounts={{ c_test: 4 }} onDone={done} />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Kaydet' })))
    await waitFor(() => expect(done).toHaveBeenCalled())
    expect(comboMemory.get().stats.c_test).toEqual({ count: 4, lastDate: '2026-11-21' })
  })
})
