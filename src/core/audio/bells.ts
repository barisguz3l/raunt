// Zil sesleri kodla üretilir (spec §4.5: rakip ses dosyası yok, lisans temiz).
// Zil = inharmonik sinüs bileşenleri + üstel sönüm; tak-tak = filtrelenmiş kısa gürültü; bip = kısa sinüs.

import type { BellSound } from '../engine/timeline'

type Synth = (ctx: BaseAudioContext, out: AudioNode, t: number) => void

/** Klasik ring zili oranları (inharmonik). */
const BELL_PARTIALS = [
  { ratio: 1, gain: 1, decay: 1 },
  { ratio: 2.76, gain: 0.55, decay: 0.7 },
  { ratio: 5.4, gain: 0.3, decay: 0.45 },
  { ratio: 8.93, gain: 0.15, decay: 0.3 },
]

export function strike(ctx: BaseAudioContext, out: AudioNode, t: number, f0: number, decaySec: number, level = 0.36) {
  for (const p of BELL_PARTIALS) {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = f0 * p.ratio
    const d = decaySec * p.decay
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(level * p.gain, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t + d)
    osc.connect(g).connect(out)
    osc.start(t)
    osc.stop(t + d + 0.05)
  }
}

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>()
function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let b = noiseCache.get(ctx)
  if (!b) {
    b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.1), ctx.sampleRate)
    const d = b.getChannelData(0)
    let seed = 1
    for (let i = 0; i < d.length; i++) {
      seed = (seed * 16807) % 2147483647 // deterministik gürültü
      d[i] = (seed / 2147483647) * 2 - 1
    }
    noiseCache.set(ctx, b)
  }
  return b
}

export function clack(ctx: BaseAudioContext, out: AudioNode, t: number, freq = 1700, level = 4) {
  const src = ctx.createBufferSource()
  src.buffer = noiseBuffer(ctx)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = freq
  bp.Q.value = 6
  const g = ctx.createGain()
  g.gain.setValueAtTime(level, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06)
  src.connect(bp).connect(g).connect(out)
  src.start(t)
  src.stop(t + 0.08)
}

export function beep(ctx: BaseAudioContext, out: AudioNode, t: number, freq = 1000, dur = 0.12, level = 0.5) {
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(level, t + 0.005)
  g.gain.setValueAtTime(level, t + dur - 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(g).connect(out)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

/** Gong: düşük temel frekans, yoğun alt bileşenler, uzun sönüm. */
export function gong(ctx: BaseAudioContext, out: AudioNode, t: number, f0 = 150, decaySec = 4, level = 0.32) {
  const partials = [
    { r: 1, g: 1, d: 1 },
    { r: 1.48, g: 0.6, d: 0.8 },
    { r: 2.0, g: 0.5, d: 0.6 },
    { r: 2.76, g: 0.35, d: 0.5 },
    { r: 3.9, g: 0.2, d: 0.35 },
  ]
  for (const p of partials) {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(f0 * p.r * 1.01, t)
    osc.frequency.exponentialRampToValueAtTime(f0 * p.r, t + 0.4) // hafif perde düşüşü
    const d = decaySec * p.d
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(level * p.g, t + 0.03)
    g.gain.exponentialRampToValueAtTime(0.0001, t + d)
    osc.connect(g).connect(out)
    osc.start(t)
    osc.stop(t + d + 0.05)
  }
}

/** Hakem düdüğü: yüksek sinüs + hızlı titreşim (vibrato) + biraz nefes gürültüsü. */
export function whistle(ctx: BaseAudioContext, out: AudioNode, t: number, dur = 0.35, freq = 2900, level = 0.45) {
  const osc = ctx.createOscillator()
  const lfo = ctx.createOscillator()
  const lfoGain = ctx.createGain()
  const g = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  lfo.frequency.value = 32
  lfoGain.gain.value = 160
  lfo.connect(lfoGain).connect(osc.frequency)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(level, t + 0.015)
  g.gain.setValueAtTime(level, t + dur - 0.04)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(g).connect(out)
  osc.start(t)
  lfo.start(t)
  osc.stop(t + dur + 0.02)
  lfo.stop(t + dur + 0.02)
  // nefes
  const n = ctx.createBufferSource()
  n.buffer = noiseBuffer(ctx)
  n.loop = true
  const hp = ctx.createBiquadFilter()
  hp.type = 'bandpass'
  hp.frequency.value = freq
  hp.Q.value = 2
  const ng = ctx.createGain()
  ng.gain.setValueAtTime(0.0001, t)
  ng.gain.exponentialRampToValueAtTime(level * 0.25, t + 0.015)
  ng.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  n.connect(hp).connect(ng).connect(out)
  n.start(t)
  n.stop(t + dur + 0.02)
}

export type BellSetId = 'classic' | 'gong' | 'wood' | 'digital' | 'whistle' | 'silent'

const nothing: Synth = () => {}

export const bellSets: Record<BellSetId, { nameTr: string; sounds: Record<BellSound, Synth> }> = {
  classic: {
    nameTr: 'Klasik Zil',
    sounds: {
      // Raunt başı: çift vuruş
      roundStart: (c, o, t) => {
        strike(c, o, t, 640, 1.6)
        strike(c, o, t + 0.32, 640, 1.8)
      },
      // Raunt sonu: uzun tek vuruş + yankı
      roundEnd: (c, o, t) => {
        strike(c, o, t, 600, 3.2, 0.4)
        strike(c, o, t + 0.9, 600, 2.4, 0.22)
      },
      // Uyarı: tak-tak-tak
      warn: (c, o, t) => {
        clack(c, o, t)
        clack(c, o, t + 0.17)
        clack(c, o, t + 0.34)
      },
      tick: (c, o, t) => beep(c, o, t, 1000, 0.12),
      // Bitiş: üç vuruş
      finish: (c, o, t) => {
        strike(c, o, t, 640, 1.4, 0.3)
        strike(c, o, t + 0.3, 720, 1.4, 0.3)
        strike(c, o, t + 0.6, 860, 2.6, 0.32)
      },
    },
  },
  gong: {
    nameTr: 'Gong',
    sounds: {
      roundStart: (c, o, t) => gong(c, o, t, 160, 3),
      roundEnd: (c, o, t) => {
        gong(c, o, t, 140, 4.5)
        gong(c, o, t + 1.1, 140, 3.5, 0.22)
      },
      warn: (c, o, t) => {
        clack(c, o, t, 1200, 7)
        clack(c, o, t + 0.17, 1200, 7)
        clack(c, o, t + 0.34, 1200, 7)
      },
      tick: (c, o, t) => beep(c, o, t, 660, 0.14),
      finish: (c, o, t) => {
        gong(c, o, t, 180, 2.5, 0.24)
        gong(c, o, t + 0.45, 160, 2.5, 0.24)
        gong(c, o, t + 0.9, 140, 4.5, 0.28)
      },
    },
  },
  wood: {
    nameTr: 'Ahşap Tak-Tak',
    sounds: {
      roundStart: (c, o, t) => {
        for (const d of [0, 0.14, 0.42, 0.56]) clack(c, o, t + d, 1500, 6)
      },
      roundEnd: (c, o, t) => {
        for (let i = 0; i < 6; i++) clack(c, o, t + i * 0.11, 1300 - i * 60, 7)
      },
      warn: (c, o, t) => {
        clack(c, o, t, 2000)
        clack(c, o, t + 0.17, 2000)
        clack(c, o, t + 0.34, 2000)
      },
      tick: (c, o, t) => clack(c, o, t, 2600, 3),
      finish: (c, o, t) => {
        for (let i = 0; i < 10; i++) clack(c, o, t + i * 0.09, 1200 + i * 90)
      },
    },
  },
  digital: {
    nameTr: 'Dijital Bip',
    sounds: {
      roundStart: (c, o, t) => {
        beep(c, o, t, 1200, 0.25)
        beep(c, o, t + 0.35, 1200, 0.45)
      },
      roundEnd: (c, o, t) => beep(c, o, t, 760, 0.9),
      warn: (c, o, t) => {
        for (const d of [0, 0.15, 0.3]) beep(c, o, t + d, 1600, 0.08)
      },
      tick: (c, o, t) => beep(c, o, t, 1000, 0.12),
      finish: (c, o, t) => {
        ;[880, 1100, 1320, 1760].forEach((f, i) => beep(c, o, t + i * 0.16, f, i === 3 ? 0.5 : 0.13))
      },
    },
  },
  whistle: {
    nameTr: 'Düdük',
    sounds: {
      roundStart: (c, o, t) => {
        whistle(c, o, t, 0.22)
        whistle(c, o, t + 0.32, 0.22)
      },
      roundEnd: (c, o, t) => whistle(c, o, t, 1.1, 2700),
      warn: (c, o, t) => {
        for (const d of [0, 0.2, 0.4]) whistle(c, o, t + d, 0.1, 3100)
      },
      tick: (c, o, t) => beep(c, o, t, 1000, 0.12),
      finish: (c, o, t) => {
        whistle(c, o, t, 0.8, 2700)
        whistle(c, o, t + 0.95, 0.18)
        whistle(c, o, t + 1.2, 0.18)
      },
    },
  },
  silent: {
    nameTr: 'Sessiz (sadece ekran)',
    sounds: { roundStart: nothing, roundEnd: nothing, warn: nothing, tick: nothing, finish: nothing },
  },
}

export const bellSetIds = Object.keys(bellSets) as BellSetId[]
