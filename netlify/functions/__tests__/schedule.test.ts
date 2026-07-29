import { describe, it, expect } from 'vitest'
import { buildExpectedSlotsForDate, buildSlotDoc } from '../_shared/schedule'

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
