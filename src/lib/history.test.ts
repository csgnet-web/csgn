import { describe, it, expect } from 'vitest'
import { etDayKey, groupByPeriod, periodBucket } from './history'

// 2026-07-29 is a Wednesday. 18:00 UTC = 2 PM ET (EDT).
const NOW = new Date('2026-07-29T18:00:00Z')

describe('etDayKey', () => {
  it('reads the ET calendar day, not the UTC one', () => {
    // 01:30 UTC on the 30th is still 9:30 PM ET on the 29th.
    expect(etDayKey('2026-07-30T01:30:00Z')).toBe('2026-07-29')
  })

  it('returns empty for an unparseable value', () => {
    expect(etDayKey('not a date')).toBe('')
  })
})

describe('periodBucket', () => {
  it('labels the current ET day as Today', () => {
    expect(periodBucket('2026-07-29T18:00:00Z', 'day', NOW).label).toMatch(/^Today/)
  })

  it('labels the previous ET day as Yesterday', () => {
    expect(periodBucket('2026-07-28T18:00:00Z', 'day', NOW).label).toMatch(/^Yesterday/)
  })

  it('keeps a late-night slot on the ET day it started', () => {
    // 2 AM ET Thursday belongs to Thursday, but 11 PM ET Wednesday does not.
    expect(periodBucket('2026-07-30T03:00:00Z', 'day', NOW).key).toBe('d:2026-07-29')
  })

  it('buckets weeks Monday-first', () => {
    const wed = periodBucket('2026-07-29T18:00:00Z', 'week', NOW)
    const mon = periodBucket('2026-07-27T18:00:00Z', 'week', NOW)
    const prevSun = periodBucket('2026-07-26T18:00:00Z', 'week', NOW)
    expect(wed.key).toBe('w:2026-07-27')
    expect(mon.key).toBe(wed.key)
    expect(prevSun.key).toBe('w:2026-07-20')
    expect(wed.label).toMatch(/^This week/)
    expect(prevSun.label).toMatch(/^Week of/)
  })

  it('buckets months', () => {
    const bucket = periodBucket('2026-07-03T18:00:00Z', 'month', NOW)
    expect(bucket.key).toBe('m:2026-07')
    expect(bucket.label).toBe('July 2026')
  })

  it('falls back to an Undated bucket instead of throwing', () => {
    expect(periodBucket('', 'day', NOW).key).toBe('unknown')
  })
})

describe('groupByPeriod', () => {
  const rows = [
    { id: 'a', at: '2026-07-29T18:00:00Z' },
    { id: 'b', at: '2026-07-29T20:00:00Z' },
    { id: 'c', at: '2026-07-20T18:00:00Z' },
    { id: 'd', at: '2026-06-11T18:00:00Z' },
  ]

  it('groups newest bucket first', () => {
    const groups = groupByPeriod(rows, 'day', (r) => r.at, NOW)
    expect(groups.map((g) => g.key)).toEqual(['d:2026-07-29', 'd:2026-07-20', 'd:2026-06-11'])
    expect(groups[0].items.map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('collapses into fewer buckets as the period widens', () => {
    expect(groupByPeriod(rows, 'week', (r) => r.at, NOW)).toHaveLength(3)
    expect(groupByPeriod(rows, 'month', (r) => r.at, NOW)).toHaveLength(2)
  })

  it('preserves input order inside a bucket', () => {
    const groups = groupByPeriod([rows[1], rows[0]], 'month', (r) => r.at, NOW)
    expect(groups[0].items.map((r) => r.id)).toEqual(['b', 'a'])
  })

  it('returns nothing for an empty list', () => {
    expect(groupByPeriod([], 'day', () => NOW, NOW)).toEqual([])
  })
})
