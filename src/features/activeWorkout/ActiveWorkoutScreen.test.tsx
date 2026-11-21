import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { FakeClock } from '../../core/engine/clock'
import { ActiveWorkoutScreen } from './ActiveWorkoutScreen'

const config = { prepSec: 10, rounds: 3, roundSec: 120, warnSec: 10, restSec: 30 }

// rAF'i elle sür
let frames: FrameRequestCallback[] = []
beforeEach(() => {
  frames = []
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb))
  vi.stubGlobal('cancelAnimationFrame', () => {})
})
afterEach(() => vi.unstubAllGlobals())
const flush = () =>
  act(() => {
    const f = frames
    frames = []
    f.forEach((cb) => cb(0))
  })

function setup() {
  const clock = new FakeClock(0)
  const props = { plan: { kind: 'timer' as const, config }, onClose: vi.fn(), onRestart: vi.fn(), clock }
  render(<ActiveWorkoutScreen {...props} />)
  flush()
  return { clock, props }
}

describe('Aktif antrenman ekranı', () => {
  it('hazırlıkla başlar, rauntta sayaç ve raunt göstergesi', () => {
    const { clock } = setup()
    expect(screen.getByRole('timer')).toHaveTextContent('00:10')
    expect(screen.getByText('Hazırlık')).toBeInTheDocument()
    clock.advance(25)
    flush()
    expect(screen.getByText('Raunt')).toBeInTheDocument()
    expect(screen.getByText('Raunt 1 / 3')).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent('01:45')
    expect(screen.getByText('2 raunt kaldı')).toBeInTheDocument()
  })

  it('duraklat / devam', () => {
    const { clock } = setup()
    fireEvent.click(screen.getByRole('button', { name: /Duraklat/ }))
    clock.advance(60)
    flush()
    expect(screen.getByText('Duraklatıldı')).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent('00:10')
    fireEvent.click(screen.getByRole('button', { name: /Devam/ }))
    clock.advance(3)
    flush()
    expect(screen.getByRole('timer')).toHaveTextContent('00:07')
  })

  it('atla ve dinlenmede sıradaki raunt', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: /Atla/ })) // hazırlık → raunt 1
    fireEvent.click(screen.getByRole('button', { name: /Atla/ })) // raunt 1 → dinlenme
    flush()
    expect(screen.getByText('Dinlenme')).toBeInTheDocument()
    expect(screen.getByText('Sıradaki: raunt 2')).toBeInTheDocument()
  })

  it('uygulamadan çıkınca otomatik duraklar ve nedenini söyler', () => {
    const { clock } = setup()
    clock.advance(20)
    flush()
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
    clock.advance(120)
    flush()
    expect(screen.getByText('Duraklatıldı')).toBeInTheDocument()
    expect(screen.getByText('Uygulamadan çıktığın için duraklatıldı.')).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent('01:50') // 10 sn rauntta geçti, süre korunmuş
    // Devam: önce 3-2-1 (eldivenle telefona yürüyüp dönme payı)
    fireEvent.click(screen.getByRole('button', { name: /Devam/ }))
    expect(screen.getByRole('button', { name: '3…' })).toBeInTheDocument()
  })

  it('ses başlatılamazsa uyarı + tekrar dene butonu', () => {
    const onRetryAudio = vi.fn()
    render(<ActiveWorkoutScreen plan={{ kind: 'timer', config }} onClose={vi.fn()} onRestart={vi.fn()} clock={new FakeClock(0)} audioOk={false} onRetryAudio={onRetryAudio} />)
    flush()
    expect(screen.getByRole('alert')).toHaveTextContent('Ses başlatılamadı')
    fireEvent.click(screen.getByRole('button', { name: /Sesi tekrar dene/ }))
    expect(onRetryAudio).toHaveBeenCalled()
  })

  it('bitişte özet, zorluk ve kayıt', async () => {
    const { clock, props } = setup()
    clock.advance(500)
    flush()
    expect(screen.getByText('Antrenman bitti, harika iş!')).toBeInTheDocument()
    // Antrenman sonu: zorluk seç, kaydet → seans kaydı oluşur ve ekran kapanır
    fireEvent.click(within(screen.getByRole('group', { name: 'Ne kadar zordu? (1–10)' })).getByRole('button', { name: '7' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Kaydet' }))
    })
    await vi.waitFor(() => expect(props.onClose).toHaveBeenCalled())
    const { records } = await import('../../core/records/records')
    const saved = (await records.sessions()).find((x) => x.rpe === 7 && x.rounds === 3)
    expect(saved).toBeTruthy()
  })
})
