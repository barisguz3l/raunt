import { describe, expect, it } from 'vitest'
import { getContentStore } from '../content/contentStore'
import { resolveCombo } from '../../features/combos/comboModel'
import { chainPool } from '../../features/activeWorkout/plan'
import { buildCoachTimeline } from './coachTimeline'
import { addCoachVoice, isSayCue } from './coachVoice'
import { seededRandom } from './comboScheduler'
import type { CueEvent } from './timeline'

const store = getContentStore()
const phraseMs = () => 600
const cfg = { prepSec: 10, rounds: 3, roundSec: 120, warnSec: 10, restSec: 30 }
const v = { stance: 'orthodox' as const, callMode: 'numbers' as const, nameStyle: 'leftRight' as const }
const pool = store.content.combos.filter((c) => c.level === 1 && !c.requiresCoachApproval).map((c) => resolveCombo(store, c, v))
const coach = () => buildCoachTimeline(cfg, { pool, selection: 'random', tempo: 'slow', coachApproved: false, phraseMs, seed: 7 })
const says = (cues: CueEvent[]) => cues.filter(isSayCue).map((c) => (c.type === 'call' ? c.comboId : ''))

describe('Koç araya girer', () => {
  it('hazırlıkta "hazır ol", dinlenmede "dinlen", son raunttan önce "son raunt", uyarıda "son on saniye"', () => {
    const tl = addCoachVoice(coach(), { phraseMs, rand: seededRandom(1) })
    const ids = says(tl.cues)
    expect(ids.filter((x) => x === 'say:getReady')).toHaveLength(1)
    expect(ids.filter((x) => x === 'say:rest')).toHaveLength(2)
    expect(ids.filter((x) => x === 'say:lastRound')).toHaveLength(1)
    expect(ids.filter((x) => x === 'say:tenSeconds')).toHaveLength(3)
  })

  it('"hazır ol" geri sayım bip\'lerinden önce biter', () => {
    const tl = addCoachVoice(coach(), { phraseMs, rand: seededRandom(1) })
    const ready = tl.cues.find((c) => c.type === 'call' && c.comboId === 'say:getReady')!
    expect(ready.t + 0.6).toBeLessThanOrEqual(10 - 3)
  })

  it('hiçbir konuşma bir kombo çağrısıyla üst üste binmez', () => {
    const tl = addCoachVoice(coach(), { phraseMs, rand: seededRandom(3) })
    const calls = tl.cues.filter((c): c is CueEvent & { type: 'call' } => c.type === 'call')
    const sayC = calls.filter(isSayCue)
    const combos = calls.filter((c) => !isSayCue(c))
    for (const a of sayC)
      for (const b of combos) {
        const overlap = a.t < b.t + b.speakSec && b.t < a.t + a.speakSec
        expect(overlap).toBe(false)
      }
  })

  it('hocanın odağı daha sık söylenir', () => {
    let focus = 0
    let other = 0
    for (let seed = 1; seed <= 30; seed++) {
      const tl = addCoachVoice(coach(), { phraseMs, rand: seededRandom(seed), focus: 'chinDown', tipEverySec: 20 })
      for (const id of says(tl.cues)) {
        if (id === 'say:chinDown') focus++
        else if (id === 'say:guardUp') other++
      }
    }
    expect(focus).toBeGreaterThan(other * 1.5)
  })
})

describe('Zincir: parça parça öğren', () => {
  it('1-2-3 → önce 1 (×4), sonra 1-2 (×4), sonra tam kombo', () => {
    const base = resolveCombo(store, store.content.combos.find((c) => c.code === '1-2-3')!, v)
    const p = chainPool(base)
    expect(p.slice(0, 4).every((c) => c.moves.length === 1)).toBe(true)
    expect(p.slice(4, 8).every((c) => c.moves.length === 2)).toBe(true)
    expect(p[8].moves.length).toBe(3)
    expect(p[0].combo.id).toBe(`chain:${base.combo.id}:1`)
  })
})
