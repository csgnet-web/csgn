// Everything /studio needs in one call: your reel, and how much of the day is
// yours.
//
// The allocation is READ from the schedule the poller already published, never
// recomputed here. `public/airtimeSchedule` is what actually goes on air, so
// showing a member a number derived any other way would be showing them a
// number that is not true.
import { requireUser } from './_shared/auth'
import { getDoc, queryCollection, fieldFilter, order } from './_shared/firebaseAdmin'
import { json, requireMethod, withHttp } from './_shared/http'
import { refreshAirtimeSchedule, type AirtimeBlockReason } from './_shared/airtimeSchedule'
import { getCsgnBalance } from './_shared/solana'

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
    queryCollection('clips', [fieldFilter('uid', 'EQUAL', authUser.uid)], [order('order', 'ASCENDING')], 50),
    getDoc<ScheduleDoc>('public/airtimeSchedule'),
    getDoc<{ onAirLook?: string; username?: string; phantom?: { verified?: boolean; walletAddress?: string } }>(`users/${authUser.uid}`),
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
  })

  const mine = (schedule?.allocations ?? []).find((a) => a?.uid === authUser.uid)
  // Only future airings — a member wants to know when they are next on, not
  // when they were on an hour ago.
  const nowMs = Date.now()
  const airings = (schedule?.items ?? [])
    .filter((i) => i?.uid === authUser.uid && Date.parse(String(i.startsAt ?? '')) > nowMs)
    .slice(0, 20)
    .map((i) => ({ startsAt: i.startsAt ?? '', seconds: Number(i.seconds) || 0, clipId: String(i.clipId || '') }))

  // ── WHY the allowance is what it is ────────────────────────────────────
  //
  // A bare "0 seconds" is the single most confusing thing this endpoint can
  // say, because four unrelated situations produce it and the member can fix
  // three of them. Naming the cause is the difference between "this is broken"
  // and "oh, I need to connect my wallet" — which was the actual experience of
  // a member holding 1.8M $CSGN and seeing nothing.
  const wallet = profile?.phantom?.verified ? String(profile.phantom.walletAddress || '') : ''
  const approvedCount = clips.filter((c) => c.status === 'approved').length
  const seconds = Number(mine?.seconds) || 0

  // Only read the chain when the answer actually depends on it — i.e. the
  // member has content and a linked wallet but still got nothing.
  let balance: number | null = null
  if (wallet && (seconds === 0 || approvedCount > 0)) {
    try {
      balance = await getCsgnBalance(wallet)
    } catch {
      // null means "we could not read it", which the UI states plainly rather
      // than rendering as a zero the member would read as an accusation.
      balance = null
    }
  }

  let reason: AirtimeBlockReason = 'ok'
  if (seconds <= 0) {
    if (approvedCount === 0) reason = 'no_clips'
    else if (!wallet) reason = 'no_wallet'
    else if ((balance ?? 0) <= 0) reason = 'no_balance'
    else reason = 'no_inventory'
  }

  return json(200, {
    onAirLook: String(profile?.onAirLook || 'signal'),
    username: String(profile?.username || ''),
    clips,
    airtime: {
      seconds,
      capped: Boolean(mine?.capped),
      inventorySeconds: Number(schedule?.inventorySeconds) || 0,
      networkBlockEnabled: schedule?.networkBlockEnabled !== false,
      builtAt: schedule?.builtAt ?? null,
      /** Which of the four zeroes this is. 'ok' when seconds > 0. */
      reason,
      /** The linked wallet, or '' when none is attached to this account. */
      walletAddress: wallet,
      /** Live $CSGN balance; null when unread, not when zero. */
      balance,
    },
    airings,
  })
})
