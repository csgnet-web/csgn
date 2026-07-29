import { describe, it, expect } from 'vitest'
import { normalizeSlotType, normalizeSlotStatus, normalizeSlot, isNetworkSlot, isSlotClaimable, SLOT_STATUSES } from './slotModel'

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
