import { describe, it, expect } from 'vitest'
import {
  SQUARE_COUNT, DEFAULT_PERIODS, squaresAllowance, claimSquare, drawDigits,
  winningSquareIndex, resolvePeriod, settleBoard, lastDigit, squaresHeldBy, boardFill,
  FREE_SQUARES, MAX_SQUARES_PER_WALLET,
  type SquaresBoard, type SquareClaim,
} from './squares'
import { seededShuffle, isSeedValid, type SeedCommitment } from './provablyFair'

const CLOSE = '2026-08-02T18:00:00.000Z'
const beforeClose = Date.parse('2026-08-02T17:00:00.000Z')
const afterClose = Date.parse('2026-08-02T19:00:00.000Z')

const seed = (over: Partial<SeedCommitment> = {}): SeedCommitment => ({
  blockhash: '4vJ9JU1bJJE96FbKdjWG9WnHkQVpvJ7BqL8tR2mNcXyZ',
  slot: 301_884_221,
  sampledAt: '2026-08-02T18:00:30.000Z',
  gameId: 'board-2026-08-02',
  ...over,
})

const board = (over: Partial<SquaresBoard> = {}): SquaresBoard => ({
  id: 'board-2026-08-02',
  status: 'open',
  axes: { x: 'HOME', y: 'AWAY' },
  periods: DEFAULT_PERIODS,
  purseCsgn: 1_000_000,
  claims: [],
  entriesCloseAt: CLOSE,
  colDigits: [],
  rowDigits: [],
  seed: null,
  ...over,
})

const claim = (index: number, wallet = 'WalletA', name = 'alice'): SquareClaim =>
  ({ index, wallet, displayName: name, claimedAt: '2026-08-02T12:00:00.000Z' })

/** Fill every square, spread across enough wallets to stay inside allowances. */
function fullBoard(over: Partial<SquaresBoard> = {}): SquaresBoard {
  const claims = Array.from({ length: SQUARE_COUNT }, (_, i) => claim(i, `Wallet${i}`, `player${i}`))
  return board({ claims, ...over })
}

describe('entry allowance is holdings-based, never a deposit', () => {
  it('gives a free square to a wallet holding nothing at all', () => {
    expect(squaresAllowance(0, 1_000_000_000)).toBe(FREE_SQUARES)
    expect(squaresAllowance(-5, 1_000_000_000)).toBe(FREE_SQUARES)
  })

  it('caps a whale rather than letting one wallet own the board', () => {
    // 50% of supply is still capped at the same ten squares as 1%.
    expect(squaresAllowance(500_000_000, 1_000_000_000)).toBe(MAX_SQUARES_PER_WALLET)
    expect(squaresAllowance(10_000_000, 1_000_000_000)).toBe(MAX_SQUARES_PER_WALLET)
  })

  it('is sub-linear — a hundredth of the stake buys far more than a hundredth of the squares', () => {
    const full = squaresAllowance(10_000_000, 1_000_000_000)     // 1% of supply
    const hundredth = squaresAllowance(100_000, 1_000_000_000)   // 0.01% of supply
    expect(hundredth).toBeGreaterThan(full / 100)
    expect(hundredth).toBeLessThan(full)
  })

  it('never returns less than the free allowance, whatever the inputs', () => {
    expect(squaresAllowance(5, 0)).toBe(FREE_SQUARES)
    expect(squaresAllowance(NaN, 1_000)).toBe(FREE_SQUARES)
    expect(squaresAllowance(1, Number.POSITIVE_INFINITY)).toBe(FREE_SQUARES)
  })
})

describe('claiming', () => {
  it('accepts a legal claim and never mutates the input board', () => {
    const b = board()
    const result = claimSquare(b, claim(42), 3, beforeClose)
    expect(result.ok).toBe(true)
    expect(result.board.claims).toHaveLength(1)
    expect(b.claims).toHaveLength(0)
  })

  it('refuses a square somebody already has', () => {
    const b = board({ claims: [claim(42, 'WalletA')] })
    const result = claimSquare(b, claim(42, 'WalletB', 'bob'), 3, beforeClose)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('square_taken')
  })

  it('refuses claims once the entry deadline passes', () => {
    const result = claimSquare(board(), claim(1), 3, afterClose)
    expect(result.reason).toBe('entries_closed')
  })

  it('refuses claims on a board that has already been drawn', () => {
    const result = claimSquare(board({ status: 'drawn' }), claim(1), 3, beforeClose)
    expect(result.reason).toBe('board_closed')
  })

  it('rejects an index off the board', () => {
    expect(claimSquare(board(), claim(-1), 3, beforeClose).reason).toBe('bad_index')
    expect(claimSquare(board(), claim(SQUARE_COUNT), 3, beforeClose).reason).toBe('bad_index')
    expect(claimSquare(board(), claim(1.5), 3, beforeClose).reason).toBe('bad_index')
  })

  it('enforces the allowance per wallet, not per board', () => {
    const b = board({ claims: [claim(1, 'WalletA'), claim(2, 'WalletA')] })
    expect(claimSquare(b, claim(3, 'WalletA'), 2, beforeClose).reason).toBe('allowance_exceeded')
    // A different wallet at the same allowance is unaffected.
    expect(claimSquare(b, claim(3, 'WalletB', 'bob'), 2, beforeClose).ok).toBe(true)
  })

  it('always honours the free square even if a caller passes allowance 0', () => {
    expect(claimSquare(board(), claim(7), 0, beforeClose).ok).toBe(true)
  })

  it('counts squares held and board fill', () => {
    const b = board({ claims: [claim(1, 'WalletA'), claim(2, 'WalletA'), claim(3, 'WalletB', 'bob')] })
    expect(squaresHeldBy(b, 'WalletA')).toBe(2)
    expect(squaresHeldBy(b, 'WalletC')).toBe(0)
    expect(boardFill(b)).toBeCloseTo(0.03)
  })
})

describe('the draw is provably fair and reproducible', () => {
  it('produces a full permutation of 0-9 on each axis', () => {
    const drawn = drawDigits(board(), seed())
    expect([...drawn.colDigits].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect([...drawn.rowDigits].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(drawn.status).toBe('drawn')
  })

  it('is deterministic — the same seed always yields the same board', () => {
    const a = drawDigits(board(), seed())
    const b = drawDigits(board(), seed())
    expect(a.colDigits).toEqual(b.colDigits)
    expect(a.rowDigits).toEqual(b.rowDigits)
  })

  it('gives the rows and columns different orders from the same seed', () => {
    const drawn = drawDigits(board(), seed())
    expect(drawn.colDigits).not.toEqual(drawn.rowDigits)
  })

  it('changes completely when the blockhash changes', () => {
    const a = drawDigits(board(), seed())
    const b = drawDigits(board(), seed({ blockhash: 'GkP2sV8wNqRt4xYzB7cJfLmH3dE9aU6vC1nT5oXpQrSw' }))
    expect(a.colDigits).not.toEqual(b.colDigits)
  })

  it('refuses a seed sampled before entries closed — the whole integrity claim', () => {
    const early = seed({ sampledAt: '2026-08-02T17:59:00.000Z' })
    expect(isSeedValid(early, CLOSE)).toBe(false)
    expect(() => drawDigits(board(), early)).toThrow(/older than the entry deadline/)
  })

  it('refuses a malformed or missing seed', () => {
    expect(isSeedValid(null, CLOSE)).toBe(false)
    expect(isSeedValid(seed({ blockhash: 'short' }), CLOSE)).toBe(false)
    expect(isSeedValid(seed({ slot: 0 }), CLOSE)).toBe(false)
  })

  it('refuses to draw a board twice', () => {
    const drawn = drawDigits(board(), seed())
    expect(() => drawDigits(drawn, seed())).toThrow(/already been drawn/)
  })

  it('shuffles without bias in the extremes — no digit is stuck in place', () => {
    // Across many seeds, digit 0 should reach every one of the ten positions.
    const positions = new Set<number>()
    for (let i = 0; i < 200; i++) {
      positions.add(seededShuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], `seed-${i}`).indexOf(0))
    }
    expect(positions.size).toBe(10)
  })
})

describe('resolving a period', () => {
  it('takes the last digit of each score', () => {
    expect(lastDigit(0)).toBe(0)
    expect(lastDigit(7)).toBe(7)
    expect(lastDigit(24)).toBe(4)
    expect(lastDigit(130)).toBe(0)
    expect(lastDigit(-13)).toBe(3)
    expect(lastDigit(21.8)).toBe(1)
  })

  it('maps scores to the square sitting at those digits', () => {
    const b = board({ status: 'drawn', colDigits: [3, 1, 4, 1, 5, 9, 2, 6, 8, 7].map((_, i) => i), rowDigits: [9, 8, 7, 6, 5, 4, 3, 2, 1, 0] })
    // col digit 4 is at index 4; row digit 7 is at index 2 → 2 * 10 + 4
    expect(winningSquareIndex(b, { x: 24, y: 17 })).toBe(24)
  })

  it('refuses to resolve a board that was never drawn', () => {
    expect(() => winningSquareIndex(board(), { x: 7, y: 3 })).toThrow(/not been drawn/)
  })

  it('pays the wallet holding the winning square', () => {
    const drawn = drawDigits(fullBoard(), seed())
    const index = winningSquareIndex(drawn, { x: 21, y: 14 })
    const result = resolvePeriod(drawn, DEFAULT_PERIODS[0], { x: 21, y: 14 })
    expect(result.squareIndex).toBe(index)
    expect(result.winner?.wallet).toBe(`Wallet${index}`)
    expect(result.payoutCsgn).toBe(150_000) // 15% of 1,000,000
    expect(result.rolledOver).toBe(false)
  })

  it('rolls over when nobody held the winning square', () => {
    const drawn = drawDigits(board({ claims: [] }), seed())
    const result = resolvePeriod(drawn, DEFAULT_PERIODS[3], { x: 30, y: 27 })
    expect(result.winner).toBeNull()
    expect(result.payoutCsgn).toBe(0)
    expect(result.rolledOver).toBe(true)
  })

  it('includes rollover carried in from a previous board in the purse', () => {
    const drawn = drawDigits(fullBoard({ rolloverInCsgn: 500_000 }), seed())
    const result = resolvePeriod(drawn, DEFAULT_PERIODS[0], { x: 21, y: 14 })
    expect(result.payoutCsgn).toBe(225_000) // 15% of 1.5M
  })
})

describe('settling a whole board', () => {
  const scores = { q1: { x: 7, y: 3 }, h: { x: 14, y: 10 }, q3: { x: 21, y: 17 }, f: { x: 28, y: 24 } }

  it('reconciles exactly: everything paid plus rollover equals the purse', () => {
    const drawn = drawDigits(fullBoard(), seed())
    const settled = settleBoard(drawn, scores)
    const paid = Object.values(settled.payouts).reduce((s, n) => s + n, 0)
    expect(paid + settled.rolloverOutCsgn).toBe(drawn.purseCsgn)
    expect(settled.board.status).toBe('settled')
  })

  it('adds up multiple wins by the same wallet into one payout entry', () => {
    // One wallet owns every square, so it wins all four periods.
    const claims = Array.from({ length: SQUARE_COUNT }, (_, i) => claim(i, 'Whale', 'whale'))
    const drawn = drawDigits(board({ claims }), seed())
    const settled = settleBoard(drawn, scores)
    expect(Object.keys(settled.payouts)).toEqual(['Whale'])
    expect(settled.payouts.Whale).toBe(drawn.purseCsgn)
    expect(settled.rolloverOutCsgn).toBe(0)
  })

  it('rolls the unwon share forward on an empty board and pays nobody', () => {
    const drawn = drawDigits(board({ claims: [] }), seed())
    const settled = settleBoard(drawn, scores)
    expect(settled.payouts).toEqual({})
    expect(settled.rolloverOutCsgn).toBe(drawn.purseCsgn)
  })

  it('stays open when only some periods have reported', () => {
    const drawn = drawDigits(fullBoard(), seed())
    const settled = settleBoard(drawn, { q1: scores.q1 })
    expect(settled.results).toHaveLength(1)
    expect(settled.board.status).toBe('drawn')
  })

  it('refuses to settle a board that was never drawn', () => {
    expect(() => settleBoard(board(), scores)).toThrow(/Draw the board/)
  })

  it('leaves no dust on a purse that does not divide evenly', () => {
    const drawn = drawDigits(fullBoard({ purseCsgn: 999_999 }), seed())
    const settled = settleBoard(drawn, scores)
    const paid = Object.values(settled.payouts).reduce((s, n) => s + n, 0)
    expect(paid + settled.rolloverOutCsgn).toBe(999_999)
  })
})

describe('period weights', () => {
  it('total exactly 100%', () => {
    expect(DEFAULT_PERIODS.reduce((s, p) => s + p.weightBps, 0)).toBe(10_000)
  })
})
