import { fireEvent, render, screen } from '@testing-library/react'
import { HoldButton } from './HoldButton'

describe('HoldButton', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('kısa basış onaylamaz, 1.2 sn basılı tutmak onaylar', () => {
    const onConfirm = vi.fn()
    render(<HoldButton label="Bitir" onConfirm={onConfirm}>Bitir</HoldButton>)
    const btn = screen.getByRole('button', { name: 'Bitir' })

    fireEvent.pointerDown(btn)
    vi.advanceTimersByTime(500)
    fireEvent.pointerUp(btn)
    vi.advanceTimersByTime(2000)
    expect(onConfirm).not.toHaveBeenCalled()

    fireEvent.pointerDown(btn)
    vi.advanceTimersByTime(1199)
    expect(onConfirm).not.toHaveBeenCalled()
    vi.advanceTimersByTime(2)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('parmak butondan kayarsa iptal', () => {
    const onConfirm = vi.fn()
    render(<HoldButton label="Bitir" onConfirm={onConfirm}>Bitir</HoldButton>)
    const btn = screen.getByRole('button', { name: 'Bitir' })
    fireEvent.pointerDown(btn)
    vi.advanceTimersByTime(600)
    fireEvent.pointerLeave(btn)
    vi.advanceTimersByTime(1000)
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
