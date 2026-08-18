import { describe, it, expect } from 'vitest'
import { parseIsoDuration } from '../_shared/clipMeta'

describe('parseIsoDuration', () => {
  it('reads the shapes YouTube actually returns', () => {
    expect(parseIsoDuration('PT30S')).toBe(30)
    expect(parseIsoDuration('PT1M30S')).toBe(90)
    expect(parseIsoDuration('PT1H2M3S')).toBe(3723)
    expect(parseIsoDuration('PT2M')).toBe(120)
    expect(parseIsoDuration('PT1H')).toBe(3600)
  })

  it('handles fractional seconds and multi-day values without NaN', () => {
    expect(parseIsoDuration('PT10.5S')).toBe(11)
    expect(parseIsoDuration('P1DT1H')).toBe(90_000)
  })

  // Null means "we could not measure it", and the caller falls back to a
  // default length. It must never be confused with a real zero.
  it('returns null for junk or a zero-length value', () => {
    expect(parseIsoDuration('')).toBeNull()
    expect(parseIsoDuration('30 seconds')).toBeNull()
    expect(parseIsoDuration('PT0S')).toBeNull()
    expect(parseIsoDuration(undefined as unknown as string)).toBeNull()
  })
})
