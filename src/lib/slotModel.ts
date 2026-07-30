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
