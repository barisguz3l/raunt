// Tek AudioContext. iOS Safari ses motorunu yalnızca kullanıcı dokunuşunda başlatır:
// unlock() dokunuşun içinde (ilk await'ten önce) çağrılmalı.
//
// Yönlendirme:  zil kanalı ─┐
//              koç kanalı ─┴─> ana kazanç ─> sınırlayıcı ─> hoparlör

import type { BellSound } from '../engine/timeline'
import { bellSets, type BellSetId } from './bells'

export type MusicMode = 'mix' | 'always'

type AudioSessionType = 'auto' | 'playback' | 'transient' | 'transient-solo' | 'ambient' | 'play-and-record'
interface NavigatorWithAudioSession {
  audioSession?: { type: AudioSessionType }
}

/** Müzik modu → Audio Session türü (Safari 17+). "mix": müzikle karışır ama sessiz anahtarda duyulmaz. */
export function sessionTypeFor(mode: MusicMode): AudioSessionType {
  return mode === 'mix' ? 'ambient' : 'playback'
}

class AudioService {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private bellBus: GainNode | null = null
  private voiceBus: GainNode | null = null
  private voices: { gain: GainNode; at: number }[] = []

  bellSet: BellSetId = 'classic'
  bellVolume = 0.9
  voiceVolume = 1
  musicMode: MusicMode = 'mix'

  get available(): boolean {
    return typeof window !== 'undefined' && ('AudioContext' in window || 'webkitAudioContext' in window)
  }

  /** Audio Session API var mı (Safari 17+). Yoksa müzik modu ayarı etkisizdir. */
  get sessionSupported(): boolean {
    return typeof navigator !== 'undefined' && !!(navigator as NavigatorWithAudioSession).audioSession
  }

  applyMusicMode(mode: MusicMode = this.musicMode) {
    this.musicMode = mode
    const s = (navigator as NavigatorWithAudioSession).audioSession
    if (s) {
      try {
        s.type = sessionTypeFor(mode)
      } catch {
        /* desteklenmeyen tür */
      }
    }
  }

  /** Dokunuş anında çağır. Ses motoru çalışıyorsa true. */
  async unlock(): Promise<boolean> {
    if (!this.available) return false
    this.applyMusicMode()
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      const limiter = this.ctx.createDynamicsCompressor()
      limiter.threshold.value = -3
      limiter.knee.value = 0
      limiter.ratio.value = 20
      limiter.attack.value = 0.002
      limiter.release.value = 0.1
      this.master.connect(limiter).connect(this.ctx.destination)
      this.bellBus = this.ctx.createGain()
      this.bellBus.gain.value = this.bellVolume
      this.bellBus.connect(this.master)
      this.voiceBus = this.ctx.createGain()
      this.voiceBus.gain.value = this.voiceVolume
      this.voiceBus.connect(this.master)
    }
    // iOS: sessiz bir tampon çalmak motoru kilitten çıkarır (dokunuşun içinde, eşzamanlı)
    const b = this.ctx.createBuffer(1, 1, this.ctx.sampleRate)
    const s = this.ctx.createBufferSource()
    s.buffer = b
    s.connect(this.ctx.destination)
    s.start(0)
    const resuming = this.ctx.resume().catch(() => {})
    await resuming
    return this.ctx.state === 'running'
  }

  get running(): boolean {
    return this.ctx?.state === 'running'
  }

  /**
   * Ses motoru gerçekten ilerliyor mu? (iOS 26 ana ekran uygulamalarında motor "running" görünüp
   * zamanı ilerletmeyebiliyor.) Saat ~0,3 sn'de ilerlemezse false.
   */
  async selfTest(waitMs = 300): Promise<boolean> {
    if (!this.ctx || this.ctx.state !== 'running') return false
    const t0 = this.ctx.currentTime
    await new Promise((r) => setTimeout(r, waitMs))
    return this.ctx.currentTime - t0 > (waitMs / 1000) * 0.5
  }

  setBellVolume(v: number) {
    this.bellVolume = v
    if (this.bellBus) this.bellBus.gain.value = v
  }

  setVoiceVolume(v: number) {
    this.voiceVolume = v
    if (this.voiceBus) this.voiceBus.gain.value = v
  }

  /** Koç sesi kanalı (M3: ses klipleri buraya bağlanır). */
  get voiceOutput(): AudioNode | null {
    return this.voiceBus
  }

  get context(): AudioContext | null {
    return this.ctx
  }

  /** Sesi ses saatine planlar. Her ses kendi kanalına bağlanır ki iptal edilebilsin. */
  play(sound: BellSound, delaySec = 0, set: BellSetId = this.bellSet) {
    if (!this.ctx || !this.bellBus || this.ctx.state !== 'running') return
    const at = this.ctx.currentTime + 0.02 + delaySec
    const voice = this.ctx.createGain()
    voice.connect(this.bellBus)
    bellSets[set].sounds[sound](this.ctx, voice, at)
    this.voices.push({ gain: voice, at })
    const now = this.ctx.currentTime
    this.voices = this.voices.filter((v) => v.at > now - 10)
  }

  /** Koç sesi kliplerini sırayla ses saatine planlar (offset: çağrı başından itibaren sn). */
  playVoice(parts: { buffer: AudioBuffer; offset: number }[], delaySec = 0, rate = 1) {
    if (!this.ctx || !this.voiceBus || this.ctx.state !== 'running' || !parts.length) return
    const at = this.ctx.currentTime + 0.02 + delaySec
    const voice = this.ctx.createGain()
    voice.connect(this.voiceBus)
    for (const p of parts) {
      const src = this.ctx.createBufferSource()
      src.buffer = p.buffer
      src.playbackRate.value = rate
      src.connect(voice)
      src.start(at + p.offset)
    }
    this.voices.push({ gain: voice, at })
  }

  /** Henüz çalmaya başlamamış planlı sesleri iptal eder (duraklat/atla). Çalmakta olanlar söner. */
  cancelScheduled() {
    if (!this.ctx) return
    const now = this.ctx.currentTime
    for (const v of this.voices) if (v.at > now) v.gain.disconnect()
    this.voices = this.voices.filter((v) => v.at <= now)
  }
}

export const audio = new AudioService()
