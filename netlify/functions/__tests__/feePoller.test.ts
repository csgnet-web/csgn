import { describe, it, expect } from 'vitest'
import { pickActiveSlot } from '../feePollerBackground'

const HOUR = 60 * 60 * 1000
const now = Date.parse('2026-07-09T18:00:00.000Z')

function row(startOffsetMs: number, endOffsetMs: number, status: string, id = 'slot') {
  return {
    path: `projects/p/databases/(default)/documents/slots/${id}`,
    data: {
      status,
      startTime: new Date(now + startOffsetMs).toISOString(),
      endTime: new Date(now + endOffsetMs).toISOString(),
    },
  }
}

describe('pickActiveSlot', () => {
  it('returns the in-window confirmed slot', () => {
    const active = row(-1 * HOUR, 1 * HOUR, 'confirmed', 'active')
    const rows = [row(-4 * HOUR, -2 * HOUR, 'completed', 'past'), active]
    expect(pickActiveSlot(rows, now)).toBe(active)
  })

  it('returns the in-window live slot', () => {
    const active = row(-1 * HOUR, 1 * HOUR, 'live', 'active')
    expect(pickActiveSlot([active], now)).toBe(active)
  })

  it('ignores in-window slots that are not confirmed/live', () => {
    expect(pickActiveSlot([row(-1 * HOUR, 1 * HOUR, 'open')], now)).toBeNull()
    expect(pickActiveSlot([row(-1 * HOUR, 1 * HOUR, 'completed')], now)).toBeNull()
  })

  it('is inclusive of start and exclusive of end', () => {
    expect(pickActiveSlot([row(0, 2 * HOUR, 'confirmed')], now)).not.toBeNull()
    expect(pickActiveSlot([row(-2 * HOUR, 0, 'live')], now)).toBeNull()
  })

  it('ignores future and past slots and handles empty/missing fields', () => {
    expect(pickActiveSlot([row(1 * HOUR, 3 * HOUR, 'confirmed')], now)).toBeNull()
    expect(pickActiveSlot([], now)).toBeNull()
    expect(pickActiveSlot([{ path: 'slots/x', data: { status: 'live' } }], now)).toBeNull()
  })
})
