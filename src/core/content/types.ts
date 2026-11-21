// Statik içerik tipleri (seed/*.json). Kimlikler okunabilir string'dir.

export type MoveCategory = 'punch' | 'kick' | 'knee' | 'defense' | 'footwork'
export type Limb = 'lead' | 'rear' | 'none'
export type Target = 'head' | 'body' | 'leg' | 'none'
export type PadZone =
  | 'center-high'
  | 'side-high'
  | 'center-low-up'
  | 'center-body'
  | 'side-body'
  | 'low-side'
  | 'mid-side'
  | 'high-side'
  | 'defense'
  | 'none'

export interface PadVisual {
  zone: PadZone
  orientation: string
  hand: 'lead' | 'rear' | 'both' | 'none'
}

export interface Move {
  id: string
  category: MoveCategory
  nameTr: string
  pad: number | null
  limb: Limb
  target: Target
  level: number
  durationMsEstimate: number
  speak: { numbers: string; names: string; sideWord: boolean | null }
  steps: string[]
  mistakes: string[]
  animationKey: string
  /** Ekrandaki kısa Türkçe etiket (ör. "3", "Arka alçak"). */
  shortTr: string
  padVisual: PadVisual
  coachApproval: boolean
}

export type ComboFocus = 'teknik' | 'tekme' | 'diz' | 'savunma' | 'kombinasyon'

export interface Combo {
  id: string
  nameTr: string
  level: number
  code: string
  steps: { move: string }[]
  description?: string
  focus: ComboFocus
  requiresCoachApproval: boolean
  isSystem: boolean
}

export interface ReferenceVideo {
  title: string
  youtubeId: string
  turkish?: boolean
}

export interface Exercise {
  id: string
  nameTr: string
  group: string
  animationKey: string
  steps: string[]
  coachingCue?: string
  commonMistakes?: string
  referenceVideos?: ReferenceVideo[]
  videoNote?: string
}

export interface TimerHint {
  rounds: number
  roundSec: number
  restSec: number
}

export interface ProgramBlock {
  startMin: number
  endMin: number
  titleTr: string
  items: string[]
  exerciseRefs?: string[]
  timerHint?: TimerHint
}

export interface ProgramDay {
  week: number
  dayOfWeek: number // 1 = Pazartesi … 7 = Pazar
  type: string
  sessionId: string
  titleTr: string
  plannedMinutes: number | null
  rpeTarget: string | null
  blocks: ProgramBlock[]
  afterSessionPrompt?: { ask: string[]; feedsNextHomeDay: boolean }
  note?: string
}

export interface Program {
  id: string
  nameTr: string
  weeks: number
  defaultStartDate: string
  startsOnWeekday: number
  weekHeadings: Record<string, string>
  weeklyPattern: Record<string, string>
  testDays: { week: number; dayOfWeek: number; testSet: string }[]
  rules: string[]
  days: ProgramDay[]
}

export interface FitnessTest {
  id: string
  nameTr: string
  unit: string
  higherIsBetter: boolean | null
  variants?: string[]
  protocol: string
  safety?: string
}

export interface TimerPreset {
  id: string
  nameTr: string
  prepSec: number
  rounds: number
  roundSec: number
  warnSec: number
  restSec: number
}

export interface Pronunciations {
  numbers: Record<string, string>
  words: { display: string; speak: string; note?: string }[]
  systemPhrases: Record<string, string>
}

export interface Content {
  moves: Move[]
  combos: Combo[]
  exercises: Exercise[]
  program: Program
  tests: FitnessTest[]
  timerPresets: TimerPreset[]
  pronunciations: Pronunciations
}
