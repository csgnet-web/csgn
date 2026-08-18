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
 * Six hours, which is three network blocks. Long enough that winning is worth
 * paying for, short enough that one payment cannot buy the channel for a week
 * and that a quiet night resets to the opening price by morning.
 */
export const JUKEBOX_TTL_MS = 6 * 60 * 60 * 1000

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
