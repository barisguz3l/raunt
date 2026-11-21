import { FakeClock } from './clock'
import { buildTimeline } from './timeline'
import { WorkoutEngine } from './workoutEngine'

const spec = { prepSec: 10, rounds: 3, roundSec: 120, warnSec: 10, restSec: 30 }

function setup() {
  const clock = new FakeClock(1000)
  const engine = new WorkoutEngine(buildTimeline(spec), clock)
  return { clock, engine }
}

const sounds = (fired: ReturnType<WorkoutEngine['tick']>['fired']) =>
  fired.flatMap((f) => (f.cue.type === 'bell' ? [f.cue.sound] : []))

describe('WorkoutEngine', () => {
  it('başlamadan önce süre ilerlemez', () => {
    const { clock, engine } = setup()
    clock.advance(50)
    expect(engine.tick().snapshot).toMatchObject({ status: 'idle', elapsed: 0, phase: 'prep' })
  })

  it('fazlar arası geçiş ve sayaç', () => {
    const { clock, engine } = setup()
    engine.start()
    expect(engine.tick().snapshot).toMatchObject({ phase: 'prep', remaining: 10, roundsLeft: 3 })
    clock.advance(15)
    // Raunt sayacı uyarı dahil rauntun tamamını gösterir
    expect(engine.tick().snapshot).toMatchObject({ phase: 'round', round: 1, remaining: 115, phaseDuration: 120, roundsLeft: 2 })
    clock.advance(110) // t=125 → uyarı
    expect(engine.tick().snapshot).toMatchObject({ phase: 'warn', round: 1, remaining: 5 })
    clock.advance(10) // t=135 → dinlenme, sıradaki raunt 2
    expect(engine.tick().snapshot).toMatchObject({ phase: 'rest', round: 2, remaining: 25, roundsLeft: 2 })
  })

  it('M1 kabul (2): duraklatınca sayaç durur, devamda kalan süre korunur', () => {
    const { clock, engine } = setup()
    engine.start()
    clock.advance(40) // rauntta 30 sn geçti
    engine.pause()
    const before = engine.tick().snapshot.remaining
    clock.advance(300)
    expect(engine.tick().snapshot.remaining).toBe(before)
    expect(engine.tick().snapshot.status).toBe('paused')
    engine.resume()
    clock.advance(1)
    expect(engine.tick().snapshot.remaining).toBe(before - 1)
    expect(engine.pausedTotal).toBe(300)
    // Duraklatma toplam bitişi öteler
    clock.advance(430 - 41)
    expect(engine.tick().snapshot.status).toBe('done')
  })

  it('M1 kabul (3): faz geçişlerinde doğru ziller, sırasıyla', () => {
    const { clock, engine } = setup()
    engine.start()
    const heard: string[] = []
    for (let i = 0; i < 4400; i++) {
      clock.advance(0.1)
      heard.push(...sounds(engine.tick().fired))
    }
    expect(heard).toEqual([
      'tick', 'tick', 'tick', 'roundStart', 'warn', 'roundEnd',
      'tick', 'tick', 'tick', 'roundStart', 'warn', 'roundEnd',
      'tick', 'tick', 'tick', 'roundStart', 'warn', 'finish',
    ])
    expect(engine.state).toBe('done')
  })

  it('atla: raunt → dinlenme (raunt sonu zili çalar), dinlenme → sonraki raunt', () => {
    const { clock, engine } = setup()
    engine.start()
    clock.advance(20)
    engine.tick()
    engine.skip()
    let r = engine.tick()
    expect(r.snapshot).toMatchObject({ phase: 'rest', round: 2, remaining: 30 })
    expect(sounds(r.fired)).toEqual(['roundEnd'])
    engine.skip()
    r = engine.tick()
    expect(r.snapshot).toMatchObject({ phase: 'round', round: 2, remaining: 120 })
    expect(sounds(r.fired)).toEqual(['roundStart'])
  })

  it('son rauntta atlamak antrenmanı bitirir', () => {
    const { engine } = setup()
    engine.start()
    for (let i = 0; i < 6; i++) engine.skip() // prep, r1, rest1, r2, rest2, r3
    const r = engine.tick()
    expect(r.snapshot.status).toBe('done')
    expect(sounds(r.fired)).toEqual(['finish'])
  })

  it('duraklatılmışken atlama çalışır ve duraklatılmış kalır', () => {
    const { engine } = setup()
    engine.start()
    engine.pause()
    engine.skip()
    expect(engine.tick().snapshot).toMatchObject({ status: 'paused', phase: 'round', remaining: 120 })
  })

  it('gerçekleşen raunt ve çalışma süresi (erken bitişte dürüst özet)', () => {
    const { clock, engine } = setup()
    engine.start()
    clock.advance(10 + 120 + 30 + 45) // raunt 1 tamam, raunt 2'de 45 sn
    engine.finish()
    expect(engine.actual()).toEqual({ roundsCompleted: 1, workSec: 165, totalSec: 205 })
    const full = setup()
    full.engine.start()
    full.clock.advance(1000)
    full.engine.tick()
    expect(full.engine.actual()).toEqual({ roundsCompleted: 3, workSec: 360, totalSec: 430 })
  })

  it('erken bitir', () => {
    const { clock, engine } = setup()
    engine.start()
    clock.advance(50)
    engine.finish()
    clock.advance(10)
    const r = engine.tick()
    expect(r.snapshot.status).toBe('done')
    expect(r.fired).toEqual([])
    expect(engine.elapsed()).toBe(50)
  })

  it('arka plandan geç dönüş: süre doğru, olaylar gecikmesiyle bildirilir', () => {
    const { clock, engine } = setup()
    engine.start()
    engine.tick()
    clock.advance(140) // 2 dk kare yok (ör. sekme arka planda)
    const r = engine.tick()
    expect(r.snapshot).toMatchObject({ phase: 'rest', round: 2 })
    expect(r.fired.some((f) => f.cue.type === 'phase')).toBe(true)
    expect(Math.min(...r.fired.map((f) => f.lateBy))).toBeGreaterThan(5)
  })
})
