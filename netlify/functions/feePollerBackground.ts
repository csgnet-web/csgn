// Scheduled background function — runs every minute via cron.
// Executes 4 DexScreener polls at 15-second intervals (t=0, 15s, 30s, 45s).
// Writes live creatorFees to the active slot doc in Firestore.
// Browser clients NEVER call DexScreener — they read from the single Firestore listener.

import { queryCollection, writeDoc, commitWrites, createWrite, fieldFilter, order } from './_shared/firebaseAdmin'
import { buildExpectedSlotsForDate, buildSlotDoc } from './_shared/schedule'
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

interface StreamActivity {
  channel?: string
  lastCheckedAt?: string
  lastLive?: boolean
  firstLiveAt?: string
  lastLiveAt?: string
  liveCheckCount?: number
  checkpoints?: string[]
}

interface SlotDoc {
  id?: string
  status?: string
  startTime?: string
  endTime?: string
  streamUrl?: string
  walletAddress?: string
  creatorFees?: CreatorFees
  streamActivity?: StreamActivity
  _feeState?: FeeState
}

/* ─── Twitch Helix: verify the slot's channel is actually live ─── */

let cachedTwitchToken: { token: string; exp: number } | null = null

async function twitchAppToken(): Promise<string | null> {
  const clientId = process.env.TWITCH_CLIENT_ID
  const clientSecret = process.env.TWITCH_CLIENT_SECRET
  if (!clientId || !clientSecret) return null
  const now = Date.now()
  if (cachedTwitchToken && cachedTwitchToken.exp > now + 60_000) return cachedTwitchToken.token
  try {
    const res = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { access_token?: string; expires_in?: number }
    if (!data.access_token) return null
    cachedTwitchToken = { token: data.access_token, exp: now + (data.expires_in ?? 3600) * 1000 }
    return cachedTwitchToken.token
  } catch {
    return null
  }
}

function twitchLoginFromUrl(url?: string): string | null {
  if (!url) return null
  const match = String(url).match(/twitch\.tv\/([^/?#]+)/i)
  return match ? match[1].replace(/^@/, '').toLowerCase() : null
}

async function isTwitchChannelLive(login: string, token: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(login)}`, {
      headers: { 'Client-Id': process.env.TWITCH_CLIENT_ID || '', Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return false
    const data = (await res.json()) as { data?: unknown[] }
    return Array.isArray(data.data) && data.data.length > 0
  } catch {
    return false
  }
}

/**
 * Once a minute, sample whether the active slot's Twitch channel is actually
 * broadcasting and append a timestamp to the slot's streamActivity log. Kept in
 * a separate top-level field so the fee-poll writes never clobber it.
 */
async function logSlotActivity(): Promise<void> {
  try {
    const row = await findActiveSlot()
    if (!row) return
    const slot = row.data as SlotDoc
    const login = twitchLoginFromUrl(slot.streamUrl)
    if (!login) return
    const token = await twitchAppToken()
    if (!token) return

    const live = await isTwitchChannelLive(login, token)
    const nowISO = new Date().toISOString()
    const prev = slot.streamActivity ?? {}
    const prevCheckpoints = Array.isArray(prev.checkpoints) ? prev.checkpoints : []
    // Keep the last ~4h of per-minute samples (well within a 2h slot + buffer).
    const checkpoints = live ? [...prevCheckpoints, nowISO].slice(-240) : prevCheckpoints

    const streamActivity: StreamActivity = {
      channel: login,
      lastCheckedAt: nowISO,
      lastLive: live,
      firstLiveAt: prev.firstLiveAt ?? (live ? nowISO : undefined),
      lastLiveAt: live ? nowISO : prev.lastLiveAt,
      liveCheckCount: (prev.liveCheckCount ?? 0) + (live ? 1 : 0),
      checkpoints,
    }

    const slotId = row.path.split('/').pop()!
    await writeDoc(`slots/${slotId}`, { streamActivity }, { merge: true })
  } catch (err) {
    console.error('[feePoller] logSlotActivity error:', err)
  }
}

/* ─── Schedule top-up: keep the next week of slots always seeded ─── */

const DEFAULT_STREAM_URL = 'https://twitch.tv/csgnet'
/** Refill when the farthest-out slot is closer than this. */
const MIN_HORIZON_DAYS = 5
/** Refill out to this many days ahead. */
const TARGET_HORIZON_DAYS = 7

/**
 * The schedule used to empty out after a few days because slot creation was a
 * manual admin action. This runs every minute but is engineered to cost almost
 * nothing: one 1-doc query checks how far out the schedule extends, and only
 * when the horizon drops under MIN_HORIZON_DAYS (i.e. ~once a day) does it do
 * a real fill out to TARGET_HORIZON_DAYS.
 *
 * The fill is strictly CREATE-ONLY (Firestore create preconditions): existing
 * slots — including any the admin retyped, assigned, or hand-edited — are
 * never patched or deleted here. Deterministic doc IDs make the fill
 * idempotent, so a racing admin reseed at worst fails one commit and the next
 * minute's run picks it back up.
 */
async function topUpSchedule(): Promise<void> {
  try {
    const nowMs = Date.now()

    const latest = await queryCollection('slots', [], [order('startTime', 'DESCENDING')], 1)
    const latestStartMs = latest.length ? new Date(String(latest[0].data.startTime ?? 0)).getTime() : 0
    if (latestStartMs >= nowMs + MIN_HORIZON_DAYS * 24 * 60 * 60 * 1000) return

    // Expected slots for every ET day from today out to the target horizon.
    const expected = new Map<string, ReturnType<typeof buildExpectedSlotsForDate>[number]>()
    for (let i = 0; i <= TARGET_HORIZON_DAYS; i++) {
      const day = new Date(nowMs + i * 24 * 60 * 60 * 1000)
      for (const slot of buildExpectedSlotsForDate(day)) {
        // Skip slots already fully in the past — no point seeding history.
        if (new Date(slot.endTime).getTime() > nowMs) expected.set(slot.id, slot)
      }
    }
    if (expected.size === 0) return

    // One ranged query over the fill window tells us which already exist.
    const starts = [...expected.values()].map((s) => new Date(s.startTime).getTime())
    const fromISO = new Date(Math.min(...starts)).toISOString()
    const toISO = new Date(Math.max(...starts)).toISOString()
    const existing = await queryCollection(
      'slots',
      [fieldFilter('startTime', 'GREATER_THAN_OR_EQUAL', fromISO), fieldFilter('startTime', 'LESS_THAN_OR_EQUAL', toISO)],
      [order('startTime', 'ASCENDING')],
      (TARGET_HORIZON_DAYS + 2) * 12 + 10,
    )
    const existingIds = new Set(existing.map((r) => r.path.split('/').pop()!))

    const writes = [...expected.values()]
      .filter((slot) => !existingIds.has(slot.id))
      .map((slot) => createWrite(`slots/${slot.id}`, buildSlotDoc(slot, DEFAULT_STREAM_URL)))
    if (writes.length === 0) return

    await commitWrites(writes)
    console.log(`[feePoller] topUpSchedule created ${writes.length} slots (horizon was ${((latestStartMs - nowMs) / 86_400_000).toFixed(1)}d)`)
  } catch (err) {
    console.error('[feePoller] topUpSchedule error:', err)
  }
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
  // Keep the schedule seeded ~a week out so it never runs empty. Cheap check
  // every minute; real work only when the horizon actually shrinks (~daily).
  await topUpSchedule()

  // Advance clock-driven slot statuses first so /player, admin, /schedule and
  // /queue all agree on which slot is confirmed / live / completed right now.
  await advanceSlotLifecycles()

  // Sample real Twitch activity for the active slot (1 Helix call/min) so the
  // Creator Fees log can prove the streamer was actually live, not intermission.
  await logSlotActivity()

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
