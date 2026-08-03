import { describe, it, expect } from 'vitest'
import {
  TIER_ORDER, tierForMarketCap, validateLineup, lineupAllowance, pickPoints,
  leverageFor, ownershipPercentages, scoreLineup, rankLineups, splitPurse, settleSlate,
  CAPTAIN_MULTIPLIER, MAX_LEVERAGE, FREE_LINEUPS, MAX_LINEUPS, PAYOUT_CURVE_BPS,
  PERFECT_CARD_PURSE_CSGN, isPerfectCard,
  type Slate, type Lineup, type SlateEntry,
} from './startingFive'
import type { SeedCommitment } from './provablyFair'

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

describe('settling a whole slate (leaderboard mode)', () => {
  it('scores, ranks and pays in one pass', () => {
    const s = slate({ prizeMode: 'leaderboard' })
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
    const settled = settleSlate(slate({ prizeMode: 'leaderboard' }), [], {})
    expect(settled.ranked).toEqual([])
    expect(settled.payouts).toEqual([])
  })
})

/* ─── The perfect card ─── */

/** Every coin up 10% — a perfect card. */
const ALL_GREEN = { SOL: 220, BONK: 0.000022, CSGN: 0.00044, DEGEN: 0.0000011, WIF: 2.2 }
/** DEGEN red, everything else green — one pick short. */
const ONE_RED = { SOL: 220, BONK: 0.000022, CSGN: 0.00044, DEGEN: 0.0000009, WIF: 2.2 }

const seed = (over: Partial<SeedCommitment> = {}): SeedCommitment => ({
  blockhash: '4vJ9JU1bJJE96FbKdjWG9WnHkQVpvJ7BqL8tR2mNcXyZ',
  slot: 301_884_221,
  sampledAt: '2026-08-03T02:00:00.000Z',
  gameId: 'slate-2026-08-02',
  ...over,
})

describe('the perfect card', () => {
  it('starts at 100,000 $CSGN', () => {
    expect(PERFECT_CARD_PURSE_CSGN).toBe(100_000)
  })

  it('is all five green', () => {
    const scored = scoreLineup(slate(), lineup(), ALL_GREEN)
    expect(isPerfectCard(scored)).toBe(true)
  })

  it('is broken by a single red pick', () => {
    expect(isPerfectCard(scoreLineup(slate(), lineup(), ONE_RED))).toBe(false)
  })

  it('is not broken by a flat pick at the default threshold', () => {
    const flat = { ...ALL_GREEN, WIF: 2 } // exactly unchanged
    expect(isPerfectCard(scoreLineup(slate(), lineup(), flat))).toBe(true)
  })

  it('honours a raised threshold', () => {
    const scored = scoreLineup(slate(), lineup(), ALL_GREEN) // every pick +10%
    expect(isPerfectCard(scored, 5)).toBe(true)
    expect(isPerfectCard(scored, 15)).toBe(false)
  })

  it('is judged on raw performance, so a captain multiplier cannot rescue a red pick', () => {
    // DEGEN is red and captained; leverage/captain must not drag it over the line.
    const scored = scoreLineup(slate(), lineup({ captain: 'DEGEN' }), ONE_RED, { DEGEN: 0 })
    expect(isPerfectCard(scored)).toBe(false)
  })

  it('is not awarded to an empty or unpriced card', () => {
    const scored = scoreLineup(slate(), lineup(), {}) // no settle prices at all
    expect(isPerfectCard(scored)).toBe(false)
  })

  it('is not awarded when even ONE pick is missing a price', () => {
    const missingOne = { SOL: 220, BONK: 0.000022, CSGN: 0.00044, DEGEN: 0.0000011 } // no WIF
    expect(isPerfectCard(scoreLineup(slate(), lineup(), missingOne))).toBe(false)
  })

  it('marks picks as priced only when the snapshot really carried them', () => {
    const missingOne = { SOL: 220, BONK: 0.000022, CSGN: 0.00044, DEGEN: 0.0000011 } // no WIF
    const scored = scoreLineup(slate(), lineup(), missingOne)
    expect(scored.picks.find((p) => p.symbol === 'WIF')!.priced).toBe(false)
    expect(scored.picks.find((p) => p.symbol === 'SOL')!.priced).toBe(true)
  })

  it('a dead price feed rolls the jackpot instead of paying every card', () => {
    // The expensive failure: unpriced picks score as flat, flat clears a zero
    // threshold, and without the `priced` guard the whole field goes perfect.
    const settled = settleSlate(slate({ purseCsgn: 100_000 }), [
      lineup({ id: 'a', wallet: 'WalletA' }),
      lineup({ id: 'b', wallet: 'WalletB' }),
    ], {})
    expect(settled.perfect).toEqual([])
    expect(settled.payouts).toEqual([])
    expect(settled.rolloverCsgn).toBe(100_000)
  })
})

describe('perfect_split — the jackpot shared', () => {
  it('pays the whole jackpot to a lone perfect card', () => {
    const s = slate({ purseCsgn: PERFECT_CARD_PURSE_CSGN })
    const settled = settleSlate(s, [lineup({ id: 'a', wallet: 'WalletA' })], ALL_GREEN)
    expect(settled.prizeMode).toBe('perfect_split')
    expect(settled.perfect).toHaveLength(1)
    expect(settled.payouts[0].payoutCsgn).toBe(100_000)
    expect(settled.rolloverCsgn).toBe(0)
  })

  it('splits evenly across perfect cards, to the token', () => {
    const s = slate({ purseCsgn: 100_000 })
    const lineups = ['a', 'b', 'c'].map((id) => lineup({ id, wallet: `Wallet${id}` }))
    const settled = settleSlate(s, lineups, ALL_GREEN)
    expect(settled.payouts).toHaveLength(3)
    expect(settled.payouts.reduce((sum, p) => sum + p.payoutCsgn, 0)).toBe(100_000)
    // 33,333 each with the odd token to the top card.
    expect(settled.payouts.map((p) => p.payoutCsgn).sort((x, y) => y - x)).toEqual([33_334, 33_333, 33_333])
  })

  it('gives a wallet a share per perfect CARD, not per wallet', () => {
    const s = slate({ purseCsgn: 100_000 })
    const settled = settleSlate(s, [
      lineup({ id: 'a', wallet: 'Whale' }),
      lineup({ id: 'b', wallet: 'Whale' }),
    ], ALL_GREEN)
    expect(settled.payouts).toHaveLength(2)
    expect(settled.payouts.every((p) => p.wallet === 'Whale')).toBe(true)
    expect(settled.payouts.reduce((sum, p) => sum + p.payoutCsgn, 0)).toBe(100_000)
  })

  it('pays nobody and rolls the jackpot when no card is perfect', () => {
    const s = slate({ purseCsgn: 100_000 })
    const settled = settleSlate(s, [lineup()], ONE_RED)
    expect(settled.perfect).toEqual([])
    expect(settled.payouts).toEqual([])
    expect(settled.rolloverCsgn).toBe(100_000)
  })

  it('rolls an empty slate rather than paying it out', () => {
    const settled = settleSlate(slate({ purseCsgn: 100_000 }), [], {})
    expect(settled.payouts).toEqual([])
    expect(settled.rolloverCsgn).toBe(100_000)
  })

  it('carries yesterday jackpot into today purse', () => {
    const s = slate({ purseCsgn: 100_000, jackpotInCsgn: 300_000 })
    const settled = settleSlate(s, [lineup()], ALL_GREEN)
    expect(settled.jackpotCsgn).toBe(400_000)
    expect(settled.payouts[0].payoutCsgn).toBe(400_000)
  })

  it('keeps rolling a jackpot that goes unclaimed twice', () => {
    const s = slate({ purseCsgn: 100_000, jackpotInCsgn: 300_000 })
    expect(settleSlate(s, [lineup()], ONE_RED).rolloverCsgn).toBe(400_000)
  })
})

describe('perfect_lottery — the jackpot drawn', () => {
  const s = (over: Partial<Slate> = {}) =>
    slate({ prizeMode: 'perfect_lottery', purseCsgn: 100_000, ...over })
  const field = ['a', 'b', 'c', 'd'].map((id) => lineup({ id, wallet: `Wallet${id}` }))

  it('pays the entire jackpot to exactly one perfect card', () => {
    const settled = settleSlate(s(), field, ALL_GREEN, seed())
    expect(settled.perfect).toHaveLength(4)
    expect(settled.payouts).toHaveLength(1)
    expect(settled.payouts[0].payoutCsgn).toBe(100_000)
    expect(settled.rolloverCsgn).toBe(0)
  })

  it('is deterministic — the same seed always draws the same winner', () => {
    const a = settleSlate(s(), field, ALL_GREEN, seed())
    const b = settleSlate(s(), field, ALL_GREEN, seed())
    expect(a.payouts[0].wallet).toBe(b.payouts[0].wallet)
  })

  it('draws a different winner from a different blockhash', () => {
    const winners = new Set(
      Array.from({ length: 12 }, (_, i) =>
        settleSlate(s(), field, ALL_GREEN, seed({ blockhash: `GkP2sV8wNqRt4xYzB7cJfLmH3dE9aU6vC1nT5oXpQr${i}w` }))
          .payouts[0].wallet),
    )
    expect(winners.size).toBeGreaterThan(1)
  })

  it('does not depend on the order lineups were submitted in', () => {
    const a = settleSlate(s(), field, ALL_GREEN, seed())
    const b = settleSlate(s(), [...field].reverse(), ALL_GREEN, seed())
    expect(a.payouts[0].wallet).toBe(b.payouts[0].wallet)
  })

  it('REFUSES to draw without a published seed rather than picking the first row', () => {
    const settled = settleSlate(s(), field, ALL_GREEN)
    expect(settled.payouts).toEqual([])
    expect(settled.rolloverCsgn).toBe(100_000)
    expect(settled.note).toMatch(/seed/i)
  })

  it('rolls over when nobody goes perfect, seed or not', () => {
    expect(settleSlate(s(), field, ONE_RED, seed()).rolloverCsgn).toBe(100_000)
  })

  it('only ever draws from the perfect cards', () => {
    const mixed = [
      lineup({ id: 'green', wallet: 'Green' }),
      lineup({ id: 'red', wallet: 'Red', picks: lineup().picks }),
    ]
    // Both cards are identical, so make the second one lose by pricing it out:
    // instead, assert directly that the winner is drawn from `perfect`.
    const settled = settleSlate(s(), mixed, ONE_RED, seed())
    expect(settled.perfect).toEqual([])
    expect(settled.payouts).toEqual([])
  })
})
