import type { TimerPreset } from '../content/types'
import { getRepo } from '../persistence/db'
import { clampConfig, type TimerConfig } from './timeline'

/**
 * Seed'deki 8 ön ayara ek, araştırmadan gelen disiplin ön ayarları
 * (WAKO kuralları: ring 3×2 dk / 1 dk ara; tatami raundu 2 dk / 1 dk ara).
 */
export const extraPresets: TimerPreset[] = [
  { id: 't_wako_ring', nameTr: 'WAKO Ring 3 x 2 dk (1 dk ara)', prepSec: 10, rounds: 3, roundSec: 120, warnSec: 10, restSec: 60 },
  { id: 't_wako_tatami', nameTr: 'WAKO Tatami 2 x 2 dk (1 dk ara)', prepSec: 10, rounds: 2, roundSec: 120, warnSec: 10, restSec: 60 },
  { id: 't_muaythai_am', nameTr: 'Muay Thai amatör 3 x 3 dk (1 dk ara)', prepSec: 10, rounds: 3, roundSec: 180, warnSec: 10, restSec: 60 },
]

export interface UserPreset extends TimerPreset {
  createdAt: string
}

export const toConfig = (p: TimerPreset): TimerConfig =>
  clampConfig({ prepSec: p.prepSec, rounds: p.rounds, roundSec: p.roundSec, warnSec: p.warnSec, restSec: p.restSec })

export function sameConfig(a: TimerConfig, b: TimerConfig): boolean {
  return a.prepSec === b.prepSec && a.rounds === b.rounds && a.roundSec === b.roundSec && a.warnSec === b.warnSec && a.restSec === b.restSec
}

export async function listUserPresets(): Promise<UserPreset[]> {
  const all = await getRepo().all<UserPreset>('userPresets')
  return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function saveUserPreset(nameTr: string, config: TimerConfig): Promise<UserPreset> {
  const c = clampConfig(config)
  const preset: UserPreset = {
    id: `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    nameTr: nameTr.trim() || defaultPresetName(c),
    ...c,
    createdAt: new Date().toISOString(),
  }
  await getRepo().put('userPresets', preset)
  return preset
}

export async function deleteUserPreset(id: string) {
  await getRepo().delete('userPresets', id)
}

/** "3 x 2 dk · 30 sn ara" */
export function defaultPresetName(c: TimerConfig): string {
  return `${c.rounds} x ${durationLabel(c.roundSec)} · ${durationLabel(c.restSec)} ara`
}

export function durationLabel(sec: number): string {
  if (sec < 60) return `${sec} sn`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s ? `${m} dk ${s} sn` : `${m} dk`
}

/** Son kullanılan ayar (kurulum ekranı bununla açılır). */
const LAST_KEY = 'timer.last'
export async function loadLastConfig(): Promise<TimerConfig | undefined> {
  return getRepo().getKV<TimerConfig>(LAST_KEY)
}
export async function saveLastConfig(c: TimerConfig) {
  await getRepo().setKV(LAST_KEY, clampConfig(c))
}
