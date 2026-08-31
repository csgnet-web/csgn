import { describe, it, expect } from 'vitest'
import { pickActiveSlot, shouldRunPoll, slotAirtime, nextDueAtMs, TIER_INTERVAL_MS, OVERLAP_GUARD_MS } from '../feePollerBackground'
import { creditMinutes, MAX_SAMPLE_CREDIT_MIN } from '../_shared/liveRoster'

/** The cron period in netlify.toml, in minutes. Kept here so the clamp below
 *  is pinned against the real schedule rather than a remembered one. */
const CRON_PERIOD_MIN = 2

const HOUR = 60 * 60 * 1000
const now = Date.parse('2026-07-09T18:00:00.000Z')

function row(startOffsetMs: number, endOffsetMs: number, status: string, id = 'slot') {
  return {
    path: `projects/p/databases/(default)/documents/slots/${id}`,
    data: {
      status,
      startTime: new Date(now + startOffsetMs).toISOString(),
      endTime: new Date(now + endOffsetMs).toISOString(),
    },
  }
}

describe('pickActiveSlot', () => {
  it('returns the in-window confirmed slot', () => {
    const active = row(-1 * HOUR, 1 * HOUR, 'confirmed', 'active')
    const rows = [row(-4 * HOUR, -2 * HOUR, 'completed', 'past'), active]
    expect(pickActiveSlot(rows, now)).toBe(active)
  })

  it('returns the in-window live slot', () => {
    const active = row(-1 * HOUR, 1 * HOUR, 'live', 'active')
    expect(pickActiveSlot([active], now)).toBe(active)
  })

  it('ignores in-window slots that are not confirmed/live', () => {
    expect(pickActiveSlot([row(-1 * HOUR, 1 * HOUR, 'open')], now)).toBeNull()
    expect(pickActiveSlot([row(-1 * HOUR, 1 * HOUR, 'completed')], now)).toBeNull()
  })

  it('is inclusive of start and exclusive of end', () => {
    expect(pickActiveSlot([row(0, 2 * HOUR, 'confirmed')], now)).not.toBeNull()
    expect(pickActiveSlot([row(-2 * HOUR, 0, 'live')], now)).toBeNull()
  })

  it('ignores future and past slots and handles empty/missing fields', () => {
    expect(pickActiveSlot([row(1 * HOUR, 3 * HOUR, 'confirmed')], now)).toBeNull()
    expect(pickActiveSlot([], now)).toBeNull()
    expect(pickActiveSlot([{ path: 'slots/x', data: { status: 'live' } }], now)).toBeNull()
  })
})

// ── shouldRunPoll — the single-flight guard on the most expensive function ──
//
// This job is publicly routable in principle (Netlify serves scheduled
// functions at /.netlify/functions/<name>) and every run is billed wall clock
// while calling DexScreener, Twitch and Firestore.
// The guard bounds that. These tests pin BOTH halves of its contract, because
// each has a different failure: too permissive and concurrent runs stack; too
// strict and it rejects the real scheduled run, which would silently stall fee
// tracking, slot lifecycle and token stats.

describe('shouldRunPoll', () => {
  const T = Date.parse('2026-07-09T18:00:00.000Z')
  const iso = (msAgo: number) => new Date(T - msAgo).toISOString()
  /** A lock that last ran `msAgo` and is next due `dueInMs` from now. */
  const lock = (msAgo: number, dueInMs: number) => ({
    startedAt: iso(msAgo),
    nextDueAt: new Date(T + dueInMs).toISOString(),
  })

  it('runs when there is no lock at all (first ever run)', () => {
    expect(shouldRunPoll(undefined, T)).toBe(true)
    expect(shouldRunPoll(null, T)).toBe(true)
  })

  // Two invocations landing together — a scheduler retry, an operator wake
  // racing the cron — must not both run the pass.
  it('collapses a duplicate run that arrives on top of the last one', () => {
    expect(shouldRunPoll({ startedAt: iso(0) }, T)).toBe(false)
    expect(shouldRunPoll({ startedAt: iso(1_000) }, T)).toBe(false)
    expect(shouldRunPoll({ startedAt: iso(OVERLAP_GUARD_MS - 1) }, T)).toBe(false)
  })

  // The overlap guard must sit BELOW the cron period, or it becomes a
  // self-inflicted outage: the scheduled run would arrive and be turned away by
  // the previous scheduled run's own lock.
  it('never blocks the next scheduled run at the cron period', () => {
    expect(OVERLAP_GUARD_MS).toBeLessThan(2 * 60_000)
    expect(shouldRunPoll({ startedAt: iso(2 * 60_000) }, T)).toBe(true)
  })

  // ── Every ambiguous lock RUNS ──
  //
  // The failure that matters is a poll that silently never happens. A wrong
  // guess in this direction costs one invocation; the other direction costs a
  // streamer their fee accrual, with nothing to show why.
  it('runs on an unreadable or garbled lock rather than stalling the poller', () => {
    expect(shouldRunPoll({ startedAt: 'not a date' }, T)).toBe(true)
    expect(shouldRunPoll({ startedAt: '' }, T)).toBe(true)
    expect(shouldRunPoll({}, T)).toBe(true)
  })

  // Clock skew between containers must not be able to park the lock in the
  // future and wedge the poller off indefinitely.
  it('runs when the lock is dated in the future', () => {
    expect(shouldRunPoll({ startedAt: new Date(T + 10 * 60_000).toISOString() }, T)).toBe(true)
  })

  // A lock with a start time but no due time is a pass that never got to write
  // its verdict. That is not evidence the work is done.
  it('runs when there is no readable due time', () => {
    expect(shouldRunPoll({ startedAt: iso(5 * 60_000) }, T)).toBe(true)
    expect(shouldRunPoll({ startedAt: iso(5 * 60_000), nextDueAt: 'garbage' }, T)).toBe(true)
    expect(shouldRunPoll({ startedAt: iso(5 * 60_000), nextDueAt: '' }, T)).toBe(true)
  })

  // ── The duty cycle: where the Netlify bill went ──
  //
  // The previous version of this was a boolean, and it did almost nothing:
  // "cold" required that NOBODY on the roster was live anywhere on Twitch, which
  // on a real network is almost never true, so the full pass ran every minute
  // anyway. The tier is now decided by whether a slot is on the clock, and the
  // pass names the minute it is next due.
  it('waits until the due time the last pass named', () => {
    expect(shouldRunPoll(lock(5 * 60_000, 60_000), T)).toBe(false)
    expect(shouldRunPoll(lock(5 * 60_000, 1), T)).toBe(false)
    expect(shouldRunPoll(lock(5 * 60_000, 0), T)).toBe(true)
    expect(shouldRunPoll(lock(5 * 60_000, -1), T)).toBe(true)
  })

  // The overlap guard outranks a due time: a pass that started two seconds ago
  // is still running, whatever the previous one asked for.
  it('holds the overlap guard even when the due time has passed', () => {
    expect(shouldRunPoll(lock(2_000, -60_000), T)).toBe(false)
  })
})

describe('nextDueAtMs', () => {
  const T = Date.parse('2026-07-09T18:00:00.000Z')

  // A slot on the clock is an hour that decides money. Airtime is scored on
  // samples taken (AIRTIME_MIN_SAMPLES = 10), so a hot pass must never defer
  // the next one.
  it('never defers the next pass while a slot is on the clock', () => {
    expect(nextDueAtMs('hot', T, null)).toBe(T)
    expect(TIER_INTERVAL_MS.hot).toBe(0)
  })

  it('backs off further when the channel is cold than when it is warm', () => {
    expect(nextDueAtMs('warm', T, null)).toBe(T + TIER_INTERVAL_MS.warm)
    expect(nextDueAtMs('cold', T, null)).toBe(T + TIER_INTERVAL_MS.cold)
    expect(TIER_INTERVAL_MS.cold).toBeGreaterThan(TIER_INTERVAL_MS.warm)
  })

  // THE ONE THAT STOPS AN IDLE CHANNEL SLEEPING THROUGH A BOOKED HOUR. Without
  // this cap a ten-minute cold interval could start an assigned slot ten minutes
  // late, costing real airtime samples on a slot that pays somebody.
  it('wakes for the next slot rather than sleeping out the tier interval', () => {
    const slotStart = T + 90_000
    expect(nextDueAtMs('cold', T, slotStart)).toBe(slotStart)
    expect(nextDueAtMs('warm', T, slotStart)).toBe(slotStart)
  })

  it('ignores a slot start that is not sooner than the tier interval', () => {
    expect(nextDueAtMs('cold', T, T + 60 * 60_000)).toBe(T + TIER_INTERVAL_MS.cold)
  })

  // A past or unreadable slot start must not pull the due time backwards into a
  // permanent every-tick run, which would undo the whole saving.
  it('ignores a past, missing or unreadable next slot', () => {
    expect(nextDueAtMs('cold', T, T - 60_000)).toBe(T + TIER_INTERVAL_MS.cold)
    expect(nextDueAtMs('cold', T, null)).toBe(T + TIER_INTERVAL_MS.cold)
    expect(nextDueAtMs('cold', T, undefined)).toBe(T + TIER_INTERVAL_MS.cold)
    expect(nextDueAtMs('cold', T, NaN)).toBe(T + TIER_INTERVAL_MS.cold)
  })
})

// ── slotAirtime — where the payable fraction meets a real slot ──
//
// payableAirtime decides the rule (see feeCalc.test.ts); this decides whether
// the rule reaches a given slot at all. Getting that wrong means re-scoring an
// hour that already settled under different terms.

describe('slotAirtime', () => {
  const cutover = Date.parse('2026-09-01T00:00:00.000Z')
  const slot = (startTime: string, activity?: Record<string, number>) => ({ startTime, streamActivity: activity })

  it('does not reach a slot that started before the cutover', () => {
    expect(slotAirtime(slot('2026-08-31T22:00:00.000Z', { liveCheckCount: 0, checkCount: 60 }), cutover)).toBeNull()
    // Even a flagrant no-show: those terms were already settled, and changing
    // what a finished hour owed after the fact is the thing we do not do.
    expect(slotAirtime(slot('2020-01-01T00:00:00.000Z', { liveCheckCount: 0, checkCount: 120 }), cutover)).toBeNull()
  })

  it('scores a slot that started on or after the cutover', () => {
    const verdict = slotAirtime(slot('2026-09-01T04:00:00.000Z', { liveCheckCount: 30, checkCount: 60 }), cutover)
    expect(verdict).toMatchObject({ reason: 'prorated', liveCheckCount: 30, checkCount: 60 })
    expect(verdict!.fraction).toBeCloseTo(0.5, 10)
  })

  it('carries the counts it judged on, so the stored verdict is checkable', () => {
    const verdict = slotAirtime(slot('2026-09-02T00:00:00.000Z', { liveCheckCount: 58, checkCount: 60 }), cutover)
    expect(verdict).toEqual({ liveCheckCount: 58, checkCount: 60, ratio: 58 / 60, fraction: 1, reason: 'full' })
  })

  it('fails open on a slot with no activity log at all', () => {
    expect(slotAirtime(slot('2026-09-02T00:00:00.000Z'), cutover)).toMatchObject({ reason: 'unverified', fraction: 1 })
  })

  // A slot that was mid-flight when this shipped has live samples but no
  // denominator. Backfilling the denominator from them lands on full credit
  // rather than inventing a penalty out of a schema change.
  it('backfills a missing denominator instead of penalising the streamer', () => {
    const verdict = slotAirtime(slot('2026-09-01T12:00:00.000Z', { liveCheckCount: 44 }), cutover)
    expect(verdict).toMatchObject({ checkCount: 44, fraction: 1, reason: 'full' })
  })

  it('ignores a slot with no readable start time', () => {
    expect(slotAirtime({ streamActivity: { liveCheckCount: 0, checkCount: 60 } }, cutover)).toBeNull()
  })
})

// ── creditMinutes — the payout denominator, and the cron period ─────────────
//
// This is the guard that makes the cron rate a COST decision instead of a
// PAYOUT decision. The roster sampler used to add a literal `+ 1` per pass,
// which silently encoded "the poller runs once a minute" into every member's
// minute counter. Nothing said so and nothing checked it, so slowing the cron
// to save credits would have under-credited every streamer on the network by
// exactly that factor — not with an error, but with smaller numbers that looked
// entirely plausible.
describe('creditMinutes', () => {
  const T = Date.parse('2026-07-09T18:00:00.000Z')
  const ago = (ms: number) => new Date(T - ms).toISOString()

  // The first sample of a live run has nothing to measure against.
  it('credits a single minute when there is no previous observation', () => {
    expect(creditMinutes(undefined, T)).toBe(1)
    expect(creditMinutes('', T)).toBe(1)
    expect(creditMinutes('not a date', T)).toBe(1)
  })

  // Clock skew must not produce a negative gap and quietly erase minutes.
  it('credits a single minute when the last observation is in the future', () => {
    expect(creditMinutes(new Date(T + 60_000).toISOString(), T)).toBe(1)
  })

  // The behaviour that makes the cron period safe to change: the same wall
  // clock pays the same minutes at any cadence.
  it('credits the measured gap, so the cadence does not change the total', () => {
    expect(creditMinutes(ago(60_000), T)).toBe(1)
    expect(creditMinutes(ago(2 * 60_000), T)).toBe(2)
    expect(creditMinutes(ago(3 * 60_000), T)).toBe(3)
  })

  // Six passes at one minute and three passes at two minutes must pay the same
  // six minutes. This is the property the whole change rests on.
  it('pays the same total for the same wall clock at either cadence', () => {
    const perMinute = Array.from({ length: 6 }, () => creditMinutes(ago(60_000), T))
    const perTwoMinutes = Array.from({ length: 3 }, () => creditMinutes(ago(2 * 60_000), T))
    expect(perMinute.reduce((a, b) => a + b, 0)).toBe(6)
    expect(perTwoMinutes.reduce((a, b) => a + b, 0)).toBe(6)
  })

  // A retry, or an operator waking the poller, must not pay the same minute
  // twice.
  it('credits nothing for a second sample inside the same minute', () => {
    expect(creditMinutes(ago(0), T)).toBe(0)
    expect(creditMinutes(ago(20_000), T)).toBe(0)
  })

  // A member returning after a break carries an old timestamp. Clamping bounds
  // the over-credit; it fails toward the streamer, which is the posture the
  // roster module already takes for a sample it could not take.
  it('clamps a long gap so an idle stretch cannot pay for itself', () => {
    expect(creditMinutes(ago(60 * 60_000), T)).toBe(MAX_SAMPLE_CREDIT_MIN)
    expect(creditMinutes(ago(24 * 60 * 60_000), T)).toBe(MAX_SAMPLE_CREDIT_MIN)
  })

  // The clamp has to cover the cron period, or every ordinary pass would be
  // truncated and under-credit exactly the way the old `+ 1` did.
  it('clamps no tighter than the cron period', () => {
    expect(MAX_SAMPLE_CREDIT_MIN).toBeGreaterThanOrEqual(CRON_PERIOD_MIN)
  })
})
