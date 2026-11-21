import type { Combo, Content, Exercise, Move, ProgramDay } from './types'
import { loadBundledContent } from './seedLoader'

/** Statik içeriğe hızlı erişim. Kullanıcı verisinden bağımsızdır (IndexedDB'ye yazılmaz). */
export class ContentStore {
  readonly content: Content
  private moveById: Map<string, Move>
  private comboById: Map<string, Combo>
  private user: Combo[] = []
  private listeners = new Set<() => void>()
  private exerciseById: Map<string, Exercise>

  constructor(content: Content) {
    this.content = content
    this.moveById = new Map(content.moves.map((m) => [m.id, m]))
    this.comboById = new Map(content.combos.map((c) => [c.id, c]))
    this.exerciseById = new Map(content.exercises.map((e) => [e.id, e]))
  }

  move(id: string) {
    return this.moveById.get(id)
  }
  combo(id: string) {
    return this.comboById.get(id)
  }

  /** Sistem + kullanıcı kombinasyonları. */
  allCombos(): Combo[] {
    return this.user.length ? [...this.content.combos, ...this.user] : this.content.combos
  }

  userCombos(): Combo[] {
    return this.user
  }

  /** Kullanıcı kombolarını (IndexedDB'den) kaydet; arayüz abone olabilir. */
  setUserCombos(list: Combo[]) {
    for (const c of this.user) this.comboById.delete(c.id)
    this.user = list
    for (const c of list) this.comboById.set(c.id, c)
    this.listeners.forEach((l) => l())
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }
  exercise(id: string) {
    return this.exerciseById.get(id)
  }

  /** Bir kombonun hareketleri (bilinmeyenler atlanır). */
  comboMoves(combo: Combo): Move[] {
    return combo.steps.map((s) => this.moveById.get(s.move)).filter((m): m is Move => !!m)
  }

  programDay(week: number, dayOfWeek: number): ProgramDay | undefined {
    return this.content.program.days.find((d) => d.week === week && d.dayOfWeek === dayOfWeek)
  }
}

let shared: ContentStore | null = null

export function getContentStore(): ContentStore {
  if (!shared) shared = new ContentStore(loadBundledContent())
  return shared
}
