// Scheduled background function — runs every minute via cron.
// Executes 4 DexScreener polls at 15-second intervals (t=0, 15s, 30s, 45s).
// Writes live creatorFees to the active slot doc in Firestore.
// Browser clients NEVER call DexScreener — they read from the single Firestore listener.

import { queryCollection, writeDoc, fieldFilter, order } from './_shared/firebaseAdmin'
import {
  buildTokenStatsDoc,
  fetchDexData,
  resolvePumpFeeTier,
  formatTierRange,
  PUMP_FUN_FEE_TIERS,
  STREAMER_SHARE_OF_CREATOR_FEE,
  type DexData,
} from './_shared/feeCalc'

const POLL_INTERVAL_MS = 15_000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface FeeState {
  baselineH24Usd: number
  previousEstimatedVolumeSOL: number
  tierVolumeMap: Record<string, number>
  marketCapCheckpoints: Array<{ capturedAt: string; marketCapSOL: number; tierLabel: string; creatorFeeRate: number }>
}

interface CreatorFees {
  paymentStatus?: string
  streamerWalletAddress?: string
  snapshotLockedAt?: string
  paidAt?: string
  declineReason?: string
}

interface SlotDoc {
  id?: string
  status?: string
  startTime?: string
  endTime?: string
  walletAddress?: string
  creatorFees?: CreatorFees
  _feeState?: FeeState
}

async function findActiveSlot(): Promise<{ path: string; data: SlotDoc } | null> {
  const now = new Date()
  const fromISO = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString()
  const toISO = new Date(now.getTime() + 60 * 60 * 1000).toISOString()

  const rows = await queryCollection(
    'slots',
    [fieldFilter('startTime', 'GREATER_THAN_OR_EQUAL', fromISO), fieldFilter('startTime', 'LESS_THAN_OR_EQUAL', toISO)],
    [order('startTime', 'ASCENDING')],
    5,
  )

  const nowMs = Date.now()
  return (
    rows.find((r) => {
      const s = r.data as SlotDoc
      const start = s.startTime ? new Date(s.startTime).getTime() : 0
      const end = s.endTime ? new Date(s.endTime).getTime() : 0
      return nowMs >= start && nowMs < end && (s.status === 'confirmed' || s.status === 'live')
    }) ?? null
  )
}

/**
 * Advance assigned slots through their clock-driven lifecycle so every surface
 * (admin, /schedule, /queue, /player) sees the same status:
 *   confirmed → live       (once the slot's start time arrives)
 *   confirmed/live → completed (once the slot's end time passes)
 * Runs every minute alongside the fee poll.
 */
async function advanceSlotLifecycles(): Promise<void> {
  try {
    const now = new Date()
    const fromISO = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString()
    const toISO = new Date(now.getTime() + 60 * 1000).toISOString()
    const rows = await queryCollection(
      'slots',
      [fieldFilter('startTime', 'GREATER_THAN_OR_EQUAL', fromISO), fieldFilter('startTime', 'LESS_THAN_OR_EQUAL', toISO)],
      [order('startTime', 'ASCENDING')],
      20,
    )
    const nowMs = Date.now()
    for (const row of rows) {
      const s = row.data as SlotDoc
      const start = s.startTime ? new Date(s.startTime).getTime() : NaN
      const end = s.endTime ? new Date(s.endTime).getTime() : NaN
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue
      let next: string | null = null
      if (s.status === 'confirmed' || s.status === 'live') {
        if (nowMs >= end) next = 'completed'
        else if (nowMs >= start && s.status === 'confirmed') next = 'live'
      }
      if (next) {
        const slotId = row.path.split('/').pop()!
        await writeDoc(`slots/${slotId}`, { status: next, updatedAt: now.toISOString() }, { merge: true })
      }
    }
  } catch (err) {
    console.error('[feePoller] advanceSlotLifecycles error:', err)
  }
}

async function pollAndWrite(dexData: DexData): Promise<void> {
  try {
    const row = await findActiveSlot()
    if (!row) return

    const slotId = row.path.split('/').pop()!
    const slotData = row.data as SlotDoc

    const existing = slotData.creatorFees
    if (existing?.paymentStatus === 'paid' || existing?.paymentStatus === 'declined') return
    if (existing?.snapshotLockedAt) return

    if (slotData.endTime && Date.now() > new Date(slotData.endTime).getTime()) {
      await writeDoc(
        `slots/${slotId}`,
        { 'creatorFees.snapshotLockedAt': new Date().toISOString(), 'creatorFees.updatedAt': new Date().toISOString() },
        { merge: true },
      )
      return
    }

    const { volumeH1Usd, volumeH24Usd, solPriceUsd, marketCapSOL } = dexData

    const prevState: FeeState = slotData._feeState ?? {
      baselineH24Usd: -1,
      previousEstimatedVolumeSOL: 0,
      tierVolumeMap: {},
      marketCapCheckpoints: [],
    }

    const baselineH24Usd = prevState.baselineH24Usd < 0 ? volumeH24Usd : prevState.baselineH24Usd
    const deltaVolumeUsd = Math.max(0, volumeH24Usd - baselineH24Usd)
    const slotStartMs = slotData.startTime ? new Date(slotData.startTime).getTime() : 0
    const slotElapsedMs = Math.max(0, Date.now() - slotStartMs)
    const estimatedSlotVolumeUsd = slotElapsedMs <= 2 * 60 * 60 * 1000 ? Math.max(deltaVolumeUsd, volumeH1Usd) : deltaVolumeUsd
    const deltaVolumeSOL = solPriceUsd > 0 ? estimatedSlotVolumeUsd / solPriceUsd : 0

    const tier = resolvePumpFeeTier(marketCapSOL)
    const tierKey = `${tier.minMarketCapSOL}:${tier.maxMarketCapSOL ?? 'max'}`
    const tierVolumeMap = { ...prevState.tierVolumeMap }
    const incrementalVolumeSOL = Math.max(0, deltaVolumeSOL - prevState.previousEstimatedVolumeSOL)
    tierVolumeMap[tierKey] = (tierVolumeMap[tierKey] ?? 0) + incrementalVolumeSOL

    const checkpoints = [
      ...prevState.marketCapCheckpoints.slice(-23),
      {
        capturedAt: new Date().toISOString(),
        marketCapSOL,
        tierLabel: `${formatTierRange(tier)} (${(tier.creatorFeeRate * 100).toFixed(3)}%)`,
        creatorFeeRate: tier.creatorFeeRate,
      },
    ]

    const feeSOL = Object.entries(tierVolumeMap).reduce((sum, [key, volumeSOL]) => {
      const [minStr] = key.split(':')
      const mapTier = PUMP_FUN_FEE_TIERS.find((t) => t.minMarketCapSOL === Number(minStr)) ?? PUMP_FUN_FEE_TIERS[0]
      return sum + volumeSOL * mapTier.creatorFeeRate * STREAMER_SHARE_OF_CREATOR_FEE
    }, 0)
    const feeUSD = feeSOL * solPriceUsd

    const tierFeeBreakdown = Object.entries(tierVolumeMap)
      .filter(([, v]) => v > 0)
      .map(([key, volumeSOL]) => {
        const [minStr] = key.split(':')
        const mapTier = PUMP_FUN_FEE_TIERS.find((t) => t.minMarketCapSOL === Number(minStr)) ?? PUMP_FUN_FEE_TIERS[0]
        return {
          tierLabel: `${formatTierRange(mapTier)} (${(mapTier.creatorFeeRate * 100).toFixed(3)}%)`,
          marketCapRange: formatTierRange(mapTier),
          creatorFeeRate: mapTier.creatorFeeRate,
          streamerShareRate: mapTier.creatorFeeRate * STREAMER_SHARE_OF_CREATOR_FEE,
          volumeSOL,
          creatorFeeSOL: volumeSOL * mapTier.creatorFeeRate,
          streamerFeeSOL: volumeSOL * mapTier.creatorFeeRate * STREAMER_SHARE_OF_CREATOR_FEE,
        }
      })
      .sort((a, b) => b.volumeSOL - a.volumeSOL)

    const updatedFees = {
      tradingVolumeSOL: deltaVolumeSOL,
      tradingVolumeUSD: estimatedSlotVolumeUsd,
      feeOwedSOL: feeSOL,
      feeOwedUSD: feeUSD,
      marketCapSOL,
      creatorFeeRate: tier.creatorFeeRate,
      streamerShareRate: tier.creatorFeeRate * STREAMER_SHARE_OF_CREATOR_FEE,
      marketCapTierLabel: `${formatTierRange(tier)} (${(tier.creatorFeeRate * 100).toFixed(3)}%)`,
      marketCapTierRange: formatTierRange(tier),
      tierFeeBreakdown,
      marketCapCheckpoints: checkpoints,
      paymentStatus: existing?.paymentStatus ?? 'pending',
      streamerWalletAddress: existing?.streamerWalletAddress ?? slotData.walletAddress ?? '',
      updatedAt: new Date().toISOString(),
      ...(existing?.paidAt ? { paidAt: existing.paidAt } : {}),
      ...(existing?.declineReason ? { declineReason: existing.declineReason } : {}),
    }

    const newFeeState: FeeState = {
      baselineH24Usd,
      previousEstimatedVolumeSOL: Math.max(prevState.previousEstimatedVolumeSOL, deltaVolumeSOL),
      tierVolumeMap,
      marketCapCheckpoints: checkpoints,
    }

    await writeDoc(`slots/${slotId}`, { creatorFees: updatedFees, _feeState: newFeeState }, { merge: true })
  } catch (err) {
    console.error('[feePoller] pollAndWrite error:', err)
  }
}

// Netlify scheduled background function — handler runs once per cron invocation.
// Executes 4 polls at 15s intervals within the single invocation. Each tick
// fetches DexScreener once; the first successful tick also refreshes
// public/tokenStats (~1 write/min) so token stats flow 24/7 even when no slot
// is live.
export const handler = async () => {
  // Advance clock-driven slot statuses first so /player, admin, /schedule and
  // /queue all agree on which slot is confirmed / live / completed right now.
  await advanceSlotLifecycles()

  let tokenStatsWritten = false
  for (let i = 0; i < 4; i++) {
    const dexData = await fetchDexData()
    if (dexData) {
      if (!tokenStatsWritten) {
        try {
          await writeDoc('public/tokenStats', buildTokenStatsDoc(dexData), { merge: false })
          tokenStatsWritten = true
        } catch (err) {
          console.error('[feePoller] tokenStats write error:', err)
        }
      }
      await pollAndWrite(dexData)
    }
    if (i < 3) await sleep(POLL_INTERVAL_MS)
  }
}
