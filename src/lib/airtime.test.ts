import { describe, it, expect } from 'vitest'
import { readAirtime, airtimeLabel, airtimeNote, airtimeTone, liveDuration, type SlotAirtime } from './airtime'

const verdict = (over: Partial<SlotAirtime> = {}): SlotAirtime => ({
  liveCheckCount: 42,
  checkCount: 48,
  ratio: 42 / 48,
  fraction: 1,
  reason: 'full',
  ...over,
})

describe('readAirtime', () => {
  it('reads a verdict the poller wrote', () => {
    expect(readAirtime(verdict())).toEqual(verdict())
  })

  it('returns null for a slot that ran before verified airtime shipped', () => {
    expect(readAirtime(undefined)).toBeNull()
    expect(readAirtime(null)).toBeNull()
    expect(readAirtime({})).toBeNull()
    // Half a verdict is worse than none — it would render a confident number
    // with nothing behind it.
    expect(readAirtime({ reason: 'full' })).toBeNull()
    expect(readAirtime({ fraction: 1 })).toBeNull()
  })
})

describe('liveDuration — the real one', () => {
  it('reads the measured seconds, not a sample count', () => {
    expect(liveDuration({ liveSeconds: 0 })).toBeNull()
    expect(liveDuration({ liveSeconds: 47 * 60 })).toBe('47m')
    expect(liveDuration({ liveSeconds: 107 * 60 })).toBe('1h 47m')
    expect(liveDuration({ liveSeconds: 60 * 60 })).toBe('1h 00m')
  })

  it('is null for a slot that predates the measurement', () => {
    // Honest: a slot with no liveSeconds genuinely does not know its duration,
    // and inferring one from the sample count is the bug this replaced.
    expect(liveDuration({})).toBeNull()
    expect(liveDuration(null)).toBeNull()
    expect(liveDuration(undefined)).toBeNull()
    expect(liveDuration({ liveSeconds: Number.NaN })).toBeNull()
  })
})

describe('airtimeLabel', () => {
  it('shows both halves — live samples over samples taken', () => {
    expect(airtimeLabel(verdict())).toBe('42 of 48 checks live')
  })

  it('says CHECKS, never minutes', () => {
    // It read "42/48 min live" for as long as it existed, which was true only
    // while the poller ran every minute. It runs every two and backs off to ten
    // when the channel is quiet, so the same stream reported anywhere between a
    // half and a twelfth of its real airtime. The ratio was always right; the
    // unit was the lie.
    expect(airtimeLabel(verdict())).not.toMatch(/\bmin\b/)
  })

  it('has nothing to say without a verdict or a denominator', () => {
    expect(airtimeLabel(null)).toBeNull()
    expect(airtimeLabel(verdict({ liveCheckCount: 0, checkCount: 0 }))).toBeNull()
  })
})

describe('airtimeNote', () => {
  it('explains each verdict in one sentence', () => {
    expect(airtimeNote(verdict({ reason: 'full' }))).toMatch(/in full/)
    expect(airtimeNote(verdict({ reason: 'prorated', fraction: 0.63 }))).toBe(
      'Pro-rated to 63% — the share of checks that found you live.',
    )
    expect(airtimeNote(verdict({ reason: 'no_show', fraction: 0 }))).toMatch(/offline/)
    // Thin telemetry is our failure, and the copy has to say the streamer was
    // still paid — otherwise the flag reads as an accusation.
    expect(airtimeNote(verdict({ reason: 'unverified' }))).toMatch(/paid in full/)
  })

  it('says nothing when there is no verdict', () => {
    expect(airtimeNote(null)).toBeNull()
  })
})

describe('airtimeTone', () => {
  it('only paints a no-show red', () => {
    expect(airtimeTone(verdict({ reason: 'full' }))).toContain('emerald')
    expect(airtimeTone(verdict({ reason: 'prorated' }))).toContain('amber')
    expect(airtimeTone(verdict({ reason: 'no_show' }))).toContain('red')
    expect(airtimeTone(verdict({ reason: 'unverified' }))).toContain('gray')
    expect(airtimeTone(null)).toContain('gray')
  })
})
