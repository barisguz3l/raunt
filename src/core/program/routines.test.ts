import { getContentStore } from '../content/contentStore'
import { buildTimeline } from '../engine/timeline'
import { blockConfig, ROUTINES, routineConfig, routineMinutes } from './routines'

const store = getContentStore()

describe('Rutinler', () => {
  it('tüm rutin hareketleri egzersiz kütüphanesinde var', () => {
    for (const r of Object.values(ROUTINES)) for (const i of r.items) expect(store.exercise(i.exerciseId), i.exerciseId).toBeTruthy()
  })

  it('esneme: kas başına ≤ 60 sn (araştırma) ve etiketler Türkçe ad', () => {
    expect(ROUTINES.stretch.items.every((i) => i.sec <= 60)).toBe(true)
    const c = routineConfig(store, ROUTINES.stretch)
    expect(c.labels?.[0]).toBe(store.exercise('kalcafleks')!.nameTr)
    const tl = buildTimeline(c)
    expect(tl.config.rounds).toBe(7)
  })

  it('kondisyon 2 set → 12 hareket; süre dakikası makul', () => {
    expect(routineConfig(store, ROUTINES.conditioning).rounds).toBe(12)
    expect(routineMinutes(ROUTINES.conditioning)).toBeGreaterThan(5)
  })

  it('program bloğu timerHint → zamanlayıcı', () => {
    const day = store.content.program.days.find((d) => d.blocks.some((b) => b.timerHint))!
    const b = day.blocks.find((x) => x.timerHint)!
    expect(blockConfig(b)).toMatchObject({ rounds: b.timerHint!.rounds, roundSec: b.timerHint!.roundSec, restSec: b.timerHint!.restSec })
    expect(blockConfig({ startMin: 0, endMin: 5, titleTr: 'x', items: [] })).toBeNull()
  })
})
