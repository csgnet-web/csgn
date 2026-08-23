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

import { queryCollection, getDoc, writeDoc, fieldFilter } from './firebaseAdmin'
import { broadcastDayBounds, broadcastDayKey } from './broadcastDay'
import { ensureDayLock } from './airtimeLock'
import { applyTrim } from './clipEmbed'
import {
  airtimeShares, deriveAirtimeWindows, windowSeconds, buildAirtimeSchedule,
  CSGN_TOTAL_SUPPLY,
  type AirtimeClip, type AirtimeMember, type TimeRange,
} from './airtime'

const SCHEDULE_META_PATH = 'config/scheduleMeta'


/** Rebuild cadence. Long enough to cost nothing, short enough that a clip
 *  approved now is on the air within the hour. */
const AIRTIME_REBUILD_INTERVAL_MS = 10 * 60 * 1000
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
 * HOW MUCH CLIP AIR THERE IS IN A DAY. The answer is: all of it.
 *
 * ── The rule, and why it is this simple ────────────────────────────────────
 *
 * **Clips run 24/7.** A member's entitlement is their share of the token
 * applied to a whole 86,400-second day — one to one, balance over the
 * 1,000,000,000 supply — and nothing shrinks it.
 *
 * This replaced a version that subtracted booked hours and the owner's block
 * from the denominator, so the reel divided sixteen hours on some days and
 * twenty-four on others. Two problems with that, one practical and one about
 * what the token means:
 *
 *   • A member's seconds moved for reasons that had nothing to do with them.
 *     They bought a share of the channel and got a different amount of it
 *     depending on what somebody else did that evening.
 *
 *   • It made an interruption look like a deduction. It is not. A streamer
 *     going on, or the MP taking the channel, PRE-EMPTS the reel in real time —
 *     it does not withdraw anybody's entitlement. The reel picks up where it
 *     left off.
 *
 * So the denominator is a constant and the schedule no longer touches it. What
 * a holder is owed is now a fact about the token, not a fact about tonight.
 *
 * ── Why this is derived rather than read from a cache ──────────────────────
 *
 * Reading the inventory off the PUBLISHED playlist was a live bug with a bad
 * failure mode. `myClips` did `Number(schedule?.inventorySeconds) || 0`, and
 * `airtimeQuote` floors to zero when inventory is zero — so if
 * `public/airtimeSchedule` had never been written (the poller had not run, or
 * the last rebuild bailed because nobody had an approved clip), a member holding
 * 1.89 MILLION $CSGN was quoted zero seconds. Their balance was read correctly
 * and then multiplied by an inventory of nothing.
 *
 * An entitlement must not depend on a cache existing — and now it does not
 * depend on a query either.
 */
export interface OpenAir {
  /** Which broadcast day this is — see _shared/broadcastDay.ts. */
  dayKey: string
  dayStartMs: number
  /** The entitlement denominator: a whole day, every day. Constant by design —
   *  see the note above. */
  inventorySeconds: number
  /** Air still to come today. What a playlist can actually be laid into — you
   *  cannot schedule a clip into an hour that has already gone out. */
  remainingSeconds: number
  /** Whether the MP has their 7 PM–3 AM block reserved. Kept because the
   *  SCHEDULE still shows it and the mode rule still reads it — but it no
   *  longer touches the clip denominator, which is the point. */
  networkBlockEnabled: boolean
  /** The remaining windows, for scheduling. */
  windows: TimeRange[]
  horizonEndMs: number
}

export async function openAirInventory(nowMs = Date.now()): Promise<OpenAir> {
  // THE WHOLE BROADCAST DAY, and all of it.
  //
  // Past hours are included on purpose: the day's proportions are fixed at its
  // 2 AM cutover, so what a member is entitled to must not depend on how much
  // of the day has already been spent.
  const { startMs, endMs } = broadcastDayBounds(broadcastDayKey(nowMs))

  // One read, and only for the schedule's benefit — the denominator below does
  // not use it. See the note on the interface.
  const meta = await getDoc<{ networkBlockEnabled?: boolean }>(SCHEDULE_META_PATH)
  const networkBlockEnabled = meta?.networkBlockEnabled !== false // absent = on

  // NO BLOCKED RANGES. There used to be a slots query here subtracting booked
  // hours and the owner's block. Deleting it is the whole change: clips run
  // 24/7, live interruptions pre-empt rather than deduct, and this function no
  // longer needs the schedule to answer a question about the token.
  const dayWindows = deriveAirtimeWindows(startMs, endMs, [])
  // The air still to come, for actually laying a playlist down.
  const remainingWindows = deriveAirtimeWindows(Math.max(nowMs, startMs), endMs, [])

  return {
    dayKey: broadcastDayKey(nowMs),
    dayStartMs: startMs,
    inventorySeconds: windowSeconds(dayWindows),
    remainingSeconds: windowSeconds(remainingWindows),
    networkBlockEnabled,
    windows: remainingWindows,
    horizonEndMs: endMs,
  }
}

/** The one denominator. Re-exported from _shared/airtime.ts rather than
 *  redeclared, because two copies of a number that decides airtime is two
 *  answers waiting to disagree. */
const DEFAULT_SUPPLY = CSGN_TOTAL_SUPPLY

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
    const openAir = await openAirInventory(nowMs)
    const { inventorySeconds: inventory, networkBlockEnabled, windows, horizonEndMs } = openAir
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

    // ── THE DAY'S LOCKED SHARES ──
    //
    // Read, not recomputed. The proportions were decided at the 2 AM cutover
    // and this is where that decision is honoured: the scheduler lays clips
    // into the remaining air in proportion to what each member was ALREADY
    // told they had, so the playlist and the number on their screen cannot
    // drift apart during the day.
    //
    // Balances are no longer read here at all. That is the point — one balance
    // read per member per DAY at the cutover, instead of one per member per
    // rebuild, which was both more expensive and less stable.
    const lock = await ensureDayLock(getSupply ?? (async () => 0), nowMs)

    const secondsByUid = new Map<string, number>()
    const lookByUid = new Map<string, string>()
    const styleByUid = new Map<string, string>()
    const motionByUid = new Map<string, string>()
    const avatarByUid = new Map<string, string>()
    for (const clip of clips) secondsByUid.set(clip.uid, (secondsByUid.get(clip.uid) ?? 0) + clip.seconds)

    await Promise.all([...secondsByUid.keys()].map(async (uid) => {
      const user = await getDoc<{
        onAirLook?: string; onAirStyle?: string; onAirMotion?: string; showAvatarOnAir?: boolean
        socialAvatar?: { url?: string }
      }>(`users/${uid}`)
      // The member's chosen lower-third travels with their segments, so the
      // broadcast does not have to look anything up at playback.
      lookByUid.set(uid, String(user?.onAirLook || 'signal'))
      styleByUid.set(uid, String(user?.onAirStyle || 'bar'))
      motionByUid.set(uid, String(user?.onAirMotion || 'cut'))
      avatarByUid.set(uid, user?.showAvatarOnAir !== false ? String(user?.socialAvatar?.url || '') : '')
    }))

    for (const clip of clips) {
      clip.look = lookByUid.get(clip.uid) ?? 'signal'
      clip.style = styleByUid.get(clip.uid) ?? 'bar'
      clip.motion = motionByUid.get(clip.uid) ?? 'cut'
      clip.avatarUrl = avatarByUid.get(clip.uid) ?? ''
    }

    // A member with content but no locked share gets nothing today — they had
    // no readable balance at the cutover. They are picked up at the next one.
    const members: AirtimeMember[] = [...secondsByUid].map(([uid, clipSeconds]) => ({
      uid,
      balance: lock?.shares.find((share) => share.uid === uid)?.balance ?? 0,
      clipSeconds,
    }))

    const supply = lock?.supply ?? ((getSupply ? await getSupply().catch(() => 0) : 0) || DEFAULT_SUPPLY)

    // Cut against the REMAINING air. A member's entitlement is a share of the
    // whole day, but a playlist can only be laid into hours that have not
    // aired yet — so the scheduler scales the locked proportions down to what
    // is actually left. Late in the day this means fewer seconds scheduled
    // than the member's daily figure, which is correct and is why /studio
    // shows both numbers.
    const allocations = airtimeShares(members, openAir.remainingSeconds, supply)
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

