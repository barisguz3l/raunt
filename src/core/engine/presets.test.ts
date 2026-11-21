import { getContentStore } from '../content/contentStore'
import {
  defaultPresetName,
  deleteUserPreset,
  durationLabel,
  extraPresets,
  listUserPresets,
  loadLastConfig,
  saveLastConfig,
  saveUserPreset,
  toConfig,
} from './presets'

describe('Ön ayarlar', () => {
  it('seed 8 + WAKO/Muay Thai ön ayarları, id çakışması yok', () => {
    const all = [...getContentStore().content.timerPresets, ...extraPresets]
    expect(all).toHaveLength(11)
    expect(new Set(all.map((p) => p.id)).size).toBe(11)
    expect(toConfig(extraPresets[0])).toEqual({ prepSec: 10, rounds: 3, roundSec: 120, warnSec: 10, restSec: 60 })
  })

  it('kendi ön ayarını kaydet, listele, sil (IndexedDB)', async () => {
    const before = (await listUserPresets()).length
    const p = await saveUserPreset('  Akşam torba  ', { prepSec: 5, rounds: 4, roundSec: 150, warnSec: 10, restSec: 45 })
    expect(p.nameTr).toBe('Akşam torba')
    const list = await listUserPresets()
    expect(list).toHaveLength(before + 1)
    expect(list.find((x) => x.id === p.id)).toMatchObject({ rounds: 4, roundSec: 150 })
    await deleteUserPreset(p.id)
    expect(await listUserPresets()).toHaveLength(before)
  })

  it('boş adla otomatik ad', async () => {
    const p = await saveUserPreset('', { prepSec: 10, rounds: 3, roundSec: 120, warnSec: 10, restSec: 30 })
    expect(p.nameTr).toBe('3 x 2 dk · 30 sn ara')
    await deleteUserPreset(p.id)
  })

  it('son ayar hatırlanır ve sınırlara çekilir', async () => {
    await saveLastConfig({ prepSec: 10, rounds: 99, roundSec: 120, warnSec: 10, restSec: 30 })
    expect((await loadLastConfig())?.rounds).toBe(30)
  })

  it('süre etiketleri', () => {
    expect(durationLabel(45)).toBe('45 sn')
    expect(durationLabel(120)).toBe('2 dk')
    expect(durationLabel(150)).toBe('2 dk 30 sn')
    expect(defaultPresetName({ prepSec: 0, rounds: 8, roundSec: 20, warnSec: 3, restSec: 10 })).toBe('8 x 20 sn · 10 sn ara')
  })
})
