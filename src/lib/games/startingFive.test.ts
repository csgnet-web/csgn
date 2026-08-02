import { describe, it, expect } from 'vitest'
import {
  TIER_ORDER, tierForMarketCap, validateLineup, lineupAllowance, pickPoints,
  leverageFor, ownershipPercentages, scoreLineup, rankLineups, splitPurse, settleSlate,
  CAPTAIN_MULTIPLIER, MAX_LEVERAGE, FREE_LINEUPS, MAX_LINEUPS, PAYOUT_CURVE_BPS,
  type Slate, type Lineup, type SlateEntry,
} from './startingFive'

const LOCKS = '2026-08-02T18:00:00.000Z'
const beforeLock = Date.parse('2026-08-02T17:00:00.000Z')
const afterLock = Date.parse('2026-08-02T19:00:00.000Z')

const entry = (symbol: string, tier: SlateEntry['tier'], lockPriceUsd = 1): SlateEntry => ({
  symbol, name: symbol, tier, lockPriceUsd, marketCapUsd: 0,
})

const slate = (over: Partial<Slate> = {}): Slate => ({
  id: 'slate-2026-08-02',
  gameDate: '2026-08-02',
  locksAt: LOCKS,
  settlesAt: '2026-08-03T02:00:00.000Z',
  purseCsgn: 1_000_000,
  entries: [
    entry('SOL', 'anchor', 200),
    entry('BONK', 'core', 0.00002),
    entry('CSGN', 'swing', 0.0004),
    entry('DEGEN', 'moonshot', 0.000001),
    entry('WIF', 'core', 2),
  ],
  ...over,
})

const lineup = (over: Partial<Lineup> = {}): Lineup => ({
  id: 'lineup-1',
  wallet: 'WalletA',
  displayName: 'alice',
  picks: [
    { slot: 'anchor', symbol: 'SOL' },
    { slot: 'core', symbol: 'BONK' },
    { slot: 'swing', symbol: 'CSGN' },
    { slot: 'moonshot', symbol: 'DEGEN' },
    { slot: 'wildcard', symbol: 'WIF' },
  ],
  captain: 'CSGN',
  submittedAt: '2026-08-02T17:00:00.000Z',
  ...over,
})

const ctx = (over: Partial<{ nowMs: number; entriesAlreadySubmitted: number; entryAllowance: number }> = {}) =>
  ({ nowMs: beforeLock, entriesAlreadySubmitted: 0, entryAllowance: 3, ...over })

describe('tiers', () => {
  it('bucket by market cap', () => {
    expect(tierForMarketCap(50_000_000_000)).toBe('anchor')
    expect(tierForMarketCap(1_000_000_000)).toBe('anchor')
    expect(tierForMarketCap(500_000_000)).toBe('core')
    expect(tierForMarketCap(50_000_000)).toBe('swing')
    expect(tierForMarketCap(2_000_000)).toBe('moonshot')
    expect(tierForMarketCap(0)).toBe('moonshot')
  })

  it('has exactly five lineup slots', () => {
    expect(TIER_ORDER).toEqual(['anchor', 'core', 'swing', 'moonshot', 'wildcard'])
  })
})

describe('lineup validation', () => {
  it('accepts a legal lineup', () => {
    expect(validateLineup(slate(), lineup(), ctx())).toEqual({ ok: true })
  })

  it('refuses a lineup submitted at or after lock', () => {
    expect(validateLineup(slate(), lineup(), ctx({ nowMs: afterLock })).reason).toBe('slate_locked')
    expect(validateLineup(slate(), lineup(), ctx({ nowMs: Date.parse(LOCKS) })).reason).toBe('slate_locked')
  })

  it('refuses a lineup that is not exactly five picks', () => {
    const short = lineup({ picks: lineup().picks.slice(0, 4) })
    expect(validateLineup(slate(), short, ctx()).reason).toBe('wrong_slot_count')
  })

  it('refuses the same coin twice', () => {
    const dupe = lineup({ picks: [...lineup().picks.slice(0, 4), { slot: 'wildcard', symbol: 'SOL' }] })
    expect(validateLineup(slate(), dupe, ctx()).reason).toBe('duplicate_symbol')
  })

  it('refuses a coin that is not on the slate', () => {
    const off = lineup({ picks: [...lineup().picks.slice(0, 4), { slot: 'wildcard', symbol: 'PEPE' }] })
    expect(validateLineup(slate(), off, ctx()).reason).toBe('unknown_symbol')
  })

  it('refuses a coin in the wrong tier slot', () => {
    const wrong = lineup({
      picks: [
        { slot: 'anchor', symbol: 'BONK' }, // BONK is core
        { slot: 'core', symbol: 'WIF' },
        { slot: 'swing', symbol: 'CSGN' },
        { slot: 'moonshot', symbol: 'DEGEN' },
        { slot: 'wildcard', symbol: 'SOL' },
      ],
    })
    expect(validateLineup(slate(), wrong, ctx()).reason).toBe('tier_mismatch')
  })

  it('lets the wildcard slot take any tier — that is the point of it', () => {
    const wild = lineup({ picks: [...lineup().picks.slice(0, 4), { slot: 'wildcard', symbol: 'WIF' }] })
    expect(validateLineup(slate(), wild, ctx()).ok).toBe(true)
  })

  it('refuses a duplicated slot with a missing one', () => {
    const missing = lineup({
      picks: [
        { slot: 'anchor', symbol: 'SOL' },
        { slot: 'core', symbol: 'BONK' },
        { slot: 'core', symbol: 'WIF' },
        { slot: 'moonshot', symbol: 'DEGEN' },
        { slot: 'wildcard', symbol: 'CSGN' },
      ],
    })
    expect(validateLineup(slate(), missing, ctx()).reason).toBe('missing_slot')
  })

  it('refuses a captain who is not on the roster', () => {
    expect(validateLineup(slate(), lineup({ captain: 'PEPE' }), ctx()).reason).toBe('bad_captain')
  })

  it('refuses once a wallet is at its entry limit', () => {
    expect(validateLineup(slate(), lineup(), ctx({ entriesAlreadySubmitted: 3, entryAllowance: 3 })).reason).toBe('entry_limit')
  })

  it('is case-insensitive about symbols', () => {
    const lower = lineup({
      picks: lineup().picks.map((p) => ({ ...p, symbol: p.symbol.toLowerCase() })),
      captain: 'csgn',
    })
    expect(validateLineup(slate(), lower, ctx()).ok).toBe(true)
  })
})

describe('entry allowance is holdings-based, never a deposit', () => {
  it('gives everyone one free lineup, including a wallet holding nothing', () => {
    expect(lineupAllowance(0, 1_000_000_000)).toBe(FREE_LINEUPS)
  })

  it('caps a whale', () => {
    expect(lineupAllowance(900_000_000, 1_000_000_000)).toBe(MAX_LINEUPS)
  })

  it('is sub-linear', () => {
    const full = lineupAllowance(10_000_000, 1_000_000_000)
    const tiny = lineupAllowance(100_000, 1_000_000_000)
    expect(tiny).toBeGreaterThan(full / 100)
    expect(tiny).toBeLessThanOrEqual(full)
  })
})

describe('scoring', () => {
  it('scores 1 point per 0.1% move, in both directions', () => {
    expect(pickPoints(100, 110)).toBe(100)   // +10%
    expect(pickPoints(100, 90)).toBe(-100)   // -10%
    expect(pickPoints(100, 100)).toBe(0)
    expect(pickPoints(100, 200)).toBe(1000)  // +100%
  })

  it('is safe against a zero or missing lock price', () => {
    expect(pickPoints(0, 10)).toBe(0)
    expect(pickPoints(NaN, 10)).toBe(0)
  })

  it('gives full leverage to an unowned pick and none to a consensus one', () => {
    expect(leverageFor(0)).toBe(MAX_LEVERAGE)
    expect(leverageFor(50)).toBe(1)
    expect(leverageFor(100)).toBe(1)
    expect(leverageFor(25)).toBeCloseTo(1.25)
  })

  it('computes ownership across the field', () => {
    const own = ownershipPercentages([
      lineup({ id: 'a' }),
      lineup({ id: 'b', picks: [...lineup().picks.slice(0, 4), { slot: 'wildcard', symbol: 'WIF' }] }),
    ])
    expect(own.SOL).toBe(100)
    expect(own.WIF).toBe(100)
  })

  it('applies the captain multiplier to gains', () => {
    const s = slate()
    const prices = { SOL: 200, BONK: 0.00002, CSGN: 0.00044, DEGEN: 0.000001, WIF: 2 } // CSGN +10%
    const scored = scoreLineup(s, lineup(), prices, { CSGN: 100 })
    const csgn = scored.picks.find((p) => p.symbol === 'CSGN')!
    expect(csgn.isCaptain).toBe(true)
    expect(csgn.basePoints).toBe(100)
    expect(csgn.points).toBe(100 * CAPTAIN_MULTIPLIER)
  })

  it('does NOT multiply a captained loss — being bold must not be punished 1.5x', () => {
    const s = slate()
    const prices = { SOL: 200, BONK: 0.00002, CSGN: 0.00036, DEGEN: 0.000001, WIF: 2 } // CSGN -10%
    const scored = scoreLineup(s, lineup(), prices, { CSGN: 100 })
    const csgn = scored.picks.find((p) => p.symbol === 'CSGN')!
    expect(csgn.basePoints).toBe(-100)
    expect(csgn.points).toBe(-100)
  })

  it('rewards a contrarian winner over a consensus one at identical performance', () => {
    const s = slate()
    const prices = { SOL: 220, BONK: 0.00002, CSGN: 0.0004, DEGEN: 0.000001, WIF: 2 } // SOL +10%
    const consensus = scoreLineup(s, lineup({ captain: 'BONK' }), prices, { SOL: 100 })
    const contrarian = scoreLineup(s, lineup({ captain: 'BONK' }), prices, { SOL: 0 })
    const a = consensus.picks.find((p) => p.symbol === 'SOL')!
    const b = contrarian.picks.find((p) => p.symbol === 'SOL')!
    expect(b.points).toBeGreaterThan(a.points)
    expect(b.points).toBe(Math.round(100 * MAX_LEVERAGE))
  })

  it('does not leverage a loss — leverage is a free option, not extra variance', () => {
    const s = slate()
    const prices = { SOL: 180, BONK: 0.00002, CSGN: 0.0004, DEGEN: 0.000001, WIF: 2 } // SOL -10%
    const scored = scoreLineup(s, lineup({ captain: 'BONK' }), prices, { SOL: 0 })
    expect(scored.picks.find((p) => p.symbol === 'SOL')!.points).toBe(-100)
  })

  it('treats a missing settle price as unchanged rather than a total loss', () => {
    const scored = scoreLineup(slate(), lineup(), {})
    expect(scored.totalPoints).toBe(0)
  })

  it('a lineup can finish below zero', () => {
    const prices = { SOL: 100, BONK: 0.00001, CSGN: 0.0002, DEGEN: 0.0000005, WIF: 1 }
    expect(scoreLineup(slate(), lineup(), prices).totalPoints).toBeLessThan(0)
  })
})

describe('ranking', () => {
  const scored = (id: string, points: number, wallet = id) =>
    ({ lineupId: id, wallet, displayName: id, picks: [], totalPoints: points, rank: 0 })

  it('ranks highest first', () => {
    const rows = rankLineups(
      [scored('a', 100), scored('b', 300), scored('c', 200)],
      [lineup({ id: 'a' }), lineup({ id: 'b' }), lineup({ id: 'c' })],
    )
    expect(rows.map((r) => r.lineupId)).toEqual(['b', 'c', 'a'])
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3])
  })

  it('gives tied scores an equal rank, with standard competition numbering', () => {
    const rows = rankLineups(
      [scored('a', 300), scored('b', 300), scored('c', 100)],
      [lineup({ id: 'a' }), lineup({ id: 'b' }), lineup({ id: 'c' })],
    )
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 3])
  })

  it('orders tied rows by submission time for display', () => {
    const rows = rankLineups(
      [scored('late', 300), scored('early', 300)],
      [
        lineup({ id: 'late', submittedAt: '2026-08-02T17:59:00.000Z' }),
        lineup({ id: 'early', submittedAt: '2026-08-02T12:00:00.000Z' }),
      ],
    )
    expect(rows[0].lineupId).toBe('early')
    expect(rows.map((r) => r.rank)).toEqual([1, 1])
  })
})

describe('splitting the purse', () => {
  const field = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      lineupId: `l${i}`, wallet: `Wallet${i}`, displayName: `p${i}`,
      picks: [], totalPoints: 1000 - i * 10, rank: i + 1,
    }))

  it('pays out the entire purse, to the token', () => {
    const payouts = splitPurse(field(20), 1_000_000)
    expect(payouts.reduce((s, p) => s + p.payoutCsgn, 0)).toBe(1_000_000)
  })

  it('pays only the curve depth, however big the field', () => {
    expect(splitPurse(field(50), 1_000_000)).toHaveLength(PAYOUT_CURVE_BPS.length)
  })

  it('is top-heavy but pays the tail', () => {
    const payouts = splitPurse(field(20), 1_000_000)
    expect(payouts[0].payoutCsgn).toBeGreaterThan(payouts[1].payoutCsgn)
    expect(payouts[payouts.length - 1].payoutCsgn).toBeGreaterThan(0)
  })

  it('redistributes across a short field instead of the treasury keeping it', () => {
    const payouts = splitPurse(field(3), 1_000_000)
    expect(payouts).toHaveLength(3)
    expect(payouts.reduce((s, p) => s + p.payoutCsgn, 0)).toBe(1_000_000)
  })

  it('splits a tie evenly across the positions it occupies', () => {
    const tied = [
      { lineupId: 'a', wallet: 'A', displayName: 'a', picks: [], totalPoints: 500, rank: 1 },
      { lineupId: 'b', wallet: 'B', displayName: 'b', picks: [], totalPoints: 500, rank: 1 },
      { lineupId: 'c', wallet: 'C', displayName: 'c', picks: [], totalPoints: 100, rank: 3 },
    ]
    const payouts = splitPurse(tied, 1_000_000)
    const a = payouts.find((p) => p.wallet === 'A')!
    const b = payouts.find((p) => p.wallet === 'B')!
    // Equal to within the single token of rounding dust handed to first place.
    expect(Math.abs(a.payoutCsgn - b.payoutCsgn)).toBeLessThanOrEqual(1)
    expect(payouts.reduce((s, p) => s + p.payoutCsgn, 0)).toBe(1_000_000)
  })

  it('handles an empty field and a zero purse', () => {
    expect(splitPurse([], 1_000_000)).toEqual([])
    expect(splitPurse(field(5), 0)).toEqual([])
  })

  it('has a curve that sums to 100%', () => {
    expect(PAYOUT_CURVE_BPS.reduce((s, b) => s + b, 0)).toBe(10_000)
  })
})

describe('settling a whole slate', () => {
  it('scores, ranks and pays in one pass', () => {
    const s = slate()
    const a = lineup({ id: 'a', wallet: 'WalletA' })
    const b = lineup({ id: 'b', wallet: 'WalletB', captain: 'SOL' })
    const prices = { SOL: 220, BONK: 0.00002, CSGN: 0.0004, DEGEN: 0.000001, WIF: 2 }

    const settled = settleSlate(s, [a, b], prices)
    expect(settled.ranked).toHaveLength(2)
    // Captaining the coin that moved wins it.
    expect(settled.ranked[0].wallet).toBe('WalletB')
    expect(settled.payouts.reduce((sum, p) => sum + p.payoutCsgn, 0)).toBe(s.purseCsgn)
    expect(settled.ownership.SOL).toBe(100)
  })

  it('handles a slate nobody entered', () => {
    const settled = settleSlate(slate(), [], {})
    expect(settled.ranked).toEqual([])
    expect(settled.payouts).toEqual([])
  })
})
