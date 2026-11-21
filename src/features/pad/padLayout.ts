// Lapa (pad) modu yerleşimi — spec Ek A.3 tablosu. Saf fonksiyon, birim testli.
// Koordinatlar sahne oranı (0..1), (x, y) = lapanın merkezi. Ekranın solu = kullanıcının solu.

import type { Move } from '../../core/content/types'
import type { Stance } from '../../core/speech/stanceMapper'

export type PadKind = 'left' | 'right' | 'both' | 'kick' | 'defense' | 'none'

export interface PadSpec {
  x: number
  y: number
  w: number
  h: number
  /** derece */
  rot: number
  kind: PadKind
  side: 'left' | 'right' | 'center'
  /** Rozet: 1-6 ya da kısa metin */
  label: string
  /** Aparkat: ok yukarı */
  arrowUp?: boolean
}

interface ZoneDef {
  x: number
  y: number
  w: number
  h: number
  rot: number
}

/** Sol el için tablo değerleri (sağ el: x → 1 − x). */
export const ZONES: Record<string, ZoneDef> = {
  'center-high': { x: 0.4, y: 0.28, w: 0.22, h: 0.14, rot: 0 },
  'side-high': { x: 0.26, y: 0.28, w: 0.14, h: 0.22, rot: -75 },
  'center-low-up': { x: 0.42, y: 0.46, w: 0.22, h: 0.12, rot: 180 },
  'center-body': { x: 0.42, y: 0.56, w: 0.24, h: 0.16, rot: 0 },
  'side-body': { x: 0.26, y: 0.58, w: 0.14, h: 0.22, rot: -75 },
  'low-side': { x: 0.24, y: 0.8, w: 0.16, h: 0.34, rot: 90 },
  'mid-side': { x: 0.24, y: 0.58, w: 0.16, h: 0.34, rot: 90 },
  'high-side': { x: 0.24, y: 0.26, w: 0.16, h: 0.34, rot: 90 },
}

/** Ön/arka → ekran tarafı (normal duruş: ön = sol). */
export function screenSide(limb: 'lead' | 'rear', stance: Stance): 'left' | 'right' {
  const leadLeft = stance === 'orthodox'
  return (limb === 'lead') === leadLeft ? 'left' : 'right'
}

const mirror = (z: ZoneDef, side: 'left' | 'right'): ZoneDef => (side === 'left' ? z : { ...z, x: 1 - z.x, rot: -z.rot })

export function padSpec(move: Move, stance: Stance): PadSpec {
  const pv = move.padVisual
  const label = move.category === 'punch' ? move.shortTr.split(' ')[0] : move.shortTr.toLocaleUpperCase('tr').replace(/^(ÖN|ARKA) /, '')

  if (pv.zone === 'none') return { x: 0.5, y: 0.5, w: 0, h: 0, rot: 0, kind: 'none', side: 'center', label }

  if (pv.zone === 'defense') {
    // Kırmızı eldiven kameraya uçar: bloklar solda, kaçışlar sağda başlar (görsel çeşitlilik)
    const side = move.id === 'block' || move.id === 'leg_check' || move.id === 'parry' ? 'left' : 'right'
    return { x: side === 'left' ? 0.3 : 0.7, y: 0.3, w: 0.2, h: 0.2, rot: 0, kind: 'defense', side, label }
  }

  const z = ZONES[pv.zone]
  if (!z) return { x: 0.5, y: 0.5, w: 0, h: 0, rot: 0, kind: 'none', side: 'center', label }

  // Teep ve diz: iki lapa merkezde birleşir ("büyük lapa")
  if (pv.orientation === 'front-both' || pv.orientation === 'clinch') {
    return { x: 0.5, y: z.y, w: 0.38, h: 0.18, rot: 0, kind: 'both', side: 'center', label }
  }

  const limb = pv.hand === 'lead' || pv.hand === 'rear' ? pv.hand : move.limb === 'rear' ? 'rear' : 'lead'
  const side = screenSide(limb, stance)
  const m = mirror(z, side)
  const kind: PadKind = pv.orientation === 'kickpad' ? 'kick' : side
  return { ...m, kind, side, label, arrowUp: pv.orientation === 'under' || undefined }
}

/** Çağrı içinde etkin adım: adımlar konuşma süresine eşit dağılır (ses ile eş zamanlı). */
export function activeStep(steps: number, cueT: number, speakSec: number, elapsed: number): number {
  if (steps <= 0 || elapsed < cueT) return -1
  const d = Math.max(0.15, speakSec / steps)
  return Math.min(steps - 1, Math.floor((elapsed - cueT) / d))
}

/** Adım içi ilerleme 0..1 (yaklaşma halkası için). */
export function stepProgress(steps: number, cueT: number, speakSec: number, elapsed: number): number {
  if (steps <= 0) return 0
  const d = Math.max(0.15, speakSec / steps)
  const i = activeStep(steps, cueT, speakSec, elapsed)
  if (i < 0) return 0
  return Math.min(1, (elapsed - cueT - i * d) / d)
}
