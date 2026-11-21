import { describe, expect, it } from 'vitest'
import { getContentStore } from '../content/contentStore'
import { resolveCombo } from '../../features/combos/comboModel'
import { buildCoachTimeline } from './coachTimeline'
import { seededRandom, type Tempo } from './comboScheduler'
import { insertOpponentCalls, type DefenseMove } from './opponentCalls'
import type { CueEvent } from './timeline'

const store = getContentStore()
const phraseMs = () => 600
const cfg = { prepSec: 10, rounds: 3, roundSec: 120, warnSec: 10, restSec: 30 }
const v = { stance: 'orthodox' as const, callMode: 'numbers' as const, nameStyle: 'leftRight' as const }
const pool = store.content.combos.filter((c) => c.level === 1 && !c.requiresCoachApproval).map((c) => resolveCombo(store, c, v))
const moves: DefenseMove[] = ['slip', 'block', 'roll', 'parry'].map((id) => ({ id, phrase: id, durationMs: store.move(id)!.durationMsEstimate }))
const coach = (tempo: Tempo) => buildCoachTimeline(cfg, { pool, selection: 'random', tempo, coachApproved: false, phraseMs, seed: 3 })
type Call = CueEvent & { type: 'call' }
const calls = (cues: CueEvent[]) => cues.filter((c): c is Call => c.type === 'call')
const defense = (cues: CueEvent[]) => calls(cues).filter((c) => c.comboId.startsWith('move:'))

describe('Rakip saldırısı', () => {
  for (const tempo of ['slow', 'medium', 'fast', 'master'] as const) {
    it(`${tempo}: her rauntta savunma var, çağrılar çakışmaz, raunt sonunu aşmaz`, () => {
      const base = coach(tempo)
      const tl = insertOpponentCalls(base, { moves, phraseMs, rand: seededRandom(11) })
      const all = calls(tl.cues)
      for (let i = 1; i < all.length; i++) {
        const prev = all[i - 1]
        expect(all[i].t).toBeGreaterThanOrEqual(prev.t + prev.speakSec + prev.windowSec - 1e-9)
      }
      for (let r = 1; r <= cfg.rounds; r++) {
        const d = defense(tl.cues).filter((c) => c.round === r)
        expect(d.length).toBeGreaterThanOrEqual(2)
        const seg = tl.segments.filter((s) => s.round === r && (s.phase === 'round' || s.phase === 'warn'))
        const end = seg[seg.length - 1].end
        for (const c of d) expect(c.t + c.speakSec + c.windowSec).toBeLessThanOrEqual(end)
      }
    })
  }

  it('savunmalar arası 12 sn\'den az değil; yalnızca seçilen hareketler, "move:" kimliğiyle', () => {
    const tl = insertOpponentCalls(coach('slow'), { moves, phraseMs, rand: seededRandom(5) })
    const d = defense(tl.cues)
    for (let i = 1; i < d.length; i++) if (d[i].round === d[i - 1].round) expect(d[i].t - d[i - 1].t).toBeGreaterThanOrEqual(12)
    for (const c of d) expect(['move:slip', 'move:block', 'move:roll', 'move:parry']).toContain(c.comboId)
  })

  it('aynı tohum → aynı çizelge; hareket yoksa değişmez', () => {
    const a = insertOpponentCalls(coach('medium'), { moves, phraseMs, rand: seededRandom(9) })
    const b = insertOpponentCalls(coach('medium'), { moves, phraseMs, rand: seededRandom(9) })
    expect(a.cues).toEqual(b.cues)
    const base = coach('medium')
    expect(insertOpponentCalls(base, { moves: [], phraseMs, rand: seededRandom(1) })).toBe(base)
  })

  it('yavaş tempoda kombo çağrısı silinmez (boşluklara sığar)', () => {
    const base = coach('slow')
    const tl = insertOpponentCalls(base, { moves, phraseMs, rand: seededRandom(2) })
    const comboCount = (cues: CueEvent[]) => calls(cues).filter((c) => !c.comboId.startsWith('move:')).length
    expect(comboCount(tl.cues)).toBe(comboCount(base.cues))
  })
})
