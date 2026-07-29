import { describe, it, expect } from 'vitest'
import { deriveNowLive, deriveUpNext, formatETTime, slotDisplayName, slotDisplayTitle } from '../_shared/onAir'

describe('slotDisplayName', () => {
  it('uses the claimant when a slot is claimed', () => {
    expect(slotDisplayName({ assignedName: 'ansem', type: 'open' })).toBe('ansem')
  })

  it('names an unclaimed network hour CSGN Originals', () => {
    expect(slotDisplayName({ type: 'network' })).toBe('CSGN Originals')
    expect(slotDisplayName({ type: 'ceo' })).toBe('CSGN Originals') // legacy type
  })

  it('names an unclaimed open hour Open Stage', () => {
    expect(slotDisplayName({ type: 'open' })).toBe('Open Stage')
  })

  it('ignores a whitespace-only name', () => {
    expect(slotDisplayName({ assignedName: '   ', type: 'network' })).toBe('CSGN Originals')
  })
})

describe('slotDisplayTitle', () => {
  it('prefers the streamer’s own title', () => {
    expect(slotDisplayTitle({ assignedName: 'ansem', streamTitle: 'Chart Talk', label: '9:00 PM – 11:00 PM' })).toBe('Chart Talk')
  })

  it('falls back to the slot label for a claimed slot with no title', () => {
    expect(slotDisplayTitle({ assignedName: 'ansem', label: '9:00 PM – 11:00 PM' })).toBe('9:00 PM – 11:00 PM')
  })

  it('sells the open hour when nobody has claimed it', () => {
    expect(slotDisplayTitle({ type: 'open' })).toMatch(/open/i)
  })

  it('labels an unclaimed network hour as the block', () => {
    expect(slotDisplayTitle({ type: 'network' })).toBe('CSGN Originals block')
  })
})

describe('formatETTime', () => {
  it('renders ET wall clock', () => {
    // 2026-07-30T02:00:00Z = 10:00 PM ET on the 29th (EDT).
    expect(formatETTime('2026-07-30T02:00:00Z')).toBe('10:00 PM ET')
  })

  it('handles standard time too', () => {
    // 2026-01-15T02:00:00Z = 9:00 PM ET on the 14th (EST).
    expect(formatETTime('2026-01-15T02:00:00Z')).toBe('9:00 PM ET')
  })

  it('returns empty for missing or unparseable input', () => {
    expect(formatETTime(null)).toBe('')
    expect(formatETTime('nonsense')).toBe('')
  })
})

describe('deriveNowLive / deriveUpNext', () => {
  it('returns null when there is no slot', () => {
    expect(deriveNowLive(null)).toBeNull()
    expect(deriveUpNext(undefined)).toBeNull()
  })

  it('builds both cards off one slot', () => {
    const slot = { assignedName: 'ansem', streamTitle: 'Chart Talk', startTime: '2026-07-30T02:00:00Z', type: 'open' }
    expect(deriveNowLive(slot)).toEqual({ name: 'ansem', title: 'Chart Talk' })
    expect(deriveUpNext(slot)).toEqual({ name: 'ansem', startET: '10:00 PM ET' })
  })
})
