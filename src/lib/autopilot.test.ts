import { describe, expect, it } from 'vitest'
import { DEMO_PACKAGE, formatClock, isPackageFresh, segmentAt, wheelPosition } from './autopilot'

describe('autonomous show clock', () => {
  it('restarts the wheel every half hour', () => {
    expect(wheelPosition(new Date('2026-10-01T12:29:59Z'))).toBe(1799)
    expect(wheelPosition(new Date('2026-10-01T12:30:00Z'))).toBe(0)
  })

  it('cuts on exact segment boundaries', () => {
    expect(segmentAt(239).id).toBe('lead')
    expect(segmentAt(240).id).toBe('scores')
    expect(segmentAt(1380).id).toBe('community')
  })

  it('formats rundown time safely', () => expect(formatClock(69.9)).toBe('1:09'))

  it('fails closed when an anchor package expires', () => {
    expect(isPackageFresh({ ...DEMO_PACKAGE, freshUntil: '2026-01-01T00:00:00.000Z' }, new Date('2026-10-01'))).toBe(false)
    expect(isPackageFresh(DEMO_PACKAGE, new Date('2026-10-01'))).toBe(true)
  })
})
