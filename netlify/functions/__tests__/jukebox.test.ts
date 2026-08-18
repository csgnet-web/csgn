import { describe, it, expect } from 'vitest'
import {
  nextJukeboxFloor, jukeboxBidLive,
  JUKEBOX_BASE_FLOOR_CSGN, JUKEBOX_MIN_RAISE, JUKEBOX_TTL_MS,
} from '../_shared/jukebox'

const NOW = Date.parse('2026-08-18T12:00:00.000Z')
const ago = (ms: number) => new Date(NOW - ms).toISOString()

describe('nextJukeboxFloor', () => {
  it('opens at the base floor when nothing is standing', () => {
    expect(nextJukeboxFloor({ bidCsgn: 0, bidAt: null }, 250_000, NOW)).toBe(250_000)
  })

  it('makes the next bid clear the standing one by the raise', () => {
    const floor = nextJukeboxFloor({ bidCsgn: 1_000_000, bidAt: ago(60_000) }, 250_000, NOW)
    expect(floor).toBe(Math.ceil(1_000_000 * JUKEBOX_MIN_RAISE))
    expect(floor).toBeGreaterThan(1_000_000)
  })

  it('rounds the raise UP, so the published number is never under the real one', () => {
    // 333 * 1.15 = 382.95 — a floor of 382 would be rejected on-chain by 0.95.
    expect(nextJukeboxFloor({ bidCsgn: 333, bidAt: ago(60_000) }, 1, NOW)).toBe(383)
  })

  it('reopens at the floor once the standing bid expires', () => {
    const expired = { bidCsgn: 9_000_000, bidAt: ago(JUKEBOX_TTL_MS + 1000) }
    expect(nextJukeboxFloor(expired, 250_000, NOW)).toBe(250_000)
  })

  it('still honours a bid one second before it expires', () => {
    const nearly = { bidCsgn: 1_000_000, bidAt: ago(JUKEBOX_TTL_MS - 1000) }
    expect(nextJukeboxFloor(nearly, 250_000, NOW)).toBeGreaterThan(1_000_000)
  })

  it('never returns less than the base floor, even for a tiny standing bid', () => {
    expect(nextJukeboxFloor({ bidCsgn: 10, bidAt: ago(60_000) }, 250_000, NOW)).toBe(250_000)
  })

  it('falls back to the built-in floor for a junk configured one', () => {
    expect(nextJukeboxFloor({ bidCsgn: 0, bidAt: null }, 0, NOW)).toBe(JUKEBOX_BASE_FLOOR_CSGN)
    expect(nextJukeboxFloor({ bidCsgn: 0, bidAt: null }, Number.NaN, NOW)).toBe(JUKEBOX_BASE_FLOOR_CSGN)
  })

  it('ignores an unparseable timestamp rather than trusting the amount', () => {
    expect(nextJukeboxFloor({ bidCsgn: 9_000_000, bidAt: 'soon' }, 250_000, NOW)).toBe(250_000)
  })
})

describe('jukeboxBidLive', () => {
  it('is true inside the window and false outside it', () => {
    expect(jukeboxBidLive({ bidCsgn: 500_000, bidAt: ago(60_000) }, NOW)).toBe(true)
    expect(jukeboxBidLive({ bidCsgn: 500_000, bidAt: ago(JUKEBOX_TTL_MS + 1) }, NOW)).toBe(false)
  })

  it('is false with no bid at all', () => {
    expect(jukeboxBidLive({ bidCsgn: 0, bidAt: ago(60_000) }, NOW)).toBe(false)
    expect(jukeboxBidLive({ bidCsgn: 500_000, bidAt: null }, NOW)).toBe(false)
  })
})
