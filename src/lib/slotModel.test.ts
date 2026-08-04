import { describe, it, expect } from 'vitest'
import { normalizeSlotType, normalizeSlotStatus, normalizeSlot, isNetworkSlot, isSlotClaimable, slotIdentity, assignmentStatus, toMillis, SLOT_STATUSES, claimEligibility } from './slotModel'

const HOUR = 60 * 60 * 1000
const future = new Date(Date.now() + 4 * HOUR).toISOString()
const past = new Date(Date.now() - 4 * HOUR).toISOString()

type TestSlot = { type?: unknown; status?: unknown; assignedUid?: string | null; endTime: string }
const slot = (over: Partial<TestSlot> = {}): TestSlot => ({
  type: 'open', status: 'open', assignedUid: null, endTime: future, ...over,
})

describe('slot type normalization (legacy docs keep working)', () => {
  it('maps the legacy CEO block onto network', () => {
    expect(normalizeSlotType('ceo')).toBe('network')
    expect(normalizeSlotType('network')).toBe('network')
  })
  it('maps legacy auction and anything unknown onto open', () => {
    expect(normalizeSlotType('auction')).toBe('open')
    expect(normalizeSlotType('open')).toBe('open')
    expect(normalizeSlotType(undefined)).toBe('open')
    expect(normalizeSlotType('nonsense')).toBe('open')
  })
})

describe('slot status normalization', () => {
  it('keeps the four real statuses', () => {
    for (const s of SLOT_STATUSES) expect(normalizeSlotStatus(s)).toBe(s)
    expect(SLOT_STATUSES).toEqual(['open', 'confirmed', 'live', 'completed'])
  })
  it('collapses every auction-era status back to open so the slot is claimable again', () => {
    expect(normalizeSlotStatus('closing')).toBe('open')
    expect(normalizeSlotStatus('pending_deposit')).toBe('open')
    expect(normalizeSlotStatus('unfilled')).toBe('open')
  })
  it('normalizes a whole legacy doc in one pass', () => {
    const s = normalizeSlot(slot({ type: 'ceo', status: 'pending_deposit' }))
    expect(s.type).toBe('network')
    expect(s.status).toBe('open')
  })
})

describe('isNetworkSlot', () => {
  it('is true for network and legacy ceo, false for open', () => {
    expect(isNetworkSlot(slot({ type: 'network' }))).toBe(true)
    expect(isNetworkSlot(slot({ type: 'ceo' }))).toBe(true)
    expect(isNetworkSlot(slot({ type: 'open' }))).toBe(false)
  })
})

describe('isSlotClaimable', () => {
  it('an open, unassigned, future slot is claimable', () => {
    expect(isSlotClaimable(slot({ type: 'open' }))).toBe(true)
  })
  it('a network slot is reserved while the block is on', () => {
    expect(isSlotClaimable(slot({ type: 'network' }), true)).toBe(false)
  })
  it('turning the network block off returns those hours to open claiming', () => {
    expect(isSlotClaimable(slot({ type: 'network' }), false)).toBe(true)
    expect(isSlotClaimable(slot({ type: 'ceo' }), false)).toBe(true)
  })
  it('rejects a slot someone already holds, and one that has ended', () => {
    expect(isSlotClaimable(slot({ assignedUid: 'u1' }))).toBe(false)
    expect(isSlotClaimable(slot({ endTime: past }))).toBe(false)
  })
  // The bug this replaced: the hour ON THE AIR is the one you most want someone
  // to take (they can go live this second), and it was the one being refused
  // because its status had drifted off 'open'.
  it('the hour currently on the air is claimable while nobody holds it', () => {
    const airing = { type: 'open', status: 'live', assignedUid: null, endTime: future }
    expect(isSlotClaimable(airing)).toBe(true)
  })
  it('status drift on an unassigned open slot never blocks a claim', () => {
    for (const status of ['open', 'confirmed', 'live', 'closing', 'pending_deposit', undefined]) {
      expect(isSlotClaimable(slot({ status }))).toBe(true)
    }
  })
  it('an explicit completed marker still stops a claim', () => {
    expect(isSlotClaimable(slot({ status: 'completed' }))).toBe(false)
    expect(isSlotClaimable(slot({ type: 'network', status: 'completed' }), false)).toBe(false)
  })
  it('a legacy auction-status slot becomes claimable again', () => {
    expect(isSlotClaimable(slot({ type: 'auction', status: 'unfilled' }))).toBe(true)
  })
  it('network slots seed as confirmed but still open up when the block is off', () => {
    // They're programmed, not claimed — 'confirmed' means held by the network.
    const netSlot = slot({ type: 'network', status: 'confirmed' })
    expect(isSlotClaimable(netSlot, true)).toBe(false)
    expect(isSlotClaimable(netSlot, false)).toBe(true)
  })
  it('a network slot actually assigned to someone is never claimable', () => {
    expect(isSlotClaimable(slot({ type: 'network', status: 'confirmed', assignedUid: 'u1' }), false)).toBe(false)
  })
})

describe('toMillis — one coercion for every timestamp shape a slot doc carries', () => {
  const ISO = '2026-07-31T12:00:00.000Z'
  const MS = Date.parse(ISO)

  it('reads ISO strings, Dates and raw millis alike', () => {
    expect(toMillis(ISO)).toBe(MS)
    expect(toMillis(new Date(MS))).toBe(MS)
    expect(toMillis(MS)).toBe(MS)
  })
  it('reads a Firestore Timestamp by duck-typing toDate()', () => {
    expect(toMillis({ toDate: () => new Date(MS) })).toBe(MS)
  })
  // The regression this consolidation fixed: two of the five copied
  // implementations skipped the finite check on the Timestamp branch, so a
  // malformed stamp returned NaN. NaN loses BOTH sides of every comparison, so
  // such a slot silently sorted into an arbitrary position instead of being
  // filtered out of the schedule.
  it('never returns NaN — a malformed value collapses to 0', () => {
    expect(toMillis({ toDate: () => new Date('nonsense') })).toBe(0)
    expect(toMillis('not a date')).toBe(0)
    expect(toMillis(undefined)).toBe(0)
    expect(toMillis(null)).toBe(0)
    expect(toMillis({})).toBe(0)
  })
})

describe('assignmentStatus — assigning the current hour goes live now', () => {
  const NOW = 1_700_000_000_000
  const at = (offsetH: number) => new Date(NOW + offsetH * HOUR).toISOString()

  it('assigning the hour on the air right now sets it live', () => {
    expect(assignmentStatus({ startTime: at(-1), endTime: at(1) }, NOW)).toBe('live')
  })
  it('assigning a future hour parks it as confirmed', () => {
    expect(assignmentStatus({ startTime: at(2), endTime: at(4) }, NOW)).toBe('confirmed')
  })
  it('an already-ended hour is completed', () => {
    expect(assignmentStatus({ startTime: at(-4), endTime: at(-2) }, NOW)).toBe('completed')
  })
  it('is live at the exact start instant, confirmed once ended (half-open window)', () => {
    expect(assignmentStatus({ startTime: at(0), endTime: at(2) }, NOW)).toBe('live')
    // end is exclusive: at the end instant the hour is over
    expect(assignmentStatus({ startTime: at(-2), endTime: at(0) }, NOW)).toBe('completed')
  })
  it('falls back to confirmed on unparseable times', () => {
    expect(assignmentStatus({ startTime: 'nope', endTime: 'nope' }, NOW)).toBe('confirmed')
  })
})

describe('slotIdentity — one source of truth for who is on an hour', () => {
  it('a genuinely open hour is the only place the stage reads as open', () => {
    const id = slotIdentity({ type: 'open', assignedUid: null, assignedName: null })
    expect(id).toEqual({ name: 'Open Slot', kind: 'Open Slot', isOpen: true, isNetwork: false })
  })

  it('lets the caller relabel the open hour (the /watch headline)', () => {
    const id = slotIdentity({ type: 'open' }, { openName: 'THE STAGE IS OPEN' })
    expect(id.name).toBe('THE STAGE IS OPEN')
    expect(id.isOpen).toBe(true)
  })

  // Bug 1: a live network show read "THE STAGE IS OPEN" because the heading
  // blanked any name starting with "CSGN". A named network hour is programmed.
  it('a named network show keeps its name and is never open', () => {
    const id = slotIdentity({ type: 'network', assignedName: 'CSGN @ NITE' })
    expect(id).toEqual({ name: 'CSGN @ NITE', kind: 'CSGN Originals', isOpen: false, isNetwork: true })
  })

  it('an unnamed reserved network hour is CSGN Originals, not open', () => {
    const id = slotIdentity({ type: 'network', assignedName: null })
    expect(id).toEqual({ name: 'CSGN Originals', kind: 'CSGN Originals', isOpen: false, isNetwork: true })
  })

  // Bug 2: a claimed open-block hour ("csgnet") read "Open Slot" as its subtitle
  // because a non-network slot was assumed unclaimed.
  it('a claimed open-block hour headlines the creator, never "Open Slot"', () => {
    const id = slotIdentity({ type: 'open', assignedUid: 'u1', assignedName: 'csgnet' })
    expect(id).toEqual({ name: 'csgnet', kind: 'Live on CSGN', isOpen: false, isNetwork: false })
  })

  it('a claimed hour with its own stream title shows that title as the kind', () => {
    const id = slotIdentity({ type: 'open', assignedUid: 'u1', assignedName: 'ansem', streamTitle: 'Chart Talk' })
    expect(id).toEqual({ name: 'ansem', kind: 'Chart Talk', isOpen: false, isNetwork: false })
  })

  it('an assignedName with no uid still counts as programmed (network self-booking)', () => {
    expect(slotIdentity({ type: 'open', assignedName: 'csgnet' }).isOpen).toBe(false)
  })

  it('turning the network block off hands an unclaimed reserved hour back to open', () => {
    const id = slotIdentity({ type: 'network', assignedName: null }, { networkBlockEnabled: false })
    expect(id).toEqual({ name: 'Open Slot', kind: 'Open Slot', isOpen: true, isNetwork: false })
  })

  it('treats a null/absent slot as an open stage (defensive for the headline)', () => {
    expect(slotIdentity(null, { openName: 'THE STAGE IS OPEN' })).toEqual({
      name: 'THE STAGE IS OPEN', kind: 'Open Slot', isOpen: true, isNetwork: false,
    })
  })
})


describe('claim eligibility — one rule, mirroring the server', () => {
  const ready = {
    status: 'active',
    phantom: { verified: true, walletAddress: '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1' },
    twitch: { verified: true, username: 'csgnet' },
  }
  const verified = { email: 'member@example.com', emailVerified: true }
  /** A wallet-only account: no email was ever given, so none can be verified. */
  const walletOnly = { email: '', emailVerified: false }

  it('clears a fully set-up member', () => {
    expect(claimEligibility(verified, ready)).toEqual({ ok: true })
  })

  it('names ONE missing thing at a time, in the order the server checks them', () => {
    expect(claimEligibility(null, null).reason).toBe('signed_out')
    expect(claimEligibility({ email: 'member@example.com', emailVerified: false }, ready).reason).toBe('email_unverified')
    expect(claimEligibility(verified, { ...ready, phantom: undefined }).reason).toBe('no_wallet')
    expect(claimEligibility(verified, { ...ready, twitch: { verified: false } }).reason).toBe('no_twitch')
    expect(claimEligibility(verified, { ...ready, status: 'disabled' }).reason).toBe('inactive')
  })

  it('tells an unlinked member about TWITCH specifically, not "phantom and twitch"', () => {
    const r = claimEligibility(verified, { ...ready, twitch: { verified: false } })
    expect(r.message).toContain('Twitch')
    expect(r.message).not.toMatch(/phantom/i)
    expect(r.actionLabel).toBe('Connect Twitch')
    expect(r.actionHref).toBe('/account')
  })

  it('always offers an action for anything the member can fix themselves', () => {
    for (const profile of [
      { ...ready, phantom: undefined },
      { ...ready, twitch: { verified: false } },
    ]) {
      const r = claimEligibility(verified, profile)
      expect(r.actionLabel).toBeTruthy()
      expect(r.actionHref).toBe('/account')
    }
    expect(claimEligibility({ email: 'member@example.com', emailVerified: false }, ready).actionLabel).toBeTruthy()
  })

  it('lets an admin through every gate, as the server does', () => {
    const admin = { role: 'admin', status: 'active' }
    expect(claimEligibility({ email: 'member@example.com', emailVerified: false }, admin)).toEqual({ ok: true })
    expect(claimEligibility(verified, admin)).toEqual({ ok: true })
  })

  // The email gate applies to accounts that HAVE an email. A wallet-only account
  // never gave one, and gating it on a verification it can never complete would
  // make the account permanently unable to claim. Mirrors claimSlot.ts.
  it('does not demand email verification from a wallet-only account', () => {
    expect(claimEligibility(walletOnly, ready)).toEqual({ ok: true })
    expect(claimEligibility({}, ready)).toEqual({ ok: true })
  })

  it('still blocks a wallet-only account on the gates that DO apply', () => {
    expect(claimEligibility(walletOnly, { ...ready, twitch: { verified: false } }).reason).toBe('no_twitch')
    expect(claimEligibility(walletOnly, { ...ready, phantom: undefined }).reason).toBe('no_wallet')
  })

  it('treats a twitch record with no username as unlinked', () => {
    expect(claimEligibility(verified, { ...ready, twitch: { verified: true } }).reason).toBe('no_twitch')
  })

  it('accepts a legacy top-level walletAddress', () => {
    const legacy = { ...ready, phantom: { verified: true }, walletAddress: 'abc' }
    expect(claimEligibility(verified, legacy)).toEqual({ ok: true })
  })
})
