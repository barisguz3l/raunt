import { fireEvent, render, screen } from '@testing-library/react'
import { App } from './App'
import { settingsStore } from '../core/settings/settings'

describe('Uygulama kabuğu', () => {
  beforeAll(async () => {
    await settingsStore.load()
    await settingsStore.update({ onboardingDone: true, healthAccepted: true })
  })

  beforeEach(() => {
    window.location.hash = ''
  })

  it('M0 kabul: 5 sekme Türkçe görünür', () => {
    render(<App />)
    const nav = screen.getByRole('navigation', { name: 'Ana menü' })
    const labels = Array.from(nav.querySelectorAll('button')).map((b) => b.textContent)
    expect(labels).toEqual(['Bugün', 'Antrenman', 'Kütüphane', 'İlerleme', 'Ayarlar'])
  })

  it('sekmeler arası geçiş', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /Kütüphane/ }))
    expect(screen.getByRole('heading', { level: 1, name: 'Kütüphane' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Ayarlar/ }))
    expect(screen.getByRole('heading', { level: 1, name: 'Ayarlar' })).toBeInTheDocument()
    expect(window.location.hash).toBe('#/ayarlar')
  })

  it('kütüphane seed sayılarını gösterir', () => {
    window.location.hash = '#/kutuphane'
    render(<App />)
    expect(screen.getByText(/Seviye 1: 16, Seviye 2: 16, Seviye 3: 10, 4 kilitli/)).toBeInTheDocument()
  })
})
