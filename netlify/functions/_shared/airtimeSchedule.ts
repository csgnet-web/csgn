/**
 * BUILD THE HOLDER-AIRTIME SCHEDULE — the playlist the channel runs between
 * live blocks.
 *
 * ── Why this is its own module ─────────────────────────────────────────────
 *
 * It used to live inside the scheduled fee poller, which made the schedule —
 * and therefore every member's airtime allowance — dependent on one background
 * invocation having got as far as calling it. When it hadn't, `/studio` showed
 * "0 seconds" with no way to tell whether that meant "you hold nothing", "you
 * have no approved clip" or "nothing has rebuilt the schedule yet". Three very
 * different problems, one identical zero.
 *
 * Two callers share it now: the poller refreshes it on its own cadence, and
 * `myClips` asks for a rebuild when the stored schedule is stale — which costs
 * one document read in the common case because the freshness check comes first.
 * A member who links a wallet sees their real allowance on the next load rather
 * than up to ten minutes later.
 *
 * ── What it does ───────────────────────────────────────────────────────────
 *
 * Reads the blocks that outrank clips (claimed hours and the network block),
 * derives the gaps between them, shares those gaps out among members with
 * approved content in proportion to the $CSGN they hold, and publishes the
 * resulting playlist to `public/airtimeSchedule`.
 */

import { queryCollection, getDoc, writeDoc, fieldFilter, order } from './firebaseAdmin'
import { getCsgnBalance } from './solana'
import { applyTrim } from './clipEmbed'
import {
  airtimeShares, deriveAirtimeWindows, windowSeconds, buildAirtimeSchedule,
  type AirtimeClip, type AirtimeMember, type TimeRange,
} from './airtime'

const SCHEDULE_META_PATH = 'config/scheduleMeta'

/** Slot fields this module reads. The poller's fuller SlotDoc is a superset. */
interface SlotRow {
  startTime?: string
  endTime?: string
  status?: string
  type?: string
}

/** Rebuild cadence. Long enough to cost nothing, short enough that a clip
 *  approved now is on the air within the hour. */
const AIRTIME_REBUILD_INTERVAL_MS = 10 * 60 * 1000
/** How far ahead the published schedule runs. The preview a member is shown
 *  ("your clip airs at 2:04 PM") is only honest out to this horizon. */
const AIRTIME_HORIZON_MS = 6 * 60 * 60 * 1000
/** Ceiling on approved clips considered per rebuild — a cost guard, not a rule. */
const AIRTIME_MAX_CLIPS = 400

interface ClipDoc {
  uid?: string
  username?: string
  /** What /player loads in an iframe — built server-side from the member's link. */
  embedUrl?: string
  /** Where the post actually lives, for credit and for the review queue. */
  sourceUrl?: string
  thumbnailUrl?: string
  platform?: string
  title?: string
  seconds?: number
  sourceSeconds?: number
  trimStartSeconds?: number
  trimEndSeconds?: number
  order?: number
  status?: string
}

/**
 * Publish `public/airtimeSchedule` — the ordered, timestamped playlist /player
 * runs whenever nobody is live.
 *
 * The shape of the day falls out of subtraction rather than a branch: claimed
 * slots and (when enabled) the owner's 7 PM–3 AM block arrive as blocked ranges,
 * and whatever is left is holder inventory. Toggling the block off hands those
 * hours back with no other change — that is the owner's 16-hour / 24-hour switch,
 * and it needs no migration because allocation is by proportion of whatever
 * inventory exists.
 *
 * Balances are read LIVE, per rebuild, for the members who actually have
 * approved content. Never a stored snapshot: `master-plan.md` §5.1 documents the
 * attack, where a stored weight lets a holder sell — or cycle the bag to a fresh
 * wallet — and keep the airtime anyway.
 */
/**
 * Why the schedule gave a member nothing, in the vocabulary /studio speaks.
 *
 * A zero is never just a zero here — it is one of four distinct situations and
 * the member can act on three of them. Returning the reason is what lets the
 * page say "link your wallet" instead of "0 seconds".
 */
export type AirtimeBlockReason =
  | 'ok'
  | 'no_clips'
  | 'no_wallet'
  /** We could not reach the chain. NOT the same as holding nothing, and the
   *  difference has to reach the screen — conflating them is how a rate limit
   *  gets read as "my tokens don't count". */
  | 'unreadable'
  | 'no_balance'
  | 'no_inventory'

export interface AirtimeRebuildResult {
  built: boolean
  skipped: boolean
  members: number
  segments: number
  inventorySeconds: number
}

/**
 * Total circulating supply, injected rather than fetched here.
 *
 * The poller already holds a cached DexScreener read and there is no reason to
 * make a second one; a caller with no market data passes nothing and gets the
 * documented default. Keeping the fetch out of this module is also what stops
 * the fee poller's rate limits leaking into a member-facing request path.
 */
export type SupplyProvider = () => Promise<number>

/**
 * HOW MUCH OPEN AIR THERE IS, computed from the schedule itself.
 *
 * Extracted because reading it off the PUBLISHED playlist was a live bug with a
 * bad failure mode. `myClips` did `Number(schedule?.inventorySeconds) || 0`, and
 * `airtimeQuote` floors to zero when inventory is zero — so if
 * `public/airtimeSchedule` had never been written (the poller had not run, or
 * the last rebuild bailed because nobody had an approved clip), a member holding
 * 1.89 MILLION $CSGN was quoted zero seconds. Their balance was read correctly
 * and then multiplied by an inventory of nothing.
 *
 * An entitlement must not depend on a cache existing. This derives the open air
 * from the slots themselves, every time, which is three cheap reads and cannot
 * be stale.
 */
export interface OpenAir {
  inventorySeconds: number
  networkBlockEnabled: boolean
  windows: TimeRange[]
  horizonEndMs: number
}

export async function openAirInventory(nowMs = Date.now()): Promise<OpenAir> {
  const horizonEndMs = nowMs + AIRTIME_HORIZON_MS

  const meta = await getDoc<{ networkBlockEnabled?: boolean }>(SCHEDULE_META_PATH)
  const networkBlockEnabled = meta?.networkBlockEnabled !== false // absent = on

  const upcoming = await queryCollection(
    'slots',
    [
      fieldFilter('endTime', 'GREATER_THAN', new Date(nowMs).toISOString()),
      fieldFilter('endTime', 'LESS_THAN', new Date(horizonEndMs + 4 * 60 * 60 * 1000).toISOString()),
    ],
    [order('endTime', 'ASCENDING')],
    40,
  )

  const blocked: TimeRange[] = []
  for (const row of upcoming) {
    const slot = row.data as SlotRow
    const startMs = Date.parse(String(slot.startTime ?? ''))
    const endMs = Date.parse(String(slot.endTime ?? ''))
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) continue
    // A claimed hour is someone's booking; the network block is the owner's.
    const claimed = slot.status === 'confirmed' || slot.status === 'live'
    const ownerBlock = networkBlockEnabled && String(slot.type || '') === 'network'
    if (claimed || ownerBlock) blocked.push({ startMs, endMs })
  }

  const windows = deriveAirtimeWindows(nowMs, horizonEndMs, blocked)
  return { inventorySeconds: windowSeconds(windows), networkBlockEnabled, windows, horizonEndMs }
}

const DEFAULT_SUPPLY = 1_000_000_000

export async function refreshAirtimeSchedule(
  getSupply?: SupplyProvider,
  { force = false } = {},
): Promise<AirtimeRebuildResult> {
  try {
    const existing = await getDoc<{ builtAt?: string }>('public/airtimeSchedule')
    const last = Date.parse(existing?.builtAt || '')
    if (!force && Number.isFinite(last) && Date.now() - last < AIRTIME_REBUILD_INTERVAL_MS) {
      return { built: false, skipped: true, members: 0, segments: 0, inventorySeconds: 0 }
    }

    const nowMs = Date.now()
    // One source for "how much open air is there", shared with myClips so a
    // member's quoted entitlement and the playlist can never disagree.
    const { inventorySeconds: inventory, networkBlockEnabled, windows, horizonEndMs } = await openAirInventory(nowMs)
    if (inventory <= 0) {
      await writeDoc('public/airtimeSchedule', {
        items: [], allocations: [], inventorySeconds: 0, networkBlockEnabled,
        builtAt: new Date(nowMs).toISOString(), horizonEndsAt: new Date(horizonEndMs).toISOString(),
      })
      return { built: true, skipped: false, members: 0, segments: 0, inventorySeconds: 0 }
    }

    // Approved clips only. Nothing airs unreviewed — see docs/plan-decentralized-tv.md §5.1.
    // NO orderBy — see the warning on queryCollection. This one failed inside
    // the catch below, so it was invisible: the schedule simply never built.
    const clipRows = await queryCollection(
      'clips',
      [fieldFilter('status', 'EQUAL', 'approved')],
      [],
      AIRTIME_MAX_CLIPS,
    )
    const clips: AirtimeClip[] = clipRows.flatMap((row) => {
      const c = row.data as ClipDoc
      const seconds = Math.floor(Number(c.seconds) || 0)
      if (!c.uid || !c.embedUrl || seconds <= 0) return []
      // The published embed carries the member's crop, so /player loads a URL
      // that already starts and ends where they said. Applying it here rather
      // than at playback keeps the broadcast dumb: it plays what it is given.
      // applyTrim, not a second copy of the same string-building. This was
      // written inline here AND implemented (and unit-tested) in clipEmbed.ts —
      // two versions of the rule that decides where a member's clip starts, with
      // only one of them covered by a test and neither aware of the other.
      const cropped = applyTrim(
        { platform: c.platform as 'youtube' | 'tiktok' | 'instagram', videoId: '', canonicalUrl: '', embedUrl: String(c.embedUrl) },
        { startSeconds: Number(c.trimStartSeconds) || 0, endSeconds: Number(c.trimEndSeconds) || 0 },
      )
      return [{
        clipId: row.path.split('/').pop()!,
        uid: String(c.uid),
        username: String(c.username || ''),
        url: cropped,
        platform: String(c.platform || ''),
        sourceUrl: String(c.sourceUrl || ''),
        title: String(c.title || ''),
        seconds,
        order: Number(c.order) || 0,
      }]
    })
    clips.sort((a, b) => a.order - b.order)
    if (clips.length === 0) {
      // Publish the EMPTY schedule rather than returning silently. Bailing left
      // whatever was there last time in place, so a member whose clip had been
      // removed kept seeing a stale allowance built from it.
      await writeDoc('public/airtimeSchedule', {
        items: [], allocations: [], inventorySeconds: inventory, networkBlockEnabled,
        builtAt: new Date(nowMs).toISOString(), horizonEndsAt: new Date(horizonEndMs).toISOString(),
      })
      return { built: true, skipped: false, members: 0, segments: 0, inventorySeconds: inventory }
    }

    // Live balances, one RPC per uploading member — bounded by who has content.
    const secondsByUid = new Map<string, number>()
    const walletByUid = new Map<string, string>()
    const lookByUid = new Map<string, string>()
    const styleByUid = new Map<string, string>()
    const avatarByUid = new Map<string, string>()
    for (const clip of clips) secondsByUid.set(clip.uid, (secondsByUid.get(clip.uid) ?? 0) + clip.seconds)
    await Promise.all([...secondsByUid.keys()].map(async (uid) => {
      const user = await getDoc<{
        phantom?: { walletAddress?: string; verified?: boolean }
        onAirLook?: string; onAirStyle?: string; showAvatarOnAir?: boolean
        socialAvatar?: { url?: string }
      }>(`users/${uid}`)
      const wallet = user?.phantom?.verified ? String(user.phantom.walletAddress || '') : ''
      if (wallet) walletByUid.set(uid, wallet)
      // The member's chosen lower-third colour travels with their segments, so
      // the broadcast does not have to look anything up at playback.
      lookByUid.set(uid, String(user?.onAirLook || 'signal'))
      styleByUid.set(uid, String(user?.onAirStyle || 'bar'))
      // Only travels if they left it on. The broadcast never has to look
      // anything up at playback — it plays what the schedule handed it.
      avatarByUid.set(uid, user?.showAvatarOnAir !== false ? String(user?.socialAvatar?.url || '') : '')
    }))
    for (const clip of clips) {
      clip.look = lookByUid.get(clip.uid) ?? 'signal'
      clip.style = styleByUid.get(clip.uid) ?? 'bar'
      clip.avatarUrl = avatarByUid.get(clip.uid) ?? ''
    }
    const balances = new Map<string, number>()
    await Promise.all([...walletByUid].map(async ([uid, wallet]) => {
      try {
        balances.set(uid, await getCsgnBalance(wallet))
      } catch {
        // A balance we cannot read is read as zero, which still earns the floor.
        // Failing toward "no airtime" would let an RPC hiccup silence somebody.
        balances.set(uid, 0)
      }
    }))

    const supply = (getSupply ? await getSupply().catch(() => 0) : 0) || DEFAULT_SUPPLY

    const members: AirtimeMember[] = [...secondsByUid].map(([uid, clipSeconds]) => ({
      uid,
      balance: balances.get(uid) ?? 0,
      clipSeconds,
    }))

    const allocations = airtimeShares(members, inventory, supply)
    const items = buildAirtimeSchedule(allocations, clips, windows)

    await writeDoc('public/airtimeSchedule', {
      items,
      inventorySeconds: inventory,
      networkBlockEnabled,
      allocations: allocations.map((a) => ({ uid: a.uid, seconds: a.seconds, capped: a.capped })),
      builtAt: new Date(nowMs).toISOString(),
      horizonEndsAt: new Date(horizonEndMs).toISOString(),
    })
    console.log(`[airtime] schedule: ${items.length} segments across ${allocations.length} members, ${inventory}s inventory (block ${networkBlockEnabled ? 'on' : 'off'})`)
    return { built: true, skipped: false, members: allocations.length, segments: items.length, inventorySeconds: inventory }
  } catch (err) {
    console.error('[airtime] refreshAirtimeSchedule error:', err)
    return { built: false, skipped: false, members: 0, segments: 0, inventorySeconds: 0 }
  }
}

