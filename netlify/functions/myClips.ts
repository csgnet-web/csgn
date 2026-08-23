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
import { refreshAirtimeSchedule, openAirInventory, type AirtimeBlockReason } from './_shared/airtimeSchedule'
import { getCsgnBalance } from './_shared/solana'
import { ensureDayLock, joinDayLock, shareFor } from './_shared/airtimeLock'
import { CSGN_TOTAL_SUPPLY } from './_shared/airtime'
import { broadcastDayWindow } from './_shared/broadcastDay'

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
      onAirLook?: string; onAirStyle?: string; onAirMotion?: string; showAvatarOnAir?: boolean
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
  let balanceError = ''
  if (wallet) {
    try {
      balance = await getCsgnBalance(wallet)
    } catch (err) {
      // null means "we could not read it", which the UI states plainly rather
      // than rendering as a zero the member would read as an accusation about
      // their own wallet. The reason travels too — "every RPC is throttling us"
      // and "you hold nothing" are opposite problems and looked identical.
      balance = null
      balanceError = err instanceof Error ? err.message : 'Could not read the chain.'
    }
  }

  // ── THE DAY'S LOCKED SHARE ──
  //
  // Read from the lock taken at this broadcast day's 2 AM ET cutover, not
  // recomputed on every load. That is the whole point of the hard stop: the
  // number does not move for twenty-four hours, so it can be shown without a
  // disclaimer and checked against the chain at leisure.
  //
  // Two things this replaced, both bugs:
  //   • a rolling six-hour horizon, so airtime shrank as the day burned down;
  //   • an inventory read from a cache that might not exist, so a real bag
  //     could be multiplied by zero.
  const openAir = await openAirInventory(nowMs)
  const inventory = openAir.inventorySeconds
  let lock = await ensureDayLock(async () => CSGN_TOTAL_SUPPLY, nowMs)
  let mine2 = shareFor(lock, authUser.uid)

  // First appearance mid-day — they just linked a wallet, or their balance was
  // unreadable at the cutover and is readable now. Added at their current
  // balance. This can only ADD somebody, never raise an existing share, so
  // buying more at noon still counts from tomorrow.
  if (!mine2 && wallet && (balance ?? 0) > 0) {
    lock = await joinDayLock(authUser.uid, String(profile?.username || ''), balance!, nowMs) ?? lock
    mine2 = shareFor(lock, authUser.uid)
  }

  const dayWindow = broadcastDayWindow(nowMs)
  const dailySeconds = mine2?.seconds ?? 0
  const supplyShare = mine2?.supplyShare ?? 0
  const capped = Boolean(mine2?.capped)
  const scheduledSeconds = Number(mine?.seconds) || 0

  let reason: AirtimeBlockReason = 'ok'
  if (dailySeconds <= 0) {
    if (!wallet) reason = 'no_wallet'
    else if (balance === null) reason = 'unreadable'
    else if (balance <= 0) reason = 'no_balance'
    else reason = 'no_inventory'
  } else if (approvedCount === 0) {
    // They have airtime and nothing to put in it. Not a failure — a next step.
    reason = 'no_clips'
  }

  return json(200, {
    onAirLook: String(profile?.onAirLook || 'signal'),
    onAirStyle: String(profile?.onAirStyle || 'bar'),
    onAirMotion: String(profile?.onAirMotion || 'cut'),
    // Defaults to ON: if we have somebody's picture, showing it is what makes
    // their segment look like theirs. They can turn it off.
    showAvatarOnAir: profile?.showAvatarOnAir !== false,
    socialAvatar: profile?.socialAvatar?.url
      ? { provider: String(profile.socialAvatar.provider || ''), url: String(profile.socialAvatar.url) }
      : null,
    username: String(profile?.username || ''),
    clips,
    airtime: {
      /** This broadcast day's locked entitlement. Fixed at 2 AM ET; does not
       *  move until the next cutover. */
      seconds: dailySeconds,
      /** What the playlist has actually laid down into the air still to come. */
      scheduledSeconds,
      capped,
      /** Share of circulating supply at the cutover, as a fraction. */
      supplyShare,
      inventorySeconds: inventory,
      /** Open air still to come today — why `scheduledSeconds` is smaller than
       *  `seconds` late in the day, which otherwise looks like a bug. */
      remainingSeconds: openAir.remainingSeconds,
      /** Which broadcast day this is, when it was locked, and when the next
       *  lock lands. A number that cannot change until a stated moment is only
       *  trustworthy if the moment is stated. */
      dayKey: dayWindow.key,
      lockedAt: lock?.lockedAt ?? null,
      nextLockAt: new Date(dayWindow.endMs).toISOString(),
      networkBlockEnabled: openAir.networkBlockEnabled,
      builtAt: schedule?.builtAt ?? null,
      /** Which of the four states this is. 'ok' when there is airtime and content. */
      reason,
      /** The linked wallet, or '' when none is attached to this account. */
      walletAddress: wallet,
      /** Live $CSGN balance; null when unread, not when zero. */
      balance,
      /** Why the balance could not be read, when it could not. */
      balanceError,
    },
    airings,
  })
})


/**
 * THE SUPPLY IS A CONSTANT, and this function is what is left of it.
 *
 * It used to fetch DexScreener on every member request and derive circulating
 * supply from market cap over price. That cost an outbound call on a
 * member-facing path, and it made the product's central promise drift: the same
 * bag bought different seconds on different days, for reasons no member could
 * see or check.
 *
 * Airtime is one to one with the token against a FIXED 1,000,000,000 supply —
 * see CSGN_TOTAL_SUPPLY. Anybody can verify their own number with a calculator,
 * which is most of why the promise is believable.
 */
