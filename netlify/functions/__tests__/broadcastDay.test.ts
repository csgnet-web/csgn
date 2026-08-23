import { describe, it, expect } from 'vitest'
import {
  broadcastDayKey, broadcastDayBounds, nextBroadcastDay, broadcastDayWindow,
  BROADCAST_DAY_START_HOUR_ET,
} from '../_shared/broadcastDay'

/** A moment expressed as an ET WALL-CLOCK time, for readable fixtures.
 *  August is EDT (UTC-4); January is EST (UTC-5). Built with Date.UTC so an
 *  hour that carries past 24 rolls the date properly instead of producing an
 *  unparseable string — `2026-08-19T27:45:00Z` is not a time. */
const edt = (day: number, hour: number, minute = 0) =>
  Date.UTC(2026, 7, day, hour + 4, minute, 0)
const est = (day: number, hour: number) =>
  Date.UTC(2026, 0, day, hour + 5, 0, 0)

describe('broadcastDayKey', () => {
  it('rolls at 2 AM ET, not at midnight', () => {
    expect(broadcastDayKey(edt(19, 1, 59))).toBe('2026-08-18')
    expect(broadcastDayKey(edt(19, 2, 0))).toBe('2026-08-19')
    expect(broadcastDayKey(edt(19, 2, 1))).toBe('2026-08-19')
  })

  it('keeps the small hours with the day that started the night before', () => {
    // 12:30 AM on the 20th is still the 19th's programming — getting this
    // backwards puts every late-night segment in the wrong day's report.
    expect(broadcastDayKey(edt(20, 0, 30))).toBe('2026-08-19')
    expect(broadcastDayKey(edt(19, 23, 45))).toBe('2026-08-19')
  })

  it('holds through the middle of the day', () => {
    for (const hour of [3, 9, 12, 17, 21]) {
      expect(broadcastDayKey(edt(19, hour))).toBe('2026-08-19')
    }
  })

  it('works in winter, when ET is UTC-5', () => {
    expect(broadcastDayKey(est(15, 1))).toBe('2026-01-14')
    expect(broadcastDayKey(est(15, 3))).toBe('2026-01-15')
  })
})

describe('broadcastDayBounds', () => {
  it('spans exactly one 2 AM to the next', () => {
    const { startMs, endMs } = broadcastDayBounds('2026-08-19')
    expect(startMs).toBe(edt(19, BROADCAST_DAY_START_HOUR_ET))
    expect(endMs).toBe(edt(20, BROADCAST_DAY_START_HOUR_ET))
    expect(endMs - startMs).toBe(24 * 60 * 60 * 1000)
  })

  it('contains every moment that maps to its key, and none that do not', () => {
    const { startMs, endMs } = broadcastDayBounds('2026-08-19')
    for (const ms of [startMs, startMs + 1, edt(19, 14), endMs - 1]) {
      expect(broadcastDayKey(ms)).toBe('2026-08-19')
    }
    expect(broadcastDayKey(startMs - 1)).toBe('2026-08-18')
    expect(broadcastDayKey(endMs)).toBe('2026-08-20')
  })

  // ── DST ──
  //
  // The property that actually matters across a clock change is not that a day
  // is exactly 23 or 25 hours — 2 AM is inside the skipped/repeated hour, so
  // what a "2 AM boundary" means on those two days is genuinely ambiguous.
  // What matters is that the days still TILE: every moment belongs to exactly
  // one day, consecutive days meet exactly, and none of them is absurd. A
  // gap would silently drop allocations; an overlap would double-count them.
  it('tiles without gaps or overlaps across the spring-forward day', () => {
    const prev = broadcastDayBounds('2026-03-07')
    const day = broadcastDayBounds('2026-03-08')
    const next = broadcastDayBounds('2026-03-09')
    expect(day.startMs).toBe(prev.endMs)
    expect(day.endMs).toBe(next.startMs)
    expect(day.endMs - day.startMs).toBeGreaterThanOrEqual(23 * 60 * 60 * 1000)
    expect(day.endMs - day.startMs).toBeLessThanOrEqual(24 * 60 * 60 * 1000)
  })

  it('tiles without gaps or overlaps across the fall-back day', () => {
    const prev = broadcastDayBounds('2026-10-31')
    const day = broadcastDayBounds('2026-11-01')
    const next = broadcastDayBounds('2026-11-02')
    expect(day.startMs).toBe(prev.endMs)
    expect(day.endMs).toBe(next.startMs)
    expect(day.endMs - day.startMs).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000)
    expect(day.endMs - day.startMs).toBeLessThanOrEqual(25 * 60 * 60 * 1000)
  })

  it('assigns every moment across a DST change to exactly one day', () => {
    // Walk ten-minute steps through both transitions and assert the key
    // agrees with the bounds it claims to be inside.
    for (const start of [Date.UTC(2026, 2, 7, 0, 0), Date.UTC(2026, 9, 31, 0, 0)]) {
      for (let ms = start; ms < start + 3 * 24 * 60 * 60 * 1000; ms += 10 * 60 * 1000) {
        const key = broadcastDayKey(ms)
        const { startMs, endMs } = broadcastDayBounds(key)
        expect(ms).toBeGreaterThanOrEqual(startMs)
        expect(ms).toBeLessThan(endMs)
      }
    }
  })
})

describe('nextBroadcastDay', () => {
  it('advances one calendar day', () => {
    expect(nextBroadcastDay('2026-08-19')).toBe('2026-08-20')
  })

  it('crosses a month boundary', () => {
    expect(nextBroadcastDay('2026-08-31')).toBe('2026-09-01')
  })

  it('crosses a year boundary', () => {
    expect(nextBroadcastDay('2026-12-31')).toBe('2027-01-01')
  })

  it('handles a leap day', () => {
    expect(nextBroadcastDay('2028-02-28')).toBe('2028-02-29')
    expect(nextBroadcastDay('2028-02-29')).toBe('2028-03-01')
  })

  it('does not slip across a DST change', () => {
    expect(nextBroadcastDay('2026-03-07')).toBe('2026-03-08')
    expect(nextBroadcastDay('2026-03-08')).toBe('2026-03-09')
    expect(nextBroadcastDay('2026-10-31')).toBe('2026-11-01')
    expect(nextBroadcastDay('2026-11-01')).toBe('2026-11-02')
  })
})

describe('broadcastDayWindow', () => {
  it('counts down to the next cutover', () => {
    const w = broadcastDayWindow(edt(19, 20))
    expect(w.key).toBe('2026-08-19')
    // 8 PM ET to 2 AM ET is six hours.
    expect(w.msUntilNextLock).toBe(6 * 60 * 60 * 1000)
  })

  it('reports nearly a full day just after a cutover', () => {
    const w = broadcastDayWindow(edt(19, 2, 1))
    expect(w.msUntilNextLock).toBeGreaterThan(23 * 60 * 60 * 1000)
  })

  it('never counts down past zero', () => {
    const { endMs } = broadcastDayBounds('2026-08-19')
    expect(broadcastDayWindow(endMs).msUntilNextLock).toBeGreaterThanOrEqual(0)
  })
})
