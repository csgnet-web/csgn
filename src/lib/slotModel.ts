// Pure slot-model logic — no Firestore, no env, no side effects, so it can be
// unit-tested directly and reused server-side. `slots.ts` re-exports all of it.
//
// Two blocks only, no auctions:
//   'open'    — nothing programmed; the member clip reel has it, unless the
//               operator puts a live roster streamer on (3 AM – 7 PM ET)
//   'network' — CSGN Originals block (7 PM – 3 AM ET), programmed by the network
//
// The network block can be switched off globally (config/scheduleMeta →
// networkBlockEnabled: false), which hands those hours back to the member reel
// without rewriting a single slot doc.

/**
 * Coerce any timestamp shape a slot doc can carry into epoch milliseconds.
 *
 * The same field arrives in three shapes depending on the write path: an ISO
 * string (client writes + the server's `new Date().toISOString()`), a real
 * `Date`, or a Firestore `Timestamp` (duck-typed by its `toDate()` so this
 * module stays free of the Firebase SDK). Anything unparseable collapses to
 * **0**, never `NaN` — every consumer compares these against `Date.now()`, and
 * a `NaN` makes *both* sides of a comparison false, so a malformed timestamp
 * would silently sort into an arbitrary position instead of being filtered out.
 * Returning 0 makes it read as "the distant past", which every call site
 * already handles.
 */
export function toMillis(value: unknown): number {
  if (typeof value === 'string' || value instanceof Date || typeof value === 'number') {
    const ms = new Date(value as string | Date | number).getTime()
    return Number.isFinite(ms) ? ms : 0
  }
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: unknown }).toDate === 'function') {
    const ms = (value as { toDate: () => Date }).toDate().getTime()
    return Number.isFinite(ms) ? ms : 0
  }
  return 0
}

export type SlotType = 'open' | 'network'

export type SlotStatus =
  | 'open'      // nothing programmed — clip hour
  | 'confirmed' // a streamer or network show is booked on it
  | 'live'      // currently airing
  | 'completed' // finished airing

/** Auction-era statuses still present on older docs; normalized away on read. */
type LegacySlotStatus = 'closing' | 'pending_deposit' | 'unfilled'

/** The only statuses an admin should ever set by hand. */
export const SLOT_STATUSES: SlotStatus[] = ['open', 'confirmed', 'live', 'completed']

/** Map any stored (possibly legacy) slot type onto the current model. */
export function normalizeSlotType(value: unknown): SlotType {
  const v = String(value || '')
  if (v === 'network' || v === 'ceo') return 'network'
  return 'open' // 'open', legacy 'auction', or anything unrecognized
}

/** Map any stored (possibly legacy) status onto the current model. Auction-era
 *  statuses collapse back to 'open' so those hours return to the reel. */
export function normalizeSlotStatus(value: unknown): SlotStatus {
  const v = String(value || '') as SlotStatus | LegacySlotStatus
  if (v === 'confirmed' || v === 'live' || v === 'completed') return v
  return 'open' // 'open', 'closing', 'pending_deposit', 'unfilled', or unknown
}

/** Normalize one raw slot doc so existing AND future slots run on the same
 *  logic without a data migration. Applied by every read path in slots.ts. */
export function normalizeSlot<T extends { type?: unknown; status?: unknown }>(raw: T): T & { type: SlotType; status: SlotStatus } {
  return { ...raw, type: normalizeSlotType(raw.type), status: normalizeSlotStatus(raw.status) }
}

/** Is this slot in the CSGN Originals (network) block? */
export function isNetworkSlot(slot: { type?: unknown }): boolean {
  return normalizeSlotType(slot.type) === 'network'
}

/**
 * Is this hour OPEN — nothing programmed on it, so the member reel has it?
 *
 * This used to be `isSlotClaimable`, back when a member could reserve a block.
 * Nobody reserves anything now: the operator puts a roster member on when they
 * are actually live, and every hour without one runs clips. The rule didn't
 * change, only what it's for — "open" is now the input to the clip schedule
 * rather than an invitation to book.
 *
 * **Assignment decides, not status.** On an unassigned slot the status field is
 * bookkeeping — it drifts (an operator sets the airing hour to 'live' to push a
 * stream, a legacy doc says 'confirmed', the clock advances it) and none of that
 * means a person is on the hour. What means the hour is taken is `assignedUid`.
 *
 * So: an unassigned slot that hasn't ended is open, including **the hour that is
 * on the air right now** — which is exactly what lets the channel fall back to
 * clips the instant a streamer drops off, rather than sitting dark until the top
 * of the next hour. Only an explicit 'completed' marker stops it, since that's a
 * deliberate "this one is finished".
 *
 * Network slots are reserved for CSGN Originals — unless the block is switched
 * off globally, which hands those hours back to the member reel.
 */
export function isOpenHour(
  slot: { type?: unknown; status?: unknown; assignedUid?: string | null; endTime: string },
  networkBlockEnabled = true,
): boolean {
  if (slot.assignedUid) return false
  if (new Date(slot.endTime).getTime() <= Date.now()) return false
  if (normalizeSlotStatus(slot.status) === 'completed') return false
  if (isNetworkSlot(slot) && networkBlockEnabled) return false
  return true
}

/**
 * The status a slot should take the moment a streamer is assigned to it.
 *
 * Assigning someone to a FUTURE hour parks it as `confirmed`; the fee poller
 * promotes it to `live` when the clock reaches its start. But assigning someone
 * to the hour that is **on the air right now** should put it live immediately —
 * an admin dropping a streamer onto the current slot means "you're on," not
 * "you're on in up to a minute when the poller next runs." Anything already past
 * its end is `completed`.
 */
export function assignmentStatus(
  slot: { startTime: string; endTime: string },
  nowMs: number = Date.now(),
): SlotStatus {
  const start = new Date(slot.startTime).getTime()
  const end = new Date(slot.endTime).getTime()
  if (Number.isFinite(end) && nowMs >= end) return 'completed'
  if (Number.isFinite(start) && Number.isFinite(end) && nowMs >= start && nowMs < end) return 'live'
  return 'confirmed'
}

/**
 * How a slot presents anywhere in the app — the single source of truth for "who
 * is on this hour, what do we call it, and is the hour open." Every
 * viewer surface (the /watch headline, the schedule strip, the up-next list, the
 * offline + intermission boards) reads from this one function so they can never
 * disagree.
 *
 * The bugs this fixes, both from each surface re-deriving the label off `type`
 * alone:
 *   - a LIVE network show ("CSGN @ NITE") that read "THE STAGE IS OPEN" because
 *     the old heading blanked any name starting with "CSGN" and fell back to the
 *     open-stage copy, and
 *   - a booked hour ("csgnet") that read "Open Slot" because a non-network slot
 *     was assumed to have nobody on it.
 *
 * The whole model is **programmed vs. open**:
 *   - a reserved CSGN Originals hour (network + block on), OR a slot a creator /
 *     the network booked (by `assignedUid` or `assignedName`) → PROGRAMMED.
 *     Headline the act; never say the stage is open, never say "Open Slot".
 *   - anything else → OPEN. Only here do we sell the empty stage.
 *
 * Mirrors the server's ticker naming in netlify/functions/_shared/onAir.ts —
 * keep the two in sync (that module can't import this one; it's bound to the
 * client Firebase SDK-free build).
 */
export interface SlotIdentity {
  /** Headline: the creator/show name, or the open-stage label. */
  name: string
  /** Secondary line: the stream title or the block — never "Open Slot" once programmed. */
  kind: string
  /** True only when nothing is programmed — i.e. the hour belongs to the reel. */
  isOpen: boolean
  /** True when this is a CSGN Originals (network) hour. */
  isNetwork: boolean
}

export interface SlotIdentityOptions {
  networkBlockEnabled?: boolean
  /** Headline for an hour with nothing programmed. Default 'Member Reel'. */
  openName?: string
  /** Secondary line for that hour. Default 'Clips from members'. */
  openKind?: string
  /** Secondary line for a booked hour that has no stream title. Default 'Live on CSGN'. */
  liveKind?: string
}

const CSGN_ORIGINALS = 'CSGN Originals'

export function slotIdentity(
  slot:
    | { type?: unknown; status?: unknown; assignedUid?: string | null; assignedName?: string | null; streamTitle?: string | null }
    | null
    | undefined,
  options: SlotIdentityOptions = {},
): SlotIdentity {
  const networkBlockEnabled = options.networkBlockEnabled ?? true
  const openName = options.openName ?? 'Member Reel'
  const openKind = options.openKind ?? 'Clips from members'
  const liveKind = options.liveKind ?? 'Live on CSGN'

  const assignedName = String(slot?.assignedName ?? '').trim()
  const assignedUid = String(slot?.assignedUid ?? '').trim()
  const streamTitle = String(slot?.streamTitle ?? '').trim()
  const network = !!slot && isNetworkSlot(slot) && networkBlockEnabled

  // Programmed = reserved network hour, or a slot someone booked (by uid or name).
  const programmed = network || !!assignedName || !!assignedUid
  if (!programmed) {
    return { name: openName, kind: openKind, isOpen: true, isNetwork: false }
  }
  if (network) {
    // A named network show (e.g. "CSGN @ NITE") keeps its name; an unnamed
    // reserved hour is simply CSGN Originals. Either way the block is the kind.
    return { name: assignedName || streamTitle || CSGN_ORIGINALS, kind: CSGN_ORIGINALS, isOpen: false, isNetwork: true }
  }
  // A creator is on an open-block hour — headline them, never "Open Slot".
  return { name: assignedName || 'On Air', kind: streamTitle || liveKind, isOpen: false, isNetwork: false }
}


/* ─── Who the network can put on air ─── */

/**
 * Why a member isn't eligible to be put on air — or that they are.
 *
 * This is the ROSTER gate. It was the claim gate until claiming was removed;
 * the checks are the same because they were never really about booking an hour,
 * they were about whether there is a real channel to forward and a real account
 * behind it. `setForwardConsent` and `adminLiveNow` are the servers that enforce
 * it; this exists so the UI can name the ONE missing thing before a round trip,
 * instead of a member reading "Verified Phantom and Twitch are required" and
 * having to guess which half they're missing.
 *
 * The tests pin the pairing of reason → message, not the wording.
 */
export type AirBlocker = 'signed_out' | 'email_unverified' | 'no_wallet' | 'no_twitch' | 'inactive'

export interface AirEligibility {
  ok: boolean
  reason?: AirBlocker
  /** What to tell the member. Names the ONE thing that's missing. */
  message?: string
  /** Label for the button that fixes it. */
  actionLabel?: string
  /** Where that button goes. */
  actionHref?: string
}

export interface AirUser {
  /** Absent/empty on a wallet-only account, which is what makes the email
   *  verification check conditional rather than universal. */
  email?: string | null
  emailVerified?: boolean
}

export interface AirProfile {
  status?: string
  role?: string
  phantom?: { verified?: boolean; walletAddress?: string }
  walletAddress?: string
  twitch?: { verified?: boolean; username?: string }
}

const OK: AirEligibility = { ok: true }

export function airEligibility(
  user: AirUser | null | undefined,
  profile: AirProfile | null | undefined,
): AirEligibility {
  if (!user || !profile) {
    return {
      ok: false, reason: 'signed_out',
      message: 'Create an account to join the roster — it takes about a minute.',
      actionLabel: 'Get started',
    }
  }

  // Admins bypass every gate, exactly as the server does: the network has to be
  // able to put itself on air even when a check is misconfigured.
  if (profile.role === 'admin') return OK

  if (profile.status && profile.status !== 'active') {
    return { ok: false, reason: 'inactive', message: 'This account is not active. Contact an admin.' }
  }
  // Only accounts that HAVE an email must verify it. A wallet-only account never
  // gave one, so an unconditional check here locked it out of the roster forever —
  // and the gate it was standing in for is the pair below: the wallet that gets
  // paid, and the Twitch channel that goes on air. Those are the real ones.
  if (user.email && user.emailVerified !== true) {
    return {
      ok: false, reason: 'email_unverified',
      message: 'Verify your email to join the roster. We sent you a link.',
      actionLabel: 'Resend email', actionHref: '/account',
    }
  }
  // NO WALLET CHECK HERE, deliberately.
  //
  // A wallet protects one thing: where SOL lands. That matters when we owe
  // somebody money, which is AFTER they have been on air — not before they join.
  // Requiring it up front meant a streamer with no crypto could not get on the
  // network at all, which was the single biggest thing standing between this
  // network and the people it wants on it.
  //
  // Fees earned without a wallet are HELD, never dropped: the Creator Fees tab
  // shows those members greyed with the amount waiting, and `adminMarkFeesPaid`
  // cannot settle a slot until there is somewhere to send it. The 'no_wallet'
  // blocker below is kept in the union for that payout-time prompt.
  if (!profile.twitch?.verified || !profile.twitch?.username) {
    return {
      ok: false, reason: 'no_twitch',
      message: 'Connect Twitch to join the roster. It is the channel the network puts on air.',
      actionLabel: 'Connect Twitch', actionHref: '/account',
    }
  }
  return OK
}


/**
 * A slot time as ET wall clock — "9:00 PM".
 *
 * Lifted out of Schedule.tsx, where it was a page-local helper that other
 * surfaces then re-implemented slightly differently. Times on a schedule are
 * the one thing that must agree everywhere: a graphic saying 9:00 while the
 * page says 21:00 is a channel that looks like it does not know its own
 * running order.
 */
export function formatTimeET(value: unknown): string {
  return new Date(toMillis(value)).toLocaleTimeString('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit',
  })
}
