import { audio, sessionTypeFor } from '../audio/audioService'
import { defaultSettings, sanitize, settingsStore } from './settings'

describe('Ayarlar', () => {
  it('bozuk kayıt güvenli değerlere çekilir', () => {
    expect(sanitize(null)).toEqual(defaultSettings)
    expect(sanitize({ bellSet: 'yok', bellVolume: 5, voiceVolume: -1, musicMode: 'x', autoPause: 'evet' })).toEqual({
      ...defaultSettings,
      bellVolume: 1,
      voiceVolume: 0,
    })
  })

  it('güncelleme kalıcıdır ve ses servisine uygulanır', async () => {
    await settingsStore.update({ bellSet: 'gong', bellVolume: 0.4, musicMode: 'always' })
    expect(audio.bellSet).toBe('gong')
    expect(audio.bellVolume).toBe(0.4)
    expect(audio.musicMode).toBe('always')
    const loaded = await settingsStore.load()
    expect(loaded).toMatchObject({ bellSet: 'gong', bellVolume: 0.4, musicMode: 'always' })
  })

  it('müzik modu → Audio Session türü', () => {
    expect(sessionTypeFor('mix')).toBe('ambient')
    expect(sessionTypeFor('always')).toBe('playback')
  })
})
