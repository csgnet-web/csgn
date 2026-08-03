// Scheduled background function — runs every minute via cron.
// Executes 4 DexScreener polls at 15-second intervals (t=0, 15s, 30s, 45s).
// Writes live creatorFees to the active slot doc in Firestore.
// Browser clients NEVER call DexScreener — they read from the single Firestore listener.

import { queryCollection, countCollection, getDoc, writeDoc, commitWrites, createWrite, updateWrite, fieldFilter, order } from './_shared/firebaseAdmin'
import { buildExpectedSlotsForDate, buildSlotDoc } from './_shared/schedule'
import { deriveNowLive, deriveUpNext, type OnAirSlot } from './_shared/onAir'
import { readLiveWeights, settleTally, type BallotRow } from './_shared/settleVotes'
import { fetchJson } from './_shared/cache'
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
  feeOwedUSD?: number
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

let cachedTwitchToken: { token: string; exp: number } | null = null

async function twitchAppToken(): Promise<string | null> {
  const clientId = process.env.TWITCH_CLIENT_ID
  const clientSecret = process.env.TWITCH_CLIENT_SECRET
  if (!clientId || !clientSecret) return null
  const now = Date.now()
  if (cachedTwitchToken && cachedTwitchToken.exp > now + 60_000) return cachedTwitchToken.token
  try {
    const data = await fetchJson<{ access_token?: string; expires_in?: number }>(
      'https://id.twitch.tv/oauth2/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' }).toString(),
      },
    )
    if (!data?.access_token) return null
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
    const data = await fetchJson<{ data?: unknown[] }>(
      `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(login)}`,
      { headers: { 'Client-Id': process.env.TWITCH_CLIENT_ID || '', Authorization: `Bearer ${token}` } },
    )
    return Array.isArray(data?.data) && data.data.length > 0
  } catch {
    return false
  }
}

/**
 * Once a minute, sample whether the active slot's Twitch channel is actually
 * broadcasting and append a timestamp to the slot's streamActivity log. Kept in
 * a separate top-level field so the fee-poll writes never clobber it.
 */
async function logSlotActivity(row: SlotRow | null): Promise<void> {
  try {
    if (!row) return
    const slot = row.data
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
/**
 * Seed and refresh public/memeBoard FROM ON-CHAIN ACTIVITY.
 *
 * Discovery, not curation. The board used to be a hand-typed list of mints,
 * which meant the "Meme 100" was really "the coins someone remembered to add".
 * Now it's assembled from what is actually trading on Solana right now:
 *
 *   1. DISCOVER — DexScreener's boosted-token and latest-profile feeds give a
 *      wide, constantly-churning set of Solana mints that people are actively
 *      promoting and trading.
 *   2. ENRICH — read the real pool state for each mint. Deepest-liquidity pair
 *      wins, because a thin pair quotes a price nobody can trade at.
 *   3. FILTER — apply hard on-chain thresholds (below). This is the step that
 *      turns a firehose into a board.
 *   4. RANK — by 24h volume, and keep the top MEME_BOARD_SIZE.
 *
 * The thresholds are the whole safety story, because this list goes ON AIR and
 * is the ballot for a token-weighted vote. Without them, a rug minted ninety
 * seconds ago with $200 of liquidity lands on the broadcast next to real coins,
 * and the vote legitimises it. So a coin has to clear all of:
 *
 *   • MIN_LIQUIDITY_USD  — someone can actually trade it
 *   • MIN_VOLUME_H24_USD — it is actually being traded
 *   • MIN_PAIR_AGE_MS    — it has survived longer than a launch snipe
 *
 * A DENYLIST (`config/memeBoard.deny`) remains, because "it cleared the numbers"
 * is not the same as "we are happy to put it on television". An ALLOWLIST
 * (`config/memeBoard.mints`) still works too and is always included regardless
 * of thresholds — that's how $CSGN itself stays on its own board.
 */

const MEME_BOARD_INTERVAL_MS = 5 * 60 * 1000
/** DexScreener accepts up to 30 comma-separated addresses per request. */
const DEX_TOKENS_BATCH = 30
/** How many coins the published board carries. */
const MEME_BOARD_SIZE = 60
/** Discovery cap — how many candidate mints we're willing to enrich per run. */
const MEME_DISCOVERY_CAP = 120

/* On-chain quality gates. A coin must clear ALL of these to be discovered. */
const MIN_LIQUIDITY_USD = 25_000
const MIN_VOLUME_H24_USD = 50_000
const MIN_PAIR_AGE_MS = 24 * 60 * 60 * 1000

const SOLANA_MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
/** Wrapped SOL and the major stables are not memecoins. */
const MEME_BOARD_EXCLUDE = new Set([
  'So11111111111111111111111111111111111111112',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
])

interface DexPair {
  chainId?: string
  pairCreatedAt?: number
  baseToken?: { address?: string; symbol?: string; name?: string }
  priceUsd?: string
  marketCap?: number
  fdv?: number
  volume?: { h24?: number }
  priceChange?: { h24?: number }
  url?: string
  liquidity?: { usd?: number }
  info?: { imageUrl?: string }
}

/** Candidate Solana mints from DexScreener's discovery feeds. */
async function discoverSolanaMints(): Promise<string[]> {
  type Row = { chainId?: string; tokenAddress?: string }
  const [boosts, profiles] = await Promise.all([
    fetchJson<Row[]>('https://api.dexscreener.com/token-boosts/top/v1'),
    fetchJson<Row[]>('https://api.dexscreener.com/token-profiles/latest/v1'),
  ])
  const out: string[] = []
  const seen = new Set<string>()
  for (const row of [...(boosts || []), ...(profiles || [])]) {
    if (row?.chainId !== 'solana') continue
    const mint = String(row.tokenAddress || '')
    if (!SOLANA_MINT_RE.test(mint) || seen.has(mint) || MEME_BOARD_EXCLUDE.has(mint)) continue
    seen.add(mint)
    out.push(mint)
    if (out.length >= MEME_DISCOVERY_CAP) break
  }
  return out
}

/** Deepest-liquidity Solana pair per mint. */
async function enrichMints(mints: string[]): Promise<Map<string, DexPair>> {
  const best = new Map<string, DexPair>()
  for (let i = 0; i < mints.length; i += DEX_TOKENS_BATCH) {
    const batch = mints.slice(i, i + DEX_TOKENS_BATCH)
    const data = await fetchJson<{ pairs?: DexPair[] }>(
      `https://api.dexscreener.com/latest/dex/tokens/${batch.join(',')}`,
    )
    for (const pair of data?.pairs || []) {
      if (pair.chainId && pair.chainId !== 'solana') continue
      const addr = pair.baseToken?.address
      if (!addr) continue
      const prev = best.get(addr)
      if (!prev || (pair.liquidity?.usd ?? 0) > (prev.liquidity?.usd ?? 0)) best.set(addr, pair)
    }
  }
  return best
}

const toBoardCoin = (address: string, p: DexPair | undefined) => ({
  address,
  symbol: String(p?.baseToken?.symbol || '').toUpperCase().slice(0, 12),
  name: String(p?.baseToken?.name || '').slice(0, 60),
  imageUrl: String(p?.info?.imageUrl || ''),
  priceUsd: Number(p?.priceUsd) || 0,
  marketCapUsd: Number(p?.marketCap ?? p?.fdv) || 0,
  volumeH24Usd: Number(p?.volume?.h24) || 0,
  priceChangeH24Pct: Number(p?.priceChange?.h24) || 0,
  liquidityUsd: Number(p?.liquidity?.usd) || 0,
  pairUrl: String(p?.url || `https://dexscreener.com/solana/${address}`),
})

async function refreshMemeBoard(): Promise<void> {
  try {
    const existing = await getDoc<{ updatedAt?: string }>('public/memeBoard')
    const last = Date.parse(existing?.updatedAt || '')
    if (Number.isFinite(last) && Date.now() - last < MEME_BOARD_INTERVAL_MS) return

    const cfg = await getDoc<{ mints?: unknown; deny?: unknown }>('config/memeBoard')
    const clean = (v: unknown) => (Array.isArray(v) ? v : [])
      .map((m) => String(m ?? '').trim())
      .filter((m) => SOLANA_MINT_RE.test(m))
    const pinned = clean(cfg?.mints).slice(0, 40)
    const denied = new Set(clean(cfg?.deny))

    const discovered = (await discoverSolanaMints()).filter((m) => !denied.has(m))
    const candidates = [...new Set([...pinned, ...discovered])].slice(0, MEME_DISCOVERY_CAP + pinned.length)
    if (candidates.length === 0) return

    const enriched = await enrichMints(candidates)
    const now = Date.now()
    const pinnedSet = new Set(pinned)

    const qualifies = (address: string, p: DexPair | undefined): boolean => {
      // Pinned coins bypass the thresholds — that's what pinning means, and it's
      // how $CSGN stays on its own board on a quiet day.
      if (pinnedSet.has(address)) return true
      if (!p) return false
      if ((p.liquidity?.usd ?? 0) < MIN_LIQUIDITY_USD) return false
      if ((p.volume?.h24 ?? 0) < MIN_VOLUME_H24_USD) return false
      const age = p.pairCreatedAt ? now - p.pairCreatedAt : 0
      if (age < MIN_PAIR_AGE_MS) return false
      return true
    }

    const coins = candidates
      .filter((address) => !denied.has(address))
      .filter((address) => qualifies(address, enriched.get(address)))
      .map((address) => toBoardCoin(address, enriched.get(address)))
      // Volume is the honest "what is actually happening" sort for the board
      // itself; the app re-ranks by power score once holder votes are folded in.
      .sort((a, b) => b.volumeH24Usd - a.volumeH24Usd)
      .slice(0, MEME_BOARD_SIZE)

    // Never publish an empty board over a good one — a discovery-feed outage
    // would otherwise wipe the ballot mid-vote.
    if (coins.length === 0) return

    await writeDoc('public/memeBoard', {
      coins,
      source: 'onchain',
      thresholds: {
        minLiquidityUsd: MIN_LIQUIDITY_USD,
        minVolumeH24Usd: MIN_VOLUME_H24_USD,
        minPairAgeHours: MIN_PAIR_AGE_MS / 3_600_000,
      },
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.warn('refreshMemeBoard failed', err)
  }
}

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

async function pollAndWrite(dexData: DexData, active: SlotRow | null, tick: number): Promise<void> {
  try {
    if (!active) return

    const slotId = active.path.split('/').pop()!
    // Tick 0 reuses the row fetched at the top of the invocation; later ticks
    // re-read just this one doc (1 read, not a range query) so admin-side
    // changes — fees marked paid/declined, snapshot locked — stay visible
    // mid-invocation.
    let slotData = active.data
    if (tick > 0) {
      const fresh = await getDoc<SlotDoc>(active.path)
      if (!fresh) return
      slotData = fresh
    }

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
  // The active slot is derived from the same rows — the whole invocation runs
  // on one slots range query where it used to issue six.
  const rows = await advanceSlotLifecycles()
  const active = pickActiveSlot(rows)

  // Sample real Twitch activity for the active slot (1 Helix call/min) so the
  // Creator Fees log can prove the streamer was actually live, not intermission.
  await logSlotActivity(active)

  // Re-anchor the Meme-100 to what voters actually still hold (every 30 min).
  await settleMemeVote()
  await refreshMemeBoard()

  let tokenStatsWritten = false
  let lastDex: DexData | null = null
  for (let i = 0; i < 4; i++) {
    const dexData = await fetchDexData()
    if (dexData) {
      lastDex = dexData
      if (!tokenStatsWritten) {
        try {
          await writeDoc('public/tokenStats', buildTokenStatsDoc(dexData), { merge: false })
          tokenStatsWritten = true
        } catch (err) {
          console.error('[feePoller] tokenStats write error:', err)
        }
      }
      await pollAndWrite(dexData, active, i)
    }
    if (i < 3) await sleep(POLL_INTERVAL_MS)
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
}
