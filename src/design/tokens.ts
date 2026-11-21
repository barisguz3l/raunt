// Tasarım belirteçleri (spec §3.3). CSS değişkenleri global.css'te aynı değerlerle tanımlı.

export const colors = {
  bg: '#000000',
  surface: '#121212',
  card: '#1C1C1E',
  text: '#FFFFFF',
  textSecondary: '#A1A1AA',
  accent: '#EF4444',
  success: '#22C55E',
  warning: '#FB923C',
} as const

export type Phase = 'idle' | 'prep' | 'round' | 'warn' | 'rest' | 'done'

/** Faz renkleri + renk körü dostu kısa etiket (renge ek olarak metin). */
export const phaseStyle: Record<Phase, { color: string; label: string; text: string }> = {
  idle: { color: '#1C1C1E', label: 'Hazır', text: '#FFFFFF' },
  prep: { color: '#F5C518', label: 'Hazırlık', text: '#000000' },
  round: { color: '#22C55E', label: 'Raunt', text: '#000000' },
  warn: { color: '#FB923C', label: 'Son saniyeler', text: '#000000' },
  rest: { color: '#3B82F6', label: 'Dinlenme', text: '#000000' },
  done: { color: '#A855F7', label: 'Bitti', text: '#000000' },
}

/** Eldivenle kullanım ölçüleri (pt ≈ CSS px). */
export const touch = {
  min: 64,
  primary: 96,
  edgeGuard: 20,
} as const
