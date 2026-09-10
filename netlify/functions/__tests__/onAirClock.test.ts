import { describe, it, expect } from 'vitest'
import { onAirSinceMs, onAirMinutes, onAirSeconds, formatOnAir, type OnAirSlot } from '../_shared/onAirClock'
import { creditSeconds, MAX_LIVE_CREDIT_SECONDS } from '../feePollerBackground'

const at = (iso: string) => Date.parse(iso)
const NOW = at('2026-09-10T21:00:00.000Z')

/** A two-hour block, 8–10 PM, with somebody put on at 8:47. */
const slot = (over: Partial<OnAirSlot> = {}): OnAirSlot => ({
  startTime: '2026-09-10T20:00:00.000Z',
  onAirAt: '2026-09-10T20:47:00.000Z',
  assignedUid: 'u1',
  status: 'live',
  ...over,
})

describe('onAirMinutes — how long THIS CUT has been running', () => {
  it('measures from the moment they were put on, not the block start', () => {
    // The bug: this answered 60 (the block began an hour ago) instead of 13.
    expect(onAirMinutes(slot(), NOW)).toBe(13)
  })

  it('is zero the instant somebody goes on', () => {
    expect(onAirMinutes(slot({ onAirAt: '2026-09-10T21:00:00.000Z' }), NOW)).toBe(0)
  })

  it('falls back to the block start only when nothing was stamped', () => {
    // Slots written before the stamp existed. Wrong in the way it was always
    // wrong, for a shrinking set of old documents.
    expect(onAirMinutes(slot({ onAirAt: undefined }), NOW)).toBe(60)
    expect(onAirMinutes(slot({ onAirAt: null }), NOW)).toBe(60)
    expect(onAirMinutes(slot({ onAirAt: '' }), NOW)).toBe(60)
  })

  it('is zero when nobody is on the hour', () => {
    expect(onAirMinutes(slot({ assignedUid: null, isGuest: null }), NOW)).toBe(0)
    expect(onAirMinutes(null, NOW)).toBe(0)
    expect(onAirMinutes(undefined, NOW)).toBe(0)
  })

  it('counts a guest, who has no uid', () => {
    expect(onAirMinutes(slot({ assignedUid: null, isGuest: true }), NOW)).toBe(13)
  })

  it('stops once the hour is completed', () => {
    expect(onAirMinutes(slot({ status: 'completed' }), NOW)).toBe(0)
  })

  it('refuses a stamp in the future rather than reporting a negative', () => {
    // Clock skew. "Unknown" beats "zero minutes" on a stream that has been
    // running for an hour — so it falls through to the block start.
    expect(onAirSinceMs(slot({ onAirAt: '2026-09-10T23:00:00.000Z' }), NOW)).toBe(at('2026-09-10T20:00:00.000Z'))
  })

  it('answers null when neither timestamp can be read', () => {
    expect(onAirSinceMs(slot({ onAirAt: 'nonsense', startTime: 'nonsense' }), NOW)).toBeNull()
    expect(onAirMinutes(slot({ onAirAt: 'nonsense', startTime: 'nonsense' }), NOW)).toBe(0)
  })

  it('reports seconds for the surfaces that tick', () => {
    expect(onAirSeconds(slot({ onAirAt: '2026-09-10T20:59:30.000Z' }), NOW)).toBe(30)
  })
})

describe('formatOnAir', () => {
  it('reads at a glance from across a room', () => {
    expect(formatOnAir(0)).toBe('0m')
    expect(formatOnAir(47)).toBe('47m')
    expect(formatOnAir(60)).toBe('1h 00m')
    expect(formatOnAir(64)).toBe('1h 04m')
    expect(formatOnAir(185)).toBe('3h 05m')
  })

  it('never renders a negative', () => {
    expect(formatOnAir(-5)).toBe('0m')
  })
})

/**
 * The other half of the bug: a SAMPLE is not a MINUTE. The poller runs every
 * two minutes and defers to four or ten when the channel is quiet, so time has
 * to be credited from the measured gap.
 */
describe('creditSeconds', () => {
  const now = at('2026-09-10T21:00:00.000Z')

  it('credits the real gap between samples', () => {
    expect(creditSeconds('2026-09-10T20:58:00.000Z', now)).toBe(120)
    expect(creditSeconds('2026-09-10T20:50:00.000Z', now)).toBe(600)
  })

  it('credits nothing without a previous observation', () => {
    // The first sample of a live run has no gap behind it, so it buys nothing —
    // the second one credits the interval between them.
    expect(creditSeconds(undefined, now)).toBe(0)
    expect(creditSeconds('', now)).toBe(0)
    expect(creditSeconds('nonsense', now)).toBe(0)
  })

  it('credits nothing for two samples inside the same second', () => {
    expect(creditSeconds('2026-09-10T21:00:00.000Z', now)).toBe(0)
  })

  it('refuses a future timestamp', () => {
    expect(creditSeconds('2026-09-10T22:00:00.000Z', now)).toBe(0)
  })

  it('caps a long outage rather than crediting airtime nobody observed', () => {
    // The poller down for an hour must not hand back an hour of "live".
    expect(creditSeconds('2026-09-10T19:00:00.000Z', now)).toBe(MAX_LIVE_CREDIT_SECONDS)
  })

  it('credits the coldest legitimate interval in full', () => {
    // The cold tier is ten minutes; the cap is twelve, so a genuinely slow pass
    // is never docked.
    expect(creditSeconds('2026-09-10T20:50:00.000Z', now)).toBe(600)
    expect(600).toBeLessThan(MAX_LIVE_CREDIT_SECONDS)
  })
})
