// İlerleme hesapları: haftalık hedef, haftalık seri (donma hakkıyla), toplamlar, sRPE yükü,
// ani artış uyarısı. Araştırma: günlük değil haftalık seri; ACWR risk yüzdesi olarak gösterilmez.

import { addDays, isoWeekday, parseISODate } from '../program/schedule'
import type { LessonJournal, SessionLog } from './records'

/** Haftanın Pazartesi'si (YYYY-MM-DD). */
export function weekStart(day: string): string {
  return addDays(day, 1 - isoWeekday(day))
}

export interface ActivityDay {
  day: string
  minutes: number
  /** sRPE yükü = RPE × dakika (AU) */
  load: number
  sessions: number
}

/** Seans kayıtları + ders günlükleri → gün bazında etkinlik. */
export function activityByDay(sessions: SessionLog[], journals: LessonJournal[] = []): Map<string, ActivityDay> {
  const m = new Map<string, ActivityDay>()
  const add = (day: string, minutes: number, rpe: number | undefined) => {
    const a = m.get(day) ?? { day, minutes: 0, load: 0, sessions: 0 }
    a.minutes += minutes
    a.load += Math.round(minutes * (rpe ?? 5))
    a.sessions += 1
    m.set(day, a)
  }
  for (const s of sessions) add(s.day, Math.round(s.totalSec / 60), s.rpe)
  for (const j of journals) add(j.date, j.minutes ?? 60, j.rpe ?? 6)
  return m
}

export interface WeekSummary {
  week: string
  sessions: number
  minutes: number
  load: number
}

export function weeklySummaries(byDay: Map<string, ActivityDay>, today: string, count: number): WeekSummary[] {
  const out: WeekSummary[] = []
  const thisWeek = weekStart(today)
  for (let i = count - 1; i >= 0; i--) {
    const w = addDays(thisWeek, -7 * i)
    const s: WeekSummary = { week: w, sessions: 0, minutes: 0, load: 0 }
    for (let d = 0; d < 7; d++) {
      const a = byDay.get(addDays(w, d))
      if (a) {
        s.sessions += a.sessions
        s.minutes += a.minutes
        s.load += a.load
      }
    }
    out.push(s)
  }
  return out
}

/**
 * Haftalık seri: hedefi tutturan ardışık haftalar. İçinde bulunulan hafta henüz bitmediği için
 * tutmadıysa seriyi bozmaz. Her 4 haftada 1 donma hakkı: hedefi kaçırılan bir hafta seriyi bozmaz.
 */
export function weeklyStreak(byDay: Map<string, ActivityDay>, today: string, goal: number, maxLookback = 104) {
  const weeks = weeklySummaries(byDay, today, maxLookback)
  let streak = 0
  let freezesUsed = 0
  let freezeBank = 1
  // Donma yalnızca kaçırılan haftanın öncesinde de başarılı hafta varsa harcanır (serinin başındaki boşluklar değil)
  let pending = false
  // En yeniden eskiye
  for (let i = weeks.length - 1; i >= 0; i--) {
    const w = weeks[i]
    const current = i === weeks.length - 1
    if (w.sessions >= goal) {
      if (pending) {
        freezesUsed++
        pending = false
      }
      streak++
      if (streak % 4 === 0) freezeBank = Math.min(2, freezeBank + 1)
    } else if (current) {
      continue
    } else if (!pending && freezeBank > 0 && streak > 0) {
      freezeBank--
      pending = true
    } else {
      if (pending) freezeBank++ // harcanmadı, iade
      break
    }
  }
  if (pending) freezeBank++
  return { streak, freezesUsed, freezesLeft: freezeBank }
}

/**
 * Ani yük artışı: bu haftanın yükü önceki 4 haftanın ortalamasının 1,5 katını aşıyorsa uyarı.
 * Yalnızca bilgi; sakatlık riski yüzdesi hesaplanmaz (ACWR eleştirisi, araştırma raporu).
 */
export function loadSpike(weeks: WeekSummary[]): { spike: boolean; ratio: number | null } {
  if (weeks.length < 3) return { spike: false, ratio: null }
  const cur = weeks[weeks.length - 1]
  const prev = weeks.slice(-5, -1).filter((w) => w.load > 0)
  if (prev.length < 2) return { spike: false, ratio: null }
  const avg = prev.reduce((s, w) => s + w.load, 0) / prev.length
  const ratio = avg > 0 ? cur.load / avg : null
  return { spike: ratio != null && ratio > 1.5, ratio }
}

/** Arka arkaya yoğun gün sayısı (RPE ≥ 7 veya 60+ dk). 6+ ise "dinlenme de antrenmandır". */
export function hardDaysInRow(byDay: Map<string, ActivityDay>, today: string): number {
  let n = 0
  for (let d = 0; d < 14; d++) {
    const a = byDay.get(addDays(today, -d))
    if (!a || a.load < 360) break
    n++
  }
  return n
}

export function daysBetween(a: string, b: string): number {
  return parseISODate(b) - parseISODate(a)
}
