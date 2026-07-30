import { describe, it, expect } from 'vitest'
import { buildExpectedSlotsForDate, buildSlotDoc, slotTypeForStartTime } from '../_shared/schedule'

// The auto-seeder is what actually creates claimable inventory (the fee poller
// sweeps a 7-day horizon). It previously hardcoded every slot to the reserved
// block, which meant a brand-new user could sign up and find NOTHING claimable.
// These tests pin the two-block shape so that can't regress silently.

const day = new Date('2026-08-12T16:00:00.000Z') // a normal EDT weekday

describe('buildExpectedSlotsForDate', () => {
  const slots = buildExpectedSlotsForDate(day)

  it('emits the canonical 12 slots/day', () => {
    expect(slots).toHaveLength(12)
  })

  it('seeds 8 OPEN slots — otherwise nobody can ever claim anything', () => {
    expect(slots.filter((s) => s.type === 'open')).toHaveLength(8)
  })

  it('reserves exactly 4 NETWORK slots for CSGN Originals', () => {
    expect(slots.filter((s) => s.type === 'network')).toHaveLength(4)
  })

  it('never emits a legacy auction/ceo type', () => {
    for (const s of slots) expect(['open', 'network']).toContain(s.type)
  })

  it('puts the network block on the 7 PM / 9 PM / 11 PM / 1 AM starts', () => {
    const networkHours = slots
      .filter((s) => s.type === 'network')
      .map((s) => Number(s.id.slice(-2)))
      .sort((a, b) => a - b)
    expect(networkHours).toEqual([1, 19, 21, 23])
  })
})

describe('buildSlotDoc', () => {
  it('carries the template type through and opens the slot', () => {
    const open = buildExpectedSlotsForDate(day).find((s) => s.type === 'open')!
    const doc = buildSlotDoc(open, 'https://twitch.tv/csgnet')
    expect(doc.type).toBe('open')
    expect(doc.status).toBe('open')
    expect(doc.assignedUid).toBeNull()
  })

  it('keeps network slots typed network so they stay reserved', () => {
    const net = buildExpectedSlotsForDate(day).find((s) => s.type === 'network')!
    expect(buildSlotDoc(net, 'https://twitch.tv/csgnet').type).toBe('network')
  })
})

describe('slotTypeForStartTime — the single rule for existing + future slots', () => {
  // ET hours: 19/21/23/1 are the CSGN Originals block, everything else is open.
  const atETHour = (h: number) => {
    // 2026-08-12 is EDT (UTC-4); hour 1 maps to the next UTC day.
    const utc = (h + 4) % 24
    const day = h >= 20 ? 13 : 12
    return `2026-08-${String(day).padStart(2, '0')}T${String(utc).padStart(2, '0')}:00:00.000Z`
  }

  it('types the 7 PM–3 AM block as network', () => {
    for (const h of [19, 21, 23, 1]) {
      expect(slotTypeForStartTime(atETHour(h))).toBe('network')
    }
  })

  it('types every daytime hour as open', () => {
    for (const h of [3, 5, 7, 9, 11, 13, 15, 17]) {
      expect(slotTypeForStartTime(atETHour(h))).toBe('open')
    }
  })

  it('agrees with the seeder template for every slot it emits', () => {
    for (const s of buildExpectedSlotsForDate(day)) {
      expect(slotTypeForStartTime(s.startTime)).toBe(s.type)
    }
  })

  it('falls back to open on an unparseable timestamp', () => {
    expect(slotTypeForStartTime('not-a-date')).toBe('open')
  })
})
