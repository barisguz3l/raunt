// Program tarih hesapları. Tarihler yerel takvim günü olarak "YYYY-MM-DD" string'i ile işlenir
// (saat dilimi kaymasını önlemek için UTC gün numarasına çevrilir).

export type ProgramPosition =
  | { kind: 'before'; daysUntilStart: number }
  | { kind: 'active'; week: number; dayOfWeek: number; dayIndex: number }
  | { kind: 'after'; daysSinceEnd: number }

const DAY_MS = 86_400_000

export function parseISODate(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) throw new Error(`Geçersiz tarih: ${iso}`)
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY_MS
}

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${da}`
}

/** 1 = Pazartesi … 7 = Pazar */
export function isoWeekday(iso: string): number {
  const dow = new Date(parseISODate(iso) * DAY_MS).getUTCDay() // 0 = Pazar
  return dow === 0 ? 7 : dow
}

export function addDays(iso: string, n: number): string {
  const d = new Date((parseISODate(iso) + n) * DAY_MS)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

/** Bugünden sonraki (veya bugün olan) ilk Pazartesi. */
export function nextMonday(todayIso: string): string {
  const wd = isoWeekday(todayIso)
  return addDays(todayIso, wd === 1 ? 0 : 8 - wd)
}

export function programPosition(startIso: string, todayIso: string, weeks: number): ProgramPosition {
  const diff = parseISODate(todayIso) - parseISODate(startIso)
  if (diff < 0) return { kind: 'before', daysUntilStart: -diff }
  const total = weeks * 7
  if (diff >= total) return { kind: 'after', daysSinceEnd: diff - total + 1 }
  return { kind: 'active', week: Math.floor(diff / 7) + 1, dayOfWeek: (diff % 7) + 1, dayIndex: diff }
}
