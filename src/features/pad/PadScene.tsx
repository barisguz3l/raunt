import { useEffect, useState } from 'react'
import type { Move } from '../../core/content/types'
import type { Stance } from '../../core/speech/stanceMapper'
import { activeStep, padSpec, stepProgress, type PadSpec } from './padLayout'

interface Props {
  moves: Move[]
  stance: Stance
  /** Çağrı zamanı ve konuşma süresi (sn); yoksa yalnızca önizleme */
  cueT?: number
  speakSec?: number
  elapsed: number
  /** Dinlenmede sıradaki kombonun soluk önizlemesi */
  preview?: boolean
}

const VW = 90
const VH = 160
const FILL: Record<PadSpec['kind'], string> = {
  left: '#3B82F6',
  right: '#EF4444',
  both: '#8B5CF6',
  kick: '#FB923C',
  defense: '#DC2626',
  none: 'transparent',
}

function useReducedMotion() {
  const [r, setR] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return
    const mq = matchMedia('(prefers-reduced-motion: reduce)')
    const f = () => setR(mq.matches)
    mq.addEventListener?.('change', f)
    return () => mq.removeEventListener?.('change', f)
  }, [])
  return r
}

const IDLE: PadSpec[] = [
  { x: 0.36, y: 0.36, w: 0.16, h: 0.12, rot: 0, kind: 'left', side: 'left', label: '' },
  { x: 0.64, y: 0.36, w: 0.16, h: 0.12, rot: 0, kind: 'right', side: 'right', label: '' },
]

/** Lapa sahnesi (Ek A): koçun elleri ekranda; çağrılan vuruşun lapası yükselir ve parlar. */
export function PadScene({ moves, stance, cueT, speakSec = 0, elapsed, preview }: Props) {
  const reduced = useReducedMotion()
  const specs = moves.map((m) => padSpec(m, stance))
  const live = !preview && cueT !== undefined
  const act = live ? activeStep(moves.length, cueT, speakSec, elapsed) : -1
  const prog = live ? stepProgress(moves.length, cueT, speakSec, elapsed) : 0
  const cur = act >= 0 ? specs[act] : undefined
  const curMove = act >= 0 ? moves[act] : undefined

  const ariaLabel = curMove
    ? `${cur?.side === 'left' ? 'Sol lapa' : cur?.side === 'right' ? 'Sağ lapa' : 'Lapa'}, ${curMove.nameTr}`
    : moves.length
      ? `Lapa önizlemesi: ${moves.map((m) => m.shortTr).join(', ')}`
      : 'Lapa bekleniyor'

  return (
    <div className="pad-scene" role="img" aria-label={ariaLabel} data-preview={preview || undefined}>
      <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <defs>
          <radialGradient id="padbg" cx="50%" cy="35%" r="75%">
            <stop offset="0" stopColor="#2a2f3a" />
            <stop offset="1" stopColor="#0b0d12" />
          </radialGradient>
          <linearGradient id="padsheen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.25" />
          </linearGradient>
        </defs>
        <rect width={VW} height={VH} rx="8" fill="url(#padbg)" />
        {/* Koç silüeti */}
        <g fill="#ffffff" opacity="0.05">
          <circle cx={VW / 2} cy={VH * 0.13} r="10" />
          <path d={`M${VW * 0.22} ${VH} L${VW * 0.28} ${VH * 0.3} Q${VW / 2} ${VH * 0.22} ${VW * 0.72} ${VH * 0.3} L${VW * 0.78} ${VH} Z`} />
        </g>

        {!cur && IDLE.map((p, i) => <Pad key={`i${i}`} p={p} opacity={0.35} />)}

        {/* Kombonun tüm lapaları soluk ve sıra numaralı */}
        {specs.map((p, i) =>
          i === act || p.kind === 'none' ? null : <Pad key={`p${i}`} p={p} opacity={act > i ? 0.12 : 0.3} order={i + 1} />,
        )}

        {cur && cur.kind !== 'none' && <ActivePad p={cur} progress={prog} reduced={reduced} />}
        {cur && cur.kind === 'none' && (
          <text x={VW / 2} y={VH * 0.5} textAnchor="middle" fontSize="10" fontWeight="900" fill="#fff">
            ↔ {cur.label}
          </text>
        )}
      </svg>
    </div>
  )
}

function Pad({ p, opacity, order, lit }: { p: PadSpec; opacity: number; order?: number; lit?: boolean }) {
  const cx = p.x * VW
  const cy = p.y * VH
  const w = p.w * VW
  const h = p.h * VH
  if (p.kind === 'defense') {
    const r = w / 2
    return (
      <g opacity={opacity}>
        <circle cx={cx} cy={cy} r={r} fill={FILL.defense} stroke="#fff" strokeWidth={lit ? 1.6 : 0.8} />
        <circle cx={cx} cy={cy} r={r} fill="url(#padsheen)" />
        {lit && (
          <text x={cx} y={cy + 2.5} textAnchor="middle" fontSize="6" fontWeight="900" fill="#fff">
            {p.label}
          </text>
        )}
      </g>
    )
  }
  const rx = Math.min(w, h) * 0.3
  return (
    <g opacity={opacity} transform={`rotate(${p.rot} ${cx} ${cy})`}>
      <rect
        x={cx - w / 2}
        y={cy - h / 2}
        width={w}
        height={h}
        rx={rx}
        fill={FILL[p.kind]}
        stroke={lit ? '#fff' : 'rgba(255,255,255,.35)'}
        strokeWidth={lit ? 1.4 : 0.6}
      />
      <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={rx} fill="url(#padsheen)" />
      <rect
        x={cx - w / 2 + 2}
        y={cy - h / 2 + 2}
        width={w - 4}
        height={h - 4}
        rx={rx * 0.8}
        fill="none"
        stroke="rgba(255,255,255,.4)"
        strokeWidth="0.4"
        strokeDasharray="1.2 1"
      />
      {order !== undefined && (
        <text x={cx} y={cy + 2.5} textAnchor="middle" fontSize="7" fontWeight="800" fill="#fff" transform={`rotate(${-p.rot} ${cx} ${cy})`}>
          {order}
        </text>
      )}
    </g>
  )
}

function ActivePad({ p, progress, reduced }: { p: PadSpec; progress: number; reduced: boolean }) {
  const cx = p.x * VW
  const cy = p.y * VH
  // Yükselme: ilk %25'te 0.7 → 1.0 ölçek ve yukarı kayma; savunmada eldiven büyür (kameraya uçar)
  const rise = reduced ? 1 : Math.min(1, progress / 0.25)
  const ease = 1 - (1 - rise) ** 3
  const scale = p.kind === 'defense' ? (reduced ? 1.6 : 1 + 2 * progress) : 0.7 + 0.3 * ease
  const lift = reduced || p.kind === 'defense' ? 0 : (1 - ease) * 6
  const ringR = (Math.max(p.w * VW, p.h * VH) / 2 + 3) * (1.6 - 0.6 * progress)
  const badge = p.arrowUp ? `↑${p.label}` : p.label
  const top = cy - Math.max(p.w * VW, p.h * VH) * 0.5 - 14
  return (
    <g>
      <g transform={`translate(${cx} ${cy + lift}) scale(${scale}) translate(${-cx} ${-cy})`} style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,.55))' }}>
        <Pad p={p} opacity={1} lit />
      </g>
      {!reduced && p.kind !== 'defense' && (
        <circle cx={cx} cy={cy} r={ringR} fill="none" stroke="#fff" strokeOpacity={0.25 + 0.6 * progress} strokeWidth="1" />
      )}
      {p.kind !== 'defense' && (
        <g>
          <rect x={cx - 13} y={Math.max(1, top)} width="26" height="11" rx="5.5" fill="#fff" />
          <text x={cx} y={Math.max(1, top) + 8} textAnchor="middle" fontSize={badge.length > 3 ? 5 : 8} fontWeight="900" fill="#111">
            {badge}
          </text>
        </g>
      )}
    </g>
  )
}
