import { act, fireEvent, render, screen } from '@testing-library/react'
import { settingsStore } from '../../core/settings/settings'
import { SoundSettings } from './SoundSettings'

describe('Ses ayarları ekranı', () => {
  beforeEach(async () => {
    await act(() => settingsStore.update({ bellSet: 'classic', musicMode: 'mix', autoPause: true }))
  })

  it('6 zil seti listelenir ve seçim kaydedilir', async () => {
    render(<SoundSettings />)
    const radios = screen.getAllByRole('radio').filter((r) => r.closest('[aria-labelledby="bellset-label"]'))
    expect(radios.map((r) => r.textContent)).toEqual([
      'Klasik Zil',
      'Gong',
      'Ahşap Tak-Tak',
      'Dijital Bip',
      'Düdük',
      'Sessiz (sadece ekran)',
    ])
    await act(async () => fireEvent.click(screen.getByRole('radio', { name: /Gong/ })))
    expect(settingsStore.get().bellSet).toBe('gong')
    expect(screen.getByRole('radio', { name: /Gong/ })).toHaveAttribute('aria-checked', 'true')
  })

  it('müzik modu ve otomatik duraklatma', async () => {
    render(<SoundSettings />)
    await act(async () => fireEvent.click(screen.getByRole('radio', { name: /Her zaman duyulsun/ })))
    expect(settingsStore.get().musicMode).toBe('always')
    await act(async () => fireEvent.click(screen.getByRole('switch', { name: /Uygulamadan çıkınca duraklat/ })))
    expect(settingsStore.get().autoPause).toBe(false)
  })

  it('ses testi: "Hayır" sorun giderme adımlarını gösterir', async () => {
    render(<SoundSettings />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Ses testini başlat/ })))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Hayır' })))
    expect(screen.getByRole('alert')).toHaveTextContent('sessiz anahtarı')
  })
})
