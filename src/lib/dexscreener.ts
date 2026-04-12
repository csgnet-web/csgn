/**
 * Live fee tracking via DexScreener token-pairs endpoint.
 *
 * Polls every 30s, captures h24 USD-volume delta during an active slot,
 * converts to SOL, and applies creator fee rate based on market-cap tiers.
 */

import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { CSGN_MINT, type CreatorFees } from '@/lib/slots'

const DS_API = 'https://api.dexscreener.com/token-pairs/v1'
const DS_CHAIN = 'solana'
const POLL_INTERVAL_MS = 30_000

interface DexPair {
  priceNative?: string
  priceUsd?: string
  volume?: { h24?: number }
  marketCap?: number
  fdv?: number
  quoteToken?: { symbol?: string }
}

type DexResponse = DexPair[]

const CREATOR_FEE_TIERS = [
  { min: 0, max: 420, creatorBps: 0.3 },
  { min: 420, max: 1470, creatorBps: 0.95 },
  { min: 1470, max: 2460, creatorBps: 0.9 },
  { min: 2460, max: 3440, creatorBps: 0.85 },
  { min: 3440, max: 4420, creatorBps: 0.8 },
  { min: 4420, max: 9820, creatorBps: 0.75 },
  { min: 9820, max: 14740, creatorBps: 0.7 },
  { min: 14740, max: 19650, creatorBps: 0.65 },
  { min: 19650, max: 24560, creatorBps: 0.6 },
  { min: 24560, max: 29470, creatorBps: 0.55 },
  { min: 29470, max: 34380, creatorBps: 0.5 },
  { min: 34380, max: 39300, creatorBps: 0.45 },
  { min: 39300, max: 44210, creatorBps: 0.4 },
] as const

function getCreatorFeeRate(marketCapSOL: number): number {
  const tier = CREATOR_FEE_TIERS.find((t) => marketCapSOL >= t.min && marketCapSOL < t.max)
  const bps = tier?.creatorBps ?? CREATOR_FEE_TIERS[CREATOR_FEE_TIERS.length - 1].creatorBps
  return bps / 100
}

/** Fetch best pair and return h24 volume + SOL conversion inputs. */
async function fetchCsgnData(): Promise<{ volumeH24Usd: number; solPriceUsd: number; marketCapSOL: number } | null> {
  try {
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

    return {
      volumeH24Usd: best.volume?.h24 ?? 0,
      solPriceUsd,
      marketCapSOL,
    }
  } catch {
    return null
  }
}

async function saveFeeToFirestore(slotId: string, tradingVolumeSOL: number, feeOwedSOL: number): Promise<void> {
  try {
    const slotRef = doc(db, 'slots', slotId)
    const snap = await getDoc(slotRef)
    if (!snap.exists()) return

    const existing = snap.data()?.creatorFees as CreatorFees | undefined
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
    // ignore background failures
  }
}

export interface FeeTrackerOptions {
  slotId: string
  slotEndTime: string
  onUpdate: (feeSOL: number, volumeSOL: number) => void
}

export function startFeeTracker(options: FeeTrackerOptions): () => void {
  const { slotId, slotEndTime, onUpdate } = options

  let baselineH24Usd: number | null = null
  let intervalId: ReturnType<typeof setInterval> | null = null
  let stopped = false

  const poll = async () => {
    if (stopped) return

    if (Date.now() > new Date(slotEndTime).getTime()) {
      stop()
      return
    }

    const data = await fetchCsgnData()
    if (!data) return

    const { volumeH24Usd, solPriceUsd, marketCapSOL } = data

    if (baselineH24Usd === null) baselineH24Usd = volumeH24Usd

    const deltaVolumeUsd = Math.max(0, volumeH24Usd - baselineH24Usd)
    const deltaVolumeSOL = solPriceUsd > 0 ? deltaVolumeUsd / solPriceUsd : 0

    const feeRate = getCreatorFeeRate(marketCapSOL)
    const feeSOL = deltaVolumeSOL * feeRate

    onUpdate(feeSOL, deltaVolumeSOL)
    await saveFeeToFirestore(slotId, deltaVolumeSOL, feeSOL)
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
