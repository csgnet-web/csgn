/**
 * Live fee tracking via DexScreener token-pairs endpoint.
 *
 * Polls every 30s, captures h24 USD-volume delta during an active slot,
 * converts to SOL, and applies creator fee rate based on market-cap tiers.
 */

import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { CSGN_MINT, type CreatorFees } from '@/lib/slots'

const DS_API = 'https://api.dexscreener.com/token-pairs/v1'
const DS_CHAIN = 'solana'
const POLL_INTERVAL_MS = 30_000
const MIN_API_CALL_INTERVAL_MS = 1_500 // <= 40 calls/minute per client
const CACHE_TTL_MS = 2_000

interface DexPair {
  priceNative?: string
  priceUsd?: string
  volume?: { h24?: number }
  marketCap?: number
  fdv?: number
  quoteToken?: { symbol?: string }
}

type DexResponse = DexPair[]

// Manual payout mode: streamer-facing live earnings are 30% of slot volume.
const STREAMER_SHARE = 0.3
export function estimateCreatorFeeSOL(tradingVolumeSOL: number, _marketCapSOL: number): number {
  return tradingVolumeSOL * STREAMER_SHARE
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

    // For SOL quote pairs, `priceNative` is token price in SOL.
    // So SOL/USD = token/USD ÷ token/SOL.
    const solPriceUsd = best.quoteToken?.symbol?.toUpperCase() === 'SOL' && priceNative > 0
      ? priceUsd / priceNative
      : 150

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

async function saveFeeToFirestore(slotId: string, tradingVolumeSOL: number, feeOwedSOL: number, tradingVolumeUSD: number, feeOwedUSD: number): Promise<void> {
  try {
    const slotRef = doc(db, 'slots', slotId)
    const snap = await getDoc(slotRef)
    if (!snap.exists()) return

    const existing = snap.data()?.creatorFees as CreatorFees | undefined
    if (existing?.paymentStatus === 'paid' || existing?.paymentStatus === 'declined') return

    const fees: CreatorFees = {
      tradingVolumeSOL,
      tradingVolumeUSD,
      feeOwedSOL,
      feeOwedUSD,
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
  onUpdate: (feeSOL: number, volumeSOL: number, feeUSD: number, volumeUSD: number) => void
}

export function startFeeTracker(options: FeeTrackerOptions): () => void {
  const { slotId, slotEndTime, onUpdate } = options

  let baselineH24Usd: number | null = null
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

    if (baselineH24Usd === null) baselineH24Usd = volumeH24Usd

    const deltaVolumeUsd = Math.max(0, volumeH24Usd - baselineH24Usd)
    const deltaVolumeSOL = solPriceUsd > 0 ? deltaVolumeUsd / solPriceUsd : 0

    const feeSOL = estimateCreatorFeeSOL(deltaVolumeSOL, marketCapSOL)
    const feeUSD = deltaVolumeUsd * STREAMER_SHARE

    onUpdate(feeSOL, deltaVolumeSOL, feeUSD, deltaVolumeUsd)
    await saveFeeToFirestore(slotId, deltaVolumeSOL, feeSOL, deltaVolumeUsd, feeUSD)
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
