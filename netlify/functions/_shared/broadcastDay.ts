/**
 * THE BROADCAST DAY — 2:00 AM ET to 2:00 AM ET.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 *
 * Airtime used to be quoted against a ROLLING six-hour horizon from whenever
 * you happened to look. That is nonsense on a television channel and it showed:
 * a member's "airtime today" shrank every time they refreshed, because the
 * denominator was "however much of the next six hours is unclaimed" and six
 * hours from 11 PM is not six hours from 9 AM. Two members holding identical
 * bags saw different numbers depending on the clock, and the same member saw
 * their entitlement evaporate over the course of an afternoon.
 *
 * A channel has a programming day. Ours starts at 2 AM ET, and every question
 * about proportions is answered once, for the whole day, at that boundary.
 *
 * ── Why 2 AM ────────────────────────────────────────────────────────────────
 *
 * It is the quietest hour on the channel and it sits INSIDE the network block
 * (7 PM–3 AM ET), so the cutover never lands in the middle of open air being
 * allocated. Rolling the day at midnight would put the recalculation in the
 * busiest hour of the evening; rolling it at, say, 6 AM would split the
 * previous night's programming across two days in every report.
 *
 * Broadcast networks have done this forever, for the same reason: "Tuesday's
 * programming" means the block that started Tuesday morning and ran into
 * Wednesday's small hours, not a calendar day that cuts a show in half.
 *
 * ── The consequence, stated plainly ────────────────────────────────────────
 *
 * Your share of a day is fixed at that day's 2 AM cutover, against what you
 * held at that moment. Buy more at noon and it counts from TOMORROW. That is
 * the point of a hard stop — it makes the number stable, it makes the schedule
 * buildable in advance, and it removes the incentive to buy tokens ten minutes
 * before a clip you want boosted.
 *
 * Everything here is pure and DST-aware. It is the only place that knows what
 * "today" means, so the poller, the scheduler and the member's own screen
 * cannot disagree about which day they are talking about.
 */
import { etToUTC, utcToETComponents } from './schedule'

/** ET hour the programming day rolls over. See the header for why 2. */
export const BROADCAST_DAY_START_HOUR_ET = 2

/** A broadcast day is identified by the ET calendar date it STARTS on.
 *  `2026-08-19` is the day that began at 2 AM ET on the 19th and runs until
 *  2 AM ET on the 20th. */
export type BroadcastDayKey = string

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Which broadcast day a moment belongs to.
 *
 * The subtlety is the small hours: 12:30 AM ET on the 20th is still the 19th's
 * programming day, because the 20th has not started yet. Getting this backwards
 * would make every late-night segment appear in the wrong day's report.
 */
export function broadcastDayKey(nowMs: number = Date.now()): BroadcastDayKey {
  const { year, month, day } = utcToETComponents(new Date(nowMs))
  const todayKey = `${year}-${pad(month)}-${pad(day)}`
  const todaysStart = etToUTC(year, month, day, BROADCAST_DAY_START_HOUR_ET)

  // Before today's 2 AM: we are still in yesterday's broadcast day.
  //
  // CALENDAR arithmetic, not epoch arithmetic. Subtracting 24 hours from the
  // timestamp is wrong across a clock change and produces a real off-by-a-day:
  // at midnight EDT on the morning after spring-forward, 24 hours earlier is
  // 11 PM EST two calendar days back, so the moment was filed under the wrong
  // broadcast day entirely. Stepping the ET DATE back by one has no such
  // failure mode, because a calendar date is not a duration.
  return nowMs < todaysStart.getTime() ? prevBroadcastDay(todayKey) : todayKey
}

/** The day before, by ET calendar date. Mirror of nextBroadcastDay. */
export function prevBroadcastDay(key: BroadcastDayKey): BroadcastDayKey {
  const [year, month, day] = key.split('-').map((n) => parseInt(n, 10))
  // Noon UTC is never near a DST boundary, so stepping a day from it cannot
  // slip an hour and land on the wrong date.
  const prev = new Date(Date.UTC(year, month - 1, day, 12, 0, 0) - 24 * 60 * 60 * 1000)
  const c = utcToETComponents(prev)
  return `${c.year}-${pad(c.month)}-${pad(c.day)}`
}

/** When a broadcast day starts and ends, in epoch ms. DST-aware, so the day
 *  that contains a clock change is 23 or 25 hours long — which is correct, and
 *  is exactly the sort of thing a hand-rolled `+ 24 * 3600_000` gets wrong. */
export function broadcastDayBounds(key: BroadcastDayKey): { startMs: number; endMs: number } {
  const [year, month, day] = key.split('-').map((n) => parseInt(n, 10))
  const start = etToUTC(year, month, day, BROADCAST_DAY_START_HOUR_ET)
  const nextKey = nextBroadcastDay(key)
  const [ny, nm, nd] = nextKey.split('-').map((n) => parseInt(n, 10))
  const end = etToUTC(ny, nm, nd, BROADCAST_DAY_START_HOUR_ET)
  return { startMs: start.getTime(), endMs: end.getTime() }
}

/** The day after, by ET calendar date. */
export function nextBroadcastDay(key: BroadcastDayKey): BroadcastDayKey {
  const [year, month, day] = key.split('-').map((n) => parseInt(n, 10))
  // Noon UTC is safe to add a day to — it is never near a DST boundary, so
  // the calendar arithmetic cannot slip an hour and land on the wrong date.
  const next = new Date(Date.UTC(year, month - 1, day, 12, 0, 0) + 24 * 60 * 60 * 1000)
  const c = utcToETComponents(next)
  return `${c.year}-${pad(c.month)}-${pad(c.day)}`
}

/** When the CURRENT day's proportions were fixed, and when the next fix lands.
 *  Both are shown to members, because a number that cannot change until a
 *  stated moment is only trustworthy if the moment is stated. */
export function broadcastDayWindow(nowMs: number = Date.now()): {
  key: BroadcastDayKey
  startMs: number
  endMs: number
  msUntilNextLock: number
} {
  const key = broadcastDayKey(nowMs)
  const { startMs, endMs } = broadcastDayBounds(key)
  return { key, startMs, endMs, msUntilNextLock: Math.max(0, endMs - nowMs) }
}

/** Human label for a broadcast day — "Tue 19 Aug", in ET. */
export function broadcastDayLabel(key: BroadcastDayKey): string {
  const { startMs } = broadcastDayBounds(key)
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', weekday: 'short', day: 'numeric', month: 'short',
  }).format(new Date(startMs))
}
