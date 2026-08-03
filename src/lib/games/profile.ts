/**
 * A holder's standing across the games — the numbers the profile page shows.
 *
 * All pure. Balance and token stats come in; entitlements and formatted labels
 * come out. The point of putting this here rather than inline in the page is
 * that "what does my bag entitle me to" is the same question the server asks
 * when it accepts an entry, so both sides read one rule.
 */

import { squaresAllowance, MAX_SQUARES_PER_WALLET } from './squares'
import { lineupAllowance, MAX_LINEUPS } from './startingFive'

/**
 * Fallback circulating supply for $CSGN — the pump.fun standard 1B.
 *
 * Only used when live token stats aren't available. The real figure is derived
 * from marketCap / price (see `circulatingSupply`), because a hardcoded supply
 * silently becomes a lie the first time anything is minted or burned elsewhere.
 */
export const FALLBACK_CIRCULATING_SUPPLY = 1_000_000_000

/**
 * Circulating supply implied by the live market cap and price.
 *
 * Derived rather than stored: both inputs already flow through
 * `public/tokenStats`, and dividing them gives a supply that self-corrects.
 * Returns the fallback when either input is missing or nonsensical.
 */
export function circulatingSupply(stats: { marketCapUsd?: number; priceUsd?: number } | null): number {
  const cap = Number(stats?.marketCapUsd)
  const price = Number(stats?.priceUsd)
  if (!Number.isFinite(cap) || !Number.isFinite(price) || cap <= 0 || price <= 0) {
    return FALLBACK_CIRCULATING_SUPPLY
  }
  const supply = cap / price
  return Number.isFinite(supply) && supply > 0 ? supply : FALLBACK_CIRCULATING_SUPPLY
}

/** Share of circulating supply, as a percentage. Never negative, never NaN. */
export function supplySharePct(balance: number, supply: number): number {
  if (!Number.isFinite(balance) || balance <= 0) return 0
  if (!Number.isFinite(supply) || supply <= 0) return 0
  return Math.min(100, (balance / supply) * 100)
}

/**
 * Format a supply share for display.
 *
 * Small shares get more decimals rather than collapsing to "0.00%" — a holder
 * whose stake rounds to zero on their own profile has just been told they don't
 * count, which is the opposite of what this number is for.
 */
export function formatSharePct(pct: number): string {
  if (!Number.isFinite(pct) || pct <= 0) return '0%'
  if (pct >= 1) return `${pct.toFixed(2)}%`
  if (pct >= 0.01) return `${pct.toFixed(3)}%`
  if (pct >= 0.0001) return `${pct.toFixed(5)}%`
  return '<0.0001%'
}

/** Compact token counts: 1.2M, 4.5K, 900. */
export function formatTokens(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0'
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return String(Math.round(n))
}

/**
 * Lifetime game record, written server-side onto the user doc by the settlement
 * job. Every field is optional because that job doesn't exist yet — the profile
 * renders honest zeroes and empty states rather than inventing numbers.
 */
export interface GameStats {
  startingFiveEntries?: number
  startingFivePerfect?: number
  startingFiveBestRank?: number
  squaresBoards?: number
  squaresPeriodsWon?: number
  /** Lifetime $CSGN paid out across all games. */
  winningsCsgn?: number
  /** ISO of the most recent win, for "last won" copy. */
  lastWonAt?: string
}

export interface HolderStanding {
  balance: number
  supply: number
  sharePct: number
  shareLabel: string
  balanceLabel: string
  /** Squares this wallet may hold on a board. */
  squares: number
  squaresMax: number
  /** Starting 5 lineups this wallet may enter per slate. */
  lineups: number
  lineupsMax: number
  /** True when there is no connected wallet to read a balance from. */
  disconnected: boolean
}

/**
 * Everything the profile's holder panel needs, from a balance and the live
 * token stats.
 *
 * A disconnected wallet still gets the free allowances rather than zeroes,
 * because that IS the entitlement — one square and one lineup are free to
 * everybody, and showing a stranger "0 entries" would be both wrong and the
 * worst possible first impression of the games.
 */
export function holderStanding(
  balance: number | null,
  stats: { marketCapUsd?: number; priceUsd?: number } | null,
): HolderStanding {
  const supply = circulatingSupply(stats)
  const held = Number.isFinite(Number(balance)) && Number(balance) > 0 ? Number(balance) : 0
  const sharePct = supplySharePct(held, supply)

  return {
    balance: held,
    supply,
    sharePct,
    shareLabel: formatSharePct(sharePct),
    balanceLabel: formatTokens(held),
    squares: squaresAllowance(held, supply),
    squaresMax: MAX_SQUARES_PER_WALLET,
    lineups: lineupAllowance(held, supply),
    lineupsMax: MAX_LINEUPS,
    disconnected: balance == null,
  }
}

/**
 * How much more $CSGN would buy the next entry — the single most motivating
 * number that can appear on a holder's profile, and the reason the allowance
 * curve is worth surfacing at all.
 *
 * Returns null at the cap (nothing left to earn) so the caller renders a "maxed"
 * state instead of an impossible target. Binary search over the curve rather
 * than inverting it algebraically, because the curve is defined by the
 * allowance function and should stay that way — invert it here and the two drift
 * the first time anyone retunes it.
 */
export function tokensToNextEntry(
  balance: number,
  supply: number,
  allowanceFor: (held: number, supply: number) => number,
  max: number,
): number | null {
  const held = Math.max(0, Number(balance) || 0)
  const current = allowanceFor(held, supply)
  if (current >= max) return null

  let lo = held
  let hi = supply
  // 60 iterations halves the range far below one token — exact for our purposes.
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (allowanceFor(mid, supply) > current) hi = mid
    else lo = mid
  }
  const needed = Math.ceil(hi - held)
  return needed > 0 ? needed : null
}
