// Sesleri ekran karelerinden bağımsız, ses saatine önceden planlar (spec §4.2: "ses katmanı çizelgedeki
// sesleri önceden planlar"). Kare atlansa bile zil ve kombo çağrısı zamanında çalar.

import type { BellSound, CueEvent, Timeline } from './timeline'

/** Planlama penceresi: bu kadar ilerideki sesler şimdiden ses saatine kurulur. */
export const LOOKAHEAD_SEC = 1.2
/** Bu kadar geç kalmış ses çalınmaz (ör. uygulama arka plandan dönünce zil yağmuru olmasın). */
export const STALE_SEC = 0.75

type SoundCue = CueEvent & ({ type: 'bell' } | { type: 'call' })

export type Planned = ({ kind: 'bell'; sound: BellSound } | { kind: 'call'; phrases: string[]; comboId: string; rate?: number; wordGap?: number }) & {
  /** Şu andan kaç saniye sonra çalınacak (≥ 0). */
  delay: number
  t: number
}

export class SoundScheduler {
  private cues: SoundCue[]
  private next = 0

  constructor(timeline: Timeline, private lookahead = LOOKAHEAD_SEC) {
    this.cues = timeline.cues.filter((c): c is SoundCue => c.type === 'bell' || c.type === 'call')
  }

  /** Çalışırken her adımda çağrılır; pencereye giren ve henüz planlanmamış sesleri döndürür. */
  take(elapsed: number): Planned[] {
    const out: Planned[] = []
    while (this.next < this.cues.length && this.cues[this.next].t <= elapsed + this.lookahead) {
      const cue = this.cues[this.next++]
      if (cue.t < elapsed - STALE_SEC) continue
      const delay = Math.max(0, cue.t - elapsed)
      out.push(
        cue.type === 'bell'
          ? { kind: 'bell', sound: cue.sound, delay, t: cue.t }
          : { kind: 'call', phrases: cue.phrases, comboId: cue.comboId, rate: cue.rate, wordGap: cue.wordGap, delay, t: cue.t },
      )
    }
    return out
  }

  /** Duraklat/devam/atla sonrası: planlanmış sesler iptal edilmiş varsayılır, `elapsed`ten itibaren yeniden planla. */
  reset(elapsed: number) {
    this.next = this.cues.findIndex((c) => c.t >= elapsed - 1e-9)
    if (this.next < 0) this.next = this.cues.length
  }
}
