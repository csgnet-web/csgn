/**
 * THE DAILY LOCK — proportions fixed once, at the 2 AM ET cutover.
 *
 * ── What this is for ───────────────────────────────────────────────────────
 *
 * A member's share of the channel is their share of circulating $CSGN. If that
 * is recomputed continuously, the number on their screen never settles: it
 * moves when someone else buys, when the market cap ticks, when the day burns
 * down. Nobody can plan against it and nobody can verify it, because by the
 * time you have checked it, it is different.
 *
 * So it is decided ONCE PER BROADCAST DAY and then it does not move. At 2 AM ET
 * we read every eligible member's balance, work out their share of that day's
 * open air, and write it down. For the next twenty-four hours that document is
 * the answer — to the member, to the scheduler, and to any argument about it.
 *
 * ── What that means for a member, stated plainly ───────────────────────────
 *
 * Buy more $CSGN at noon and it counts from TOMORROW's lock, not today's. This
 * is the deliberate consequence of a hard stop, and it is worth having:
 *
 *   • The number is stable, so it can be shown without a disclaimer.
 *   • The playlist can be built a full day ahead instead of chased.
 *   • Nobody can buy ten minutes before a clip they want boosted and dump
 *     afterwards — the snapshot has already happened.
 *
 * ── Idempotence ────────────────────────────────────────────────────────────
 *
 * The lock document is a CREATE. The poller runs every minute and calls this
 * every time; all but the first call after a cutover lose the write and return
 * the existing lock. That is the mechanism working — a lock that could be
 * rewritten later in the day would not be a lock.
 */
import { queryCollection, getDoc, writeDoc, fieldFilter } from './firebaseAdmin'
import { getCsgnBalance } from './solana'
import { airtimeQuote, AIRTIME_MAX_SHARE } from './airtime'
import { broadcastDayKey, broadcastDayBounds } from './broadcastDay'
import { openAirInventory } from './airtimeSchedule'

/** Cost ceiling per lock: one balance read per member, once a day. */
const LOCK_MAX_MEMBERS = 500

export interface LockedShare {
  uid: string
  username: string
  /** Balance at the cutover. The snapshot, not a live read. */
  balance: number
  /** Share of circulating supply at the cutover, as a fraction. */
  supplyShare: number
  /** Seconds of the day this member is entitled to. */
  seconds: number
  capped: boolean
}

export interface AirtimeDayLock {
  dayKey: string
  /** When the lock was actually taken. Normally within a minute of the cutover;
   *  later if the poller was down, which is worth being able to see. */
  lockedAt: string
  dayStartsAt: string
  dayEndsAt: string
  /** Open air across the whole day — the denominator every share was cut from. */
  inventorySeconds: number
  /** Circulating supply used for the cut. Stored so a share is checkable. */
  supply: number
  maxShare: number
  shares: LockedShare[]
}

interface UserRow {
  username?: string
  status?: string
  phantom?: { verified?: boolean; walletAddress?: string }
}

/**
 * Take today's lock if it has not been taken, and return it either way.
 *
 * Cheap in the common case: one document read finds an existing lock and
 * returns. The expensive path — a balance read per member — runs once a day.
 */
export async function ensureDayLock(
  supplyProvider: () => Promise<number>,
  nowMs = Date.now(),
): Promise<AirtimeDayLock | null> {
  const dayKey = broadcastDayKey(nowMs)
  const path = `airtimeDays/${dayKey}`

  const existing = await getDoc<AirtimeDayLock>(path)
  if (existing?.shares) return existing

  try {
    const { startMs, endMs } = broadcastDayBounds(dayKey)
    const openAir = await openAirInventory(nowMs)
    const supply = (await supplyProvider().catch(() => 0)) || 1_000_000_000

    // Everyone with a verified wallet. NOT "everyone with an approved clip" —
    // the entitlement is a property of the bag, and a member who gets a clip
    // approved at 3 PM must already have had airtime waiting for it. Gating the
    // snapshot on content would recreate the "1.89 million, zero seconds" bug
    // one layer down.
    const rows = await queryCollection(
      'users',
      [fieldFilter('phantom.verified', 'EQUAL', true)],
      [],
      LOCK_MAX_MEMBERS,
    )

    const shares: LockedShare[] = []
    await Promise.all(rows.map(async (row) => {
      const u = row.data as UserRow
      const wallet = String(u.phantom?.walletAddress || '')
      if (!wallet) return
      if (u.status && u.status !== 'active') return

      let balance = 0
      try {
        balance = await getCsgnBalance(wallet)
      } catch {
        // A balance we could not read at the cutover is recorded as zero for
        // the day, which is the one genuinely unfair outcome in this design.
        // It is bounded — see `relockMember` — and the RPC now fails over
        // across several providers before it gets here.
        balance = 0
      }
      if (balance <= 0) return

      const quote = airtimeQuote(balance, openAir.inventorySeconds, supply)
      shares.push({
        uid: row.path.split('/').pop()!,
        username: String(u.username || ''),
        balance,
        supplyShare: quote.supplyShare,
        seconds: quote.seconds,
        capped: quote.capped,
      })
    }))

    shares.sort((a, b) => b.seconds - a.seconds)

    const lock: AirtimeDayLock = {
      dayKey,
      lockedAt: new Date(nowMs).toISOString(),
      dayStartsAt: new Date(startMs).toISOString(),
      dayEndsAt: new Date(endMs).toISOString(),
      inventorySeconds: openAir.inventorySeconds,
      supply,
      maxShare: AIRTIME_MAX_SHARE,
      shares,
    }

    // CREATE. A second poller tick that got here concurrently loses, and the
    // catch below returns whatever actually landed — so there is exactly one
    // lock per day no matter how many callers raced for it.
    await writeDoc(path, { ...lock }, { exists: false })
    console.log(`[airtime] locked ${dayKey}: ${shares.length} members, ${lock.inventorySeconds}s of open air`)
    return lock
  } catch {
    // Lost the race, or the write failed. Read back rather than inventing a
    // second answer for a day that already has one.
    return (await getDoc<AirtimeDayLock>(path)) ?? null
  }
}

/** One member's locked share, or null if they were not in today's snapshot. */
export function shareFor(lock: AirtimeDayLock | null, uid: string): LockedShare | null {
  return lock?.shares?.find((s) => s.uid === uid) ?? null
}

/**
 * Add a member to today's lock after the fact.
 *
 * For the case the hard stop otherwise handles badly: somebody links a wallet
 * — or is read successfully for the first time after an RPC failure — at 2 PM.
 * Under a strict reading they wait until tomorrow, which is correct for
 * *changes* to a bag but punishing for a first appearance, and it is the
 * difference between a rule and an obstacle.
 *
 * Deliberately only ever ADDS a member at their current balance, and only if
 * they are not already in the lock. It cannot raise an existing share, so
 * buying more mid-day still counts from tomorrow — which is the property the
 * whole design exists to protect.
 */
export async function joinDayLock(
  uid: string,
  username: string,
  balance: number,
  nowMs = Date.now(),
): Promise<AirtimeDayLock | null> {
  if (!(balance > 0)) return null
  const dayKey = broadcastDayKey(nowMs)
  const path = `airtimeDays/${dayKey}`
  const lock = await getDoc<AirtimeDayLock>(path)
  if (!lock?.shares) return null
  if (lock.shares.some((s) => s.uid === uid)) return lock

  const quote = airtimeQuote(balance, lock.inventorySeconds, lock.supply, { maxShare: lock.maxShare })
  const shares = [...lock.shares, {
    uid, username, balance,
    supplyShare: quote.supplyShare,
    seconds: quote.seconds,
    capped: quote.capped,
  }].sort((a, b) => b.seconds - a.seconds)

  const updated = { ...lock, shares }
  await writeDoc(path, { ...updated })
  return updated
}
