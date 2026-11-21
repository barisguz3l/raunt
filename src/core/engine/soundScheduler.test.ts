import { FakeClock } from './clock'
import { SoundScheduler } from './soundScheduler'
import { buildTimeline } from './timeline'
import { WorkoutEngine } from './workoutEngine'

const spec = { prepSec: 10, rounds: 3, roundSec: 120, warnSec: 10, restSec: 30 }

/** Motoru ve planlayıcıyı runner gibi sürer; sesin gerçek çalma zamanlarını döndürür. */
function simulate(stepSec: number, actions: (t: number, e: WorkoutEngine, s: SoundScheduler) => void = () => {}) {
  const clock = new FakeClock(0)
  const tl = buildTimeline(spec)
  const engine = new WorkoutEngine(tl, clock)
  const sched = new SoundScheduler(tl)
  const played: { sound: string; at: number }[] = []
  engine.start()
  for (let t = 0; t <= 500; t = +(t + stepSec).toFixed(6)) {
    actions(t, engine, sched)
    engine.tick()
    if (engine.state === 'running') {
      for (const p of sched.take(engine.elapsed())) played.push({ sound: p.kind === "bell" ? p.sound : "call", at: +(clock.now() + p.delay).toFixed(3) })
    }
    clock.advance(stepSec)
  }
  return played
}

describe('SoundScheduler', () => {
  it('kareler 1 saniyede bir gelse bile (ağır takılma) tüm ziller tam zamanında planlanır', () => {
    const played = simulate(1)
    expect(played).toHaveLength(18)
    const expected = buildTimeline(spec).cues.filter((c) => c.type === 'bell').map((c) => c.t)
    expect(played.map((p) => p.at)).toEqual(expected)
  })

  it('60 fps ile aynı sonuç', () => {
    expect(simulate(1 / 60).map((p) => p.at)).toEqual(simulate(1).map((p) => p.at))
  })

  it('geç kalan zil atılır, zamanındakiler çalınır', () => {
    const clock = new FakeClock(0)
    const tl = buildTimeline(spec)
    const s = new SoundScheduler(tl)
    clock.advance(10.2) // 7-9. sn bip'leri çok geç, raunt zili 0.2 sn geç
    expect(s.take(10.2).map((p) => (p.kind === "bell" ? p.sound : "call"))).toEqual(['roundStart'])
  })

  it('duraklatma: devamda kalan sesler yeniden ve kaymış zamanla planlanır', () => {
    // t=125'te duraklat (uyarı zili 120'de çaldı, raunt sonu 130 bekliyor), 30 sn bekle, devam
    const played = simulate(0.5, (t, e, s) => {
      if (t === 125) e.pause()
      if (t === 155) {
        e.resume()
        s.reset(e.elapsed())
      }
    })
    const roundEnd = played.find((p) => p.sound === 'roundEnd')!
    expect(roundEnd.at).toBe(160) // 130 + 30 sn duraklatma
  })

  it('atlama: hedef andaki zil çalar, aradakiler çalmaz', () => {
    const played = simulate(0.5, (t, e, s) => {
      if (t === 20) {
        e.skip()
        s.reset(e.elapsed())
      }
    })
    const first = played.filter((p) => p.at >= 20).slice(0, 2).map((p) => p.sound)
    expect(first).toEqual(['roundEnd', 'tick']) // uyarı (120) atlandı
  })
})
