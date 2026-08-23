// Server-side fee calculation logic — pure functions, no browser deps.
// Extracted from src/lib/dexscreener.ts for use in scheduled Netlify functions.

// Must stay in sync with CSGN_MINT in src/lib/slots.ts (functions and src have
// separate build graphs — do not cross-import).
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

/* ─── Verified airtime ─── */

/**
 * The fee a slot generated is what the VOLUME produced. What we owe is that
 * number scaled by how much of the slot the streamer was actually broadcasting.
 * This is the single home of that rule: the poller computes it and stores the
 * result on the slot, and every surface — /watch, /account, the admin Payable
 * view — reads the stored value. There is deliberately no client-side twin.
 */

/** At or above this share of samples live, the hour pays in full. An encoder
 *  restart, a Twitch hiccup or a five-minute BRB costs the streamer nothing. */
export const AIRTIME_FULL_CREDIT = 0.85
/** Below this share, the hour pays nothing — the stream did not happen. */
export const AIRTIME_FLOOR = 0.20
/** Below this many samples we cannot judge the hour at all. */
export const AIRTIME_MIN_SAMPLES = 10

export type AirtimeReason = 'full' | 'prorated' | 'no_show' | 'unverified'

export interface AirtimeResult {
  /** What to multiply the gross fee by. */
  fraction: number
  /** Live samples ÷ samples taken. Reported even when it didn't decide the fraction. */
  ratio: number
  reason: AirtimeReason
}

/**
 * The payable fraction of a slot's gross creator fee.
 *
 * THE DENOMINATOR IS SAMPLES TAKEN, NEVER SLOT MINUTES. Netlify's scheduler is
 * at-least-once and drifts, and the poller self-throttles at 45s
 * (`shouldRunPoll`), so an hour can easily produce 40 samples instead of 60.
 * Dividing by wall-clock minutes would dock a streamer a third of their fee for
 * OUR outage. Divide by what we actually asked, and a run we never made simply
 * doesn't count against anyone.
 *
 * The bands:
 *   • fewer than AIRTIME_MIN_SAMPLES samples → `unverified`, fraction 1.0.
 *     Thin telemetry is our problem, so it fails OPEN toward the streamer and
 *     gets flagged for review — the same posture as the `walletCheck:
 *     'unavailable'` fail-open in signupWithPhantom.ts.
 *   • ratio ≥ AIRTIME_FULL_CREDIT → paid in full. The grace band.
 *   • ratio in [AIRTIME_FLOOR, AIRTIME_FULL_CREDIT) → paid that share of the
 *     hour. Pro-rating means exactly what it says — live for 60% of the samples
 *     pays 60% — because a rescaled curve would be a second penalty on top of
 *     the missing minutes and would stop being explicable in one sentence.
 *   • ratio < AIRTIME_FLOOR → nothing, `no_show`.
 */
export function payableAirtime(activity: { liveCheckCount: number; checkCount: number }): AirtimeResult {
  const checkCount = Math.max(0, Math.floor(Number(activity?.checkCount) || 0))
  // A live count above the sample count is corrupt telemetry (a slot sampled
  // before checkCount existed, say). Clamp rather than report a ratio > 1.
  const liveCheckCount = Math.min(checkCount, Math.max(0, Math.floor(Number(activity?.liveCheckCount) || 0)))
  // Guarded rather than relying on the band checks: zero samples is the normal
  // state of a slot nobody has polled yet, not an edge case.
  const ratio = checkCount > 0 ? liveCheckCount / checkCount : 0

  if (checkCount < AIRTIME_MIN_SAMPLES) return { fraction: 1, ratio, reason: 'unverified' }
  if (ratio >= AIRTIME_FULL_CREDIT) return { fraction: 1, ratio, reason: 'full' }
  if (ratio < AIRTIME_FLOOR) return { fraction: 0, ratio, reason: 'no_show' }
  return { fraction: ratio, ratio, reason: 'prorated' }
}

/**
 * When verified airtime started deciding money.
 *
 * A completed hour's terms are settled. Re-scoring one after the fact — even
 * upward — is the credibility loss this product is built against, so the rule
 * binds on slots that START at or after the cutover and never reaches back.
 * Mechanically a finished slot is never re-polled either; this gate is what
 * stops an hour that was already ON AIR when the change shipped from having its
 * terms changed underneath the person streaming it.
 */
export const AIRTIME_DEFAULT_START_AT = '2026-08-15T00:00:00.000Z'

/** Cutover instant from `config/season`, falling back to the shipped default.
 *  Anything that isn't an ISO date string falls back too: `Date.parse` reads
 *  plenty of junk as a real date (`'42'` is the year 2042), and a config typo
 *  that silently moves the cutover a decade out would switch the rule off for
 *  every slot with nothing to show why. */
export function airtimeStartMs(config: { airtimeStartAt?: unknown } | null | undefined): number {
  const raw = config?.airtimeStartAt
  const configured = typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}/.test(raw) ? Date.parse(raw) : NaN
  return Number.isFinite(configured) ? configured : Date.parse(AIRTIME_DEFAULT_START_AT)
}

/** Does the verified-airtime rule apply to this slot at all? */
export function airtimeAppliesToSlot(slotStartTime: string | undefined, startMs: number): boolean {
  const start = Date.parse(String(slotStartTime ?? ''))
  return Number.isFinite(start) && start >= startMs
}

const DS_API = 'https://api.dexscreener.com/token-pairs/v1'
const DS_CHAIN = 'solana'

export interface DexData {
  volumeH1Usd: number
  volumeH24Usd: number
  solPriceUsd: number
  marketCapSOL: number
  priceUsd: number
  marketCapUsd: number
  priceChangeH24Pct: number
  liquidityUsd: number
  pairUrl: string
}

export interface TokenStatsDoc {
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

export function buildTokenStatsDoc(dex: DexData): TokenStatsDoc {
  return {
    priceUsd: dex.priceUsd,
    marketCapUsd: dex.marketCapUsd,
    volumeH24Usd: dex.volumeH24Usd,
    priceChangeH24Pct: dex.priceChangeH24Pct,
    liquidityUsd: dex.liquidityUsd,
    solPriceUsd: dex.solPriceUsd,
    pairUrl: dex.pairUrl,
    mint: CSGN_MINT,
    updatedAt: new Date().toISOString(),
  }
}

export async function fetchDexData(): Promise<DexData | null> {
  try {
    const res = await fetch(`${DS_API}/${DS_CHAIN}/${CSGN_MINT}`, { cache: 'no-store' })
    if (!res.ok) return null
    const pairs = await res.json() as Array<{
      url?: string
      priceNative?: string
      priceUsd?: string
      volume?: { h1?: number; h24?: number }
      priceChange?: { h24?: number }
      liquidity?: { usd?: number }
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
    return {
      volumeH1Usd: best.volume?.h1 ?? 0,
      volumeH24Usd: best.volume?.h24 ?? 0,
      solPriceUsd,
      marketCapSOL,
      priceUsd,
      marketCapUsd,
      priceChangeH24Pct: best.priceChange?.h24 ?? 0,
      liquidityUsd: best.liquidity?.usd ?? 0,
      pairUrl: best.url ?? '',
    }
  } catch {
    return null
  }
}
