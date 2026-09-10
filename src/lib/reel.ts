/**
 * HOW THE REEL DECIDES WHAT IS ON RIGHT NOW.
 *
 * ── Two answers, and the fact that they disagree ───────────────────────────
 *
 * The scheduler (`netlify/functions/_shared/airtime.ts`) lays every member's
 * segments onto the clock with real timestamps, and says so in its own comments:
 * subtracting the blocked hours up front "is what lets a member be told,
 * truthfully, that their clip airs at 2:04 PM". /studio shows them that time.
 *
 * The playout did not read those timestamps at all. It took the list, played it
 * in order with a board break between each, and looped. So the promise on the
 * member's screen and the thing the encoder actually did were two different
 * programmes, and the gap between them grew all day.
 *
 * Both behaviours are defensible, and which one is right is a PROGRAMMING
 * decision rather than a bug to be fixed quietly:
 *
 *   LOOP   Stretch what content exists across the whole day. Today, with a
 *          handful of holders, this is the only thing standing between the
 *          channel and a board that sits there for twenty-three hours. It is
 *          good television and the clip times in /studio are approximate.
 *
 *   CLOCK  Play each segment in the minute it was scheduled for, and show the
 *          board the rest of the time. The member's quoted time becomes exactly
 *          true, the day's proportions are visibly honoured, and the channel is
 *          mostly board until holdings grow.
 *
 * LOOP stays the default, because changing what goes out on a live channel is
 * the owner's call and not a side effect of a refactor. CLOCK is one query
 * parameter away (`/player?reel=clock`) so it can be watched before it is
 * chosen. Everything here is pure so both are pinned by tests.
 */

export interface ScheduledSegment {
  /** ISO. Present on member segments; absent on the admin VOD playlist. */
  startsAt?: string
  endsAt?: string
}

export type ReelPlayout = 'loop' | 'clock'

/** `?reel=clock` on the browser source. Anything else — including nothing at
 *  all — is the stretch-to-fill loop the channel has always run. */
export function parsePlayout(search: string): ReelPlayout {
  return new URLSearchParams(search).get('reel') === 'clock' ? 'clock' : 'loop'
}

const ms = (iso: string | undefined): number => {
  const t = Date.parse(String(iso ?? ''))
  return Number.isFinite(t) ? t : NaN
}

export interface ClockPick {
  /** Index of the segment on air now, or -1 for "nothing is scheduled". */
  index: number
  /**
   * How long until this decision expires — the end of the current segment, or
   * the start of the next one. The caller sets ONE timer for this rather than
   * polling; Infinity means nothing further is scheduled today.
   */
  holdMs: number
}

/**
 * Which segment the clock says is on air, and how long the answer is good for.
 *
 * Segments are laid down back to back and never overlap, but this does not
 * assume it: the FIRST segment whose window contains `nowMs` wins, so a
 * malformed or double-booked schedule degrades to "play the earlier one" rather
 * than flickering between two.
 *
 * A segment with no timestamps (the admin VOD playlist) is never picked by the
 * clock — it has no place on it. That is what makes it correct to hand this
 * function a mixed list.
 */
export function pickByClock(items: ScheduledSegment[], nowMs: number): ClockPick {
  let index = -1
  let endsAt = Infinity
  let nextStart = Infinity

  for (let i = 0; i < items.length; i++) {
    const start = ms(items[i]?.startsAt)
    const end = ms(items[i]?.endsAt)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue

    if (nowMs >= start && nowMs < end) {
      if (index === -1 || start < ms(items[index]?.startsAt)) {
        index = i
        endsAt = end
      }
      continue
    }
    if (start > nowMs && start < nextStart) nextStart = start
  }

  if (index >= 0) return { index, holdMs: Math.max(0, endsAt - nowMs) }
  return { index: -1, holdMs: nextStart === Infinity ? Infinity : Math.max(0, nextStart - nowMs) }
}

/**
 * BOARD BREAK — how long the network board sits between two clips in loop mode.
 *
 * A minute was the original, and a minute is a long time on television: against
 * the 20–45 second segments the scheduler actually produces, it means the board
 * is on screen more than half the time the reel is "running". That is the right
 * order of magnitude for stretching four minutes of content over a day, and the
 * wrong one for a channel with enough clips to fill the hour — so it is a knob
 * (`?board=<seconds>`) rather than a constant, and a rehearsal turns it right
 * down so an operator can actually watch a hand-over without waiting a minute
 * for the next one.
 */
export const DEFAULT_BOARD_BREAK_MS = 60_000
export const MIN_BOARD_BREAK_MS = 1_000
export const MAX_BOARD_BREAK_MS = 10 * 60_000

export function parseBoardBreakMs(search: string, fallbackMs = DEFAULT_BOARD_BREAK_MS): number {
  // Absent and empty are checked BEFORE Number(), because `Number(null)` and
  // `Number('')` are both 0 — which is finite, non-negative, and would clamp a
  // missing parameter up to the one-second minimum instead of leaving the
  // channel's board break alone.
  const raw = new URLSearchParams(search).get('board')
  if (raw === null || raw.trim() === '') return fallbackMs
  const seconds = Number(raw)
  if (!Number.isFinite(seconds) || seconds < 0) return fallbackMs
  return Math.min(MAX_BOARD_BREAK_MS, Math.max(MIN_BOARD_BREAK_MS, Math.round(seconds * 1000)))
}
