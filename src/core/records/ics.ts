// Takvim dosyası (.ics): iOS web'de yerel zamanlanmış bildirim yok (araştırma) → alarmlı takvim etkinlikleri.

export interface CalendarItem {
  date: string // YYYY-MM-DD
  start: string // HH:MM
  minutes: number
  title: string
  description?: string
  /** Etkinlikten kaç dakika önce alarm */
  alarmBefore?: number
}

const pad = (n: number) => String(n).padStart(2, '0')
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')

function local(date: string, hhmm: string, plusMin = 0): string {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = hhmm.split(':').map(Number)
  const t = new Date(y, mo - 1, d, h, mi + plusMin)
  return `${t.getFullYear()}${pad(t.getMonth() + 1)}${pad(t.getDate())}T${pad(t.getHours())}${pad(t.getMinutes())}00`
}

/** Satırları 75 karakterde katlar (RFC 5545). */
function fold(line: string): string {
  const out: string[] = []
  let s = line
  while (s.length > 74) {
    out.push(s.slice(0, 74))
    s = ' ' + s.slice(74)
  }
  out.push(s)
  return out.join('\r\n')
}

export function buildIcs(items: CalendarItem[], stamp = new Date()): string {
  const now = `${stamp.getUTCFullYear()}${pad(stamp.getUTCMonth() + 1)}${pad(stamp.getUTCDate())}T${pad(stamp.getUTCHours())}${pad(stamp.getUTCMinutes())}00Z`
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Raunt//TR', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Raunt']
  items.forEach((it, i) => {
    lines.push(
      'BEGIN:VEVENT',
      `UID:raunt-${it.date}-${i}@raunt.local`,
      `DTSTAMP:${now}`,
      `DTSTART:${local(it.date, it.start)}`,
      `DTEND:${local(it.date, it.start, it.minutes)}`,
      fold(`SUMMARY:${esc(it.title)}`),
    )
    if (it.description) lines.push(fold(`DESCRIPTION:${esc(it.description)}`))
    if (it.alarmBefore != null) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', fold(`DESCRIPTION:${esc(it.title)}`), `TRIGGER:-PT${it.alarmBefore}M`, 'END:VALARM')
    }
    lines.push('END:VEVENT')
  })
  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}
