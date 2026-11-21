import { describe, expect, it } from 'vitest'
import { getContentStore } from '../../core/content/contentStore'
import { hasClip } from '../../core/audio/voiceService'
import { defaultSettings } from '../../core/settings/settings'
import { buildPlanTimeline, timelinePhrases, type WorkoutPlan } from './plan'

const store = getContentStore()
const ids = store.content.combos.filter((c) => c.level === 1 && !c.requiresCoachApproval).map((c) => c.id)
const cfg = { prepSec: 10, rounds: 6, roundSec: 180, warnSec: 10, restSec: 30 }
const plan = (extra: Partial<WorkoutPlan['coach']> = {}, kind: WorkoutPlan['kind'] = 'combo'): WorkoutPlan => ({
  kind,
  config: cfg,
  coach: { comboIds: ids, selection: 'random', tempo: 'medium', callMode: 'numbers', seed: 42, ...extra },
})
const s = { ...defaultSettings, coachChatter: false }
const countOf = (tl: ReturnType<typeof buildPlanTimeline>, id: string) => tl.cues.filter((c) => c.type === 'call' && c.comboId === id).length

describe('Plan: unutma eğrisi ve hocanın kombinasyonu', () => {
  it('hocanın kombinasyonu ve uzun süredir çağrılmayanlar daha sık gelir', () => {
    const today = '2026-11-21'
    // Hepsi bugün çağrılmış (ağırlık 1); hedef kombo 30 gün önce (ağırlık 4) ve hocanın kombinasyonu (×2 → 8)
    const target = ids[0]
    const stats = Object.fromEntries(ids.map((id) => [id, { count: 3, lastDate: today }]))
    const base = buildPlanTimeline(plan(), store, s, { stats, lesson: null, today })
    stats[target] = { count: 3, lastDate: '2026-10-22' }
    const boosted = buildPlanTimeline(plan(), store, s, { stats, lesson: { comboId: target, date: '2026-11-20' }, today })
    expect(countOf(boosted, target)).toBeGreaterThan(countOf(base, target) * 2)
  })

  it('sıralı seçimde ağırlık sırayı değiştirmez', () => {
    const today = '2026-11-21'
    const a = buildPlanTimeline(plan({ selection: 'sequential' }), store, s, { stats: {}, lesson: null, today })
    const b = buildPlanTimeline(plan({ selection: 'sequential' }), store, s, { stats: {}, lesson: { comboId: ids[1], date: today }, today })
    expect(a.cues).toEqual(b.cues)
  })
})

describe('Plan: rakip saldırısı', () => {
  const mem = { stats: {}, lesson: null, today: '2026-11-21' }
  it('lapa + rakip: savunma çağrıları eklenir ve her ifadenin klibi var', () => {
    for (const callMode of ['numbers', 'names'] as const) {
      const tl = buildPlanTimeline(plan({ pad: true, opponent: true, callMode }, 'pad'), store, { ...s, coachChatter: true }, mem)
      const def = tl.cues.filter((c) => c.type === 'call' && c.comboId.startsWith('move:'))
      expect(def.length).toBeGreaterThanOrEqual(cfg.rounds * 2)
      for (const c of def) expect(['move:slip', 'move:block', 'move:roll', 'move:parry']).toContain(c.type === 'call' && c.comboId)
      for (const p of timelinePhrases(tl)) expect(hasClip(p), p).toBe(true)
    }
  })

  it('kapalıyken savunma yok', () => {
    const tl = buildPlanTimeline(plan({ pad: true }, 'pad'), store, s, mem)
    expect(tl.cues.some((c) => c.type === 'call' && c.comboId.startsWith('move:'))).toBe(false)
  })
})
