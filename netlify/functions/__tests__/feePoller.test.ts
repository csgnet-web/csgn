import { describe, it, expect } from 'vitest'
import { pickActiveSlot, shouldRunPoll } from '../feePollerBackground'

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
// functions at /.netlify/functions/<name>) and each run holds a container for
// ~45s of billed wall clock while calling DexScreener, Twitch and Firestore.
// The guard bounds that. These tests pin BOTH halves of its contract, because
// each has a different failure: too permissive and concurrent runs stack; too
// strict and it rejects the real scheduled run, which would silently stall fee
// tracking, slot lifecycle and token stats.

describe('shouldRunPoll', () => {
  const T = Date.parse('2026-07-09T18:00:00.000Z')
  const iso = (msAgo: number) => new Date(T - msAgo).toISOString()

  it('runs when there is no lock at all (first ever run)', () => {
    expect(shouldRunPoll(undefined, T)).toBe(true)
  })

  it('blocks a second run that arrives immediately after one started', () => {
    expect(shouldRunPoll(iso(0), T)).toBe(false)
    expect(shouldRunPoll(iso(1_000), T)).toBe(false)
    expect(shouldRunPoll(iso(44_999), T)).toBe(false)
  })

  // The guard must sit BELOW the 60s cron period, or it becomes a self-inflicted
  // outage: the scheduled run would arrive and be turned away by the previous
  // scheduled run's own lock.
  it('never blocks the next scheduled run at the 60s cron period', () => {
    expect(shouldRunPoll(iso(60_000), T)).toBe(true)
    expect(shouldRunPoll(iso(45_000), T)).toBe(true)
  })

  it('runs on an unreadable or garbled lock rather than stalling the poller', () => {
    expect(shouldRunPoll('not a date', T)).toBe(true)
    expect(shouldRunPoll('', T)).toBe(true)
  })

  // Clock skew between containers must not be able to park the lock in the
  // future and wedge the poller off indefinitely.
  it('runs when the lock is dated in the future', () => {
    expect(shouldRunPoll(new Date(T + 10 * 60_000).toISOString(), T)).toBe(true)
  })
})
