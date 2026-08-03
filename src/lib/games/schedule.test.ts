import { describe, it, expect } from 'vitest'
import {
  normalizeCadence, DEFAULT_CADENCE, normalizeBanner, DEFAULT_BANNER_LINES,
  BANNER_FACES, formatCountdown, resolveBanner, GAME_LABELS,
  type GameBannerDoc,
} from './schedule'

const NOW = Date.parse('2026-08-02T18:00:00.000Z')
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString()

const banner = (over: Partial<GameBannerDoc> = {}): GameBannerDoc => normalizeBanner({
  mode: 'manual',
  game: 'starting5',
  headline: 'STARTING 5',
  countdownLabel: 'LOCKS IN',
  countdownTo: at(90 * 60_000),
  lines: ['A', 'B', 'C', 'D'],
  href: '/participate',
  ...over,
})

describe('cadence', () => {
  it('defaults Squares to a weekly Sunday board', () => {
    expect(DEFAULT_CADENCE.squaresDayET).toBe(0)
    expect(normalizeCadence(null)).toEqual(DEFAULT_CADENCE)
  })

  it('accepts valid overrides', () => {
    const c = normalizeCadence({ squaresDayET: 4, squaresHourET: 20, startingFiveLockHourET: 9 })
    expect(c).toEqual({ squaresDayET: 4, squaresHourET: 20, startingFiveLockHourET: 9 })
  })

  it('rejects out-of-range or junk values per field', () => {
    const c = normalizeCadence({ squaresDayET: 9, squaresHourET: -1, startingFiveLockHourET: 'noon' })
    expect(c).toEqual(DEFAULT_CADENCE)
  })

  it('keeps a valid field when a sibling is junk', () => {
    const c = normalizeCadence({ squaresDayET: 3, squaresHourET: 99 })
    expect(c.squaresDayET).toBe(3)
    expect(c.squaresHourET).toBe(DEFAULT_CADENCE.squaresHourET)
  })
})

describe('banner normalization', () => {
  it('defaults a missing document to auto/none with the stock lines', () => {
    const b = normalizeBanner(null)
    expect(b.mode).toBe('auto')
    expect(b.game).toBe('none')
    expect(b.lines).toEqual([...DEFAULT_BANNER_LINES])
  })

  it('always produces exactly four faces', () => {
    expect(normalizeBanner({ lines: ['ONLY ONE'] }).lines).toEqual(
      ['ONLY ONE', 'ONLY ONE', 'ONLY ONE', 'ONLY ONE'],
    )
    expect(normalizeBanner({ lines: ['A', 'B'] }).lines).toEqual(['A', 'B', 'A', 'B'])
    expect(normalizeBanner({ lines: ['A', 'B', 'C', 'D', 'E', 'F'] }).lines).toHaveLength(BANNER_FACES)
  })

  it('drops blank lines before padding', () => {
    expect(normalizeBanner({ lines: ['A', '   ', 'B'] }).lines).toEqual(['A', 'B', 'A', 'B'])
  })

  it('falls back to the stock lines when every line is blank', () => {
    expect(normalizeBanner({ lines: ['', '  '] }).lines).toEqual([...DEFAULT_BANNER_LINES])
  })

  it('rejects an unknown mode or game rather than rendering them', () => {
    const b = normalizeBanner({ mode: 'chaos', game: 'roulette' })
    expect(b.mode).toBe('auto')
    expect(b.game).toBe('none')
  })

  it('gives the countdown label a sane default', () => {
    expect(normalizeBanner({}).countdownLabel).toBe('STARTS IN')
    expect(normalizeBanner({ countdownLabel: '  ' }).countdownLabel).toBe('STARTS IN')
  })

  it('trims and bounds free text so a paste cannot break the strip', () => {
    const b = normalizeBanner({ headline: `  ${'x'.repeat(500)}  ` })
    expect(b.headline).toHaveLength(120)
  })

  it('names the games', () => {
    expect(GAME_LABELS.starting5).toBe('Starting 5')
    expect(GAME_LABELS.squares).toBe('Squares')
  })
})

describe('countdown formatting', () => {
  it('drops leading units instead of showing zeroes', () => {
    expect(formatCountdown(at(45_000), NOW)!.display).toBe('00:45')
    expect(formatCountdown(at(90 * 60_000), NOW)!.display).toBe('01:30:00')
    expect(formatCountdown(at(50 * 3_600_000), NOW)!.display).toBe('2d 02:00:00')
  })

  it('pads to two digits', () => {
    expect(formatCountdown(at(65_000), NOW)!.display).toBe('01:05')
  })

  it('floors at zero and reports expired', () => {
    const c = formatCountdown(at(-5_000), NOW)!
    expect(c.remainingMs).toBe(0)
    expect(c.display).toBe('00:00')
    expect(c.expired).toBe(true)
  })

  it('flags the final minute as urgent, and not before', () => {
    expect(formatCountdown(at(59_000), NOW)!.urgent).toBe(true)
    expect(formatCountdown(at(61_000), NOW)!.urgent).toBe(false)
    // Expired is not urgent — it's over.
    expect(formatCountdown(at(-1), NOW)!.urgent).toBe(false)
  })

  it('returns null for an unparseable target', () => {
    expect(formatCountdown('', NOW)).toBeNull()
    expect(formatCountdown('soon', NOW)).toBeNull()
  })
})

describe('resolving what the strip renders', () => {
  const fallback = ['F1', 'F2', 'F3', 'F4']

  it('shows the countdown while the clock is running', () => {
    const r = resolveBanner(banner(), NOW, fallback)
    expect(r.kind).toBe('countdown')
    expect(r.headline).toBe('STARTING 5')
    expect(r.label).toBe('LOCKS IN')
    expect(r.countdown!.display).toBe('01:30:00')
    expect(r.game).toBe('starting5')
  })

  it('falls back to the rotating lines once the countdown expires', () => {
    const r = resolveBanner(banner({ countdownTo: at(-1000) }), NOW, fallback)
    expect(r.kind).toBe('rotating')
    expect(r.lines).toEqual(['A', 'B', 'C', 'D'])
  })

  it('rotates when no countdown is set at all', () => {
    const r = resolveBanner(banner({ countdownTo: '' }), NOW, fallback)
    expect(r.kind).toBe('rotating')
  })

  it('yields to the caller fallback when the banner is off', () => {
    const r = resolveBanner(banner({ mode: 'off' }), NOW, fallback)
    expect(r.kind).toBe('rotating')
    expect(r.lines).toEqual(fallback)
    expect(r.game).toBe('none')
  })

  it('treats a missing document exactly like off', () => {
    const r = resolveBanner(null, NOW, fallback)
    expect(r.lines).toEqual(fallback)
  })

  it('always returns four faces, whatever the fallback length', () => {
    expect(resolveBanner(null, NOW, ['ONE']).lines).toEqual(['ONE', 'ONE', 'ONE', 'ONE'])
    expect(resolveBanner(null, NOW, []).lines).toEqual([...DEFAULT_BANNER_LINES])
  })

  it('names the game in the headline when the operator left it blank', () => {
    const r = resolveBanner(banner({ headline: '', game: 'squares' }), NOW, fallback)
    expect(r.headline).toBe('SQUARES')
  })

  it('carries the link through in both shapes', () => {
    expect(resolveBanner(banner(), NOW, fallback).href).toBe('/participate')
    expect(resolveBanner(banner({ countdownTo: '' }), NOW, fallback).href).toBe('/participate')
  })
})
