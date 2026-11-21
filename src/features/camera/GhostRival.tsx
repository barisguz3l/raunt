import { useEffect, useRef, useState } from 'react'
import { voice } from '../../core/audio/voiceService'
import { getContentStore } from '../../core/content/contentStore'
import type { Stance } from '../../core/speech/stanceMapper'
import { spokenPhrase } from '../../core/speech/stanceMapper'
import { tr } from '../../i18n/tr'
import { cueMoves } from '../combos/comboModel'
import { activeStep, padSpec } from '../pad/padLayout'
import type { CallInfo, VisionSession } from './visionSession'

interface Props {
  session: VisionSession
  elapsed: number
  inRound: boolean
  paused: boolean
  stance: Stance
  call?: CallInfo
  seed: number
}

const W = 90
const H = 160
const ATTACK_WINDOW = 1.4

/** Basit tohumlu rastgele (saldırı zamanları tekrarlanabilir). */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), a | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Hayalet rakip: aynanın üstünde yarı saydam rakip. Çağrılan vuruşun hedefi rakipte yanar
 * (lapa haritası), algılanan doğru vuruş "isabet" sayılır; rakip ara sıra saldırır.
 */
export function GhostRival({ session, elapsed, inRound, paused, stance, call, seed }: Props) {
  const store = getContentStore()
  const rand = useRef(rng(seed))
  const nextAttack = useRef<number | null>(null)
  const [attack, setAttack] = useState<{ t: number; kind: 'slip' | 'block'; result?: 'dodged' | 'caught' } | null>(null)
  const [hitAt, setHitAt] = useState(-1)
  const lastProgress = useRef(0)

  // İsabet: sırayla algılanan adım sayısı arttıkça
  const progress = session.progress
  useEffect(() => {
    if (progress > lastProgress.current) setHitAt(elapsed)
    lastProgress.current = progress
  }, [progress])

  // Saldırı zamanlaması
  const speaking = call ? elapsed >= call.t - 0.5 && elapsed <= call.t + call.speakSec + call.windowSec : false
  useEffect(() => {
    if (!inRound || paused) {
      nextAttack.current = null
      return
    }
    nextAttack.current ??= elapsed + 8 + rand.current() * 8
    if (!attack && !speaking && elapsed >= nextAttack.current) {
      const kind = rand.current() < 0.6 ? 'slip' : 'block'
      setAttack({ t: elapsed, kind })
      const mv = store.move(kind)
      if (mv) voice.speak([spokenPhrase(mv, stance, 'names')])
      nextAttack.current = elapsed + ATTACK_WINDOW + 12 + rand.current() * 8
    }
    if (attack && !attack.result) {
      const reacted = session.recent.some((e) => (e.type === 'slip' || e.type === 'block') && e.t >= attack.t - 0.2 && e.t <= attack.t + ATTACK_WINDOW)
      if (reacted) {
        session.dodged++
        session.show(tr.vision.dodged, 'good', 1)
        setAttack({ ...attack, result: 'dodged' })
      } else if (elapsed > attack.t + ATTACK_WINDOW) {
        session.caught++
        session.show(tr.vision.caught, 'warn', 1)
        setAttack({ ...attack, result: 'caught' })
      }
    }
    if (attack?.result && elapsed > attack.t + ATTACK_WINDOW + 1) setAttack(null)
  })

  // Çağrılan kombonun hedefleri
  const moves = call && !call.comboId.startsWith('say:') ? cueMoves(store, call.comboId) : []
  const specs = moves.map((m) => padSpec(m, stance))
  const speakIdx = call ? activeStep(moves.length, call.t, call.speakSec, elapsed) : -1
  const target = call && elapsed > call.t + call.speakSec ? Math.min(progress, moves.length - 1) : speakIdx
  const shaking = elapsed - hitAt < 0.35
  const attacking = attack && !attack.result

  return (
    <div className="ghost-rival" data-attack={attacking || undefined} aria-hidden="true">
      <svg viewBox={`0 0 ${W} ${H}`} className="ghost-svg" data-shake={shaking || undefined}>
        {/* Rakip silüeti */}
        <g className="ghost-body">
          <circle cx={45} cy={30} r={11} />
          <path d="M28 46 Q45 40 62 46 L64 98 Q45 104 26 98 Z" />
          <path d="M30 100 L24 152 L33 152 L41 104 Z" />
          <path d="M60 100 L66 152 L57 152 L49 104 Z" />
          {/* Gard: eldivenler çene önünde; saldırıda biri sana uzanır */}
          <circle cx={attacking && attack?.kind === 'slip' ? 40 : 36} cy={attacking ? 34 : 40} r={attacking && attack?.kind === 'slip' ? 15 : 7} className="ghost-glove" />
          <circle cx={attacking && attack?.kind === 'block' ? 50 : 54} cy={attacking ? 34 : 40} r={attacking && attack?.kind === 'block' ? 15 : 7} className="ghost-glove" />
        </g>
        {/* Hedefler */}
        {specs.map((p, i) =>
          p.kind === 'none' || p.kind === 'defense' ? null : (
            <g key={i} opacity={i === target ? 1 : i < progress ? 0.15 : 0.35}>
              <circle cx={p.x * W} cy={p.y * H} r={i === target ? 9 : 6} className="ghost-target" data-side={p.side} />
              <text x={p.x * W} y={p.y * H + 3} textAnchor="middle" className="ghost-target-label">
                {i + 1}
              </text>
            </g>
          ),
        )}
      </svg>
      {shaking && <span className="ghost-hit">{tr.vision.hit}</span>}
    </div>
  )
}
