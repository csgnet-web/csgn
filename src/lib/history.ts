// Historical bucketing for admin ledgers (creator-fee decisions, closed votes).
//
// Everything the network does is anchored to Eastern time — the schedule runs on
// ET, so "which day did this land on" has to be answered in ET too, otherwise a
// 10 PM PT payout jumps a day and lands in the wrong bucket.
//
// Pure functions, no React and no Firestore, so they unit-test directly.

export type HistoryPeriod = 'day' | 'week' | 'month'

export const HISTORY_PERIODS: HistoryPeriod[] = ['day', 'week', 'month']

export interface HistoryGroup<T> {
  /** Stable bucket id, e.g. 'd:2026-07-29' — safe as a React key. */
  key: string
  /** Human label, e.g. 'Today', 'Week of Jul 27', 'July 2026'. */
  label: string
  /** Sort/most-recent anchor for the bucket (ET midday, so DST can't shift it). */
  at: Date
  items: T[]
}

const ET = 'America/New_York'

/** ET calendar day as 'YYYY-MM-DD' (en-CA formats ISO-style). */
export function etDayKey(value: Date | string | number): string {
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-CA', { timeZone: ET })
}

/** Midday UTC on an ET calendar day — far enough from either boundary that DST
 *  can never bump the date, so weekday/month math off it is always right. */
function dayAnchor(dayKey: string): Date {
  const [y, m, d] = dayKey.split('-').map(Number)
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12))
}

/** Monday of the ET week containing `dayKey`. Broadcast weeks start Monday. */
function weekStartKey(dayKey: string): string {
  const anchor = dayAnchor(dayKey)
  const dow = anchor.getUTCDay() // 0 = Sun
  const backToMonday = dow === 0 ? 6 : dow - 1
  anchor.setUTCDate(anchor.getUTCDate() - backToMonday)
  return anchor.toISOString().slice(0, 10)
}

const fmtDay = (d: Date) => d.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' })
const fmtShort = (d: Date) => d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })
const fmtMonth = (d: Date) => d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' })

/**
 * Which bucket a timestamp falls in, and what to call it.
 * `now` is injectable so 'Today'/'Yesterday' are testable.
 */
export function periodBucket(value: Date | string | number, period: HistoryPeriod, now = new Date()): { key: string; label: string; at: Date } {
  const dayKey = etDayKey(value)
  if (!dayKey) return { key: 'unknown', label: 'Undated', at: new Date(0) }

  if (period === 'month') {
    const monthKey = dayKey.slice(0, 7)
    const at = dayAnchor(`${monthKey}-01`)
    return { key: `m:${monthKey}`, label: fmtMonth(at), at }
  }

  if (period === 'week') {
    const startKey = weekStartKey(dayKey)
    const at = dayAnchor(startKey)
    const end = new Date(at.getTime())
    end.setUTCDate(end.getUTCDate() + 6)
    const thisWeek = weekStartKey(etDayKey(now))
    const label = startKey === thisWeek ? `This week · ${fmtShort(at)} – ${fmtShort(end)}` : `Week of ${fmtShort(at)} – ${fmtShort(end)}`
    return { key: `w:${startKey}`, label, at }
  }

  const at = dayAnchor(dayKey)
  const todayKey = etDayKey(now)
  const yesterday = dayAnchor(todayKey)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  const yesterdayKey = yesterday.toISOString().slice(0, 10)
  const label = dayKey === todayKey ? `Today · ${fmtShort(at)}` : dayKey === yesterdayKey ? `Yesterday · ${fmtShort(at)}` : fmtDay(at)
  return { key: `d:${dayKey}`, label, at }
}

/**
 * Bucket a list into newest-first period groups. Items inside each group keep
 * the order they arrived in, so callers control the within-group sort.
 */
export function groupByPeriod<T>(
  items: T[],
  period: HistoryPeriod,
  at: (item: T) => Date | string | number,
  now = new Date(),
): HistoryGroup<T>[] {
  const groups = new Map<string, HistoryGroup<T>>()
  for (const item of items) {
    const bucket = periodBucket(at(item), period, now)
    const existing = groups.get(bucket.key)
    if (existing) existing.items.push(item)
    else groups.set(bucket.key, { ...bucket, items: [item] })
  }
  return [...groups.values()].sort((a, b) => b.at.getTime() - a.at.getTime())
}
