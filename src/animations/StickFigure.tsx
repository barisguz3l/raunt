// Çöp adam animasyonları (spec §2.6): anahtar kareler kodla tanımlı, kareler arası yumuşak geçiş.
// Koordinatlar 0–100 sahnede; sol taraf = ön (normal duruş, sol ayak önde).

import { useEffect, useRef, useState } from 'react'

type P = [number, number]
interface Pose {
  head: P
  neck: P
  hip: P
  // ön (lead) ve arka (rear) kol/bacak: omuz → dirsek → el, kalça → diz → ayak
  lElbow: P
  lHand: P
  rElbow: P
  rHand: P
  lKnee: P
  lFoot: P
  rKnee: P
  rFoot: P
}

const GUARD: Pose = {
  head: [50, 16],
  neck: [50, 25],
  hip: [50, 55],
  lElbow: [42, 38],
  lHand: [45, 24],
  rElbow: [58, 38],
  rHand: [55, 26],
  lKnee: [42, 72],
  lFoot: [38, 90],
  rKnee: [58, 72],
  rFoot: [64, 90],
}

const P = (patch: Partial<Pose>): Pose => ({ ...GUARD, ...patch })

/** animationKey → [kare, süre(ms)] dizisi; sonda guard'a dönüş. */
const ANIMS: Record<string, [Pose, number][]> = {
  guard: [
    [GUARD, 700],
    [P({ head: [50, 17], lHand: [45, 25], rHand: [55, 27] }), 700],
  ],
  jab: [
    [GUARD, 350],
    [P({ lElbow: [32, 26], lHand: [16, 24], head: [48, 17] }), 250],
    [GUARD, 400],
  ],
  cross: [
    [GUARD, 350],
    [P({ rElbow: [38, 28], rHand: [16, 25], hip: [48, 55], head: [46, 17], rFoot: [62, 90], rKnee: [56, 72] }), 280],
    [GUARD, 420],
  ],
  hook: [
    [GUARD, 350],
    [P({ lElbow: [30, 26], lHand: [34, 18], head: [52, 17], lKnee: [44, 72] }), 280],
    [GUARD, 420],
  ],
  upper: [
    [GUARD, 300],
    [P({ lElbow: [40, 42], lHand: [42, 48], hip: [50, 58], lKnee: [42, 75], rKnee: [58, 75] }), 220],
    [P({ lElbow: [36, 34], lHand: [38, 16], head: [51, 16] }), 240],
    [GUARD, 400],
  ],
  knee: [
    [GUARD, 350],
    [P({ rKnee: [44, 52], rFoot: [56, 66], lHand: [42, 20], rHand: [50, 20], hip: [52, 55] }), 320],
    [GUARD, 450],
  ],
  teep: [
    [GUARD, 350],
    [P({ lKnee: [36, 56], lFoot: [36, 66] }), 250],
    [P({ lKnee: [32, 56], lFoot: [14, 56], head: [54, 17], hip: [54, 56] }), 300],
    [GUARD, 450],
  ],
  low: [
    [GUARD, 350],
    [P({ rKnee: [46, 66], rFoot: [30, 74], hip: [48, 55], rHand: [62, 34] }), 300],
    [P({ rKnee: [40, 70], rFoot: [24, 82], rHand: [64, 40], head: [52, 17] }), 220],
    [GUARD, 450],
  ],
  mid: [
    [GUARD, 350],
    [P({ rKnee: [42, 56], rFoot: [24, 58], hip: [50, 55], rHand: [64, 36], head: [54, 17] }), 380],
    [GUARD, 450],
  ],
  high: [
    [GUARD, 350],
    [P({ rKnee: [40, 42], rFoot: [24, 30], hip: [52, 56], rHand: [66, 38], head: [56, 18] }), 420],
    [GUARD, 500],
  ],
  block: [
    [GUARD, 400],
    [P({ lElbow: [46, 30], lHand: [46, 14], rElbow: [54, 30], rHand: [54, 14], head: [50, 19] }), 400],
    [GUARD, 400],
  ],
  slip: [
    [GUARD, 350],
    [P({ head: [40, 20], neck: [44, 28], hip: [48, 56] }), 300],
    [GUARD, 350],
  ],
  roll: [
    [GUARD, 300],
    [P({ head: [44, 30], neck: [46, 36], hip: [50, 60], lKnee: [42, 76], rKnee: [58, 76] }), 300],
    [P({ head: [56, 30], neck: [54, 36], hip: [50, 60], lKnee: [42, 76], rKnee: [58, 76] }), 300],
    [GUARD, 350],
  ],
  plank: [
    [
      {
        head: [18, 56],
        neck: [26, 60],
        hip: [56, 64],
        lElbow: [28, 78],
        lHand: [36, 80],
        rElbow: [30, 78],
        rHand: [38, 80],
        lKnee: [70, 70],
        lFoot: [86, 78],
        rKnee: [70, 71],
        rFoot: [86, 79],
      },
      1200,
    ],
    [
      {
        head: [18, 55],
        neck: [26, 59],
        hip: [56, 63],
        lElbow: [28, 78],
        lHand: [36, 80],
        rElbow: [30, 78],
        rHand: [38, 80],
        lKnee: [70, 69],
        lFoot: [86, 78],
        rKnee: [70, 70],
        rFoot: [86, 79],
      },
      1200,
    ],
  ],
}
ANIMS.combo = [...ANIMS.jab.slice(0, 2), ...ANIMS.cross.slice(1, 2), ...ANIMS.hook.slice(1)]
ANIMS.sinav = [
  [P({ ...ANIMS.plank[0][0], lElbow: [30, 70], rElbow: [32, 70], lHand: [30, 80], rHand: [32, 80] }), 600],
  [P({ ...ANIMS.plank[0][0], head: [18, 66], neck: [26, 70], hip: [56, 70], lElbow: [40, 70], rElbow: [42, 70], lHand: [30, 80], rHand: [32, 80] }), 600],
]
ANIMS.squat = [
  [GUARD, 600],
  [P({ hip: [56, 66], neck: [48, 34], head: [46, 25], lKnee: [38, 70], rKnee: [62, 70], lHand: [34, 40], rHand: [36, 42] }), 600],
]
ANIMS.highknee = [
  [P({ lKnee: [44, 56], lFoot: [46, 70] }), 250],
  [P({ rKnee: [56, 56], rFoot: [54, 70] }), 250],
]

const ALIAS: Record<string, string> = {
  rope: 'highknee',
  pushup: 'sinav',
  crunch: 'plank',
  deadbug: 'plank',
  climber: 'highknee',
  legswing: 'teep',
  hipflex: 'squat',
  ham: 'squat',
  adim: 'guard',
  parry: 'block',
  check: 'knee',
  pivot: 'guard',
}

function lerp(a: Pose, b: Pose, t: number): Pose {
  const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
  const out = {} as Pose
  for (const k of Object.keys(a) as (keyof Pose)[]) out[k] = [a[k][0] + (b[k][0] - a[k][0]) * e, a[k][1] + (b[k][1] - a[k][1]) * e]
  return out
}

export function hasAnimation(key: string) {
  return key in ANIMS || key in ALIAS
}

/** Animasyonlu çöp adam. mirror: solak duruş (ayna). */
export function StickFigure({ animKey, mirror = false, size = 220, paused = false }: { animKey: string; mirror?: boolean; size?: number; paused?: boolean }) {
  const frames = ANIMS[animKey] ?? ANIMS[ALIAS[animKey] ?? 'guard']
  const [pose, setPose] = useState<Pose>(frames[0][0])
  const raf = useRef(0)
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (paused || reduce) {
      setPose(frames[Math.min(1, frames.length - 1)][0])
      return
    }
    const total = frames.reduce((s, f) => s + f[1], 0)
    const start = performance.now()
    const tick = () => {
      let t = (performance.now() - start) % total
      let i = 0
      while (t > frames[i][1]) {
        t -= frames[i][1]
        i++
      }
      const next = frames[(i + 1) % frames.length][0]
      setPose(lerp(frames[i][0], next, t / frames[i][1]))
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [frames, paused, reduce])

  const sh: P = [pose.neck[0], pose.neck[1] + 3]
  const line = (a: P, b: P, w = 5, c = '#ece8df') => <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={c} strokeWidth={w} strokeLinecap="round" />
  // Ön kol/bacak mavi (lapa modundaki ön el rengiyle aynı), eldivenler kırmızı
  const lead = '#4a8bff'
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="stick" style={mirror ? { transform: 'scaleX(-1)' } : undefined} aria-hidden="true">
      <ellipse cx="50" cy="92" rx="30" ry="3" fill="rgba(255,255,255,0.06)" />
      {/* arka kol/bacak önce (arkada kalsın) */}
      {line(pose.hip, pose.rKnee)}
      {line(pose.rKnee, pose.rFoot)}
      {line(sh, pose.rElbow)}
      {line(pose.rElbow, pose.rHand)}
      <circle cx={pose.rHand[0]} cy={pose.rHand[1]} r="3.6" fill="#e5333f" />
      {line(pose.neck, pose.hip, 6)}
      {line(pose.hip, pose.lKnee, 5, lead)}
      {line(pose.lKnee, pose.lFoot, 5, lead)}
      {line(sh, pose.lElbow, 5, lead)}
      {line(pose.lElbow, pose.lHand, 5, lead)}
      <circle cx={pose.lHand[0]} cy={pose.lHand[1]} r="3.6" fill="#e5333f" />
      <circle cx={pose.head[0]} cy={pose.head[1]} r="6.5" fill="#ece8df" />
    </svg>
  )
}
