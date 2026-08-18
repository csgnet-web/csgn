// HOLDER AIRTIME — who gets how much of the day, and exactly when it airs.
//
// The network is on 24/7 because the people who hold the token fill it. This
// module is the whole rule, and it is pure: balances and clips in, a timestamped
// playlist out. The poller does the reading and writing; nothing here touches
// Firestore, so every case below is testable without a network.
//
// It lives server-side for the same reason `payableAirtime` does — the server
// computes and stores, and every surface (/studio, /player, the OBS overlay)
// reads the stored result. A second implementation on the client would drift,
// and this one decides what goes on television.

/* ─── Knobs ─── */

/** Airtime per member per day for holding nothing at all.
 *
 *  master-plan.md §5: the token "never gates claiming a slot, making an account,
 *  or going live". A holder-weighted broadcast is only compatible with that if
 *  somebody holding zero still has a place on it. This is that place. */
export const AIRTIME_FLOOR_SECONDS = 30

/** No member may take more than this share of a day, however large their bag.
 *  token-voting.md §2.5's anti-capture cap. Set to 1 for a pure, uncapped 1:1
 *  split — see `weightMode` below for the trade that implies. */
export const AIRTIME_MAX_SHARE = 0.25

/** Shorter than this reads as a flicker on air; longer is a takeover. */
export const AIRTIME_MIN_SEGMENT_SECONDS = 5
export const AIRTIME_MAX_SEGMENT_SECONDS = 120

/**
 * How a bag converts to weight.
 *
 *   'linear' — 1:1 with tokens held. Twice the bag, twice the airtime. This is
 *              the owner's stated design and the default.
 *   'sqrt'   — sub-linear (token-voting.md §2.4). Four times the bag, twice the
 *              airtime.
 *
 * The trade, stated once so it is on the record and not re-argued: under
 * 'linear', a wallet holding 40% of supply is entitled to 40% of the broadcast,
 * and AIRTIME_MAX_SHARE is the only thing standing between that wallet and the
 * channel. Under 'sqrt' the cap rarely binds. Both are supported; the cap
 * applies to both.
 */
export type AirtimeWeightMode = 'linear' | 'sqrt'

export interface AirtimeOptions {
  weightMode?: AirtimeWeightMode
  floorSeconds?: number
  maxShare?: number
}

/* ─── Allocation ─── */

export interface AirtimeMember {
  uid: string
  /** $CSGN held, live — never a stored snapshot. See settleVotes doctrine. */
  balance: number
  /** Seconds of approved, ready-to-air content this member actually has. */
  clipSeconds: number
}

export interface AirtimeAllocation {
  uid: string
  /** Seconds of the window this member is entitled to. */
  seconds: number
  /** Share of circulating supply, as a fraction. Reported for the UI. */
  supplyShare: number
  /** True when AIRTIME_MAX_SHARE clipped this member's entitlement. */
  capped: boolean
}

/**
 * Split an inventory of seconds across members by what they hold.
 *
 * The order of operations matters and is the whole design:
 *
 *   1. Everyone with content gets the FLOOR first. It comes off the top, so a
 *      thousand small holders cannot be squeezed to zero by one large one.
 *   2. What's left is split by weight (see AirtimeWeightMode).
 *   3. The CAP is applied, and anything it claws back is redistributed across
 *      the uncapped members — repeatedly, because redistributing can push the
 *      next member over the cap too. Bounded to a handful of passes; the
 *      remainder simply goes unallocated rather than looping forever.
 *   4. Nobody is allocated more than they have content for. Unused seconds
 *      return to the pool rather than being aired as dead time.
 *
 * Members with no content are excluded entirely — an allocation nobody can fill
 * is just a gap in the broadcast.
 */
export function airtimeShares(
  members: AirtimeMember[],
  inventorySeconds: number,
  supply: number,
  options: AirtimeOptions = {},
): AirtimeAllocation[] {
  const weightMode = options.weightMode ?? 'linear'
  const floor = Math.max(0, options.floorSeconds ?? AIRTIME_FLOOR_SECONDS)
  const maxShare = Math.min(1, Math.max(0, options.maxShare ?? AIRTIME_MAX_SHARE))

  const inventory = Math.max(0, Math.floor(Number(inventorySeconds) || 0))
  const usableSupply = Number.isFinite(supply) && supply > 0 ? supply : 0

  const eligible = members
    .filter((m) => m && m.uid && Math.floor(Number(m.clipSeconds) || 0) > 0)
    .map((m) => ({
      uid: String(m.uid),
      balance: Math.max(0, Number(m.balance) || 0),
      clipSeconds: Math.floor(Number(m.clipSeconds) || 0),
    }))

  if (inventory === 0 || eligible.length === 0) return []

  // 1. Floor off the top — but never more than the inventory can carry. With
  //    more members than seconds, the floor itself is what gets shared.
  const floorTotal = floor * eligible.length
  const perMemberFloor = floorTotal > inventory ? Math.floor(inventory / eligible.length) : floor
  const weighted = Math.max(0, inventory - perMemberFloor * eligible.length)

  // 2. Weight.
  const weightOf = (balance: number): number => {
    if (usableSupply <= 0 || balance <= 0) return 0
    const share = Math.min(1, balance / usableSupply)
    return weightMode === 'sqrt' ? Math.sqrt(share) : share
  }
  const weights = new Map(eligible.map((m) => [m.uid, weightOf(m.balance)]))
  const weightSum = [...weights.values()].reduce((a, b) => a + b, 0)

  const raw = new Map(eligible.map((m) => [
    m.uid,
    perMemberFloor + (weightSum > 0 ? (weights.get(m.uid)! / weightSum) * weighted : weighted / eligible.length),
  ]))

  // 3. Cap, redistributing what it claws back.
  const ceiling = inventory * maxShare
  const capped = new Set<string>()
  for (let pass = 0; pass < 8; pass++) {
    const over = eligible.filter((m) => !capped.has(m.uid) && raw.get(m.uid)! > ceiling)
    if (over.length === 0) break
    let reclaimed = 0
    for (const m of over) {
      reclaimed += raw.get(m.uid)! - ceiling
      raw.set(m.uid, ceiling)
      capped.add(m.uid)
    }
    const open = eligible.filter((m) => !capped.has(m.uid))
    if (open.length === 0) break
    const openWeight = open.reduce((sum, m) => sum + weights.get(m.uid)!, 0)
    for (const m of open) {
      const bonus = openWeight > 0
        ? (weights.get(m.uid)! / openWeight) * reclaimed
        : reclaimed / open.length
      raw.set(m.uid, raw.get(m.uid)! + bonus)
    }
  }

  // 4. Never allocate more than a member has content for.
  return eligible
    .map((m) => ({
      uid: m.uid,
      seconds: Math.min(m.clipSeconds, Math.floor(raw.get(m.uid)!)),
      supplyShare: usableSupply > 0 ? Math.min(1, m.balance / usableSupply) : 0,
      capped: capped.has(m.uid),
    }))
    .filter((a) => a.seconds >= AIRTIME_MIN_SEGMENT_SECONDS)
    // Stable: biggest first, then by share, then by uid so two runs over the
    // same inputs produce byte-identical output.
    .sort((a, b) => b.seconds - a.seconds || b.supplyShare - a.supplyShare || a.uid.localeCompare(b.uid))
}

/* ─── Inventory: which seconds are actually ours to fill ─── */

export interface TimeRange { startMs: number; endMs: number }

/**
 * The stretches of the horizon that holder content may fill.
 *
 * Everything else on the schedule outranks it. A claimed hour that someone is
 * going to broadcast is not negotiable, and the owner's block is the owner's.
 * Subtracting them here — rather than checking at playback — is what lets a
 * member be told, truthfully, that their clip airs at 2:04 PM.
 *
 * The 16-hour and 24-hour shapes the owner toggles between are not two code
 * paths: with the network block enabled its hours arrive in `blocked` and the
 * open window is ~16h; disable it and they simply stop arriving, so the same
 * arithmetic yields ~24h. Nothing else changes.
 */
export function deriveAirtimeWindows(nowMs: number, horizonEndMs: number, blocked: TimeRange[]): TimeRange[] {
  if (!(horizonEndMs > nowMs)) return []

  const merged: TimeRange[] = []
  for (const range of [...blocked]
    .filter((r) => r && Number.isFinite(r.startMs) && Number.isFinite(r.endMs) && r.endMs > r.startMs)
    .sort((a, b) => a.startMs - b.startMs)) {
    const last = merged[merged.length - 1]
    if (last && range.startMs <= last.endMs) last.endMs = Math.max(last.endMs, range.endMs)
    else merged.push({ ...range })
  }

  const windows: TimeRange[] = []
  let cursor = nowMs
  for (const range of merged) {
    if (range.endMs <= cursor) continue
    if (range.startMs > cursor) windows.push({ startMs: cursor, endMs: Math.min(range.startMs, horizonEndMs) })
    cursor = Math.max(cursor, range.endMs)
    if (cursor >= horizonEndMs) break
  }
  if (cursor < horizonEndMs) windows.push({ startMs: cursor, endMs: horizonEndMs })

  return windows.filter((w) => w.endMs - w.startMs >= AIRTIME_MIN_SEGMENT_SECONDS * 1000)
}

/** Total seconds across a set of windows. */
export const windowSeconds = (windows: TimeRange[]): number =>
  Math.floor(windows.reduce((sum, w) => sum + (w.endMs - w.startMs), 0) / 1000)

/* ─── The schedule ─── */

export interface AirtimeClip {
  clipId: string
  uid: string
  username: string
  /** The embed URL /player loads. */
  url: string
  /** 'youtube' | 'tiktok' | 'instagram' — the player picks its renderer by this. */
  platform?: string
  /** The original post, for on-screen credit. */
  sourceUrl?: string
  title: string
  seconds: number
  /** The member's own ordering, low first. This is the "order your seconds"
   *  promise — respect it exactly rather than re-sorting by anything clever. */
  order: number
}

export interface ScheduleItem {
  startsAt: string
  endsAt: string
  seconds: number
  clipId: string
  uid: string
  username: string
  url: string
  platform?: string
  sourceUrl?: string
  title: string
}

/**
 * Lay allocations out on the clock.
 *
 * Round-robin across members rather than draining one member's whole allocation
 * before starting the next. A viewer should see the channel change hands every
 * segment; a block of forty consecutive clips from the biggest holder is the
 * failure this ordering exists to prevent, and it is the same failure the cap
 * addresses at a different timescale.
 *
 * Deterministic given the same inputs, because the preview a member is shown has
 * to be the truth. Anything that does not fit the horizon is simply not
 * scheduled — the next rebuild will place it.
 */
export function buildAirtimeSchedule(
  allocations: AirtimeAllocation[],
  clips: AirtimeClip[],
  windows: TimeRange[],
): ScheduleItem[] {
  const byMember = new Map<string, AirtimeClip[]>()
  for (const clip of clips) {
    if (!clip?.url || !clip.clipId) continue
    const seconds = Math.floor(Number(clip.seconds) || 0)
    if (seconds < AIRTIME_MIN_SEGMENT_SECONDS) continue
    byMember.set(clip.uid, [...(byMember.get(clip.uid) ?? []), {
      ...clip,
      seconds: Math.min(seconds, AIRTIME_MAX_SEGMENT_SECONDS),
    }])
  }
  for (const list of byMember.values()) {
    list.sort((a, b) => a.order - b.order || a.clipId.localeCompare(b.clipId))
  }

  const remaining = new Map(allocations.map((a) => [a.uid, a.seconds]))
  const cursorOf = new Map(allocations.map((a) => [a.uid, 0]))
  const queue = allocations.map((a) => a.uid).filter((uid) => (byMember.get(uid)?.length ?? 0) > 0)
  if (queue.length === 0) return []

  const items: ScheduleItem[] = []
  let turn = 0

  for (const window of windows) {
    let at = window.startMs
    // `stalled` counts members passed over in a row; a full lap with nothing
    // placeable means this window is done, and it is what stops the round-robin
    // spinning forever on clips that no longer fit.
    let stalled = 0

    while (at < window.endMs && stalled < queue.length) {
      const uid = queue[turn % queue.length]
      turn++

      const list = byMember.get(uid)!
      const index = cursorOf.get(uid)!
      const left = remaining.get(uid) ?? 0
      const clip = list[index]
      const fitsWindow = clip ? at + clip.seconds * 1000 <= window.endMs : false

      if (!clip || left < (clip?.seconds ?? Infinity) || !fitsWindow) {
        stalled++
        continue
      }

      stalled = 0
      items.push({
        startsAt: new Date(at).toISOString(),
        endsAt: new Date(at + clip.seconds * 1000).toISOString(),
        seconds: clip.seconds,
        clipId: clip.clipId,
        uid,
        username: clip.username,
        url: clip.url,
        platform: clip.platform ?? '',
        sourceUrl: clip.sourceUrl ?? '',
        title: clip.title,
      })
      at += clip.seconds * 1000
      remaining.set(uid, left - clip.seconds)
      // Members loop their own reel once exhausted, so a member with one good
      // clip and a large allocation still fills it rather than forfeiting.
      cursorOf.set(uid, (index + 1) % list.length)
    }
  }

  return items
}
