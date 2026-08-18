// Everything /studio needs in one call: your reel, and how much of the day is
// yours.
//
// The allocation is READ from the schedule the poller already published, never
// recomputed here. `public/airtimeSchedule` is what actually goes on air, so
// showing a member a number derived any other way would be showing them a
// number that is not true.
import { requireUser } from './_shared/auth'
import { getDoc, queryCollection, fieldFilter } from './_shared/firebaseAdmin'
import { json, requireMethod, withHttp } from './_shared/http'
import { refreshAirtimeSchedule, type AirtimeBlockReason } from './_shared/airtimeSchedule'
import { getCsgnBalance } from './_shared/solana'
import { airtimeQuote } from './_shared/airtime'
import { fetchJson } from './_shared/cache'

interface ScheduleDoc {
  items?: Array<{ startsAt?: string; endsAt?: string; seconds?: number; clipId?: string; uid?: string }>
  allocations?: Array<{ uid?: string; seconds?: number; capped?: boolean }>
  inventorySeconds?: number
  networkBlockEnabled?: boolean
  builtAt?: string
}

export const handler = withHttp(async (event) => {
  requireMethod(event, 'GET')
  const authUser = await requireUser(event)

  // Rebuild first, if it is due. Cheap — the freshness check inside is one
  // document read and returns immediately when the schedule is current. This is
  // what stops /studio reporting a stale (or entirely absent) allowance when the
  // scheduled poller has not run: a member who links a wallet or gets a clip
  // approved sees the real number on their next load rather than up to ten
  // minutes later, wondering whether the feature works at all.
  await refreshAirtimeSchedule()

  const [rows, schedule, profile] = await Promise.all([
    // NO orderBy — see the warning on queryCollection. `uid == x` plus
    // `orderBy(order)` needs a composite index this project does not define, so
    // this query 500'd and took the whole Studio page down with it. Twenty-five
    // clips sort for free below.
    queryCollection('clips', [fieldFilter('uid', 'EQUAL', authUser.uid)], [], 50),
    getDoc<ScheduleDoc>('public/airtimeSchedule'),
    getDoc<{
      onAirLook?: string; onAirStyle?: string; showAvatarOnAir?: boolean
      socialAvatar?: { provider?: string; url?: string }
      username?: string
      phantom?: { verified?: boolean; walletAddress?: string }
    }>(`users/${authUser.uid}`),
  ])

  const clips = rows.map((row) => {
    const d = row.data as Record<string, unknown>
    return {
      id: row.path.split('/').pop()!,
      platform: String(d.platform || ''),
      sourceUrl: String(d.sourceUrl || ''),
      title: String(d.title || ''),
      thumbnailUrl: String(d.thumbnailUrl || ''),
      seconds: Number(d.seconds) || 0,
      /** The video's real full length, when the platform gave us one. */
      sourceSeconds: Number(d.sourceSeconds) || 0,
      trimStartSeconds: Number(d.trimStartSeconds) || 0,
      trimEndSeconds: Number(d.trimEndSeconds) || 0,
      /** True when the platform told us the real runtime, false when we guessed. */
      measured: d.measured === true,
      order: Number(d.order) || 0,
      status: String(d.status || 'pending'),
      rejectReason: d.rejectReason ? String(d.rejectReason) : null,
    }
  }).sort((a, b) => a.order - b.order)

  const mine = (schedule?.allocations ?? []).find((a) => a?.uid === authUser.uid)
  // Only future airings — a member wants to know when they are next on, not
  // when they were on an hour ago.
  const nowMs = Date.now()
  const airings = (schedule?.items ?? [])
    .filter((i) => i?.uid === authUser.uid && Date.parse(String(i.startsAt ?? '')) > nowMs)
    .slice(0, 20)
    .map((i) => ({ startsAt: i.startsAt ?? '', seconds: Number(i.seconds) || 0, clipId: String(i.clipId || '') }))

  // ── WHAT THE BAG IS WORTH ───────────────────────────────────────────────
  //
  // Read from the WALLET, not from the playlist.
  //
  // The allowance used to come out of `schedule.allocations`, which only exists
  // for members with an approved clip — so a member holding 1.8 million $CSGN
  // and waiting on review was shown "0 seconds". That is the token appearing to
  // do nothing on the one screen built to show what it does.
  //
  // The entitlement is a property of the holdings and is quoted as such. The
  // scheduler's number is still reported alongside it as `scheduledSeconds`,
  // because that is what is actually laid down on the playlist today and the
  // two answer different questions.
  const wallet = profile?.phantom?.verified ? String(profile.phantom.walletAddress || '') : ''
  const approvedCount = clips.filter((c) => c.status === 'approved').length

  let balance: number | null = null
  if (wallet) {
    try {
      balance = await getCsgnBalance(wallet)
    } catch {
      // null means "we could not read it", which the UI states plainly rather
      // than rendering as a zero the member would read as an accusation.
      balance = null
    }
  }

  const inventory = Number(schedule?.inventorySeconds) || 0
  const quote = airtimeQuote(balance ?? 0, inventory, await circulatingSupply())
  const scheduledSeconds = Number(mine?.seconds) || 0

  // Four zeroes, three of them fixable by the member — named so the page can
  // say which one it is instead of showing one number for four problems.
  let reason: AirtimeBlockReason = 'ok'
  if (quote.seconds <= 0) {
    if (!wallet) reason = 'no_wallet'
    else if ((balance ?? 0) <= 0) reason = 'no_balance'
    else reason = 'no_inventory'
  } else if (approvedCount === 0) {
    // They have airtime and nothing to put in it. Not a failure — a next step.
    reason = 'no_clips'
  }

  return json(200, {
    onAirLook: String(profile?.onAirLook || 'signal'),
    onAirStyle: String(profile?.onAirStyle || 'bar'),
    // Defaults to ON: if we have somebody's picture, showing it is what makes
    // their segment look like theirs. They can turn it off.
    showAvatarOnAir: profile?.showAvatarOnAir !== false,
    socialAvatar: profile?.socialAvatar?.url
      ? { provider: String(profile.socialAvatar.provider || ''), url: String(profile.socialAvatar.url) }
      : null,
    username: String(profile?.username || ''),
    clips,
    airtime: {
      /** What the bag earns today. Independent of the review queue. */
      seconds: quote.seconds,
      /** What the playlist has actually laid down — 0 until a clip is approved. */
      scheduledSeconds,
      capped: quote.capped,
      /** Share of circulating supply, as a fraction, for the 1:1 explainer. */
      supplyShare: quote.supplyShare,
      inventorySeconds: inventory,
      networkBlockEnabled: schedule?.networkBlockEnabled !== false,
      builtAt: schedule?.builtAt ?? null,
      /** Which of the four states this is. 'ok' when there is airtime and content. */
      reason,
      /** The linked wallet, or '' when none is attached to this account. */
      walletAddress: wallet,
      /** Live $CSGN balance; null when unread, not when zero. */
      balance,
    },
    airings,
  })
})


/**
 * Circulating supply, from the same market read the rest of the app uses.
 *
 * Cached for ten minutes because it moves slowly and this is a member-facing
 * request path. A failed read falls back to the nominal one-billion supply
 * rather than throwing — an unreachable price API must not be able to make
 * somebody's airtime read as zero, which is the exact class of failure this
 * whole change is about.
 */
const NOMINAL_SUPPLY = 1_000_000_000
const DEX_PAIR_URL = 'https://api.dexscreener.com/latest/dex/tokens/GFV7fphvprMr1PYpYGPJort2QP7JJLEp3J1Buu7Zpump'

async function circulatingSupply(): Promise<number> {
  try {
    const data = await fetchJson<{ pairs?: Array<{ priceUsd?: string; marketCap?: number; fdv?: number }> }>(
      DEX_PAIR_URL, { timeoutMs: 2_500 },
    )
    const pair = data?.pairs?.[0]
    const price = Number(pair?.priceUsd) || 0
    const cap = Number(pair?.marketCap ?? pair?.fdv) || 0
    const supply = price > 0 ? cap / price : 0
    return supply > 0 ? supply : NOMINAL_SUPPLY
  } catch {
    return NOMINAL_SUPPLY
  }
}
