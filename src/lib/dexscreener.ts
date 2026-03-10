/**
 * Live fee tracking via DexScreener.
 *
 * Polls the DexScreener API every 30 seconds for the CSGN/SOL trading pair.
 * Computes block-specific volume by taking the delta from the h24 baseline
 * recorded at slot start. Converts USD volume to SOL and applies the 0.3%
 * pump.fun creator fee rate. Auto-saves to Firestore `slots/{id}.creatorFees`
 * so the admin sees a live owed amount without any manual input.
 */

import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { CSGN_MINT, type CreatorFees } from '@/lib/slots'

const DS_API = 'https://api.dexscreener.com/latest/dex/tokens'
const POLL_INTERVAL_MS = 30_000

interface DexPair {
  baseToken: { address: string; symbol: string }
  quoteToken: { address: string; symbol: string }
  priceNative: string   // base token price in quote token (SOL for CSGN/SOL)
  priceUsd: string      // base token price in USD
  volume: { h24: number }
  liquidity?: { usd: number }
}

interface DexResponse {
  pairs: DexPair[] | null
}

/** Fetch the best CSGN pair from DexScreener and return h24 volume in USD + SOL price. */
async function fetchCsgnData(): Promise<{ volumeH24Usd: number; solPriceUsd: number } | null> {
  try {
    const res = await fetch(`${DS_API}/${CSGN_MINT}`, { cache: 'no-store' })
    if (!res.ok) return null
    const data: DexResponse = await res.json()

    const pairs = data.pairs ?? []
    if (pairs.length === 0) return null

    // Pick the pair with the highest 24h volume (most liquid / most relevant)
    const best = [...pairs].sort((a, b) => (b.volume?.h24 ?? 0) - (a.volume?.h24 ?? 0))[0]

    const csgnPriceUsd = parseFloat(best.priceUsd ?? '0')
    const csgnPriceInSol = parseFloat(best.priceNative ?? '0')

    // Derive SOL price: solPriceUsd = csgnPriceUsd / csgnPriceInSol
    const solPriceUsd = csgnPriceInSol > 0 ? csgnPriceUsd / csgnPriceInSol : 0

    return {
      volumeH24Usd: best.volume?.h24 ?? 0,
      solPriceUsd,
    }
  } catch {
    return null
  }
}

/** Auto-save live fee data to Firestore for the given slot. */
async function saveFeeToFirestore(
  slotId: string,
  tradingVolumeSOL: number,
  feeOwedSOL: number,
): Promise<void> {
  try {
    const slotRef = doc(db, 'slots', slotId)
    const snap = await getDoc(slotRef)
    if (!snap.exists()) return

    const existing = snap.data()?.creatorFees as CreatorFees | undefined

    // Don't overwrite if already marked as paid or declined
    if (existing?.paymentStatus === 'paid' || existing?.paymentStatus === 'declined') return

    const fees: CreatorFees = {
      tradingVolumeSOL,
      feeOwedSOL,
      paymentStatus: existing?.paymentStatus ?? 'pending',
      streamerWalletAddress: existing?.streamerWalletAddress ?? '',
      updatedAt: new Date().toISOString(),
      ...(existing?.paidAt ? { paidAt: existing.paidAt } : {}),
      ...(existing?.declineReason ? { declineReason: existing.declineReason } : {}),
    }

    await updateDoc(slotRef, { creatorFees: fees })
  } catch {
    // Non-critical: silently ignore Firestore errors during live tracking
  }
}

/**
 * Fetch the rolling 24-hour creator fee earnings in USD.
 * Returns 0.3% of the 24h trading volume in USD, or null if unavailable.
 */
export async function fetchDailyEarningsUSD(): Promise<number | null> {
  const data = await fetchCsgnData()
  if (!data) return null
  return data.volumeH24Usd * 0.003
}

export interface FeeTrackerOptions {
  /** Firestore slot document ID */
  slotId: string
  /** ISO string of when the slot ends — polling stops after this */
  slotEndTime: string
  /** Called every 30s with the latest computed fee in SOL */
  onUpdate: (feeSOL: number, volumeSOL: number) => void
}

/**
 * Start polling DexScreener every 30s for live CSGN trading volume.
 * Records a baseline h24 volume on first poll so delta reflects only
 * the current block's trades. Converts USD → SOL and computes fee.
 *
 * Returns a cleanup function that stops polling.
 */
export function startFeeTracker(options: FeeTrackerOptions): () => void {
  const { slotId, slotEndTime, onUpdate } = options

  let baselineH24Usd: number | null = null
  let baselineSolPrice: number | null = null
  let intervalId: ReturnType<typeof setInterval> | null = null
  let stopped = false

  const poll = async () => {
    if (stopped) return

    // Stop after slot ends
    if (Date.now() > new Date(slotEndTime).getTime()) {
      stop()
      return
    }

    const data = await fetchCsgnData()
    if (!data) return

    const { volumeH24Usd, solPriceUsd } = data

    // Record baseline on first successful fetch
    if (baselineH24Usd === null) {
      baselineH24Usd = volumeH24Usd
      baselineSolPrice = solPriceUsd
    }

    const effectiveSolPrice = solPriceUsd > 0 ? solPriceUsd : (baselineSolPrice ?? 150)
    if (effectiveSolPrice === 0) return

    // Delta volume = new h24 minus baseline (block-specific volume)
    const deltaVolumeUsd = Math.max(0, volumeH24Usd - baselineH24Usd)
    const deltaVolumeSOL = deltaVolumeUsd / effectiveSolPrice

    // pump.fun creator fee: 0.3% of trading volume
    const feeSOL = deltaVolumeSOL * 0.003

    onUpdate(feeSOL, deltaVolumeSOL)

    // Persist to Firestore so admin sees live data
    await saveFeeToFirestore(slotId, deltaVolumeSOL, feeSOL)
  }

  const stop = () => {
    stopped = true
    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  // First poll immediately, then every 30s
  poll()
  intervalId = setInterval(poll, POLL_INTERVAL_MS)

  return stop
}
