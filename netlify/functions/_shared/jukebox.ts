/**
 * The Coin Jukebox auction, as arithmetic.
 *
 * Pure and separate from the endpoint for the usual reason: this decides what
 * somebody has to pay, so it is the part that has to be provable. The handler
 * reads the standing bid and writes the new one; everything about WHAT the next
 * bid costs lives here and is pinned by tests.
 */

/** Opening price when no live bid stands. Overridable per-network from
 *  `config/tokenGates.jukeboxFloorCsgn` — the one number an admin still sets. */
export const JUKEBOX_BASE_FLOOR_CSGN = 250_000

/**
 * How long a winning bid holds the spotlight.
 *
 * TWELVE HOURS — half a broadcast day, six network blocks. Long enough that
 * winning is genuinely worth paying for and that a buyer sees their coin
 * through a full daytime and a full evening audience, short enough that one
 * payment cannot buy the channel for a week and that a quiet night resets to
 * the opening price by the following morning.
 */
export const JUKEBOX_TTL_MS = 12 * 60 * 60 * 1000

/**
 * The minimum raise, as a multiple of the standing bid.
 *
 * 1.15 — you take the spotlight by beating the holder by 15%, not by one token.
 * A 1-token increment turns an auction into a click war that ends with the
 * spotlight changing hands forty times an hour and nobody paying anything real.
 */
export const JUKEBOX_MIN_RAISE = 1.15

export interface StandingBid {
  bidCsgn: number
  bidAt: string | null
}

/**
 * What the next bid must pay.
 *
 * An expired bid does not set a floor — that is what expiry MEANS, and forgetting
 * it is how an abandoned bid from last week keeps the price at ten million
 * forever. Rounded up to a whole token so the number on screen is the number the
 * chain check uses; a fractional floor fails verification by a rounding hair.
 */
export function nextJukeboxFloor(standing: StandingBid, baseFloor: number, nowMs: number): number {
  const floor = Math.max(1, Math.floor(Number(baseFloor) || 0) || JUKEBOX_BASE_FLOOR_CSGN)
  const bid = Math.max(0, Number(standing?.bidCsgn) || 0)
  const at = Date.parse(standing?.bidAt ?? '')
  const live = Number.isFinite(at) && nowMs - at < JUKEBOX_TTL_MS
  if (!live || bid <= 0) return floor
  return Math.max(floor, Math.ceil(bid * JUKEBOX_MIN_RAISE))
}

/** Is a standing bid still holding the spotlight? */
export function jukeboxBidLive(standing: StandingBid, nowMs: number): boolean {
  const at = Date.parse(standing?.bidAt ?? '')
  return Number.isFinite(at) && nowMs - at < JUKEBOX_TTL_MS && (Number(standing?.bidCsgn) || 0) > 0
}


/** A past winner, as published to `public/jukebox.history`. Kept small on
 *  purpose — this is a leaderboard, not a ledger, and the ledger already
 *  exists in `spotlightPays/{signature}`. */
export interface JukeboxWinner {
  symbol: string
  bidCsgn: number
  wonAt: string
  wallet: string
}

/** How many past winners the published doc carries. Enough to show a real
 *  history, small enough that the document stays a single cheap read. */
export const JUKEBOX_HISTORY_SIZE = 10

/**
 * Fold a new winner into the history.
 *
 * Newest first, capped, and the CURRENT holder is not in it — history means
 * "who held it before", and listing the sitting champion twice on one screen
 * reads as a bug.
 */
export function pushJukeboxWinner(
  history: JukeboxWinner[] | undefined,
  previous: { symbol?: string; bidCsgn?: number; bidAt?: string | null; wallet?: string } | null,
): JukeboxWinner[] {
  const list = Array.isArray(history) ? history.slice() : []
  // The outgoing holder joins the history — but only if there actually was one
  // and it was a real bid, not an empty slot.
  if (previous && previous.symbol && Number(previous.bidCsgn) > 0 && previous.bidAt) {
    list.unshift({
      symbol: String(previous.symbol).toUpperCase().slice(0, 12),
      bidCsgn: Number(previous.bidCsgn),
      wonAt: String(previous.bidAt),
      wallet: String(previous.wallet || ''),
    })
  }
  return list.slice(0, JUKEBOX_HISTORY_SIZE)
}
