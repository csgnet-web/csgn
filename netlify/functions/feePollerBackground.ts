// Scheduled function — runs every two minutes via cron, and defers itself
// further than that whenever nothing is on the channel (see THE DUTY CYCLE
// below, which is where this project's Netlify bill lives).
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
// The lock deliberately does NOT throw, and its overlap guard is deliberately
// far shorter than the cron period: a guard that can reject the real scheduled
// run would be a self-inflicted outage on the job that drives fees, slot
// lifecycle and token stats. It skips, it never fails.
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
import { onAirMinutes } from './_shared/onAirClock'
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
  /**
   * REAL SECONDS the channel was observed live. Not a sample count.
   *
   * `liveCheckCount` is how many times we asked and got "yes", and three
   * surfaces rendered it as `~{n}m` — which was true exactly once, back when
   * the cron ran every minute. It is every TWO minutes now, and the poller
   * defers itself to four or ten when the channel is quiet, so a stream up for
   * two hours reported anywhere between 60 and 12 "minutes".
   *
   * The counters stay as they are because `payableAirtime` is a RATIO of them
   * and is unaffected by the cadence. This is the separate number for anything
   * that wants a duration, credited from the measured gap between samples the
   * same way the roster's minutes already are (`creditMinutes`).
   */
  liveSeconds?: number
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
 * How much elapsed time one sample may credit.
 *
 * The gap between samples is normally the cron period (two minutes) but can be
 * four or ten when the duty cycle has backed off, and arbitrarily long after an
 * outage. Crediting the measured gap is what makes the number mean the same
 * thing at any cadence; the ceiling is what stops a poller that was down for an
 * hour handing back an hour of "observed" airtime it did not observe.
 *
 * Twelve minutes: just above the coldest tier, so a legitimate slow pass is
 * credited in full and nothing else is.
 */
export const MAX_LIVE_CREDIT_SECONDS = 12 * 60

export function creditSeconds(lastAt: string | undefined, nowMs: number): number {
  const last = Date.parse(String(lastAt ?? ''))
  if (!Number.isFinite(last) || last <= 0 || last > nowMs) return 0
  const gap = Math.floor((nowMs - last) / 1000)
  if (gap <= 0) return 0
  return Math.min(gap, MAX_LIVE_CREDIT_SECONDS)
}

/**
 * Sample whether the active slot's Twitch channel is actually broadcasting and
 * append a timestamp to the slot's streamActivity log. Kept in a separate
 * top-level field so the fee-poll writes never clobber it.
 *
 * ONCE PER PASS, not once per minute — the cron is every two minutes and the
 * duty cycle stretches that to four or ten when the channel is quiet. That
 * distinction is the whole reason `liveSeconds` exists alongside the counters.
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
      // The MEASURED gap, never a flat minute — see the note on the field. A
      // sample only credits time if the PREVIOUS sample also saw the channel
      // live, so the first sample of a run credits nothing and a channel that
      // came back after a break is not paid for the break.
      liveSeconds: (prev.liveSeconds ?? 0)
        + (live && prev.lastLive === true ? creditSeconds(prev.lastCheckedAt, Date.now()) : 0),
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
/**
 * ── THE DUTY CYCLE, AND WHY IT IS A SCHEDULE RATHER THAN A FLAG ────────────
 *
 * Netlify bills function compute at 10 credits per GB-hour, and a function runs
 * with 1 GB by default. That makes the exchange rate brutally simple:
 *
 *     ONE CREDIT = SIX MINUTES OF WALL CLOCK.
 *     A 1,000-credit month = 100 hours of runtime. That is the whole budget.
 *
 * A cron of `* * * * *` is 43,200 invocations a month before anyone visits the
 * site. At ten seconds a pass that is 120 hours — over budget on an empty
 * channel, which is exactly what happened: 300 credits burned in a week with no
 * traffic and no deploys.
 *
 * The previous attempt at this was a boolean: `cold` meant "no slot assigned
 * AND nobody on the roster is live", and cold ticks skipped two runs in three.
 * It barely helped, for a reason worth writing down — ANY roster member live
 * ANYWHERE ON TWITCH made the channel hot. A network of real streamers almost
 * always has somebody broadcasting to their own audience, so the flag sat true
 * essentially forever and the full pass ran every single minute regardless.
 * The lesson: hotness has to mean "we are doing something expensive that
 * matters right now", not "something is happening somewhere in the world".
 *
 * So there are three tiers, and the pass NAMES THE MINUTE it next needs to be
 * awake instead of re-deciding every tick:
 *
 *   HOT   A slot is on the clock — fees are accruing and airtime samples are
 *         the denominator of somebody's payout. Run every tick, no exceptions.
 *   WARM  Nobody is on the channel, but a roster member is live and could be
 *         cut to. Worth watching, not worth watching every two minutes.
 *   COLD  Clips are carrying the air and nothing is live anywhere. This is most
 *         of the day by design, and it is where the entire bill was going.
 *
 * Three properties keep this from ever costing anyone money:
 *
 *  1. UNKNOWN MEANS RUN. A missing lock, a garbled date, a future-dated one, a
 *     missing due time — every ambiguous input resolves toward running. A wrong
 *     guess costs one invocation; the other direction costs a streamer their
 *     fee accrual, silently.
 *  2. AN ASSIGNED HOUR IS NEVER SLEPT THROUGH. The due time is capped at the
 *     next slot's start (see `nextDueAtMs`), so an idle channel wakes exactly
 *     when the schedule says something begins rather than up to ten minutes
 *     late.
 *  3. THE OPERATOR SHORT-CIRCUITS IT. `adminLiveNow` marks the poller due the
 *     moment it puts somebody on air, so the next tick runs a full pass.
 */
export type PollTier = 'hot' | 'warm' | 'cold'

/** How long a pass of each tier may let the next one wait. */
export const TIER_INTERVAL_MS: Record<PollTier, number> = {
  // Every tick. Airtime is scored on samples taken (AIRTIME_MIN_SAMPLES = 10),
  // so an hour that decides money must never be sampled sparsely.
  hot: 0,
  warm: 4 * 60_000,
  cold: 10 * 60_000,
}

/**
 * Two invocations landing on top of each other — a scheduler retry, an operator
 * wake racing the cron — must not both run the pass. Deliberately far below
 * every tier interval so it can only ever collapse a genuine duplicate, never
 * reject a real scheduled run.
 */
export const OVERLAP_GUARD_MS = 30_000

const RUN_LOCK_PATH = 'config/feePollerRun'
/** config/season only carries the airtime cutover today, and moving that date
 *  is a deliberate, rare admin act — an hour of staleness costs nothing. */
const SEASON_CONFIG_TTL_MS = 60 * 60 * 1000

export interface RunLock {
  startedAt?: string
  nextDueAt?: string
  tier?: string
}

/**
 * When the next pass is genuinely needed.
 *
 * Capped at the next slot's start so an idle channel wakes for an assigned hour
 * on time. Without that cap a ten-minute cold interval could start an hour up
 * to ten minutes late, which would cost real airtime samples on a slot that
 * pays somebody.
 */
export function nextDueAtMs(tier: PollTier, nowMs: number, nextSlotStartMs?: number | null): number {
  const byTier = nowMs + TIER_INTERVAL_MS[tier]
  if (nextSlotStartMs != null && Number.isFinite(nextSlotStartMs) && nextSlotStartMs > nowMs) {
    return Math.min(byTier, nextSlotStartMs)
  }
  return byTier
}

/**
 * The gate, with the I/O taken out so every case is testable.
 *
 * The failure that matters here is a poll that silently never happens, so every
 * ambiguous input resolves toward running — see property (1) above.
 */
export function shouldRunPoll(lock: RunLock | null | undefined, nowMs: number): boolean {
  if (!lock) return true
  const last = Date.parse(String(lock.startedAt ?? ''))
  // A lock we cannot read as a real, in-the-past instant is a bug in the lock,
  // not evidence that a pass just happened.
  if (!Number.isFinite(last) || last <= 0 || last > nowMs) return true
  if (nowMs - last < OVERLAP_GUARD_MS) return false
  const due = Date.parse(String(lock.nextDueAt ?? ''))
  // No readable due time is not evidence the work is done.
  if (!Number.isFinite(due) || due <= 0) return true
  return nowMs >= due
}

/**
 * Claim the run. Best-effort by design: if the lock cannot be read or written
 * we run anyway, because skipping a poll over a Firestore hiccup would stall
 * fee tracking, and a duplicate run is far cheaper than a missing one.
 */
async function claimRunSlot(): Promise<boolean> {
  try {
    const lock = await getLockDoc<RunLock>(RUN_LOCK_PATH)
    if (!shouldRunPoll(lock, Date.now())) return false
    await writeLockDoc(RUN_LOCK_PATH, { startedAt: new Date().toISOString() }, { merge: true })
    return true
  } catch (err) {
    console.warn('feePoller run lock unavailable, running anyway:', err)
    return true
  }
}

/**
 * Record the tier this pass found and the minute the next one is due.
 *
 * Stored rather than recomputed because the tier can only be known AFTER the
 * work — and the whole point is to let the next tick decide, before doing any
 * billable work, that it does not need to.
 */
async function recordDutyCycle(tier: PollTier, nextSlotStartMs: number | null): Promise<void> {
  try {
    const nowMs = Date.now()
    await writeLockDoc(RUN_LOCK_PATH, {
      tier,
      cold: tier === 'cold',
      nextDueAt: new Date(nextDueAtMs(tier, nowMs, nextSlotStartMs)).toISOString(),
      coldAt: new Date(nowMs).toISOString(),
    }, { merge: true })
  } catch {
    // Best-effort. Failing to write it leaves no readable due time, which the
    // gate reads as "run" — costs an invocation, breaks nothing.
  }
}

export const handler = async () => {
  if (!(await claimRunSlot())) {
    return { statusCode: 200, body: JSON.stringify({ skipped: 'not due' }) }
  }

  // ── Why the whole pass sits in a try/finally ──
  //
  // The duty-cycle write at the bottom is not bookkeeping, it is the gate: it
  // is what tells the next tick it can read one document and go home. If an
  // exception anywhere above skipped it, `nextDueAt` would stop advancing,
  // every subsequent tick would read "no readable due time → run", and the job
  // would quietly revert to a full pass every two minutes — the exact bill this
  // design exists to remove, restored by a transient Twitch or Firestore error
  // and visible nowhere except the invoice.
  //
  // So the tier is tracked in a variable that starts at the SAFE-BUT-EXPENSIVE
  // value. A pass that dies before it can judge the channel is treated as hot:
  // it runs again next tick, exactly as it does today, rather than deferring on
  // the strength of a state it never established.
  let tier: PollTier = 'hot'
  let nextSlotStartMs: number | null = null
  try {
    // ── Everything independent, at once ──
    //
    // This pass is almost entirely network round trips, and Netlify bills the
    // wall clock they take. Run in series they add up; overlapped they cost
    // roughly the slowest one. None of these four touch each other's data:
    // lifecycle advancement writes slot statuses, the rest are reads.
    const [rows, seasonConfig, meta, nextSlot] = await Promise.all([
      // Advance clock-driven slot statuses first so /player, admin, /schedule and
      // /queue all agree on which slot is confirmed / live / completed right now.
      advanceSlotLifecycles(),
      // When verified airtime started deciding money. Cached per container,
      // because the answer changes roughly never.
      memo('config:season', SEASON_CONFIG_TTL_MS, () => getDoc<{ airtimeStartAt?: string }>('config/season')),
      getDoc<{ liveViewerFloor?: number; networkBlockEnabled?: boolean }>(SCHEDULE_META_PATH),
      // Needed for the ticker's Up Next card, and — more importantly — for the
      // due time this pass writes at the end: an idle channel must wake when the
      // next hour starts rather than whenever its tier interval happens to lapse.
      fetchNextSlot(),
    ])

    const active = pickActiveSlot(rows)
    const airtimeStart = airtimeStartMs(seasonConfig)
    nextSlotStartMs = nextSlot?.data.startTime ? Date.parse(nextSlot.data.startTime) : null

    // Housekeeping that self-throttles internally (15 min / daily / 10 min /
    // 30 min / 5 min). Each costs one cheap read on a pass that does nothing, so
    // it rides along with the expensive work rather than in front of it.
    // ensureDayLock stays BEFORE refreshAirtimeSchedule so the playlist is always
    // laid against locked proportions rather than racing them, and the meme
    // settle stays before the board rebuild that reads it.
    const housekeeping = (async () => {
      try {
        await topUpSchedule()
        // The supply is a CONSTANT, not a measurement — see CSGN_TOTAL_SUPPLY.
        await ensureDayLock(async () => CSGN_TOTAL_SUPPLY)
        await refreshAirtimeSchedule(async () => CSGN_TOTAL_SUPPLY)
        await settleMemeVote()
        await refreshMemeBoard()
      } catch (err) {
        // Self-contained on purpose. This chain is started early and awaited
        // late, so an unguarded rejection would travel out of the `await` at the
        // bottom of the handler and skip the duty-cycle write — which is the one
        // thing that must always happen. See the finally block there.
        console.error('[feePoller] housekeeping error:', err)
      }
    })()

    // Sample real Twitch activity for the active slot so the Creator Fees log can
    // prove the streamer was actually live, and so this pass's sample is in the
    // denominator the fee is scaled by. Sampling every consenting member's channel
    // runs alongside it — one Helix request per 100 of them.
    const [sampled, roster, dexData] = await Promise.all([
      logSlotActivity(active),
      refreshLiveRoster(active?.data.assignedUid ?? null),
      fetchDexData(),
    ])
    // Patched onto the row we already hold so the fee poll below sees the sample
    // it just took instead of a stale one.
    if (active && sampled) active.data.streamActivity = sampled

    // ── The tier this pass found ──
    //
    // HOT is deliberately narrow: a slot actually on the clock. It is NOT "a
    // roster member is live" — that was the bug that made the previous duty cycle
    // a no-op, because somebody on a real roster is nearly always streaming to
    // their own audience, which costs us nothing and decides nothing.
    const liveCount = roster.filter((e) => e.live).length
    tier = active ? 'hot' : liveCount > 0 ? 'warm' : 'cold'

    // Publish what the operator should be doing about it, whether or not anybody
    // has the board open. Written to a doc rather than computed on read so a
    // notifier has one place to watch and cannot disagree with what the board shows.
    try {
      const viewerFloor = meta?.liveViewerFloor != null && Number(meta.liveViewerFloor) >= 0
        ? Number(meta.liveViewerFloor)
        : DEFAULT_LIVE_VIEWER_FLOOR
      const alertInput = {
        roster: roster.map((e) => ({
          uid: e.uid, username: e.username, displayName: e.displayName,
          live: e.live, viewerCount: e.viewerCount,
        })),
        onAirUid: active?.data.assignedUid ?? null,
        // How long THIS CUT has been running. It used to measure from the
        // block's start, so a streamer put on 47 minutes into a two-hour block
        // was reported as having been on air for 47 minutes the instant they
        // went on — and the alert that watches this number fired immediately,
        // every time. See _shared/onAirClock.ts.
        onAirMinutes: onAirMinutes(active?.data ?? null),
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

      await Promise.all([
        writeDoc('public/operatorAlerts', {
          alerts,
          shortlist,
          recommendation: recommendedMode(alertInput),
          viewerFloor,
          updatedAt: new Date().toISOString(),
        }),
        // AND TELL THE MP, with the tab closed. Deduped hard — see _shared/notify.
        notifyOperator(alerts),
        // ── The PUBLIC half of the same question ──
        //
        // operatorAlerts says what the operator should do. This says what a viewer
        // is looking at and why, from the same inputs on the same pass — so the
        // control room and the audience can never be told two different stories
        // about what is on. Every surface renders this stored verdict rather than
        // deriving its own, which is what stopped four pages disagreeing before.
        publishChannelMode({
          slot: active?.data ?? null,
          networkBlockEnabled: meta?.networkBlockEnabled !== false,
          liveCount,
        }),
      ])
    } catch (err) {
      console.warn('[feePoller] operatorAlerts write failed', err)
    }

    // ── ONE DexScreener read, then done ──
    //
    // This loop used to run four times per invocation with `await sleep(15_000)`
    // between them, so every scheduled run held a billed container for 45 seconds
    // doing nothing but waiting. Fee accrual is CUMULATIVE and delta-based, not an
    // average of samples: `_feeState` carries the running tier volume map and the
    // previous estimate, so the same total is reached whether it is stepped once a
    // minute or four times.
    //
    // If finer resolution is ever genuinely needed, raise the CRON RATE. Never
    // re-add a sleep — paying for a container to wait is the one thing that
    // cannot be optimised afterwards.
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
    if (dexData) {
      tickerPatch.csgn = { price: dexData.priceUsd, chg: dexData.priceChangeH24Pct, mc: dexData.marketCapUsd, vol: dexData.volumeH24Usd }
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
        const current = pickCurrentSlot(rows)
        tickerPatch.nowLive = deriveNowLive(current?.data as OnAirSlot | undefined)
        tickerPatch.upNext = deriveUpNext(nextSlot?.data as OnAirSlot | undefined)
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

    // Let the housekeeping finish before the container is torn down — it was
    // started at the top and has been running underneath the work above.
    await housekeeping

    return { statusCode: 200, body: JSON.stringify({ tier, liveCount, active: Boolean(active) }) }
  } finally {
    // How hard should the next tick work, and when is it due? Always written,
    // never skipped — see the note at the top of the block.
    await recordDutyCycle(tier, nextSlotStartMs)
  }
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
