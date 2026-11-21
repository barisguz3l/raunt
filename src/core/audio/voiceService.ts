// Türkçe koç sesi. Birincil: önceden üretilmiş klipler (public/voice, ses saatine planlanır).
// Yedek: cihazın konuşma motoru (Web Speech). Hiçbiri yoksa: yalnızca ekranda yazı.
// Gerekçe: iOS 18+ Safari web'e yalnızca düşük kaliteli sesleri açıyor, Türkçe ses garantisi yok (araştırma raporu).

import manifest from '../speech/voiceManifest.json'
import { toSpeakText } from '../speech/pronounce'
import { WORD_GAP_SEC } from '../engine/comboScheduler'
import { audio } from './audioService'

export type VoiceSource = 'clips' | 'system'

const clips = manifest.clips as Record<string, { id: string; ms: number }>

/** Konuşma süresi (ms). Paket dışı ifade için kaba tahmin (harf başına ~65 ms). */
export function phraseMs(phrase: string): number {
  return clips[phrase]?.ms ?? Math.max(250, phrase.length * 65)
}

export function hasClip(phrase: string): boolean {
  return phrase in clips
}

class VoiceService {
  source: VoiceSource = 'clips'
  private buffers = new Map<string, AudioBuffer>()
  private loading = new Map<string, Promise<AudioBuffer | null>>()
  private timers: ReturnType<typeof setTimeout>[] = []

  /** Gerekli klipleri indirip çözer. Ses motoru açıkken çağrılmalı. Eksik kalan ifade sayısını döndürür. */
  async preload(phrases: string[]): Promise<number> {
    const ctx = audio.context
    if (!ctx) return phrases.length
    const results = await Promise.all([...new Set(phrases)].map((p) => this.load(ctx, p)))
    return results.filter((b) => !b).length
  }

  private load(ctx: BaseAudioContext, phrase: string): Promise<AudioBuffer | null> {
    const hit = this.buffers.get(phrase)
    if (hit) return Promise.resolve(hit)
    const meta = clips[phrase]
    if (!meta) return Promise.resolve(null)
    let p = this.loading.get(phrase)
    if (!p) {
      p = fetch(`${import.meta.env.BASE_URL}voice/${meta.id}.wav`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((ab) => ctx.decodeAudioData(ab))
        .then((b) => {
          this.buffers.set(phrase, b)
          return b
        })
        .catch(() => null)
        .finally(() => this.loading.delete(phrase))
      this.loading.set(phrase, p)
    }
    return p
  }

  /** Çağrıyı `delaySec` sonra söyler. Klipler hazırsa ses saatine, değilse cihaz sesine düşer. */
  speak(phrases: string[], delaySec = 0, opts: { rate?: number; wordGap?: number } = {}) {
    const rate = opts.rate ?? 1
    const gap = opts.wordGap ?? WORD_GAP_SEC
    if (this.source === 'clips' && audio.running) {
      const bufs = phrases.map((p) => this.buffers.get(p))
      if (bufs.every(Boolean)) {
        let off = 0
        const parts = bufs.map((b) => {
          const part = { buffer: b!, offset: off }
          off += b!.duration / rate + gap
          return part
        })
        audio.playVoice(parts, delaySec, rate)
        return
      }
    }
    this.speakSystem(phrases, delaySec, rate)
  }

  private speakSystem(phrases: string[], delaySec: number, rate = 1) {
    if (!systemSpeechAvailable()) return
    const run = () => {
      const u = new SpeechSynthesisUtterance(phrases.map(toSpeakText).join(', '))
      const v = turkishVoice()
      if (v) u.voice = v
      u.lang = 'tr-TR'
      u.rate = 1.05 * rate
      u.volume = audio.voiceVolume
      speechSynthesis.speak(u)
    }
    if (delaySec <= 0.02) run()
    else this.timers.push(setTimeout(run, delaySec * 1000))
  }

  /** Planlanmış (henüz başlamamış) cihaz sesi çağrılarını ve konuşmayı iptal eder. Klip iptali audio.cancelScheduled ile. */
  cancel() {
    this.timers.forEach(clearTimeout)
    this.timers = []
    if (systemSpeechAvailable()) speechSynthesis.cancel()
  }
}

export function systemSpeechAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
}

/** Belirli bir ses adına bağlanmadan Türkçe ses bul (araştırma: iOS sürümüne göre ad değişiyor). */
export function turkishVoice(): SpeechSynthesisVoice | undefined {
  if (!systemSpeechAvailable()) return undefined
  const vs = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith('tr'))
  return vs.find((v) => v.localService) ?? vs[0]
}

export const voice = new VoiceService()
