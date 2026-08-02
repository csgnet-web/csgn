/**
 * CSGN SQUARES — the office pool, rebuilt as a token-weighted, deposit-free,
 * provably-fair daily game.
 *
 * The classic works like this: a 10×10 grid, you buy squares, the digits 0–9 are
 * drawn onto the rows and columns AFTER the grid fills, and at the end of each
 * period the square sitting at (last digit of one score, last digit of the other)
 * wins. It is the most successful casual betting game ever invented — your aunt
 * plays it, and she can't name a single player.
 *
 * Two things are deliberately different here, and both follow the network's
 * no-burn, no-deposit rule (docs/master-plan.md §11.1):
 *
 *   1. NOBODY BUYS IN. Not with SOL, not with $CSGN, not with anything. Squares
 *      are ALLOCATED by how much $CSGN a wallet HOLDS. Holding is not spending —
 *      the tokens never leave the wallet, are never escrowed, are never burned.
 *      You can sell your whole bag mid-game; you simply hold fewer squares next
 *      game. This is the entire thesis of the token expressed as a board game.
 *
 *   2. THE PURSE COMES FROM THE TREASURY, not from the players. A squares pool
 *      normally just moves money between entrants and takes a rake. Here the
 *      treasury funds a fixed daily $CSGN purse out of attention revenue, so the
 *      game is pure distribution — the network pays the audience to show up.
 *
 * Everything in this file is pure. No Firestore, no clock, no network: state in,
 * state out. That is what makes the whole board unit-testable and what lets a
 * viewer re-run the draw themselves and land on the same winner.
 */

import { seededShuffle, seedString, isSeedValid, type SeedCommitment } from './provablyFair'

/* ─── Shape of a board ─── */

export const GRID = 10
export const SQUARE_COUNT = GRID * GRID

/**
 * A board's life. `open` takes claims; `drawn` has digits and is watching the
 * game; `settled` has paid every period out. There is no `cancelled` — an
 * under-filled board still plays, the empty squares simply roll over.
 */
export type SquaresStatus = 'open' | 'drawn' | 'settled'

/** One claimed cell. Wallet is the identity of record — it's what gets paid. */
export interface SquareClaim {
  /** 0–99, row-major: index = row * 10 + col. */
  index: number
  wallet: string
  displayName: string
  claimedAt: string
}

/**
 * A scoring checkpoint and its share of the purse. Weights are basis points so
 * the split is exact integer arithmetic — a purse must never be divided by
 * floating point, because 0.1 + 0.2 losing a token is a support ticket forever.
 */
export interface SquaresPeriod {
  key: string
  label: string
  /** Share of the purse, in basis points. All periods must total 10_000. */
  weightBps: number
}

/** The default four-checkpoint split: back-loaded, so the last one matters most. */
export const DEFAULT_PERIODS: SquaresPeriod[] = [
  { key: 'q1', label: 'End of 1st', weightBps: 1_500 },
  { key: 'h', label: 'Halftime', weightBps: 2_000 },
  { key: 'q3', label: 'End of 3rd', weightBps: 1_500 },
  { key: 'f', label: 'Final', weightBps: 5_000 },
]

/**
 * The two things being scored. Named rather than hardcoded to "home/away"
 * because CSGN runs both: a real game on the sports nights, and on a slow
 * afternoon a crypto board where the axes are the last digits of the $CSGN and
 * SOL prices at the top of each hour. Identical engine, different labels.
 */
export interface SquaresAxes {
  /** Columns. Its last digit picks the column. */
  x: string
  /** Rows. Its last digit picks the row. */
  y: string
}

export interface SquaresBoard {
  id: string
  status: SquaresStatus
  axes: SquaresAxes
  periods: SquaresPeriod[]
  /** Total $CSGN the treasury has committed to this board. */
  purseCsgn: number
  claims: SquareClaim[]
  /** ISO deadline after which no claim is accepted and the draw may happen. */
  entriesCloseAt: string
  /** Column digits, left to right. Empty until the draw. */
  colDigits: number[]
  /** Row digits, top to bottom. Empty until the draw. */
  rowDigits: number[]
  /** Where the draw's randomness came from. Null until drawn. */
  seed: SeedCommitment | null
  /** Purse carried in from a previous board's unclaimed winnings. */
  rolloverInCsgn?: number
}

/* ─── Entry allowance: holdings, not deposits ─── */

/**
 * How many squares a wallet may hold, from its share of $CSGN supply.
 *
 * The shape here is the important part. It is NOT linear — a whale with 5% of
 * supply does not get 5 squares to a minnow's 0.001. Linear allocation would let
 * one wallet own the board, and a board one wallet owns is not a game, it's a
 * withdrawal. Instead the curve is a square root, which is the same instinct
 * behind quadratic voting: influence grows with stake, but sub-linearly, so the
 * hundredth token buys far less than the first.
 *
 * Anyone with an account gets ONE square regardless of holdings, including zero.
 * That is not charity — it is the funnel. A non-holder who plays for free and
 * watches a holder cover nine squares has just been shown exactly what the token
 * does, which no amount of marketing copy achieves.
 */
export const FREE_SQUARES = 1
export const MAX_SQUARES_PER_WALLET = 10

export function squaresAllowance(csgnHeld: number, circulatingSupply: number): number {
  if (!Number.isFinite(csgnHeld) || csgnHeld <= 0) return FREE_SQUARES
  if (!Number.isFinite(circulatingSupply) || circulatingSupply <= 0) return FREE_SQUARES

  // Share of supply, in percent. 1% of supply is the reference "full" holder.
  const sharePct = (csgnHeld / circulatingSupply) * 100
  // sqrt curve normalized so 1% of supply reaches the cap. A wallet at 0.01% of
  // supply (a hundredth of that) still gets a third of the way there, not a
  // hundredth — the sub-linearity is doing real work at the small end.
  const earned = Math.floor(Math.sqrt(Math.min(sharePct, 1)) * (MAX_SQUARES_PER_WALLET - FREE_SQUARES))
  return Math.min(MAX_SQUARES_PER_WALLET, FREE_SQUARES + Math.max(0, earned))
}

/* ─── Claiming ─── */

export type ClaimRejection =
  | 'board_closed'
  | 'entries_closed'
  | 'bad_index'
  | 'square_taken'
  | 'allowance_exceeded'

export interface ClaimResult {
  ok: boolean
  reason?: ClaimRejection
  message?: string
  board: SquaresBoard
}

const REJECTION_COPY: Record<ClaimRejection, string> = {
  board_closed: 'This board has already been drawn.',
  entries_closed: 'Entries for this board are closed.',
  bad_index: 'That square is not on the board.',
  square_taken: 'Somebody already has that square.',
  allowance_exceeded: 'You are holding your maximum squares — hold more $CSGN for more.',
}

const reject = (board: SquaresBoard, reason: ClaimRejection): ClaimResult =>
  ({ ok: false, reason, message: REJECTION_COPY[reason], board })

/** Squares a wallet currently holds on a board. */
export function squaresHeldBy(board: SquaresBoard, wallet: string): number {
  return board.claims.filter((c) => c.wallet === wallet).length
}

/**
 * Claim one square. Returns a NEW board (never mutates), so a caller can compare
 * before/after or throw the result away on a transaction retry.
 *
 * `allowance` is passed in rather than computed here because the balance behind
 * it must be read on the server from the chain, against a signature-proven
 * wallet. A pure function that trusted a client-supplied balance would be a hole
 * you could drive the whole board through.
 */
export function claimSquare(
  board: SquaresBoard,
  claim: SquareClaim,
  allowance: number,
  nowMs: number,
): ClaimResult {
  if (board.status !== 'open') return reject(board, 'board_closed')
  if (nowMs >= Date.parse(board.entriesCloseAt)) return reject(board, 'entries_closed')
  if (!Number.isInteger(claim.index) || claim.index < 0 || claim.index >= SQUARE_COUNT) {
    return reject(board, 'bad_index')
  }
  if (board.claims.some((c) => c.index === claim.index)) return reject(board, 'square_taken')
  if (squaresHeldBy(board, claim.wallet) >= Math.max(FREE_SQUARES, allowance)) {
    return reject(board, 'allowance_exceeded')
  }
  return { ok: true, board: { ...board, claims: [...board.claims, claim] } }
}

/* ─── The draw ─── */

/**
 * Assign digits to the axes from the published seed.
 *
 * The digits are drawn only AFTER entries close, which is the whole integrity
 * story of squares: while you were picking, your square had no number, so no
 * square was better than any other and there was nothing to game. Two
 * independent shuffles (one per axis) off the same seed, distinguished by a
 * suffix so the rows and columns can't come out identical.
 */
export function drawDigits(board: SquaresBoard, commitment: SeedCommitment): SquaresBoard {
  if (board.status !== 'open') throw new Error('This board has already been drawn.')
  if (!isSeedValid(commitment, board.entriesCloseAt)) {
    throw new Error('The draw seed is missing, malformed, or older than the entry deadline.')
  }
  const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
  const base = seedString(commitment)
  return {
    ...board,
    status: 'drawn',
    seed: commitment,
    colDigits: seededShuffle(digits, `${base}:cols`),
    rowDigits: seededShuffle(digits, `${base}:rows`),
  }
}

/* ─── Resolving a period ─── */

export interface PeriodScore {
  /** Score for the column axis. */
  x: number
  /** Score for the row axis. */
  y: number
}

export interface PeriodResult {
  periodKey: string
  label: string
  score: PeriodScore
  /** The digits that hit. */
  digits: { x: number; y: number }
  /** 0–99 index of the winning square. */
  squareIndex: number
  /** Null when the winning square was never claimed. */
  winner: { wallet: string; displayName: string } | null
  /** $CSGN this period pays. Zero to nobody means it rolls. */
  payoutCsgn: number
  /** True when nobody held the square, so the payout rolls forward. */
  rolledOver: boolean
}

/** Last decimal digit, safe for negative or fractional inputs. */
export function lastDigit(value: number): number {
  return Math.abs(Math.trunc(value)) % 10
}

/**
 * Which square wins for a given pair of scores. Exported on its own because the
 * broadcast overlay highlights the live winning square continuously as the score
 * changes, not only at the checkpoints — it's the single best piece of ambient
 * tension a squares board produces and it costs one function call.
 */
export function winningSquareIndex(board: SquaresBoard, score: PeriodScore): number {
  if (board.colDigits.length !== GRID || board.rowDigits.length !== GRID) {
    throw new Error('This board has not been drawn yet.')
  }
  const col = board.colDigits.indexOf(lastDigit(score.x))
  const row = board.rowDigits.indexOf(lastDigit(score.y))
  return row * GRID + col
}

/**
 * Settle one checkpoint. Integer basis-point math against the total purse, with
 * the remainder handled at the end (see `settleBoard`) so the sum of the parts
 * is exactly the purse — never a token more, never a token less.
 */
export function resolvePeriod(board: SquaresBoard, period: SquaresPeriod, score: PeriodScore): PeriodResult {
  const squareIndex = winningSquareIndex(board, score)
  const claim = board.claims.find((c) => c.index === squareIndex) ?? null
  const totalPurse = board.purseCsgn + (board.rolloverInCsgn ?? 0)
  const payoutCsgn = Math.floor((totalPurse * period.weightBps) / 10_000)

  return {
    periodKey: period.key,
    label: period.label,
    score,
    digits: { x: lastDigit(score.x), y: lastDigit(score.y) },
    squareIndex,
    winner: claim ? { wallet: claim.wallet, displayName: claim.displayName } : null,
    payoutCsgn: claim ? payoutCsgn : 0,
    rolledOver: !claim,
  }
}

export interface BoardSettlement {
  board: SquaresBoard
  results: PeriodResult[]
  /** Wallet → total $CSGN owed. The exact input the payout ledger wants. */
  payouts: Record<string, number>
  /** Purse nobody won, to be carried into the next board. */
  rolloverOutCsgn: number
}

/**
 * Settle every checkpoint at once and reduce to a payout map.
 *
 * The last paid period absorbs any rounding dust, so the paid total plus the
 * rollover reconciles to the purse to the token. This is unglamorous and it is
 * the difference between a game people trust and a game with a spreadsheet
 * discrepancy someone screenshots.
 */
export function settleBoard(board: SquaresBoard, scores: Record<string, PeriodScore>): BoardSettlement {
  if (board.status === 'open') throw new Error('Draw the board before settling it.')

  const results = board.periods
    .filter((p) => scores[p.key] !== undefined)
    .map((p) => resolvePeriod(board, p, scores[p.key]))

  const payouts: Record<string, number> = {}
  for (const r of results) {
    if (!r.winner || r.payoutCsgn <= 0) continue
    payouts[r.winner.wallet] = (payouts[r.winner.wallet] ?? 0) + r.payoutCsgn
  }

  const totalPurse = board.purseCsgn + (board.rolloverInCsgn ?? 0)
  const paid = Object.values(payouts).reduce((sum, n) => sum + n, 0)
  const allSettled = results.length === board.periods.length

  // Dust only exists once every period has reported; a partially-settled board
  // still has periods owed, and their share is not dust.
  let rolloverOutCsgn = totalPurse - paid
  if (allSettled && paid > 0) {
    const dust = results.filter((r) => r.rolledOver).reduce((sum, r) => {
      const period = board.periods.find((p) => p.key === r.periodKey)!
      return sum + Math.floor((totalPurse * period.weightBps) / 10_000)
    }, 0)
    const lastPaid = [...results].reverse().find((r) => r.winner)
    if (lastPaid?.winner) {
      // Everything not attributable to an unclaimed square is dust: hand it to
      // the final winner so the books close exactly.
      const remainder = totalPurse - paid - dust
      if (remainder > 0) payouts[lastPaid.winner.wallet] += remainder
      rolloverOutCsgn = dust
    }
  }

  return {
    board: { ...board, status: allSettled ? 'settled' : board.status },
    results,
    payouts,
    rolloverOutCsgn: Math.max(0, rolloverOutCsgn),
  }
}

/* ─── Presentation helpers ─── */

/** Row/column of a square index, for rendering and for readable labels. */
export const squareCoords = (index: number) => ({ row: Math.floor(index / GRID), col: index % GRID })

/** How full the board is, 0–1 — the number the broadcast ticker counts down. */
export const boardFill = (board: SquaresBoard): number => board.claims.length / SQUARE_COUNT
