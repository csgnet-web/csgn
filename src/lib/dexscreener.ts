/**
 * Live fee tracking via DexScreener token-pairs endpoint.
 *
 * Polls every 60s, captures h24 USD-volume delta during an active slot,
 * converts to SOL, and applies creator fee rate based on market-cap tiers.
 */

import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { CSGN_MINT, type CreatorFees } from '@/lib/slots'

const DS_API = 'https://api.dexscreener.com/token-pairs/v1'
const DS_CHAIN = 'solana'
const POLL_INTERVAL_MS = 60_000
const MIN_API_CALL_INTERVAL_MS = 1_500 // <= 40 calls/minute per client
const CACHE_TTL_MS = 2_000
const STREAMER_SHARE_OF_CREATOR_FEE = 0.3

interface DexPair {
  priceNative?: string
  priceUsd?: string
  volume?: { h1?: number; h24?: number }
  marketCap?: number
  fdv?: number
  quoteToken?: { symbol?: string }
}

type DexResponse = DexPair[]

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

let lastFetchAt = 0
let cachedData: { volumeH24Usd: number; solPriceUsd: number; marketCapSOL: number } | null = null

/** Fetch best pair and return h24 volume + SOL conversion inputs. */
async function fetchCsgnData(): Promise<{ volumeH24Usd: number; solPriceUsd: number; marketCapSOL: number } | null> {
  try {
    const now = Date.now()
    if (cachedData && now - lastFetchAt < CACHE_TTL_MS) return cachedData
    if (now - lastFetchAt < MIN_API_CALL_INTERVAL_MS) return cachedData
    lastFetchAt = now

    const res = await fetch(`${DS_API}/${DS_CHAIN}/${CSGN_MINT}`, { cache: 'no-store' })
    if (!res.ok) return null
    const pairs: DexResponse = await res.json()

    if (!Array.isArray(pairs) || pairs.length === 0) return null

    const best = [...pairs].sort((a, b) => (b.volume?.h24 ?? 0) - (a.volume?.h24 ?? 0))[0]
    const priceUsd = parseFloat(best.priceUsd ?? '0')
    const priceNative = parseFloat(best.priceNative ?? '0')
    if (priceUsd <= 0) return null

    const solPriceUsd = best.quoteToken?.symbol?.toUpperCase() === 'SOL' && priceNative > 0 ? priceUsd / priceNative : 150
    const marketCapUsd = best.marketCap ?? best.fdv ?? 0
    const marketCapSOL = marketCapUsd > 0 && solPriceUsd > 0 ? marketCapUsd / solPriceUsd : 0

    cachedData = {
      volumeH24Usd: best.volume?.h24 ?? 0,
      solPriceUsd,
      marketCapSOL,
    }
    return cachedData
  } catch {
    return null
  }
}

async function saveFeeToFirestore(
  slotId: string,
  tradingVolumeSOL: number,
  feeOwedSOL: number,
  feeMultiplier: number,
  trackerLastH24Usd: number,
): Promise<void> {
  try {
    const slotRef = doc(db, 'slots', slotId)
    const snap = await getDoc(slotRef)
    if (!snap.exists()) return

    const existing = snap.data()?.creatorFees as CreatorFees | undefined
    if (existing?.paymentStatus === 'paid' || existing?.paymentStatus === 'declined') return

    const fees: CreatorFees = {
      tradingVolumeSOL,
      feeOwedSOL,
      feeMultiplier,
      trackerLastH24Usd,
      paymentStatus: existing?.paymentStatus ?? 'pending',
      streamerWalletAddress: existing?.streamerWalletAddress ?? '',
      updatedAt: new Date().toISOString(),
      ...(existing?.paidAt ? { paidAt: existing.paidAt } : {}),
      ...(existing?.declineReason ? { declineReason: existing.declineReason } : {}),
    }

    await updateDoc(slotRef, { creatorFees: fees })
  } catch {
    // ignore background failures
  }
}

async function lockFeeSnapshot(slotId: string): Promise<void> {
  try {
    const slotRef = doc(db, 'slots', slotId)
    const snap = await getDoc(slotRef)
    if (!snap.exists()) return
    const existing = snap.data()?.creatorFees as CreatorFees | undefined
    if (!existing || existing.snapshotLockedAt) return
    await updateDoc(slotRef, { 'creatorFees.snapshotLockedAt': serverTimestamp(), 'creatorFees.updatedAt': new Date().toISOString() })
  } catch {
    // keep existing retry behavior (none)
  }
}

export interface FeeTrackerOptions {
  slotId: string
  slotEndTime: string
  onUpdate?: (feeSOL: number, volumeSOL: number, feeUSD: number, volumeUSD: number) => void
}

export function startFeeTracker(options: FeeTrackerOptions): () => void {
  const { slotId, slotEndTime, onUpdate } = options

  let intervalId: ReturnType<typeof setInterval> | null = null
  let stopped = false

  const poll = async () => {
    if (stopped) return

    if (Date.now() > new Date(slotEndTime).getTime()) {
      await lockFeeSnapshot(slotId)
      stop()
      return
    }

    const data = await fetchCsgnData()
    if (!data) return

    const { volumeH24Usd, solPriceUsd, marketCapSOL } = data
    const slotRef = doc(db, 'slots', slotId)
    const snap = await getDoc(slotRef)
    if (!snap.exists()) return
    const existing = snap.data()?.creatorFees as CreatorFees | undefined
    if (existing?.paymentStatus === 'paid' || existing?.paymentStatus === 'declined') return

    const previousH24 = existing?.trackerLastH24Usd
    const incrementalVolumeUsd = typeof previousH24 === 'number' ? Math.max(0, volumeH24Usd - previousH24) : 0
    const incrementalVolumeSOL = solPriceUsd > 0 ? incrementalVolumeUsd / solPriceUsd : 0
    const totalVolumeSOL = (existing?.tradingVolumeSOL ?? 0) + incrementalVolumeSOL

    const tier = resolvePumpFeeTier(marketCapSOL)
    const feeMultiplier = Math.min(tier.creatorFeeRate * STREAMER_SHARE_OF_CREATOR_FEE, 0.0009)
    const feeSOL = totalVolumeSOL * feeMultiplier

    onUpdate?.(feeSOL, totalVolumeSOL, 0, 0)
    await saveFeeToFirestore(slotId, totalVolumeSOL, feeSOL, feeMultiplier, volumeH24Usd)
  }

  const stop = () => {
    stopped = true
    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  poll()
  intervalId = setInterval(poll, POLL_INTERVAL_MS)

  return stop
}
