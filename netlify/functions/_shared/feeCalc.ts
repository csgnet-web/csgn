// Server-side fee calculation logic — pure functions, no browser deps.
// Extracted from src/lib/dexscreener.ts for use in scheduled Netlify functions.

// Canonical CSGN pump.fun mint — MUST match CSGN_MINT in src/lib/slots.ts.
// The live-earnings poller queries DexScreener for this token; a mismatch
// silently computes fees against the wrong token.
export const CSGN_MINT = 'GFV7fphvprMr1PYpYGPJort2QP7JJLEp3J1Buu7Zpump'
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

const DS_API = 'https://api.dexscreener.com/token-pairs/v1'
const DS_CHAIN = 'solana'

export interface DexData {
  volumeH1Usd: number
  volumeH24Usd: number
  solPriceUsd: number
  marketCapSOL: number
}

export async function fetchDexData(): Promise<DexData | null> {
  try {
    const res = await fetch(`${DS_API}/${DS_CHAIN}/${CSGN_MINT}`, { cache: 'no-store' })
    if (!res.ok) return null
    const pairs = await res.json() as Array<{
      priceNative?: string
      priceUsd?: string
      volume?: { h1?: number; h24?: number }
      marketCap?: number
      fdv?: number
      quoteToken?: { symbol?: string }
    }>
    if (!Array.isArray(pairs) || pairs.length === 0) return null
    const best = [...pairs].sort((a, b) => (b.volume?.h24 ?? 0) - (a.volume?.h24 ?? 0))[0]
    const priceUsd = parseFloat(best.priceUsd ?? '0')
    const priceNative = parseFloat(best.priceNative ?? '0')
    if (priceUsd <= 0) return null
    const solPriceUsd =
      best.quoteToken?.symbol?.toUpperCase() === 'SOL' && priceNative > 0 ? priceUsd / priceNative : 150
    const marketCapUsd = best.marketCap ?? best.fdv ?? 0
    const marketCapSOL = marketCapUsd > 0 && solPriceUsd > 0 ? marketCapUsd / solPriceUsd : 0
    return { volumeH1Usd: best.volume?.h1 ?? 0, volumeH24Usd: best.volume?.h24 ?? 0, solPriceUsd, marketCapSOL }
  } catch {
    return null
  }
}
