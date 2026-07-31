// Pure slot-model logic — no Firestore, no env, no side effects, so it can be
// unit-tested directly and reused server-side. `slots.ts` re-exports all of it.
//
// Two blocks only, no auctions:
//   'open'    — anyone with a verified account can claim it (3 AM – 7 PM ET)
//   'network' — CSGN Originals block (7 PM – 3 AM ET), programmed by the network
//
// The network block can be switched off globally (config/scheduleMeta →
// networkBlockEnabled: false), which returns those hours to open claiming
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
  | 'open'      // claimable
  | 'confirmed' // claimed / network-assigned
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
 *  statuses collapse back to 'open' so those slots become claimable again. */
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
 * Can a viewer claim this slot right now?
 *
 * **Assignment decides, not status.** On an unassigned slot the status field is
 * bookkeeping — it drifts (an admin sets the airing hour to 'live' to push a
 * stream, a legacy doc says 'confirmed', the clock advances it) and none of that
 * means a person took the hour. What means the hour is taken is `assignedUid`.
 *
 * So: an unassigned slot that hasn't ended is claimable, including **the hour
 * that is on the air right now** — which is the single most valuable slot to
 * claim, because the claimant can go live immediately. Only an explicit
 * 'completed' marker stops it, since that's a deliberate "this one is finished".
 *
 * Network slots are reserved for CSGN Originals — unless the block is switched
 * off globally, which hands those hours back to open claiming.
 */
export function isSlotClaimable(
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
 * is on this hour, what do we call it, and is it a claimable open stage." Every
 * viewer surface (the /watch headline, the schedule strip, the up-next list, the
 * offline + intermission boards) reads from this one function so they can never
 * disagree.
 *
 * The bugs this fixes, both from each surface re-deriving the label off `type`
 * alone:
 *   - a LIVE network show ("CSGN @ NITE") that read "THE STAGE IS OPEN" because
 *     the old heading blanked any name starting with "CSGN" and fell back to the
 *     open-stage copy, and
 *   - a claimed hour ("csgnet") that read "Open Slot" because a non-network slot
 *     was assumed to be unclaimed.
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
  /** True only when nothing is programmed and the hour is a claimable open stage. */
  isOpen: boolean
  /** True when this is a CSGN Originals (network) hour. */
  isNetwork: boolean
}

export interface SlotIdentityOptions {
  networkBlockEnabled?: boolean
  /** Headline for a genuinely open hour. Default 'Open Slot' (Watch passes 'THE STAGE IS OPEN'). */
  openName?: string
  /** Secondary line for an open hour. Default 'Open Slot'. */
  openKind?: string
  /** Secondary line for a claimed hour that has no stream title. Default 'Live on CSGN'. */
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
  const openName = options.openName ?? 'Open Slot'
  const openKind = options.openKind ?? 'Open Slot'
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
  // A creator holds an open-block hour — headline them, never "Open Slot".
  return { name: assignedName || 'Claimed', kind: streamTitle || liveKind, isOpen: false, isNetwork: false }
}
