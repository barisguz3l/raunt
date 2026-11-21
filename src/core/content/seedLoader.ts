import type {
  Combo,
  Content,
  Exercise,
  FitnessTest,
  Move,
  Program,
  Pronunciations,
  TimerPreset,
} from './types'

import movesJson from '../../../seed/moves.json'
import combosJson from '../../../seed/combos.json'
import exercisesJson from '../../../seed/exercises.json'
import programJson from '../../../seed/program_beginner_3week.json'
import testsJson from '../../../seed/tests.json'
import presetsJson from '../../../seed/timer_presets.json'
import pronJson from '../../../seed/tts_pronunciations_tr.json'

export class SeedError extends Error {}

export interface RawSeed {
  moves: unknown
  combos: unknown
  exercises: unknown
  program: unknown
  tests: unknown
  timerPresets: unknown
  pronunciations: unknown
}

export const bundledSeed: RawSeed = {
  moves: movesJson,
  combos: combosJson,
  exercises: exercisesJson,
  program: programJson,
  tests: testsJson,
  timerPresets: presetsJson,
  pronunciations: pronJson,
}

function arrayField<T>(raw: unknown, key: string, file: string): T[] {
  if (!raw || typeof raw !== 'object') throw new SeedError(`${file}: nesne bekleniyordu`)
  const v = (raw as Record<string, unknown>)[key]
  if (!Array.isArray(v)) throw new SeedError(`${file}: "${key}" dizisi bulunamadı`)
  return v as T[]
}

function requireKeys(items: object[], keys: string[], file: string) {
  items.forEach((it, i) => {
    for (const k of keys) {
      if (!(k in it)) throw new SeedError(`${file}[${i}]: "${k}" alanı eksik`)
    }
  })
}

/** Ham JSON'u tipli içeriğe çevirir; yapı bozuksa SeedError fırlatır. */
export function parseSeed(raw: RawSeed): Content {
  const moves = arrayField<Move>(raw.moves, 'moves', 'moves.json')
  requireKeys(moves, ['id', 'category', 'nameTr', 'shortTr', 'limb', 'durationMsEstimate', 'speak', 'padVisual', 'coachApproval'], 'moves.json')

  const combos = arrayField<Combo>(raw.combos, 'combos', 'combos.json')
  requireKeys(combos, ['id', 'nameTr', 'level', 'code', 'steps', 'focus', 'requiresCoachApproval'], 'combos.json')

  const exercises = arrayField<Exercise>(raw.exercises, 'exercises', 'exercises.json')
  requireKeys(exercises, ['id', 'nameTr', 'group', 'animationKey', 'steps'], 'exercises.json')

  const program = raw.program as Program
  if (!program || !Array.isArray(program.days)) throw new SeedError('program: "days" dizisi bulunamadı')
  requireKeys(program.days, ['week', 'dayOfWeek', 'type', 'sessionId', 'titleTr', 'blocks'], 'program')

  const tests = arrayField<FitnessTest>(raw.tests, 'tests', 'tests.json')
  requireKeys(tests, ['id', 'nameTr', 'unit', 'protocol'], 'tests.json')

  const timerPresets = arrayField<TimerPreset>(raw.timerPresets, 'presets', 'timer_presets.json')
  requireKeys(timerPresets, ['id', 'nameTr', 'prepSec', 'rounds', 'roundSec', 'warnSec', 'restSec'], 'timer_presets.json')

  const pronunciations = raw.pronunciations as Pronunciations
  if (!pronunciations?.numbers || !pronunciations?.systemPhrases) {
    throw new SeedError('tts_pronunciations_tr.json: "numbers" veya "systemPhrases" eksik')
  }

  return { moves, combos, exercises, program, tests, timerPresets, pronunciations }
}

/** Referans bütünlüğü (spec §5.5). Boş dizi = sorun yok. */
export function validateReferences(c: Content): string[] {
  const errors: string[] = []
  const moveIds = new Set(c.moves.map((m) => m.id))
  const exerciseIds = new Set(c.exercises.map((e) => e.id))

  const dup = (ids: string[], what: string) => {
    const seen = new Set<string>()
    for (const id of ids) {
      if (seen.has(id)) errors.push(`${what}: yinelenen id "${id}"`)
      seen.add(id)
    }
  }
  dup(c.moves.map((m) => m.id), 'moves')
  dup(c.combos.map((x) => x.id), 'combos')
  dup(c.exercises.map((x) => x.id), 'exercises')
  dup(c.tests.map((x) => x.id), 'tests')
  dup(c.timerPresets.map((x) => x.id), 'timerPresets')
  dup(c.program.days.map((d) => d.sessionId), 'program.days')

  for (const combo of c.combos) {
    if (combo.steps.length === 0) errors.push(`${combo.id}: adım yok`)
    for (const s of combo.steps) {
      if (!moveIds.has(s.move)) errors.push(`${combo.id}: bilinmeyen hareket "${s.move}"`)
    }
    // requiresCoachApproval adımlardan türetilmeli (spec §5.2)
    const derived = combo.steps.some((s) => c.moves.find((m) => m.id === s.move)?.coachApproval)
    if (derived !== combo.requiresCoachApproval) {
      errors.push(`${combo.id}: requiresCoachApproval (${combo.requiresCoachApproval}) adımlarla uyumsuz`)
    }
  }

  for (const day of c.program.days) {
    for (const b of day.blocks) {
      for (const ref of b.exerciseRefs ?? []) {
        if (!exerciseIds.has(ref)) errors.push(`${day.sessionId}/${b.titleTr}: bilinmeyen egzersiz "${ref}"`)
      }
    }
  }

  const testIds = new Set(c.tests.map((t) => t.id))
  if (testIds.size === 0) errors.push('tests: boş')
  return errors
}

export function loadBundledContent(): Content {
  const content = parseSeed(bundledSeed)
  const errors = validateReferences(content)
  if (errors.length) throw new SeedError(`İçerik doğrulaması başarısız:\n${errors.join('\n')}`)
  return content
}
