import { describe, it, expect } from 'vitest'
import {
  normalizeBanner, formatCountdown, resolveBanner,
  DEFAULT_BANNER_LINES, BANNER_FACES, type BroadcastBannerDoc,
} from './broadcastBanner'

const NOW = Date.parse('2026-08-17T12:00:00.000Z')
const inMs = (ms: number) => new Date(NOW + ms).toISOString()

const banner = (over: Partial<BroadcastBannerDoc> = {}): BroadcastBannerDoc =>
  normalizeBanner({ mode: 'manual', headline: 'OPEN STAGE', countdownLabel: 'STARTS IN', ...over })

describe('banner normalization', () => {
  it('defaults a missing document to auto with the stock lines', () => {
    const b = normalizeBanner(null)
    expect(b.mode).toBe('auto')
    expect(b.lines).toEqual([...DEFAULT_BANNER_LINES])
  })

  it('always produces exactly four faces', () => {
    expect(normalizeBanner({ lines: ['ONE'] }).lines).toEqual(['ONE', 'ONE', 'ONE', 'ONE'])
    expect(normalizeBanner({ lines: ['A', 'B'] }).lines).toEqual(['A', 'B', 'A', 'B'])
    expect(normalizeBanner({ lines: ['A', 'B', 'C', 'D', 'E'] }).lines).toHaveLength(BANNER_FACES)
  })

  it('drops blank lines before padding, and falls back when all are blank', () => {
    expect(normalizeBanner({ lines: ['A', '', '   '] }).lines).toEqual(['A', 'A', 'A', 'A'])
    expect(normalizeBanner({ lines: ['', ' '] }).lines).toEqual([...DEFAULT_BANNER_LINES])
  })

  it('rejects an unknown mode rather than rendering it', () => {
    expect(normalizeBanner({ mode: 'sideways' }).mode).toBe('auto')
    expect(normalizeBanner({ mode: 'off' }).mode).toBe('off')
  })

  it('gives the countdown label a sane default', () => {
    expect(normalizeBanner({}).countdownLabel).toBe('STARTS IN')
    expect(normalizeBanner({ countdownLabel: '  LOCKS IN ' }).countdownLabel).toBe('LOCKS IN')
  })

  it('trims and bounds free text so a paste cannot break the strip', () => {
    expect(normalizeBanner({ headline: 'x'.repeat(500) }).headline).toHaveLength(120)
    expect(normalizeBanner({ href: 'y'.repeat(500) }).href).toHaveLength(200)
  })

  // The stock copy goes on the broadcast. It must never advertise something the
  // product does not have — that is exactly how the removed games would have
  // kept airing after their code was deleted.
  it('ships default copy that only claims things the product does', () => {
    const copy = DEFAULT_BANNER_LINES.join(' ').toLowerCase()
    expect(copy).not.toContain('starting 5')
    expect(copy).not.toContain('squares')
  })
})

describe('countdown formatting', () => {
  it('drops leading units instead of showing zeroes', () => {
    expect(formatCountdown(inMs(2 * 86_400_000 + 4 * 3_600_000), NOW)!.display).toBe('2d 04:00:00')
    expect(formatCountdown(inMs(4 * 3_600_000), NOW)!.display).toBe('04:00:00')
    expect(formatCountdown(inMs(15 * 60_000), NOW)!.display).toBe('15:00')
  })

  it('pads to two digits', () => {
    expect(formatCountdown(inMs(65_000), NOW)!.display).toBe('01:05')
  })

  it('floors at zero and reports expired', () => {
    const c = formatCountdown(inMs(-5_000), NOW)!
    expect(c.remainingMs).toBe(0)
    expect(c.expired).toBe(true)
    expect(c.display).toBe('00:00')
  })

  it('flags the final minute as urgent, and not before', () => {
    expect(formatCountdown(inMs(30_000), NOW)!.urgent).toBe(true)
    expect(formatCountdown(inMs(90_000), NOW)!.urgent).toBe(false)
  })

  it('returns null for an unparseable target', () => {
    expect(formatCountdown('soon', NOW)).toBeNull()
    expect(formatCountdown('', NOW)).toBeNull()
  })
})

describe('resolving what the strip renders', () => {
  const fallback = ['FALLBACK ONE', 'FALLBACK TWO'] as const

  it('shows the countdown while the clock is running', () => {
    const r = resolveBanner(banner({ countdownTo: inMs(90_000) }), NOW, fallback)
    expect(r.kind).toBe('countdown')
    expect(r.headline).toBe('OPEN STAGE')
    expect(r.countdown!.display).toBe('01:30')
  })

  it('falls back to the rotating lines once the countdown expires', () => {
    const r = resolveBanner(banner({ countdownTo: inMs(-1), lines: ['A'] }), NOW, fallback)
    expect(r.kind).toBe('rotating')
    expect(r.lines).toEqual(['A', 'A', 'A', 'A'])
  })

  it('rotates when no countdown is set at all', () => {
    expect(resolveBanner(banner({ lines: ['A'] }), NOW, fallback).kind).toBe('rotating')
  })

  it('yields to the caller fallback when off, and treats a missing doc the same', () => {
    const off = resolveBanner(banner({ mode: 'off', lines: ['A'] }), NOW, fallback)
    expect(off.lines).toEqual(['FALLBACK ONE', 'FALLBACK TWO', 'FALLBACK ONE', 'FALLBACK TWO'])
    expect(resolveBanner(null, NOW, fallback).lines).toEqual(off.lines)
  })

  it('always returns four faces, whatever the fallback length', () => {
    expect(resolveBanner(null, NOW, ['ONLY']).lines).toHaveLength(BANNER_FACES)
    expect(resolveBanner(null, NOW, []).lines).toEqual([...DEFAULT_BANNER_LINES])
  })

  it('has a headline to show when the operator left it blank', () => {
    const r = resolveBanner(banner({ headline: '', countdownTo: inMs(90_000) }), NOW, fallback)
    expect(r.headline).toBe('UP NEXT')
  })

  it('carries the link through in both shapes', () => {
    expect(resolveBanner(banner({ href: '/schedule', countdownTo: inMs(90_000) }), NOW, fallback).href).toBe('/schedule')
    expect(resolveBanner(banner({ href: '/schedule' }), NOW, fallback).href).toBe('/schedule')
  })
})
