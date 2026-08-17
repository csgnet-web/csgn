/**
 * What a $CSGN bag is, as numbers the product can render.
 *
 * Balance in, share of supply out. This is deliberately separate from any one
 * feature that *uses* a share: the Right Now rail asks "is this holder over the
 * threshold", a profile asks "how big am I", and the broadcast asks "how much of
 * the hour is theirs". All three need one answer to "how much of the supply does
 * this wallet hold", computed one way.
 *
 * Nothing here spends, locks or burns anything — holding is the whole
 * interaction, and every label is written to say so.
 */

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

export interface HolderStanding {
  balance: number
  supply: number
  sharePct: number
  shareLabel: string
  balanceLabel: string
  /** True when there is no connected wallet to read a balance from. */
  disconnected: boolean
}

/** Everything a holder card needs, from a balance and the live token stats. */
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
    disconnected: balance == null,
  }
}

/**
 * How much more $CSGN would move this wallet up a step on some holding curve —
 * the single most motivating number that can appear on a holder's profile.
 *
 * Returns null at the cap (nothing left to earn) so the caller renders a "maxed"
 * state instead of an impossible target. Binary search over the curve rather
 * than inverting it algebraically, because the curve is defined by the function
 * passed in and should stay that way — invert it here and the two drift the
 * first time anyone retunes it.
 */
export function tokensToNextStep(
  balance: number,
  supply: number,
  stepFor: (held: number, supply: number) => number,
  max: number,
): number | null {
  const held = Math.max(0, Number(balance) || 0)
  const current = stepFor(held, supply)
  if (current >= max) return null

  let lo = held
  let hi = supply
  // 60 iterations halves the range far below one token — exact for our purposes.
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (stepFor(mid, supply) > current) hi = mid
    else lo = mid
  }
  const needed = Math.ceil(hi - held)
  return needed > 0 ? needed : null
}
