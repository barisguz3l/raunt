// Antrenman planı: zamanlayıcı ayarı + (isteğe bağlı) kombo koçu. Ekran ve ses tek çizelgeden beslenir.

import type { ContentStore } from '../../core/content/contentStore'
import { buildCoachTimeline } from '../../core/engine/coachTimeline'
import type { RoundRule, Selection, Tempo } from '../../core/engine/comboScheduler'
import { spokenPhrase } from '../../core/speech/stanceMapper'
import { buildTimeline, type Timeline, type TimerConfig } from '../../core/engine/timeline'
import { phraseMs } from '../../core/audio/voiceService'
import type { AppSettings } from '../../core/settings/settings'
import type { CallMode } from '../../core/speech/stanceMapper'
import { resolveCombo } from '../combos/comboModel'
import { habitBoost } from '../../core/vision/coachAdapt'
import { visionHabits } from '../camera/visionStore'
import { addCoachVoice } from '../../core/engine/coachVoice'
import { seededRandom, type ResolvedCombo } from '../../core/engine/comboScheduler'
import { comboWeight, type ComboStats, type LessonCombo } from '../../core/engine/comboMemory'
import { insertOpponentCalls } from '../../core/engine/opponentCalls'
import { speechFor } from '../../core/engine/comboScheduler'
import { comboMemory } from '../../core/records/comboMemoryStore'
import { toISODate } from '../../core/program/schedule'

export type WorkoutKind = 'timer' | 'combo' | 'shadow' | 'bag' | 'reflex' | 'pad' | 'routine'

export interface CoachSpec {
  comboIds: string[]
  selection: Selection
  tempo: Tempo
  callMode: CallMode
  /** Rastgele sıra için tohum (aynı tohum → aynı antrenman). */
  seed: number
  /** Raunt kuralları (sırayla döner) */
  rules?: RoundRule[]
  /** Raunt ortasında "duruş değiştir" */
  switchStance?: boolean
  /** Refleks modu: tek hareket çağrıları */
  reflex?: boolean
  /** Refleks çağrı aralığı [min, max] sn */
  reflexGap?: [number, number]
  /** Ekranda lapa animasyonu */
  pad?: boolean
  /** Zincir: tek kombo parça parça öğretilir (1 → 1-2 → 1-2-3 …) */
  chain?: boolean
  /** Lapa modu: rakip saldırısı (kombolar arasına savunma çağrısı, kırmızı eldiven) */
  opponent?: boolean
}

/** Rastgele seçim ağırlıkları için kombo hafızası (varsayılan: uygulamanın deposu, bugün). */
export interface PlanMemory {
  stats: ComboStats
  lesson: LessonCombo | null
  today: string
}

/** Rakip saldırısında kullanılan savunmalar */
export const DEFENSE_IDS = ['slip', 'block', 'roll', 'parry']

export interface WorkoutPlan {
  kind: WorkoutKind
  config: TimerConfig
  coach?: CoachSpec
  /** Ekranda ve geçmişte görünen ad */
  title?: string
  /** Program günü/blok kimliği (Bugün ekranından başlatıldıysa) */
  programSessionId?: string
}

export function buildPlanTimeline(plan: WorkoutPlan, store: ContentStore, s: AppSettings, memory?: PlanMemory): Timeline {
  if (!plan.coach) return buildTimeline(plan.config)
  const mem = memory ?? { ...comboMemory.get(), today: toISODate(new Date()) }
  let tl = buildCoachPart(plan, store, s, mem)
  if (plan.coach.opponent && !plan.coach.reflex) {
    const moves = DEFENSE_IDS.map((id) => store.move(id))
      .filter((m): m is NonNullable<typeof m> => !!m && (s.coachApproved || !m.coachApproval))
      .map((m) => ({ id: m.id, phrase: spokenPhrase(m, s.stance, plan.coach!.callMode, s.nameStyle), durationMs: m.durationMsEstimate }))
    tl = insertOpponentCalls(tl, { moves, phraseMs, rand: seededRandom(plan.coach.seed ^ 0x2545f491), ...speechFor(plan.coach.tempo) })
  }
  return s.coachChatter
    ? addCoachVoice(tl, { phraseMs, rand: seededRandom(plan.coach.seed ^ 0x5bd1e995), focus: s.coachFocus })
    : tl
}

/** Zincir havuzu: her ön ek 4 kez, sonra tam kombo 8 kez (sıralı). */
export function chainPool(base: ResolvedCombo): ResolvedCombo[] {
  const out: ResolvedCombo[] = []
  const n = base.moves.length
  for (let k = 1; k < n; k++) {
    const part: ResolvedCombo = {
      combo: { ...base.combo, id: `chain:${base.combo.id}:${k}`, steps: base.combo.steps.slice(0, k) },
      moves: base.moves.slice(0, k),
      phrases: base.phrases.slice(0, k),
    }
    for (let i = 0; i < 4; i++) out.push(part)
  }
  for (let i = 0; i < 8; i++) out.push(base)
  return out
}

function buildCoachPart(plan: WorkoutPlan, store: ContentStore, s: AppSettings, mem: PlanMemory): Timeline {
  if (!plan.coach) return buildTimeline(plan.config)
  const v = { stance: s.stance, callMode: plan.coach.callMode, nameStyle: s.nameStyle }
  const store2 = store
  if (plan.coach.reflex) {
    const moves = store2.content.moves
      .filter((m) => (s.coachApproved || !m.coachApproval) && m.category !== 'footwork')
      .map((m) => ({ id: m.id, phrase: spokenPhrase(m, s.stance, plan.coach!.callMode, s.nameStyle), category: m.category, durationMs: m.durationMsEstimate }))
    return buildCoachTimeline(plan.config, {
      pool: [],
      selection: 'random',
      tempo: plan.coach.tempo,
      coachApproved: s.coachApproved,
      phraseMs,
      seed: plan.coach.seed,
      reflex: { moves, minGap: plan.coach.reflexGap?.[0], maxGap: plan.coach.reflexGap?.[1] },
    })
  }
  const resolved = plan.coach.comboIds
    .map((id) => store.combo(id))
    .filter((c): c is NonNullable<typeof c> => !!c)
    .map((c) => resolveCombo(store, c, v))
    // Unutma eğrisi: uzun süredir çağrılmayanlar ve hocanın kombinasyonu rastgele seçimde daha sık gelir
    .map((rc) => ({ ...rc, weight: comboWeight(rc.combo.id, mem.stats, mem.today, mem.lesson) }))
  // Davranışa göre koç: kameranın az gördüğü vuruş/el içeren kombolar daha sık
  const habits = visionHabits()
  for (const r of resolved) r.weight = (r.weight ?? 1) * habitBoost(r.moves, s.stance, habits)
  const pool = plan.coach.chain && resolved[0] ? chainPool(resolved[0]) : resolved
  return buildCoachTimeline(plan.config, {
    pool,
    selection: plan.coach.chain ? 'sequential' : plan.coach.selection,
    tempo: plan.coach.tempo,
    coachApproved: s.coachApproved,
    phraseMs,
    seed: plan.coach.seed,
    rules: plan.coach.rules,
    switchPool: plan.coach.switchStance
      ? pool.map((c) => ({ ...resolveCombo(store, c.combo, { ...v, stance: s.stance === 'orthodox' ? 'southpaw' : 'orthodox' }), weight: c.weight }))
      : undefined,
    switchPhrase: plan.coach.switchStance ? spokenPhrase(store.move('switch')!, s.stance, 'names') : undefined,
  })
}

/** Çizelgedeki tüm çağrı ifadeleri (önceden yüklemek için). */
export function timelinePhrases(tl: Timeline): string[] {
  const set = new Set<string>()
  for (const c of tl.cues) if (c.type === 'call') c.phrases.forEach((p) => set.add(p))
  return [...set]
}
