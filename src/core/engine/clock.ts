/** Monoton saat (saniye). Duvar saati değişikliklerinden etkilenmez. */
export interface Clock {
  now(): number
}

export const systemClock: Clock = {
  now: () => performance.now() / 1000,
}

/** Testler için elle ilerletilen saat. */
export class FakeClock implements Clock {
  constructor(private t = 0) {}
  now() {
    return this.t
  }
  advance(sec: number) {
    this.t += sec
  }
}
