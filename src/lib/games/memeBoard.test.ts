import { describe, it, expect } from 'vitest'
import {
  isValidMint, normalizeMemeCoin, normalizeMemeBoard, rankMemeBoard, communityPick,
  shortMint, compactUsd, memePrice, searchBoard, POWER_WEIGHTS,
  type MemeCoin,
} from './memeBoard'

const MINT_A = 'GFV7fphvprMr1PYpYGPJort2QP7JJLEp3J1Buu7Zpump'
const MINT_B = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'
const MINT_C = '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1'

const coin = (over: Partial<MemeCoin> = {}): MemeCoin => ({
  address: MINT_A, symbol: 'CSGN', name: 'CSGN', imageUrl: '',
  priceUsd: 0.0004, marketCapUsd: 400_000, volumeH24Usd: 80_000,
  priceChangeH24Pct: 5, pairUrl: '', priced: true, ...over,
})

describe('mint validation is the identity check', () => {
  it('accepts real Solana mints', () => {
    for (const m of [MINT_A, MINT_B, MINT_C]) expect(isValidMint(m)).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isValidMint('')).toBe(false)
    expect(isValidMint('BONK')).toBe(false)
    expect(isValidMint('0x71C7656EC7ab88b098defB751B7401B5f6d8976F')).toBe(false)
    expect(isValidMint('0OIl'.repeat(10))).toBe(false)
    expect(isValidMint(undefined as unknown as string)).toBe(false)
  })
})

describe('normalizing an entry', () => {
  it('keeps a well-formed coin', () => {
    const c = normalizeMemeCoin({ address: MINT_A, symbol: 'csgn', name: 'CSGN Network', priceUsd: 0.0004 })!
    expect(c.symbol).toBe('CSGN')
    expect(c.name).toBe('CSGN Network')
    expect(c.priced).toBe(true)
  })

  it('REFUSES an entry with no valid mint — a coin nobody can look up cannot be voted on', () => {
    expect(normalizeMemeCoin({ symbol: 'MOON' })).toBeNull()
    expect(normalizeMemeCoin({ address: 'not-a-mint', symbol: 'MOON' })).toBeNull()
    expect(normalizeMemeCoin(null)).toBeNull()
  })

  it('marks an un-enriched coin unpriced rather than dropping it', () => {
    const c = normalizeMemeCoin({ address: MINT_B, symbol: 'BONK' })!
    expect(c.priced).toBe(false)
    expect(c.priceUsd).toBe(0)
  })

  it('falls back to a readable symbol when none was given', () => {
    expect(normalizeMemeCoin({ address: MINT_A })!.symbol).toBe('GFV7')
  })

  it('defaults the pair link to DexScreener for the mint', () => {
    expect(normalizeMemeCoin({ address: MINT_A })!.pairUrl).toContain(MINT_A)
  })

  it('keeps a negative 24h change (it is a real number, not a bad one)', () => {
    expect(normalizeMemeCoin({ address: MINT_A, priceChangeH24Pct: -42 })!.priceChangeH24Pct).toBe(-42)
  })
})

describe('normalizing the board', () => {
  it('drops invalid entries and keeps the rest', () => {
    const board = normalizeMemeBoard([
      { address: MINT_A, symbol: 'CSGN' },
      { symbol: 'GHOST' },
      { address: MINT_B, symbol: 'BONK' },
    ])
    expect(board.map((c) => c.symbol)).toEqual(['CSGN', 'BONK'])
  })

  it('DEDUPES by mint — a duplicate would split a coin’s own vote weight', () => {
    const board = normalizeMemeBoard([
      { address: MINT_A, symbol: 'CSGN' },
      { address: MINT_A, symbol: 'CSGN2' },
    ])
    expect(board).toHaveLength(1)
    expect(board[0].symbol).toBe('CSGN')
  })

  it('handles junk input', () => {
    expect(normalizeMemeBoard(null)).toEqual([])
    expect(normalizeMemeBoard('nope')).toEqual([])
    expect(normalizeMemeBoard([1, 2, 3])).toEqual([])
  })
})

describe('the power ranking', () => {
  it('publishes weights that total 100%', () => {
    const total = Object.values(POWER_WEIGHTS).reduce((s, w) => s + w, 0)
    expect(total).toBeCloseTo(1)
  })

  it('ranks best-first and numbers from 1', () => {
    const ranked = rankMemeBoard([
      coin({ address: MINT_A, symbol: 'SMALL', volumeH24Usd: 1_000, marketCapUsd: 10_000 }),
      coin({ address: MINT_B, symbol: 'BIG', volumeH24Usd: 900_000, marketCapUsd: 9_000_000 }),
    ])
    expect(ranked[0].symbol).toBe('BIG')
    expect(ranked.map((c) => c.rank)).toEqual([1, 2])
  })

  it('lets holder votes outweigh raw market size — it is a community ranking', () => {
    const board = [
      coin({ address: MINT_A, symbol: 'BACKED', volumeH24Usd: 10_000, marketCapUsd: 100_000 }),
      coin({ address: MINT_B, symbol: 'BIGGER', volumeH24Usd: 20_000, marketCapUsd: 200_000 }),
    ]
    expect(rankMemeBoard(board)[0].symbol).toBe('BIGGER')
    const withVotes = rankMemeBoard(board, { [MINT_A]: { tokens: 5_000_000, wallets: 12 } })
    expect(withVotes[0].symbol).toBe('BACKED')
  })

  it('reports vote weight, voters and share of the board', () => {
    const ranked = rankMemeBoard(
      [coin({ address: MINT_A }), coin({ address: MINT_B, symbol: 'BONK' })],
      { [MINT_A]: { tokens: 750, wallets: 3 }, [MINT_B]: { tokens: 250, wallets: 1 } },
    )
    const a = ranked.find((c) => c.address === MINT_A)!
    expect(a.votes).toBe(750)
    expect(a.voters).toBe(3)
    expect(a.voteShare).toBeCloseTo(0.75)
  })

  it('keeps an unpriced coin on the board instead of silently deleting it', () => {
    const ranked = rankMemeBoard([
      coin({ address: MINT_A, symbol: 'LIVE' }),
      coin({ address: MINT_B, symbol: 'NEW', priceUsd: 0, marketCapUsd: 0, volumeH24Usd: 0, priced: false }),
    ])
    expect(ranked).toHaveLength(2)
    expect(ranked.map((c) => c.symbol)).toContain('NEW')
  })

  it('is stable across calls — no reshuffling on every render', () => {
    const board = [coin({ address: MINT_A, symbol: 'A' }), coin({ address: MINT_B, symbol: 'B' })]
    expect(rankMemeBoard(board).map((c) => c.symbol)).toEqual(rankMemeBoard(board).map((c) => c.symbol))
  })

  it('handles an empty board and a board with no votes at all', () => {
    expect(rankMemeBoard([])).toEqual([])
    expect(rankMemeBoard([coin()])[0].voteShare).toBe(0)
  })

  it('never divides by zero on a board of all-zero metrics', () => {
    const ranked = rankMemeBoard([
      coin({ address: MINT_A, priceUsd: 0, marketCapUsd: 0, volumeH24Usd: 0, priceChangeH24Pct: 0 }),
    ])
    expect(Number.isFinite(ranked[0].power)).toBe(true)
  })
})

describe('the community pick', () => {
  it('is the top coin ONCE holder weight backs it', () => {
    const ranked = rankMemeBoard([coin({ address: MINT_A })], { [MINT_A]: { tokens: 1000, wallets: 2 } })
    expect(communityPick(ranked)?.address).toBe(MINT_A)
  })

  it('is null with no votes — otherwise it is just the biggest coin', () => {
    expect(communityPick(rankMemeBoard([coin()]))).toBeNull()
    expect(communityPick([])).toBeNull()
  })
})

describe('display helpers', () => {
  it('shortens a mint but keeps both ends recognisable', () => {
    expect(shortMint(MINT_A)).toBe('GFV7…pump')
    expect(shortMint('short')).toBe('short')
  })

  it('compacts usd by magnitude', () => {
    expect(compactUsd(4_200_000_000)).toBe('$4.20B')
    expect(compactUsd(4_200_000)).toBe('$4.2M')
    expect(compactUsd(4_200)).toBe('$4K')
    expect(compactUsd(0)).toBe('—')
  })

  it('scales price decimals across nine orders of magnitude', () => {
    expect(memePrice(214.6)).toBe('$214.60')
    expect(memePrice(0.0821)).toBe('$0.0821')
    expect(memePrice(0.0004)).toBe('$0.0004')
    expect(memePrice(0.000000012)).toContain('e-')
    expect(memePrice(0)).toBe('—')
  })
})

describe('searching the board', () => {
  const ranked = rankMemeBoard([
    coin({ address: MINT_A, symbol: 'CSGN', name: 'Crypto Sports' }),
    coin({ address: MINT_B, symbol: 'BONK', name: 'Bonk' }),
  ])

  it('matches symbol, name or address, case-insensitively', () => {
    expect(searchBoard(ranked, 'bonk')).toHaveLength(1)
    expect(searchBoard(ranked, 'sports')[0].symbol).toBe('CSGN')
    expect(searchBoard(ranked, MINT_B.slice(0, 8))[0].symbol).toBe('BONK')
  })

  it('returns everything for an empty query', () => {
    expect(searchBoard(ranked, '')).toHaveLength(2)
    expect(searchBoard(ranked, '   ')).toHaveLength(2)
  })

  it('returns nothing for a miss', () => {
    expect(searchBoard(ranked, 'zzzz')).toEqual([])
  })
})

// ── The published 0–100 score ──
//
// The board goes on air and is the ballot for a token-weighted vote, so "why is
// this coin here" has to be answerable from the card. These pin the two
// properties that make that possible: the number is stable and comparable, and
// the four terms shown beneath it actually add up to it.

describe('the 0-100 score', () => {
  const coins = [
    { address: 'A'.repeat(40), symbol: 'AAA', name: 'A', imageUrl: '', priceUsd: 1, marketCapUsd: 1_000_000, volumeH24Usd: 500_000, priceChangeH24Pct: 10, liquidityUsd: 100_000, pairUrl: '', priced: true },
    { address: 'B'.repeat(40), symbol: 'BBB', name: 'B', imageUrl: '', priceUsd: 1, marketCapUsd: 100_000, volumeH24Usd: 10_000, priceChangeH24Pct: 1, liquidityUsd: 10_000, pairUrl: '', priced: true },
  ]

  it('is 0-100 and ordered the same way as the ranking', () => {
    const ranked = rankMemeBoard(coins)
    for (const c of ranked) {
      expect(c.score).toBeGreaterThanOrEqual(0)
      expect(c.score).toBeLessThanOrEqual(100)
    }
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score)
  })

  it('breaks down into the four published weights, and they add up', () => {
    const [top] = rankMemeBoard(coins)
    const parts = top.breakdown.votes + top.breakdown.volume + top.breakdown.momentum + top.breakdown.maturity + top.breakdown.size
    // Rounding each term independently can drift a point from the total; more
    // than that means the breakdown is not the score.
    expect(Math.abs(parts - top.score)).toBeLessThanOrEqual(2)
  })

  it('credits the vote term only when holders actually backed a coin', () => {
    const withVotes = rankMemeBoard(coins, { [coins[1].address]: { tokens: 5_000_000, wallets: 3 } })
    const bbb = withVotes.find((c) => c.symbol === 'BBB')!
    expect(bbb.breakdown.votes).toBeGreaterThan(0)
    const aaa = withVotes.find((c) => c.symbol === 'AAA')!
    expect(aaa.breakdown.votes).toBe(0)
  })

  it('survives an empty and a single-coin board', () => {
    expect(rankMemeBoard([])).toEqual([])
    const [only] = rankMemeBoard([coins[0]])
    expect(only.score).toBeGreaterThan(0)
    expect(only.score).toBeLessThanOrEqual(100)
  })
})

describe('rankMemeBoard — trending, not merely large', () => {
  const coin = (over: Partial<MemeCoin> & { address: string; symbol: string }): MemeCoin => ({
    name: over.symbol, imageUrl: '', priceUsd: 0.001, marketCapUsd: 1_000_000,
    volumeH24Usd: 100_000, priceChangeH24Pct: 0,
    pairUrl: '', priced: true, ...over,
  })

  it('ranks a small coin having a day above a big quiet one', () => {
    // The exact failure that motivated the rewrite: the board was topped by
    // whatever was biggest, which is the opposite of what a channel about right
    // now should lead with.
    const ranked = rankMemeBoard([
      coin({ address: 'big', symbol: 'BIG', marketCapUsd: 900_000_000, volumeH24Usd: 3_000_000, priceChangeH24Pct: 1 }),
      coin({ address: 'hot', symbol: 'HOT', marketCapUsd: 4_000_000, volumeH24Usd: 12_000_000, priceChangeH24Pct: 140 }),
    ])
    expect(ranked[0].symbol).toBe('HOT')
  })

  it('does not leave the votes weight unscored when nobody has voted', () => {
    // With no ballots the old formula capped every score at 65 and ranked on a
    // partial formula. The weights must still sum to 1.
    const ranked = rankMemeBoard([
      coin({ address: 'a', symbol: 'A', volumeH24Usd: 5_000_000, priceChangeH24Pct: 50 }),
      coin({ address: 'b', symbol: 'B', volumeH24Usd: 10_000 }),
    ])
    const w = ranked[0].weights
    expect(w.votes).toBe(0)
    expect(w.volume + w.momentum + w.maturity + w.size).toBeCloseTo(1, 6)
    expect(ranked[0].score).toBeGreaterThan(65)
  })

  it('restores the votes weight as soon as one ballot exists', () => {
    const coins = [coin({ address: 'a', symbol: 'A' }), coin({ address: 'b', symbol: 'B' })]
    const ranked = rankMemeBoard(coins, { a: { tokens: 5_000, wallets: 1 } })
    expect(ranked[0].weights.votes).toBeCloseTo(POWER_WEIGHTS.votes, 6)
    const w = ranked[0].weights
    expect(w.votes + w.volume + w.momentum + w.maturity + w.size).toBeCloseTo(1, 6)
  })

  it('caps turnover so a wash trade cannot buy the top spot', () => {
    // 500x its own market cap in a day is not a signal, it is a laundromat.
    const ranked = rankMemeBoard([
      coin({ address: 'wash', symbol: 'WASH', marketCapUsd: 20_000, volumeH24Usd: 10_000_000, priceChangeH24Pct: 0 }),
      coin({ address: 'real', symbol: 'REAL', marketCapUsd: 8_000_000, volumeH24Usd: 20_000_000, priceChangeH24Pct: 90 }),
    ])
    expect(ranked[0].symbol).toBe('REAL')
  })

  it('separates the middle of the board instead of flattening it to zero', () => {
    // Log normalization exists for this: under linear normalization every coin
    // below the largest scored near-identically, so ninety of a hundred rows
    // were indistinguishable.
    const coins = Array.from({ length: 10 }, (_, i) => coin({
      address: `c${i}`, symbol: `C${i}`,
      marketCapUsd: 10 ** (4 + i * 0.5),
      volumeH24Usd: 10 ** (3 + i * 0.5),
    }))
    const ranked = rankMemeBoard(coins)
    const mid = ranked.slice(3, 8).map((c) => c.score)
    expect(new Set(mid).size).toBeGreaterThan(1)
    expect(Math.max(...mid) - Math.min(...mid)).toBeGreaterThan(3)
  })

  it('still lets an unpriced coin appear and be voted on', () => {
    const ranked = rankMemeBoard(
      [coin({ address: 'x', symbol: 'X' }), { ...coin({ address: 'y', symbol: 'Y' }), priced: false, priceUsd: 0, marketCapUsd: 0, volumeH24Usd: 0 }],
      { y: { tokens: 900_000, wallets: 4 } },
    )
    expect(ranked.map((c) => c.address)).toContain('y')
  })
})

describe('rankMemeBoard — staying power keeps the majors on', () => {
  const coin = (over: Partial<MemeCoin> & { address: string; symbol: string }): MemeCoin => ({
    name: over.symbol, imageUrl: '', priceUsd: 0.001, marketCapUsd: 1_000_000,
    volumeH24Usd: 100_000, priceChangeH24Pct: 0, pairUrl: '', priced: true, ageDays: 0, ...over,
  })

  it('ranks an established coin above a day-old one on comparable activity', () => {
    // A "Meme 100" that ranks purely on today's activity has no BONK on it,
    // and a viewer would rightly think it was broken.
    const ranked = rankMemeBoard([
      coin({ address: 'old', symbol: 'OLD', ageDays: 600, volumeH24Usd: 2_000_000, marketCapUsd: 50_000_000 }),
      coin({ address: 'new', symbol: 'NEW', ageDays: 1, volumeH24Usd: 2_000_000, marketCapUsd: 50_000_000 }),
    ])
    expect(ranked[0].symbol).toBe('OLD')
  })

  it('does not let age alone beat a coin that is genuinely on fire', () => {
    // Staying power is 15 points, not a veto. A dead two-year-old coin must
    // still lose to something actually trading.
    const ranked = rankMemeBoard([
      coin({ address: 'stale', symbol: 'STALE', ageDays: 730, volumeH24Usd: 5_000, marketCapUsd: 200_000 }),
      coin({ address: 'hot', symbol: 'HOT', ageDays: 2, volumeH24Usd: 40_000_000, priceChangeH24Pct: 180, marketCapUsd: 30_000_000 }),
    ])
    expect(ranked[0].symbol).toBe('HOT')
  })

  it('caps maturity so a five-year-old coin is not unbeatable', () => {
    const two = rankMemeBoard([coin({ address: 'a', symbol: 'A', ageDays: 730 })])[0]
    const five = rankMemeBoard([coin({ address: 'a', symbol: 'A', ageDays: 1825 })])[0]
    expect(five.breakdown.maturity).toBe(two.breakdown.maturity)
  })

  it('treats an unknown age as no credit rather than as brand new', () => {
    const t = rankMemeBoard([
      coin({ address: 'a', symbol: 'A', ageDays: 0 }),
      coin({ address: 'b', symbol: 'B', ageDays: 400 }),
    ])
    expect(t.find((c) => c.symbol === 'A')!.breakdown.maturity).toBe(0)
  })
})
