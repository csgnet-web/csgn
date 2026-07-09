/**
 * Pump.fun creator-fee tier tables and the one-shot client-side token stats
 * fallback. Live fee tracking runs server-side in
 * netlify/functions/feePollerBackground.ts — browsers only read Firestore.
 */

import { CSGN_MINT } from '@/lib/slots'

const DS_API = 'https://api.dexscreener.com/token-pairs/v1'
const DS_CHAIN = 'solana'
const STREAMER_SHARE_OF_CREATOR_FEE = 0.3

interface DexPair {
  priceNative?: string
  priceUsd?: string
  volume?: { h1?: number; h24?: number }
  marketCap?: number
  fdv?: number
  quoteToken?: { symbol?: string }
}

export interface PumpFeeTier {
  minMarketCapSOL: number
  maxMarketCapSOL: number | null
  creatorFeeRate: number
}

// Source: https://pump.fun/docs/fees (canonical PumpSwap pools; SOL market-cap tiers).
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
  return PUMP_FUN_FEE_TIERS.find((t) => marketCapSOL >= t.minMarketCapSOL && (t.maxMarketCapSOL === null || marketCapSOL < t.maxMarketCapSOL)) ?? PUMP_FUN_FEE_TIERS[0]
}

export function formatTierRange(tier: PumpFeeTier): string {
  return tier.maxMarketCapSOL === null ? `${tier.minMarketCapSOL.toLocaleString()}+ SOL` : `${tier.minMarketCapSOL.toLocaleString()} - ${tier.maxMarketCapSOL.toLocaleString()} SOL`
}

export function getStreamerShareRateForMarketCap(marketCapSOL: number): number {
  return resolvePumpFeeTier(marketCapSOL).creatorFeeRate * STREAMER_SHARE_OF_CREATOR_FEE
}

export function estimateCreatorFeeSOL(tradingVolumeSOL: number, marketCapSOL: number): number {
  return tradingVolumeSOL * getStreamerShareRateForMarketCap(marketCapSOL)
}

/** Shape of the public/tokenStats doc written server-side by feePollerBackground. */
export interface TokenStatsSnapshot {
  priceUsd: number
  marketCapUsd: number
  volumeH24Usd: number
  priceChangeH24Pct: number
  liquidityUsd: number
  solPriceUsd: number
  pairUrl: string
  mint: string
  updatedAt: string
}

/**
 * One-shot client-side token stats fetch — fallback only, for when the
 * server-written public/tokenStats doc is missing or stale. Never poll this.
 */
export async function fetchTokenStats(): Promise<TokenStatsSnapshot | null> {
  try {
    const res = await fetch(`${DS_API}/${DS_CHAIN}/${CSGN_MINT}`, { cache: 'no-store' })
    if (!res.ok) return null
    const pairs = (await res.json()) as Array<DexPair & { url?: string; priceChange?: { h24?: number }; liquidity?: { usd?: number } }>
    if (!Array.isArray(pairs) || pairs.length === 0) return null
    const best = [...pairs].sort((a, b) => (b.volume?.h24 ?? 0) - (a.volume?.h24 ?? 0))[0]
    const priceUsd = parseFloat(best.priceUsd ?? '0')
    const priceNative = parseFloat(best.priceNative ?? '0')
    if (priceUsd <= 0) return null
    const solPriceUsd = best.quoteToken?.symbol?.toUpperCase() === 'SOL' && priceNative > 0 ? priceUsd / priceNative : 150
    return {
      priceUsd,
      marketCapUsd: best.marketCap ?? best.fdv ?? 0,
      volumeH24Usd: best.volume?.h24 ?? 0,
      priceChangeH24Pct: best.priceChange?.h24 ?? 0,
      liquidityUsd: best.liquidity?.usd ?? 0,
      solPriceUsd,
      pairUrl: best.url ?? '',
      mint: CSGN_MINT,
      updatedAt: new Date().toISOString(),
    }
  } catch {
    return null
  }
}
