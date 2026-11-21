interface Props {
  value: number
  max: number
  size?: number
  stroke?: number
  label?: string
  sub?: string
}

/**
 * Haftalık hedef: her seans halkada bir dilim. Yapılan dilimler dolu mavi (toparlan/kaydet köşesi),
 * kalanlar ince çizgi; sayı ortada. Şekil + sayı → renk körü dostu.
 */
export function Ring({ value, max, size = 96, stroke = 10, label, sub }: Props) {
  const n = Math.max(1, max)
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const gap = n > 1 ? Math.min(6, c / n / 4) : 0
  const seg = c / n - gap
  const done = Math.min(value, n)
  return (
    <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label ?? `${value}/${max}`}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {Array.from({ length: n }, (_, i) => (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={i < done ? 'var(--blue)' : 'var(--stroke-2)'}
            strokeWidth={i < done ? stroke : stroke * 0.35}
            strokeDasharray={`${seg} ${c - seg}`}
            strokeDashoffset={-(i * (seg + gap))}
          />
        ))}
      </g>
      <text
        x="50%"
        y={sub ? '46%' : '52%'}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="var(--wrap)"
        fontFamily="var(--display)"
        fontSize={size * 0.32}
        fontWeight={800}
      >
        {value}/{max}
      </text>
      {sub && (
        <text x="50%" y="70%" textAnchor="middle" dominantBaseline="middle" fill="var(--rope)" fontSize={size * 0.12}>
          {sub}
        </text>
      )}
    </svg>
  )
}
