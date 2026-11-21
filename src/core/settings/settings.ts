// Uygulama ayarları: IndexedDB'de tek kayıt (kv: "settings"), bellekte abone olunabilir depo.

import { useSyncExternalStore } from 'react'
import { audio, type MusicMode } from '../audio/audioService'
import { bellSetIds, type BellSetId } from '../audio/bells'
import { voice, type VoiceSource } from '../audio/voiceService'
import type { Tempo, Selection } from '../engine/comboScheduler'
import { getRepo } from '../persistence/db'
import type { CallMode, NameStyle, Stance } from '../speech/stanceMapper'

export interface AppSettings {
  bellSet: BellSetId
  /** 0–1 */
  bellVolume: number
  /** 0–1 (koç sesi, M3) */
  voiceVolume: number
  musicMode: MusicMode
  /** Uygulamadan çıkınca (sekme gizlenince) antrenmanı duraklat. */
  autoPause: boolean
  /** Faz değişiminde ekran flaşı (azaltılmış hareket açıksa yapılmaz). */
  phaseFlash: boolean
  /** Duruş: orthodox (sol önde) / southpaw (sağ önde). */
  stance: Stance
  /** Kroşe/aparkat adı: sol/sağ veya ön/arka. */
  nameStyle: NameStyle
  /** "Hocam onayladı": orta/yüksek tekme içeren hareket ve kombolar açılır. */
  coachApproved: boolean
  /** Koç sesi kaynağı: kayıtlı Türkçe klipler veya cihazın konuşma motoru. */
  voiceSource: VoiceSource
  /** Kombo koçu varsayılanları (son kullanılan). */
  callMode: CallMode
  tempo: Tempo
  selection: Selection
  /** Profil */
  name: string
  weightKg: number | null
  /** Haftalık seans hedefi (salon dersleri dahil) */
  weeklyGoal: number
  /** Ev antrenmanı saati (beslenme/su hatırlatmaları ve takvim için) "HH:MM" */
  trainingTime: string
  /** Kuşak (TKBF sırası kullanıcı seçimli) ve son sınav tarihi */
  belt: string
  lastBeltExam: string | null
  /** Ramazan modu: daha kısa/hafif seans önerisi, iftar–sahur su hedefi */
  ramadan: boolean
  /** Oyunlaştırma (rozetler, seri) — kapatılabilir */
  gamification: boolean
  /** Eğer–o zaman planı (alışkanlık) */
  ifThen: string
  obstaclePlan: string
  onboardingDone: boolean
  healthAccepted: boolean
  /** Lapa modu: kombo antrenmanında ekranda lapa animasyonu */
  padMode: boolean
  /** Koç araya girsin: hazır ol, dinlen, son raunt, son on saniye ve raunt içi ipuçları */
  coachChatter: boolean
  /** Hocanın son düzeltmesi (ders günlüğünden): bu ipucu daha sık söylenir */
  coachFocus: 'guardUp' | 'chinDown' | 'breathe' | 'relax' | null
}

export const defaultSettings: AppSettings = {
  bellSet: 'classic',
  bellVolume: 0.9,
  voiceVolume: 1,
  musicMode: 'mix',
  autoPause: true,
  phaseFlash: true,
  stance: 'orthodox',
  nameStyle: 'leftRight',
  coachApproved: false,
  voiceSource: 'clips',
  callMode: 'numbers',
  tempo: 'slow',
  selection: 'random',
  name: '',
  weightKg: null,
  weeklyGoal: 4,
  trainingTime: '19:00',
  belt: 'beyaz',
  lastBeltExam: null,
  ramadan: false,
  gamification: true,
  ifThen: '',
  obstaclePlan: '',
  onboardingDone: false,
  healthAccepted: false,
  padMode: false,
  coachChatter: true,
  coachFocus: null,
}

const KEY = 'settings'

/** Bozuk/eski kayıtları güvenli değerlere çeker (yeni alanlar varsayılanla gelir). */
export function sanitize(raw: unknown): AppSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<AppSettings>
  const unit = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : d)
  return {
    bellSet: bellSetIds.includes(r.bellSet as BellSetId) ? (r.bellSet as BellSetId) : defaultSettings.bellSet,
    bellVolume: unit(r.bellVolume, defaultSettings.bellVolume),
    voiceVolume: unit(r.voiceVolume, defaultSettings.voiceVolume),
    musicMode: r.musicMode === 'always' || r.musicMode === 'mix' ? r.musicMode : defaultSettings.musicMode,
    autoPause: typeof r.autoPause === 'boolean' ? r.autoPause : defaultSettings.autoPause,
    phaseFlash: typeof r.phaseFlash === 'boolean' ? r.phaseFlash : defaultSettings.phaseFlash,
    stance: oneOf(r.stance, ['orthodox', 'southpaw'], defaultSettings.stance),
    nameStyle: oneOf(r.nameStyle, ['leftRight', 'frontRear'], defaultSettings.nameStyle),
    coachApproved: typeof r.coachApproved === 'boolean' ? r.coachApproved : defaultSettings.coachApproved,
    voiceSource: oneOf(r.voiceSource, ['clips', 'system'], defaultSettings.voiceSource),
    callMode: oneOf(r.callMode, ['numbers', 'names'], defaultSettings.callMode),
    tempo: oneOf(r.tempo, ['slow', 'medium', 'fast', 'master'], defaultSettings.tempo),
    selection: oneOf(r.selection, ['sequential', 'random'], defaultSettings.selection),
    name: typeof r.name === 'string' ? r.name.slice(0, 40) : '',
    weightKg: typeof r.weightKg === 'number' && r.weightKg >= 30 && r.weightKg <= 250 ? r.weightKg : null,
    weeklyGoal: typeof r.weeklyGoal === 'number' ? Math.min(7, Math.max(1, Math.round(r.weeklyGoal))) : defaultSettings.weeklyGoal,
    trainingTime: typeof r.trainingTime === 'string' && /^\d{2}:\d{2}$/.test(r.trainingTime) ? r.trainingTime : defaultSettings.trainingTime,
    belt: typeof r.belt === 'string' ? r.belt : defaultSettings.belt,
    lastBeltExam: typeof r.lastBeltExam === 'string' ? r.lastBeltExam : null,
    ramadan: r.ramadan === true,
    gamification: r.gamification !== false,
    ifThen: typeof r.ifThen === 'string' ? r.ifThen.slice(0, 200) : '',
    obstaclePlan: typeof r.obstaclePlan === 'string' ? r.obstaclePlan.slice(0, 200) : '',
    onboardingDone: r.onboardingDone === true,
    healthAccepted: r.healthAccepted === true,
    padMode: r.padMode === true,
    coachChatter: r.coachChatter !== false,
    coachFocus: (['guardUp', 'chinDown', 'breathe', 'relax'] as const).includes(r.coachFocus as never) ? (r.coachFocus as AppSettings['coachFocus']) : null,
  }
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], d: T): T {
  return allowed.includes(v as T) ? (v as T) : d
}

let current: AppSettings = defaultSettings
let loaded = false
const listeners = new Set<() => void>()

function applyToAudio(s: AppSettings) {
  audio.bellSet = s.bellSet
  audio.setBellVolume(s.bellVolume)
  audio.setVoiceVolume(s.voiceVolume)
  audio.musicMode = s.musicMode
  voice.source = s.voiceSource
}

export const settingsStore = {
  get: () => current,
  /** IndexedDB'den okundu mu (karşılama ekranı yanlışlıkla görünmesin) */
  loaded: () => loaded,
  subscribe(fn: () => void) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
  async load() {
    const raw = await getRepo().getKV<Record<string, unknown>>(KEY)
    // Karşılama ekranından önceki sürümü kullananlar zorla karşılamaya sokulmasın
    current = sanitize(raw && !('onboardingDone' in raw) ? { ...raw, onboardingDone: true, healthAccepted: true } : raw)
    loaded = true
    applyToAudio(current)
    listeners.forEach((l) => l())
    return current
  },
  async update(patch: Partial<AppSettings>) {
    current = sanitize({ ...current, ...patch })
    applyToAudio(current)
    if ('musicMode' in patch) audio.applyMusicMode(current.musicMode)
    listeners.forEach((l) => l())
    await getRepo().setKV(KEY, current)
  },
}

export function useSettings(): AppSettings {
  return useSyncExternalStore(settingsStore.subscribe, settingsStore.get, settingsStore.get)
}
