/**
 * CSGN SQUARES — the office pool, rebuilt as a weekly, pooled, provably-fair
 * game paying 500,000 $CSGN to the winner.
 *
 * The classic works like this: a 10×10 grid, you buy squares, the digits 0–9 are
 * drawn onto the rows and columns AFTER the grid fills, and at the end of the
 * game the square sitting at (last digit of one score, last digit of the other)
 * wins. It is the most successful casual betting game ever invented — your aunt
 * plays it, and she can't name a single player.
 *
 * Two things to be clear about, because one of them is a deliberate exception to
 * how the rest of the network works:
 *
 *   1. SQUARES IS THE ONE PAID GAME. Players pay an entry fee per square, the
 *      fees pool, the network takes a published rake, and the remainder goes to
 *      the winner. That makes it self-funding rather than a treasury expense —
 *      and it makes it the only mechanic here that takes money from a player.
 *      Everything else on the network (Starting 5, voting, slot claiming) stays
 *      free and holdings-based, and should stay that way. See §"The pool".
 *
 *   2. THE HOLDINGS CURVE IS NOW A CAP, NOT A GRANT. `squaresAllowance` used to
 *      say how many squares your bag EARNED you for free. On a paid board it
 *      says how many you're allowed to BUY — the sub-linear curve is what stops
 *      one wallet purchasing the whole board and winning its own money back
 *      minus the rake, which is not a game, it's a laundry.
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

/* ─── The pool ─── */

/**
 * Squares is a POOLED game, and the only one on the network that is.
 *
 * Every other mechanic here is deposit-free by design (see the header, and
 * Starting 5, where entries are earned by holding). Squares is the deliberate
 * exception: players pay an entry fee per square, the fees pool, the network
 * takes a stated rake, and the remainder goes to the winner. A full 100-square
 * board pays 500,000 $CSGN.
 *
 * Three things follow from that, and all three are enforced below rather than
 * left to a settlement script:
 *
 *   1. THE RAKE IS PUBLISHED AND COMPUTED FROM THE POOL, never taken off the
 *      top of a number nobody can check. `boardRake` is derived from the same
 *      claims everyone can count on the board.
 *   2. A SHORT BOARD PAYS A SHORT PRIZE. If forty squares sell, the prize is
 *      forty squares' worth minus rake — not 500,000. Guaranteeing a prize the
 *      pool doesn't cover means the treasury silently funds the difference on
 *      every quiet week, which is how a game stops being self-sustaining.
 *      A guarantee is available (`guaranteePrize`), but it is opt-in per board
 *      and the top-up is reported, never hidden.
 *   3. NOTHING IS OWED UNTIL THE BOARD IS DRAWN. Fees are collected on claim;
 *      an abandoned board must refund, which is why `boardPool` stays derivable
 *      from the claims at any moment.
 */

/** What a full board pays the winner at the default fee and rake. */
export const SQUARES_TARGET_PRIZE_CSGN = 500_000
/** $CSGN per square. 100 × 6,250 = 625,000 gross; less a 20% rake = 500,000. */
export const DEFAULT_ENTRY_FEE_CSGN = 6_250
/** The network's cut, in basis points. Tunable per board; published either way. */
export const DEFAULT_RAKE_BPS = 2_000

/**
 * One winner takes the game. A single Final checkpoint at the full purse —
 * which is what "500,000 to the winner of each game" means, and it's the shape
 * a pooled board wants: four smaller prizes out of one pool is four reasons to
 * feel like you nearly won, where one prize is a reason to watch the ninth.
 *
 * `DEFAULT_PERIODS` (the four-checkpoint split) is still supported for a
 * treasury-funded board — the engine doesn't care which it's handed.
 */
export const SINGLE_WINNER_PERIODS: SquaresPeriod[] = [
  { key: 'f', label: 'Final', weightBps: 10_000 },
]

export interface SquaresBoard {
  id: string
  status: SquaresStatus
  axes: SquaresAxes
  periods: SquaresPeriod[]
  /**
   * Treasury contribution, in $CSGN. Zero on a self-funding pooled board — the
   * prize comes from entries. Non-zero only when the network is adding to the
   * pot (a promoted board), or as the floor when `guaranteePrize` is set.
   */
  purseCsgn: number
  /** $CSGN each square costs. Zero makes the board free to enter. */
  entryFeeCsgn?: number
  /** The network's cut of the entry pool, in basis points. */
  rakeBps?: number
  /** Top the prize up to `purseCsgn` from the treasury when the pool falls
   *  short. Off by default: a guarantee is a subsidy, and it should be a
   *  decision someone made about this board, not a default nobody noticed. */
  guaranteePrize?: boolean
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

/* ─── Pool math ─── */

export interface BoardEconomics {
  /** Squares sold. */
  squares: number
  /** Gross entry fees collected. */
  poolCsgn: number
  /** The network's cut. */
  rakeCsgn: number
  /** Treasury money added on top of the pool (a promoted board, or a top-up). */
  treasuryCsgn: number
  /** What the winner (or winners, across periods) actually splits. */
  prizeCsgn: number
  /** True when the treasury covered a shortfall against a guaranteed prize. */
  toppedUp: boolean
}

/**
 * Everything about a board's money, derived from the claims on it.
 *
 * Integer arithmetic throughout, and the rake is floored so rounding always
 * favours the prize pool rather than the house — a fraction of a token is
 * meaningless either way, but "the house rounds up" is not a sentence anyone
 * should be able to write about us truthfully.
 */
export function boardEconomics(board: SquaresBoard): BoardEconomics {
  const fee = Math.max(0, Math.floor(board.entryFeeCsgn ?? 0))
  const squares = board.claims.length
  const poolCsgn = fee * squares
  const rakeBps = Math.min(10_000, Math.max(0, Math.floor(board.rakeBps ?? 0)))
  const rakeCsgn = Math.floor((poolCsgn * rakeBps) / 10_000)

  const netPool = poolCsgn - rakeCsgn
  const floor = Math.max(0, Math.floor(board.purseCsgn ?? 0))

  // A free board (no fee) is purely treasury-funded and the purse IS the prize.
  if (fee <= 0) {
    return { squares, poolCsgn: 0, rakeCsgn: 0, treasuryCsgn: floor, prizeCsgn: floor, toppedUp: false }
  }

  if (board.guaranteePrize && netPool < floor) {
    return { squares, poolCsgn, rakeCsgn, treasuryCsgn: floor - netPool, prizeCsgn: floor, toppedUp: true }
  }
  return { squares, poolCsgn, rakeCsgn, treasuryCsgn: 0, prizeCsgn: netPool, toppedUp: false }
}

/** What one square costs. */
export const entryFee = (board: SquaresBoard): number => Math.max(0, Math.floor(board.entryFeeCsgn ?? 0))

/** What the board is playing for right now, including any carried rollover. */
export function boardPrize(board: SquaresBoard): number {
  return boardEconomics(board).prizeCsgn + Math.max(0, Math.floor(board.rolloverInCsgn ?? 0))
}

/** Total $CSGN a wallet has committed to this board. Drives the refund path on
 *  an abandoned board, and the "you're in for X" line on the board screen. */
export function stakeOf(board: SquaresBoard, wallet: string): number {
  return squaresHeldBy(board, wallet) * entryFee(board)
}

/* ─── Entry allowance: a cap, not a grant ─── */

/**
 * How many squares a wallet may BUY, from its share of $CSGN supply.
 *
 * On a paid board this is a ceiling, not an entitlement — you still pay the fee
 * for every square you take. The ceiling exists because a squares pool with no
 * per-player limit has a degenerate strategy: buy all 100 squares, win
 * guaranteed, and get back the pool minus the rake. That isn't a game, it's a
 * 20% fee on moving your own money, and it would kill the board for everyone
 * else the first time someone did it.
 *
 * The shape is the important part. It is NOT linear — a whale with 5% of supply
 * does not get 5 squares to a minnow's 0.001. The curve is a square root, the
 * same instinct behind quadratic voting: influence grows with stake, but
 * sub-linearly, so the hundredth token buys far less than the first.
 *
 * The floor of ONE square applies regardless of holdings, including zero, so
 * anyone with an account can play. On a paid board that's one square at the
 * entry fee — the fee is the price of entry, the bag only decides how many more
 * you may take.
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
  // The prize is what the POOL pays (entries less rake, plus any treasury
  // contribution and carried rollover) — never the raw purse field, which on a
  // self-funding board is zero.
  const totalPurse = boardPrize(board)
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

  const totalPurse = boardPrize(board)
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
