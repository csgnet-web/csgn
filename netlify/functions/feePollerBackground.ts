// Scheduled background function — runs every minute via cron.
// One DexScreener poll per run (it used to be four, 15 seconds apart, which
// cost 45 seconds of billed container time every single minute).
// Writes live creatorFees to the active slot doc in Firestore.
// Browser clients NEVER call DexScreener — they read from the single Firestore listener.
//
// ── Why this function guards itself ────────────────────────────────────────
//
// Netlify serves every function at /.netlify/functions/<name>, scheduled ones
// included, so "it's a cron job" is not an access control. Anyone who knows the
// path could invoke this, and each invocation is still the most expensive
// thing in the codebase: a DexScreener call, a Twitch Helix call, and a run of
// slot-lifecycle, vote-settlement and meme-board writes to Firestore — all
// billed as wall clock. Being a *background* function makes it worse, not better — it
// returns to the caller immediately and keeps working, so requests stack
// concurrently instead of queueing.
//
// Two independent controls, because the first one is infrastructure and the
// second one is code:
//
//  1. netlify.toml returns 404 for the public path. Public HTTP is served by
//     the CDN; the scheduler invokes internally and never crosses it, so this
//     blocks the outside world without touching the cron.
//  2. The single-flight lock below. Even a caller who gets past (1) — an
//     operator with the redirect removed, a future route change, a retry storm
//     from the scheduler itself — cannot stack overlapping runs, because a run
//     that starts within MIN_RUN_INTERVAL_MS of the last one exits immediately.
//
// The lock deliberately does NOT throw and is deliberately shorter than the
// cron period: a guard that can reject the real scheduled run would be a
// self-inflicted outage on the job that drives fees, slot lifecycle and token
// stats. It skips, it never fails.
//
// ── The name lies, and it matters ──────────────────────────────────────────
//
// This file is called `feePollerBackground.ts`, but Netlify's background
// convention needs a HYPHEN — `something-background.ts`. So this is an ordinary
// scheduled function with an ordinary execution ceiling (tens of seconds), not
// a 15-minute background one.
//
// That was not a cosmetic problem. The old version of this function polled
// DexScreener four times with `await sleep(15_000)` between them, so the run
// was ~46 seconds long and would have been KILLED partway through the loop —
// which means everything after the loop (the config/ticker write, the on-air
// now-live / up-next auto-fill) very likely never ran at all, on any tick, and
// silently. A function that is billed for its wall clock and then terminated
// before its last writes is the worst of both.
//
// The loop is gone. This pass should now finish in a couple of seconds. Keep it
// that way: if a step here ever needs longer than a few seconds, it belongs in
// its own genuinely-background function with the hyphen in its filename.

import { queryCollection, countCollection, getDoc, writeDoc, commitWrites, createWrite, updateWrite, fieldFilter, order } from './_shared/firebaseAdmin'
import { buildExpectedSlotsForDate, buildSlotDoc } from './_shared/schedule'
import { deriveNowLive, deriveUpNext, type OnAirSlot } from './_shared/onAir'
import { readLiveWeights, settleTally, type BallotRow } from './_shared/settleVotes'
import { memo } from './_shared/cache'
import { refreshMemeBoard } from './_shared/memeBoard'
import { getDoc as getLockDoc, writeDoc as writeLockDoc } from './_shared/firebaseAdmin'
import {
  buildTokenStatsDoc,
  fetchDexData,
  resolvePumpFeeTier,
  formatTierRange,
  payableAirtime,
  airtimeStartMs,
  airtimeAppliesToSlot,
  PUMP_FUN_FEE_TIERS,
  STREAMER_SHARE_OF_CREATOR_FEE,
  type AirtimeResult,
  type DexData,
} from './_shared/feeCalc'
import { sampleTwitchStream, twitchAppToken, twitchLoginFromUrl } from './_shared/twitch'
import { refreshAirtimeSchedule } from './_shared/airtimeSchedule'
import { ensureDayLock } from './_shared/airtimeLock'
import { CSGN_TOTAL_SUPPLY } from './_shared/airtime'
import { refreshLiveRoster } from './_shared/liveRoster'
import { operatorAlerts, recommendedMode, DEFAULT_LIVE_VIEWER_FLOOR } from './_shared/operatorAlerts'
import { publishChannelMode } from './_shared/channelModeStore'
import { rankStreamers } from './_shared/streamerRank'
import { notifyOperator } from './_shared/notify'

// NO `sleep` HELPER, DELIBERATELY. There used to be one, used to hold this
// function open for 45 billed seconds every minute. Netlify charges wall clock;
// a serverless function that waits is a serverless function you are paying to
// do nothing. If a future step needs a delay, it needs a different cron entry,
// not a sleep.

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
  feeOwedSOL?: number
  feeOwedUSD?: number
  /** What the volume produced, before verified airtime is applied. */
  grossFeeSOL?: number
  grossFeeUSD?: number
}

interface StreamActivity {
  channel?: string
  lastCheckedAt?: string
  lastLive?: boolean
  firstLiveAt?: string
  lastLiveAt?: string
  liveCheckCount?: number
  /** Samples taken, live or not — the fairness denominator. See payableAirtime. */
  checkCount?: number
  peakViewers?: number
  viewerSampleSum?: number
  lastTitle?: string
  lastGameName?: string
  checkpoints?: string[]
}

interface SlotDoc {
  id?: string
  status?: string
  startTime?: string
  endTime?: string
  streamUrl?: string
  walletAddress?: string
  /** Who holds this block. The real "someone took this" — see claimSlot.ts. */
  assignedUid?: string
  assignedName?: string
  streamTitle?: string
  creatorFees?: CreatorFees
  streamActivity?: StreamActivity
  _feeState?: FeeState
}

interface SlotRow {
  path: string
  data: SlotDoc
}

/* ─── Twitch Helix: verify the slot's channel is actually live ─── */

/**
 * Once a minute, sample whether the active slot's Twitch channel is actually
 * broadcasting and append a timestamp to the slot's streamActivity log. Kept in
 * a separate top-level field so the fee-poll writes never clobber it.
 *
 * Two things this counts, and the difference between them decides money:
 * `liveCheckCount` is how often the channel was up, `checkCount` is how often
 * we ASKED. A sample we failed to take — no token, Helix down, request timed
 * out — increments neither, because the streamer must never be docked for our
 * outage (see payableAirtime).
 *
 * Returns the record it wrote so the caller can use this minute's numbers
 * without re-reading the doc.
 */
async function logSlotActivity(row: SlotRow | null): Promise<StreamActivity | null> {
  try {
    if (!row) return null
    const slot = row.data
    const login = twitchLoginFromUrl(slot.streamUrl)
    if (!login) return null
    const token = await twitchAppToken()
    if (!token) return null

    const sample = await sampleTwitchStream(login, token)
    // No answer at all is not an answer of "offline" — drop the sample entirely.
    if (!sample) return null

    const live = sample.live
    const nowISO = new Date().toISOString()
    const prev = slot.streamActivity ?? {}
    const prevCheckpoints = Array.isArray(prev.checkpoints) ? prev.checkpoints : []
    // Keep the last ~4h of per-minute samples (well within a 2h slot + buffer).
    const checkpoints = live ? [...prevCheckpoints, nowISO].slice(-240) : prevCheckpoints
    // Slots sampled before checkCount existed carry live samples with no
    // denominator. Seeding from liveCheckCount says "we asked at least this
    // often", which is true and keeps a mid-flight slot at a sane ratio.
    const prevCheckCount = prev.checkCount ?? prev.liveCheckCount ?? 0

    const streamActivity: StreamActivity = {
      channel: login,
      lastCheckedAt: nowISO,
      lastLive: live,
      firstLiveAt: prev.firstLiveAt ?? (live ? nowISO : undefined),
      lastLiveAt: live ? nowISO : prev.lastLiveAt,
      liveCheckCount: (prev.liveCheckCount ?? 0) + (live ? 1 : 0),
      checkCount: prevCheckCount + 1,
      peakViewers: Math.max(prev.peakViewers ?? 0, sample.viewerCount),
      // Live samples only — an offline channel's zero would drag the average
      // toward "nobody watched" rather than measuring the broadcast.
      viewerSampleSum: (prev.viewerSampleSum ?? 0) + (live ? sample.viewerCount : 0),
      lastTitle: sample.title || prev.lastTitle,
      lastGameName: sample.gameName || prev.lastGameName,
      checkpoints,
    }

    const slotId = row.path.split('/').pop()!
    await writeDoc(`slots/${slotId}`, { streamActivity }, { merge: true })
    return streamActivity
  } catch (err) {
    console.error('[feePoller] logSlotActivity error:', err)
    return null
  }
}

/* ─── Schedule top-up: keep the next week of slots always seeded ─── */

const DEFAULT_STREAM_URL = 'https://twitch.tv/csgnet'
/** Refill when the farthest-out slot is closer than this. */
const MIN_HORIZON_DAYS = 5
/** Refill out to this many days ahead. */
const TARGET_HORIZON_DAYS = 7
/** Even with a healthy horizon, sweep the whole week for missing slots this
 *  often — the horizon check only sees the schedule's tail, so a slot deleted
 *  or lost mid-week would otherwise stay missing forever. */
const FULL_SWEEP_INTERVAL_MS = 15 * 60_000

/** Warm-container mirror of config/scheduleMeta.lastFullSweepAt. Only a
 *  fast-path cache: the persisted doc is authoritative, because Netlify
 *  cold-starts far more often than the sweep cadence and a reset-to-zero
 *  module variable would make every cold start run a full sweep. */
let lastKnownSweepAtMs = 0

const SCHEDULE_META_PATH = 'config/scheduleMeta'

/**
 * The schedule used to empty out after a few days because slot creation was a
 * manual admin action. This runs every minute but is engineered to cost almost
 * nothing: one 1-doc query checks how far out the schedule extends, and only
 * when the horizon drops under MIN_HORIZON_DAYS (~once a day) — or on the
 * periodic full sweep — does it do a real fill out to TARGET_HORIZON_DAYS.
 * The fill covers EVERY missing template slot in the window, not just the
 * tail, so each of the next 7 days always carries its full 12 slots.
 *
 * The fill is CREATE-ONLY for content (Firestore create preconditions): existing
 * slots — assigned, retyped, or hand-edited — are never overwritten or deleted.
 * The single exception is a LEGACY TYPE REPAIR: docs still carrying the
 * pre-Open/Network values ('ceo' / 'auction') are patched to the template's
 * type, because 'ceo' normalizes to the reserved network block and would leave
 * a daytime slot permanently unclaimable. Deliberate 'open'/'network' choices
 * are left alone. Deterministic doc IDs make the fill idempotent, so a racing
 * admin reseed at worst fails one commit and the next minute's run picks it up.
 */
async function topUpSchedule(): Promise<void> {
  try {
    const nowMs = Date.now()

    const latest = await queryCollection('slots', [], [order('startTime', 'DESCENDING')], 1)
    const latestStartMs = latest.length ? new Date(String(latest[0].data.startTime ?? 0)).getTime() : 0
    const horizonShort = latestStartMs < nowMs + MIN_HORIZON_DAYS * 24 * 60 * 60 * 1000

    let sweepDue = nowMs - lastKnownSweepAtMs >= FULL_SWEEP_INTERVAL_MS
    if (sweepDue && !horizonShort) {
      // Looks due, but our in-memory timestamp may just be a cold start —
      // confirm against the persisted timestamp before doing sweep work.
      const meta = await getDoc<{ lastFullSweepAt?: string }>(SCHEDULE_META_PATH)
      const persisted = meta?.lastFullSweepAt ? Date.parse(meta.lastFullSweepAt) : 0
      if (Number.isFinite(persisted) && persisted > lastKnownSweepAtMs) lastKnownSweepAtMs = persisted
      sweepDue = nowMs - lastKnownSweepAtMs >= FULL_SWEEP_INTERVAL_MS
    }
    if (!horizonShort && !sweepDue) return
    lastKnownSweepAtMs = nowMs
    await writeDoc(SCHEDULE_META_PATH, { lastFullSweepAt: new Date(nowMs).toISOString() }, { merge: true })

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

    const starts = [...expected.values()].map((s) => new Date(s.startTime).getTime())
    const fromISO = new Date(Math.min(...starts)).toISOString()
    const toISO = new Date(Math.max(...starts)).toISOString()
    const windowFilters = [
      fieldFilter('startTime', 'GREATER_THAN_OR_EQUAL', fromISO),
      fieldFilter('startTime', 'LESS_THAN_OR_EQUAL', toISO),
    ]

    // Periodic sweeps almost always find a fully seeded week. A COUNT
    // aggregation (~1 billed read) confirms that without fetching ~110 docs;
    // only a mismatch (deleted/missing slot) pays for the full existence
    // query. When the horizon is short we know fill work is coming, so we go
    // straight to the full query.
    if (!horizonShort) {
      const existingCount = await countCollection('slots', windowFilters)
      if (existingCount === expected.size) return
    }

    // One ranged query over the fill window tells us which already exist.
    const existing = await queryCollection(
      'slots',
      windowFilters,
      [order('startTime', 'ASCENDING')],
      (TARGET_HORIZON_DAYS + 2) * 12 + 10,
    )
    const existingIds = new Set(existing.map((r) => r.path.split('/').pop()!))

    const writes = [...expected.values()]
      .filter((slot) => !existingIds.has(slot.id))
      .map((slot) => createWrite(`slots/${slot.id}`, buildSlotDoc(slot, DEFAULT_STREAM_URL)))
    // Self-heal the block type against the hour the slot actually airs. The type
    // is fully derivable from the start time — 7 PM–3 AM ET is network, every
    // other hour is open — so any disagreement is corruption, not a preference.
    // This used to only repair the legacy 'ceo'/'auction' values, which left the
    // real failure uncovered: a reseed bug stamped literal 'network' onto daytime
    // slots, they looked like a deliberate choice, and the entire schedule went
    // permanently unclaimable with nothing to tell anyone why. A daytime
    // Originals hour is expressed by ASSIGNING the slot, never by re-typing it.
    const repairs = existing.flatMap((row) => {
      const id = row.path.split('/').pop()!
      const exp = expected.get(id)
      if (!exp) return []
      const current = String((row.data as { type?: unknown }).type || '')
      if (current === exp.type) return []
      return [updateWrite(`slots/${id}`, { type: exp.type, updatedAt: new Date() }, true)]
    })

    if (writes.length === 0 && repairs.length === 0) return

    await commitWrites([...writes, ...repairs])
    console.log(`[feePoller] topUpSchedule created ${writes.length} slots, repaired ${repairs.length} legacy types (horizon was ${((latestStartMs - nowMs) / 86_400_000).toFixed(1)}d)`)
  } catch (err) {
    console.error('[feePoller] topUpSchedule error:', err)
  }
}

/**
 * The currently broadcasting slot, derived from rows already fetched by
 * advanceSlotLifecycles — its [now-6h, now+1min] window is a strict superset
 * of any slot that can be active right now, so no extra query is needed.
 */
export function pickActiveSlot(rows: SlotRow[], nowMs = Date.now()): SlotRow | null {
  return (
    rows.find((r) => {
      const s = r.data
      const start = s.startTime ? new Date(s.startTime).getTime() : 0
      const end = s.endTime ? new Date(s.endTime).getTime() : 0
      return nowMs >= start && nowMs < end && (s.status === 'confirmed' || s.status === 'live')
    }) ?? null
  )
}

/**
 * The slot on the clock right now, claimed or not. `pickActiveSlot` only counts
 * confirmed/live slots because fee polling needs a real streamer — but the
 * ticker's Live Now card should still name the hour when it's sitting open, so
 * viewers see "Open Stage" instead of a blank card.
 */
export function pickCurrentSlot(rows: SlotRow[], nowMs = Date.now()): SlotRow | null {
  return (
    rows.find((r) => {
      const start = r.data.startTime ? new Date(r.data.startTime).getTime() : 0
      const end = r.data.endTime ? new Date(r.data.endTime).getTime() : 0
      return nowMs >= start && nowMs < end
    }) ?? null
  )
}

/**
 * Advance assigned slots through their clock-driven lifecycle so every surface
 * (admin, /schedule, /queue, /player) sees the same status:
 *   confirmed → live       (once the slot's start time arrives)
 *   confirmed/live → completed (once the slot's end time passes)
 * Runs every minute alongside the fee poll. Returns the fetched rows (with
 * statuses patched to their post-transition values) so the handler can derive
 * the active slot without a second query.
 */
async function advanceSlotLifecycles(): Promise<SlotRow[]> {
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
        s.status = next
      }
    }
    return rows as SlotRow[]
  } catch (err) {
    console.error('[feePoller] advanceSlotLifecycles error:', err)
    return []
  }
}

/**
 * The Meme-100 vote never closes, so it can't be settled at a close. Left alone
 * its tally only ever grows: a wallet that sold still counts, and the same coins
 * counted twice if they were moved to a fresh wallet and voted again. So it gets
 * re-settled against live balances on a slow cadence — infrequent enough to cost
 * almost nothing, often enough that the on-air power ranking reflects real,
 * currently-held conviction rather than everything anyone ever felt.
 */
const MEME_SETTLE_INTERVAL_MS = 30 * 60 * 1000
const MEME_SETTLE_MAX_BALLOTS = 150

async function settleMemeVote(): Promise<void> {
  try {
    const current = await getDoc<{ settledAt?: string }>('public/memeVote')
    const last = current?.settledAt ? Date.parse(current.settledAt) : 0
    if (Number.isFinite(last) && Date.now() - last < MEME_SETTLE_INTERVAL_MS) return

    const rows = await queryCollection('memeBallots', [], [], MEME_SETTLE_MAX_BALLOTS)
    if (rows.length === 0) return
    const ballots: Array<BallotRow & { storedWeight?: number }> = rows.flatMap((row) => {
      const d = row.data as { wallet?: unknown; symbol?: unknown; weight?: unknown }
      const wallet = String(d.wallet || row.path.split('/').pop() || '')
      const key = String(d.symbol || '')
      return wallet && key ? [{ wallet, key, storedWeight: Number(d.weight) || 0 }] : []
    })
    const live = await readLiveWeights(ballots.map((b) => b.wallet))
    const settled = settleTally(ballots, live)
    await writeDoc('public/memeVote', {
      tallies: settled.tally,
      settledAt: new Date().toISOString(),
      settledCounts: { counted: settled.counted, dropped: settled.dropped, unread: settled.unread, ballots: ballots.length },
      updatedAt: new Date().toISOString(),
    }, { merge: true })
    console.log(`[feePoller] meme vote settled: ${settled.counted} counted, ${settled.dropped} dropped, ${settled.unread} unread`)
  } catch (err) {
    console.error('[feePoller] settleMemeVote error:', err)
  }
}

/** The next slot to start. One tiny query so the ticker's Up Next card tracks
 *  the real schedule instead of whatever an operator last typed. */
async function fetchNextSlot(): Promise<SlotRow | null> {
  try {
    const nowISO = new Date().toISOString()
    const rows = await queryCollection(
      'slots',
      [fieldFilter('startTime', 'GREATER_THAN', nowISO)],
      [order('startTime', 'ASCENDING')],
      1,
    )
    return (rows[0] as SlotRow) ?? null
  } catch (err) {
    console.error('[feePoller] fetchNextSlot error:', err)
    return null
  }
}

/**
 * The verified-airtime verdict for a slot, or null when the rule does not
 * reach it (a slot that started before the cutover keeps its original terms
 * forever — see airtimeAppliesToSlot).
 */
export function slotAirtime(slot: SlotDoc, startMs: number): (AirtimeResult & { liveCheckCount: number; checkCount: number }) | null {
  if (!airtimeAppliesToSlot(slot.startTime, startMs)) return null
  const activity = slot.streamActivity ?? {}
  const liveCheckCount = activity.liveCheckCount ?? 0
  // Same backfill as logSlotActivity: no denominator means "at least as many
  // asks as live answers", which lands on full credit rather than a penalty.
  const checkCount = activity.checkCount ?? activity.liveCheckCount ?? 0
  return { liveCheckCount, checkCount, ...payableAirtime({ liveCheckCount, checkCount }) }
}

async function pollAndWrite(dexData: DexData, active: SlotRow | null, airtimeStart: number): Promise<void> {
  try {
    if (!active) return

    const slotId = active.path.split('/').pop()!
    // The row fetched at the top of the invocation, reused. There used to be a
    // per-tick re-read here so admin changes made mid-invocation were visible;
    // with one tick there is no mid-invocation, and the next run (60s later)
    // reads fresh anyway. That is one Firestore read per minute saved.
    const slotData = active.data

    const existing = slotData.creatorFees
    if (existing?.paymentStatus === 'paid' || existing?.paymentStatus === 'declined') return
    if (existing?.snapshotLockedAt) return

    // ── Snapshot lock: the hour is over, so freeze what it owes ──
    //
    // This is where the number stops moving. The gross stays on the record as
    // what the volume produced; feeOwed keeps its meaning — what we owe — and
    // becomes gross × the verified-airtime fraction. An hour nobody streamed
    // settles as 'void' rather than 'pending', so it leaves the admin's payout
    // queue instead of sitting there as a judgement call.
    if (slotData.endTime && Date.now() > new Date(slotData.endTime).getTime()) {
      const nowISO = new Date().toISOString()
      const lock: Record<string, unknown> = {
        'creatorFees.snapshotLockedAt': nowISO,
        'creatorFees.updatedAt': nowISO,
      }
      const airtime = slotAirtime(slotData, airtimeStart)
      if (airtime) {
        // grossFee* is written on every poll below; the feeOwed fallback covers
        // a slot whose numbers an admin entered by hand and that this poller
        // therefore never accrued.
        const grossSOL = existing?.grossFeeSOL ?? existing?.feeOwedSOL ?? 0
        const grossUSD = existing?.grossFeeUSD ?? existing?.feeOwedUSD ?? 0
        lock['creatorFees.grossFeeSOL'] = grossSOL
        lock['creatorFees.grossFeeUSD'] = grossUSD
        lock['creatorFees.airtime'] = airtime
        lock['creatorFees.feeOwedSOL'] = grossSOL * airtime.fraction
        lock['creatorFees.feeOwedUSD'] = grossUSD * airtime.fraction
        lock['creatorFees.paymentStatus'] = airtime.reason === 'no_show' ? 'void' : 'pending'
      }
      await writeDoc(`slots/${slotId}`, lock, { merge: true })
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

    // Apply verified airtime to the RUNNING number too, not just at the lock.
    // /watch and /account read this field straight off the slot doc, and a
    // payable meter that only rises while the streamer is genuinely on air is
    // the whole retention mechanic — it also means the client never needs its
    // own copy of the rule. Early in an hour the sample count is below
    // AIRTIME_MIN_SAMPLES, so it reads `unverified` and shows the full amount.
    const airtime = slotAirtime(slotData, airtimeStart)
    const payableSOL = airtime ? feeSOL * airtime.fraction : feeSOL
    const payableUSD = airtime ? feeUSD * airtime.fraction : feeUSD

    const updatedFees = {
      tradingVolumeSOL: deltaVolumeSOL,
      tradingVolumeUSD: estimatedSlotVolumeUsd,
      feeOwedSOL: payableSOL,
      feeOwedUSD: payableUSD,
      ...(airtime ? { grossFeeSOL: feeSOL, grossFeeUSD: feeUSD, airtime } : {}),
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
// One DexScreener fetch per invocation, which also refreshes public/tokenStats
// (~1 write/min) so token stats flow 24/7 even when no slot is live.
/** Shortest gap between two real runs while the channel is HOT — something is
 *  on air, or somebody on the roster is live. Below the 60s cron period on
 *  purpose — see the header: this must never be able to reject the scheduled
 *  run during an hour that decides money. */
const HOT_RUN_INTERVAL_MS = 45_000

/**
 * Shortest gap between two real runs while the channel is COLD.
 *
 * Cold means: no slot assigned, nobody from the roster live, the clip reel
 * carrying the channel. That is most of the day by design — clips are the
 * source of last resort and the baseline — and during it a minute-by-minute
 * pass is buying nothing. Nothing accrues, no fee is moving, no minute counter
 * is running. The only question a cold tick answers is "has anybody gone live",
 * and the operator is not cutting to them inside sixty seconds anyway.
 *
 * At 1,440 scheduled invocations a day this is the difference between paying
 * for all of them and paying for a third. The cost is up to three minutes of
 * detection lag on a streamer going live, which `adminLiveNow` short-circuits
 * anyway by clearing the cold flag the moment an operator acts.
 */
export const COLD_RUN_INTERVAL_MS = 3 * 60_000

const RUN_LOCK_PATH = 'config/feePollerRun'
/** config/season only carries the airtime cutover today, and moving that date
 *  is a deliberate, rare admin act — an hour of staleness costs nothing. */
const SEASON_CONFIG_TTL_MS = 60 * 60 * 1000

/**
 * The lock decision, with the I/O taken out so every case is testable.
 *
 * Anything it cannot read as a real, in-the-past timestamp means "run": a
 * missing lock is a first run, and a garbled or future-dated one is a bug in
 * the lock rather than evidence a poll just happened. The failure that matters
 * here is a poll that silently never happens, so every ambiguous input resolves
 * toward running.
 */
export function shouldRunPoll(lastStartedAt: string | undefined, nowMs: number, wasCold = false): boolean {
  if (!lastStartedAt) return true
  const last = new Date(lastStartedAt).getTime()
  if (!Number.isFinite(last) || last <= 0) return true
  const elapsed = nowMs - last
  if (elapsed < 0) return true
  // Cold only slows things down when the PREVIOUS run positively established
  // that the channel was cold. An unknown state is treated as hot, so a missing
  // or corrupt flag costs money rather than correctness — which is the right
  // way round for a job that decides fees.
  return elapsed >= (wasCold ? COLD_RUN_INTERVAL_MS : HOT_RUN_INTERVAL_MS)
}

/**
 * Single-flight guard. Returns false when a run started too recently, so the
 * caller exits before doing any billable work.
 *
 * Best-effort by design: if the lock can't be read or written we run anyway.
 * Skipping the poll because Firestore hiccuped would silently stall fee
 * tracking, and a duplicate run is far cheaper than a missing one.
 */
async function claimRunSlot(): Promise<boolean> {
  try {
    const lock = await getLockDoc<{ startedAt?: string; cold?: boolean }>(RUN_LOCK_PATH)
    if (!shouldRunPoll(lock?.startedAt, Date.now(), lock?.cold === true)) return false
    await writeLockDoc(RUN_LOCK_PATH, { startedAt: new Date().toISOString() }, { merge: true })
    return true
  } catch (err) {
    console.warn('feePoller run lock unavailable, running anyway:', err)
    return true
  }
}

/**
 * Record whether the channel was cold on this pass, so the NEXT tick knows how
 * long it may skip for.
 *
 * Stored rather than recomputed because hotness can only be known after the
 * work — and the whole point is to let a tick decide, before doing any work,
 * that it does not need to.
 */
async function recordDutyCycle(cold: boolean): Promise<void> {
  try {
    await writeLockDoc(RUN_LOCK_PATH, { cold, coldAt: new Date().toISOString() }, { merge: true })
  } catch {
    // Best-effort. Failing to write it means the next tick assumes hot, which
    // costs an invocation and breaks nothing.
  }
}

export const handler = async () => {
  if (!(await claimRunSlot())) {
    return { statusCode: 200, body: JSON.stringify({ skipped: 'ran too recently' }) }
  }

  // Keep the schedule seeded ~a week out so it never runs empty. Cheap check
  // every minute; real work only when the horizon actually shrinks (~daily).
  await topUpSchedule()

  // Advance clock-driven slot statuses first so /player, admin, /schedule and
  // /queue all agree on which slot is confirmed / live / completed right now.
  // The active slot is derived from the same rows — the whole invocation runs
  // on one slots range query where it used to issue six.
  const rows = await advanceSlotLifecycles()
  const active = pickActiveSlot(rows)

  // Sample real Twitch activity for the active slot (1 Helix call/min) so the
  // Creator Fees log can prove the streamer was actually live, not intermission
  // — and so this minute's sample is in the denominator the fee is scaled by.
  // Patched onto the row we already hold so the first poll tick below sees the
  // sample it just took instead of a minute-old one.
  const sampled = await logSlotActivity(active)
  if (active && sampled) active.data.streamActivity = sampled

  // When verified airtime started deciding money. One cheap read, cached per
  // container, because the answer changes roughly never.
  const airtimeStart = airtimeStartMs(
    await memo('config:season', SEASON_CONFIG_TTL_MS, () => getDoc<{ airtimeStartAt?: string }>('config/season')),
  )

  // Sample every consenting member's Twitch channel — one Helix request per 100
  // of them — so the operator's board knows who is live and the minute counters
  // that decide the fee split keep ticking. This is what lets a streamer sign up
  // once and never think about the schedule again.
  const roster = await refreshLiveRoster(active?.data.assignedUid ?? null)

  // Publish what the operator should be doing about it, every minute, whether
  // or not anybody has the board open. Written to a doc rather than computed on
  // read so a future notifier (email, push, a Discord webhook) has one place to
  // watch and cannot disagree with what the board shows.
  try {
    const meta = await getDoc<{ liveViewerFloor?: number; networkBlockEnabled?: boolean }>(SCHEDULE_META_PATH)
    const viewerFloor = meta?.liveViewerFloor != null && Number(meta.liveViewerFloor) >= 0
      ? Number(meta.liveViewerFloor)
      : DEFAULT_LIVE_VIEWER_FLOOR
    const alertInput = {
      roster: roster.map((e) => ({
        uid: e.uid, username: e.username, displayName: e.displayName,
        live: e.live, viewerCount: e.viewerCount,
      })),
      onAirUid: active?.data.assignedUid ?? null,
      onAirMinutes: active?.data.startTime
        ? Math.max(0, Math.floor((Date.now() - Date.parse(active.data.startTime)) / 60_000))
        : 0,
      viewerFloor,
    }
    const alerts = operatorAlerts(alertInput)
    // WHO TO PUT ON, RANKED. Not just "somebody is live" — an ordered shortlist
    // with a reason on each row, so the decision is a glance rather than a
    // comparison. See _shared/streamerRank.ts for why viewer count alone is the
    // wrong rule.
    const shortlist = rankStreamers(
      roster.map((e) => ({
        uid: e.uid,
        username: e.username,
        displayName: e.displayName,
        live: e.live,
        viewerCount: e.viewerCount,
        streamMinutes: streamMinutesOf(e.startedAt),
        onAirMinutesToday: e.onAirMinutes,
        balance: 0,
        gameName: e.gameName,
        title: e.title,
      })),
      viewerFloor,
    ).slice(0, 8)

    await writeDoc('public/operatorAlerts', {
      alerts,
      shortlist,
      recommendation: recommendedMode(alertInput),
      viewerFloor,
      updatedAt: new Date().toISOString(),
    })

    // AND TELL THE MP, with the tab closed. Deduped hard — see _shared/notify.
    await notifyOperator(alerts)

    // ── The PUBLIC half of the same question ──
    //
    // operatorAlerts says what the operator should do. This says what a viewer
    // is looking at and why, in one sentence, on the same tick and from the
    // same inputs — so the control room and the audience can never be told two
    // different stories about what is on. Every surface (/watch, /schedule,
    // /player, the OBS graphics) renders this stored verdict rather than
    // deriving its own, which is what stopped four pages disagreeing before.
    await publishChannelMode({
      slot: active?.data ?? null,
      networkBlockEnabled: meta?.networkBlockEnabled !== false,
      liveCount: roster.filter((e) => e.live).length,
    })
  } catch (err) {
    console.warn('[feePoller] operatorAlerts write failed', err)
  }

  // Take the day's lock if 2 AM ET has passed and it has not been taken yet.
  // Idempotent and cheap — one document read on every tick but the first after
  // a cutover. Called BEFORE the schedule rebuild so the playlist is always
  // laid against locked proportions rather than racing them.
  // The supply is a CONSTANT, not a measurement — see CSGN_TOTAL_SUPPLY. This
  // used to derive circulating supply from market cap over price, which made a
  // member's seconds drift with the chart for reasons they could not check.
  await ensureDayLock(async () => CSGN_TOTAL_SUPPLY)

  // Rebuild the holder-airtime playlist the channel runs on between live hours.
  // Supply is injected so this module's cached DexScreener read is reused
  // rather than the scheduler making a second one of its own.
  await refreshAirtimeSchedule(async () => CSGN_TOTAL_SUPPLY)

  // Re-anchor the Meme-100 to what voters actually still hold (every 30 min).
  await settleMemeVote()
  await refreshMemeBoard()

  // ── ONE DexScreener read, then done ──
  //
  // This loop used to run four times per invocation with `await sleep(15_000)`
  // between them, so every scheduled run held a billed container for 45 seconds
  // doing nothing but waiting. Netlify bills wall clock: that was 1,440 runs a
  // day x 45s = eighteen hours of paid compute per day, to produce four
  // samples of a number instead of one. It was, by a wide margin, the most
  // expensive line in this project.
  //
  // Dropping to a single sample is safe because fee accrual is CUMULATIVE and
  // delta-based, not an average of samples: `_feeState` carries the running
  // tier volume map and the previous estimate, so the same total is reached
  // whether it is stepped once a minute or four times. The only thing lost is
  // sub-minute attribution when the market cap crosses a pump.fun tier
  // boundary mid-minute, which moves a fee by a fraction of a percent.
  //
  // If finer resolution is ever genuinely needed, raise the CRON RATE. Never
  // re-add a sleep — paying for a container to wait is the one thing that
  // cannot be optimised afterwards.
  const dexData = await fetchDexData()
  const lastDex: DexData | null = dexData
  if (dexData) {
    try {
      await writeDoc('public/tokenStats', { ...buildTokenStatsDoc(dexData) }, { merge: false })
    } catch (err) {
      console.error('[feePoller] tokenStats write error:', err)
    }
    await pollAndWrite(dexData, active, airtimeStart)
  }

  // Publish CSGN token info + the live creator-fee beat to the broadcast ticker
  // overlay (config/ticker), so the $CSGN beat + fee readout run automatically —
  // no manual admin entry. merge:true never touches the admin-curated fields
  // (rightNow / breaking / governance / vote).
  const tickerPatch: Record<string, unknown> = { updatedAt: new Date().toISOString() }
  if (lastDex) {
    tickerPatch.csgn = { price: lastDex.priceUsd, chg: lastDex.priceChangeH24Pct, mc: lastDex.marketCapUsd, vol: lastDex.volumeH24Usd }
  }
  const liveAssigned = active?.data.assignedName && (active.data.status === 'live' || active.data.status === 'confirmed')
  tickerPatch.liveFee = liveAssigned
    ? { name: active!.data.assignedName, usd: Math.max(0, active!.data.creatorFees?.feeOwedUSD ?? 0), sinceISO: active!.data.startTime ?? '' }
    : null

  // Live now / Up next follow the real schedule — unless an operator has taken
  // manual control (config/ticker.onAirAuto === false), in which case their
  // typed cards stay exactly as they left them.
  try {
    const ticker = await getDoc<{ onAirAuto?: boolean }>('config/ticker')
    if (ticker?.onAirAuto !== false) {
      const next = await fetchNextSlot()
      const current = pickCurrentSlot(rows)
      tickerPatch.nowLive = deriveNowLive(current?.data as OnAirSlot | undefined)
      tickerPatch.upNext = deriveUpNext(next?.data as OnAirSlot | undefined)
      tickerPatch.onAirAuto = true
    }
  } catch (err) {
    console.error('[feePoller] on-air auto-fill error:', err)
  }

  try {
    await writeDoc('config/ticker', tickerPatch, { merge: true })
  } catch (err) {
    console.error('[feePoller] ticker csgn/liveFee write error:', err)
  }

  // ── How hard should the next tick work? ──
  //
  // COLD is the honest description of most of the day under the current model:
  // clips are the source of last resort and the baseline, so unless the
  // operator has put somebody on or a roster member is actually live, nothing
  // on this pass changed and nothing on the next one will either. Saying so
  // lets the next two ticks exit in milliseconds instead of doing a full pass
  // to discover the same nothing.
  //
  // Note what counts as hot: an assigned slot OR anybody live on the roster.
  // The second is what stops the channel going to sleep on the one thing it
  // needs to notice — somebody worth cutting to going live.
  await recordDutyCycle(!active && !roster.some((e) => e.live))
}

/** Minutes since a Twitch stream started, for the freshness term in the
 *  shortlist ranking. Unknown reads as 0, which the scorer treats as "just
 *  started" — the safe direction, since a stream we cannot age is more likely
 *  to be new than six hours old. */
function streamMinutesOf(startedAt?: string): number {
  const t = Date.parse(startedAt ?? '')
  if (!Number.isFinite(t)) return 0
  return Math.max(0, Math.floor((Date.now() - t) / 60_000))
}
