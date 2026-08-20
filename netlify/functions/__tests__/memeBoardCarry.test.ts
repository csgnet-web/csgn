import { describe, it, expect } from 'vitest'
import { topUpBoard, MEME_CARRY_MAX_AGE_MS } from '../_shared/memeBoard'

/**
 * The guarantee these tests exist for: **the board cannot shrink.**
 *
 * "The Meme 100 only loaded three tokens" has been reported more times than any
 * other problem on this project. Every previous fix addressed a cause —
 * thresholds, re-fetch starvation, the wrong source endpoint, shape-dependent
 * parsing — and every one of them was real. None could promise the symptom
 * would not return, because the board depends on third-party feeds that will
 * eventually have a bad five minutes.
 *
 * topUpBoard addresses the symptom, which is the only thing that can actually
 * be guaranteed. These tests are that guarantee.
 */

interface TestCoin {
  address: string
  symbol: string
  volumeH24Usd: number
  tier: string
  carriedFrom?: string
}

const coin = (address: string, extra: Partial<TestCoin> = {}): TestCoin => ({
  address, symbol: address.toUpperCase(), volumeH24Usd: 1, tier: 'core', ...extra,
})

const NOW = Date.parse('2026-08-20T12:00:00.000Z')
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString()

describe('topUpBoard', () => {
  it('leaves a full board alone', () => {
    const fresh = Array.from({ length: 100 }, (_, i) => coin(`m${i}`))
    const prev = [coin('old')]
    expect(topUpBoard(fresh, prev, iso(60_000), 100, NOW)).toHaveLength(100)
    expect(topUpBoard(fresh, prev, iso(60_000), 100, NOW).some((c) => c.address === 'old')).toBe(false)
  })

  // THE ONE THAT MATTERS. Three fresh coins must not replace a good board.
  it('tops a three-coin build back up to a hundred', () => {
    const fresh = [coin('a'), coin('b'), coin('c')]
    const prev = Array.from({ length: 100 }, (_, i) => coin(`p${i}`))
    const out = topUpBoard(fresh, prev, iso(60_000), 100, NOW)
    expect(out).toHaveLength(100)
    // Fresh data leads — the carried rows fill in behind it.
    expect(out.slice(0, 3).map((c) => c.address)).toEqual(['a', 'b', 'c'])
  })

  it('never duplicates a coin that is in both', () => {
    const fresh = [coin('a'), coin('b')]
    const prev = [coin('b'), coin('c'), coin('d')]
    const out = topUpBoard(fresh, prev, iso(60_000), 100, NOW)
    expect(out.map((c) => c.address)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('respects the size cap when topping up', () => {
    const fresh = [coin('a')]
    const prev = Array.from({ length: 50 }, (_, i) => coin(`p${i}`))
    expect(topUpBoard(fresh, prev, iso(60_000), 10, NOW)).toHaveLength(10)
  })

  // Held data is MARKED. Presenting stale numbers as live ones would trade one
  // lie for another.
  it('marks every carried row and leaves fresh rows unmarked', () => {
    const out = topUpBoard([coin('a')], [coin('b')], iso(60_000), 100, NOW)
    expect(out[0]).not.toHaveProperty('carriedFrom')
    expect(out[1].carriedFrom).toBe(iso(60_000))
  })

  // A day-old price on a scoreboard is defensible; a week-old one is a lie with
  // a number on it.
  it('refuses to carry from a board that is too old', () => {
    const fresh = [coin('a')]
    const prev = Array.from({ length: 50 }, (_, i) => coin(`p${i}`))
    const out = topUpBoard(fresh, prev, iso(MEME_CARRY_MAX_AGE_MS + 1000), 100, NOW)
    expect(out).toEqual(fresh)
  })

  it('treats an unreadable timestamp as too old', () => {
    expect(topUpBoard([coin('a')], [coin('b')], 'nonsense', 100, NOW)).toHaveLength(1)
    expect(topUpBoard([coin('a')], [coin('b')], null, 100, NOW)).toHaveLength(1)
  })

  // The case a naive age check misses: the board is fresh because we keep
  // rewriting it, but a particular row has been held for days. Preserving the
  // ORIGINAL stamp is what stops a carried row living forever.
  it('ages out a row that has been carried too long, even off a fresh board', () => {
    const stale = coin('ancient', { carriedFrom: iso(MEME_CARRY_MAX_AGE_MS + 60_000) })
    const recent = coin('recent', { carriedFrom: iso(60_000) })
    const out = topUpBoard([coin('a')], [stale, recent], iso(1_000), 100, NOW)
    expect(out.map((c) => c.address)).toEqual(['a', 'recent'])
  })

  it('keeps the original carry stamp rather than resetting it each rebuild', () => {
    const held = coin('held', { carriedFrom: iso(60 * 60_000) })
    const out = topUpBoard([coin('a')], [held], iso(1_000), 100, NOW)
    expect(out[1].carriedFrom).toBe(iso(60 * 60_000))
  })

  it('does nothing useful — but nothing harmful — on a first-ever build', () => {
    expect(topUpBoard([coin('a')], [], null, 100, NOW)).toHaveLength(1)
  })

  it('skips rows with no address rather than carrying a blank', () => {
    const out = topUpBoard([coin('a')], [{ symbol: 'NOPE' } as Partial<TestCoin>, coin('b')], iso(1_000), 100, NOW)
    expect(out.map((c) => c.address)).toEqual(['a', 'b'])
  })
})
