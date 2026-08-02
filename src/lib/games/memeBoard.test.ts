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
