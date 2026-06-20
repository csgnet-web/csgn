// Server-side fee calculation — pure math + Solscan-sourced token data.
//
// Live earnings are derived from TOKEN-LEVEL data (price, market cap, 24h
// volume) read from Solscan, the single arbiter of truth. This is pool-proof:
// unlike a DEX-pair feed, it cannot be hijacked by a spoofed/secondary pool.
// If Solscan is unavailable or returns untrustworthy data, fetchTokenData
// returns null and the poller freezes earnings for that interval (it never
// records numbers from an unverified source).

// Canonical CSGN pump.fun mint — MUST match CSGN_MINT in src/lib/slots.ts.
export const CSGN_MINT = 'GFV7fphvprMr1PYpYGPJort2QP7JJLEp3J1Buu7Zpump'
// Wrapped SOL mint — used to price SOL/USD for market-cap-in-SOL tiering.
const SOL_MINT = 'So11111111111111111111111111111111111111112'
export const STREAMER_SHARE_OF_CREATOR_FEE = 0.3

export interface PumpFeeTier {
  minMarketCapSOL: number
  maxMarketCapSOL: number | null
  creatorFeeRate: number
}

export const PUMP_FUN_FEE_TIERS: PumpFeeTier[] = [
  { minMarketCapSOL: 0, maxMarketCapSOL: 420, creatorFeeRate: 0.003 },
  { minMarketCapSOL: 420, maxMarketCapSOL: 1470, creatorFeeRate: 0.0095 },
  { minMarketCapSOL: 1470, maxMarketCapSOL: 2460, creatorFeeRate: 0.009 },
  { minMarketCapSOL: 2460, maxMarketCapSOL: 3440, creatorFeeRate: 0.0085 },
  { minMarketCapSOL: 3440, maxMarketCapSOL: 4420, creatorFeeRate: 0.008 },
  { minMarketCapSOL: 4420, maxMarketCapSOL: 9820, creatorFeeRate: 0.0075 },
  { minMarketCapSOL: 9820, maxMarketCapSOL: 14740, creatorFeeRate: 0.007 },
  { minMarketCapSOL: 14740, maxMarketCapSOL: 19650, creatorFeeRate: 0.0065 },
  { minMarketCapSOL: 19650, maxMarketCapSOL: 24560, creatorFeeRate: 0.006 },
  { minMarketCapSOL: 24560, maxMarketCapSOL: 29470, creatorFeeRate: 0.0055 },
  { minMarketCapSOL: 29470, maxMarketCapSOL: 34380, creatorFeeRate: 0.005 },
  { minMarketCapSOL: 34380, maxMarketCapSOL: 39300, creatorFeeRate: 0.0045 },
  { minMarketCapSOL: 39300, maxMarketCapSOL: 44210, creatorFeeRate: 0.004 },
  { minMarketCapSOL: 44210, maxMarketCapSOL: 49120, creatorFeeRate: 0.0035 },
  { minMarketCapSOL: 49120, maxMarketCapSOL: 54030, creatorFeeRate: 0.003 },
  { minMarketCapSOL: 54030, maxMarketCapSOL: 58940, creatorFeeRate: 0.00275 },
  { minMarketCapSOL: 58940, maxMarketCapSOL: 63860, creatorFeeRate: 0.0025 },
  { minMarketCapSOL: 63860, maxMarketCapSOL: 68770, creatorFeeRate: 0.00225 },
  { minMarketCapSOL: 68770, maxMarketCapSOL: 73681, creatorFeeRate: 0.002 },
  { minMarketCapSOL: 73681, maxMarketCapSOL: 78590, creatorFeeRate: 0.00175 },
  { minMarketCapSOL: 78590, maxMarketCapSOL: 83500, creatorFeeRate: 0.0015 },
  { minMarketCapSOL: 83500, maxMarketCapSOL: 88400, creatorFeeRate: 0.00125 },
  { minMarketCapSOL: 88400, maxMarketCapSOL: 93330, creatorFeeRate: 0.001 },
  { minMarketCapSOL: 93330, maxMarketCapSOL: 98240, creatorFeeRate: 0.00075 },
  { minMarketCapSOL: 98240, maxMarketCapSOL: null, creatorFeeRate: 0.0005 },
]

export function resolvePumpFeeTier(marketCapSOL: number): PumpFeeTier {
  return (
    PUMP_FUN_FEE_TIERS.find(
      (t) => marketCapSOL >= t.minMarketCapSOL && (t.maxMarketCapSOL === null || marketCapSOL < t.maxMarketCapSOL),
    ) ?? PUMP_FUN_FEE_TIERS[0]
  )
}

export function formatTierRange(tier: PumpFeeTier): string {
  return tier.maxMarketCapSOL === null
    ? `${tier.minMarketCapSOL.toLocaleString()}+ SOL`
    : `${tier.minMarketCapSOL.toLocaleString()} - ${tier.maxMarketCapSOL.toLocaleString()} SOL`
}

export interface TokenData {
  volumeH1Usd: number   // not provided by token-level feed; kept 0 for poller compat
  volumeH24Usd: number
  solPriceUsd: number
  marketCapSOL: number
}

const SOLSCAN_API = 'https://pro-api.solscan.io/v2.0'

/** Coerce an unknown value to a finite, non-negative number, else null. */
function toNum(value: unknown): number | null {
  const n = typeof value === 'string' ? parseFloat(value) : typeof value === 'number' ? value : NaN
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** First trustworthy numeric value across candidate field names (tolerates Solscan naming variants). */
function pickNum(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const k of keys) {
    const n = toNum(obj[k])
    if (n !== null) return n
  }
  return null
}

/**
 * Pure: assemble TokenData from a Solscan token-meta object + SOL price.
 * Returns null (→ freeze) when market cap, 24h volume, or SOL price are
 * missing/invalid, so we never compute against partial data.
 */
export function buildTokenData(meta: Record<string, unknown>, solPriceUsd: number): TokenData | null {
  if (!(solPriceUsd > 0)) return null
  const marketCapUsd = pickNum(meta, ['market_cap', 'marketCap', 'marketcap', 'market_cap_usd'])
  const volume24hUsd = pickNum(meta, ['volume_24h', 'volume24h', 'volume', 'v24hUSD'])
  if (marketCapUsd === null || volume24hUsd === null) return null
  return {
    volumeH1Usd: 0,
    volumeH24Usd: volume24hUsd,
    solPriceUsd,
    marketCapSOL: marketCapUsd / solPriceUsd,
  }
}

async function solscanTokenMeta(address: string, apiKey: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${SOLSCAN_API}/token/meta?address=${encodeURIComponent(address)}`, {
    headers: { token: apiKey, Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) return null
  const json = (await res.json()) as { success?: boolean; data?: Record<string, unknown> }
  if (!json || json.success === false || !json.data) return null
  return json.data
}

// SOL price changes slowly; cache it within a warm function instance to keep
// Solscan call volume low (1 token call/poll + at most 1 SOL call / 5 min).
let cachedSolPrice: { price: number; at: number } | null = null
const SOL_PRICE_TTL_MS = 5 * 60 * 1000

/**
 * Fetch CSGN token-level data from Solscan (the arbiter of truth).
 * Returns null on any failure → caller freezes earnings for the interval.
 */
export async function fetchTokenData(): Promise<TokenData | null> {
  const apiKey = process.env.SOLSCAN_API_KEY
  if (!apiKey) {
    console.warn('[feeCalc] SOLSCAN_API_KEY is not set — live earnings frozen')
    return null
  }
  try {
    let solPriceUsd: number | null =
      cachedSolPrice && Date.now() - cachedSolPrice.at < SOL_PRICE_TTL_MS ? cachedSolPrice.price : null
    if (solPriceUsd === null) {
      const solMeta = await solscanTokenMeta(SOL_MINT, apiKey)
      solPriceUsd = solMeta ? pickNum(solMeta, ['price', 'price_usd', 'priceUsd']) : null
      if (solPriceUsd && solPriceUsd > 0) cachedSolPrice = { price: solPriceUsd, at: Date.now() }
    }
    if (!solPriceUsd || solPriceUsd <= 0) return null

    const meta = await solscanTokenMeta(CSGN_MINT, apiKey)
    if (!meta) return null
    return buildTokenData(meta, solPriceUsd)
  } catch {
    return null
  }
}
