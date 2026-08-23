import { describe, it, expect } from 'vitest'
import { readAirtime, airtimeLabel, airtimeNote, airtimeTone, type SlotAirtime } from './airtime'

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

describe('airtimeLabel', () => {
  it('shows both halves — live samples over samples taken', () => {
    expect(airtimeLabel(verdict())).toBe('42/48 min live')
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
