import { describe, it, expect } from 'vitest'
import { parseXPostId, parseXBroadcastId, isBroadcastUrl, canonicalPostUrl, canonicalBroadcastUrl } from './xembed'

describe('parseXPostId', () => {
  it('parses a standard x.com post URL', () => {
    expect(parseXPostId('https://x.com/CSGNet/status/1234567890123456789')).toBe('1234567890123456789')
  })

  it('parses twitter.com and mobile hosts', () => {
    expect(parseXPostId('https://twitter.com/CSGNet/status/987654321098')).toBe('987654321098')
    expect(parseXPostId('https://mobile.twitter.com/CSGNet/status/987654321098')).toBe('987654321098')
    expect(parseXPostId('https://www.x.com/CSGNet/status/987654321098')).toBe('987654321098')
  })

  it('parses /i/web/status/ URLs', () => {
    expect(parseXPostId('https://x.com/i/web/status/1234567890')).toBe('1234567890')
  })

  it('tolerates query strings, trailing slashes, and missing protocol', () => {
    expect(parseXPostId('https://x.com/CSGNet/status/1234567890?s=20&t=abc')).toBe('1234567890')
    expect(parseXPostId('https://x.com/CSGNet/status/1234567890/')).toBe('1234567890')
    expect(parseXPostId('x.com/CSGNet/status/1234567890')).toBe('1234567890')
  })

  it('rejects broadcast URLs', () => {
    expect(parseXPostId('https://x.com/i/broadcasts/1yoJMWvbybqxQ')).toBeNull()
  })

  it('rejects non-X URLs, non-numeric IDs, and empty input', () => {
    expect(parseXPostId('https://twitch.tv/csgnet')).toBeNull()
    expect(parseXPostId('https://x.com/CSGNet')).toBeNull()
    expect(parseXPostId('https://x.com/CSGNet/status/notanid')).toBeNull()
    expect(parseXPostId('https://fakex.com/CSGNet/status/1234567890')).toBeNull()
    expect(parseXPostId('')).toBeNull()
    expect(parseXPostId('   ')).toBeNull()
  })
})

describe('isBroadcastUrl', () => {
  it('detects x.com broadcast links', () => {
    expect(isBroadcastUrl('https://x.com/i/broadcasts/1yoJMWvbybqxQ')).toBe(true)
    expect(isBroadcastUrl('https://twitter.com/i/broadcasts/1yoJMWvbybqxQ')).toBe(true)
  })

  it('is false for posts and non-X URLs', () => {
    expect(isBroadcastUrl('https://x.com/CSGNet/status/1234567890')).toBe(false)
    expect(isBroadcastUrl('https://twitch.tv/csgnet')).toBe(false)
    expect(isBroadcastUrl('')).toBe(false)
  })
})

describe('parseXBroadcastId', () => {
  it('extracts the base62 ID from a broadcast permalink', () => {
    expect(parseXBroadcastId('https://x.com/i/broadcasts/1DGleeyqVQmAB')).toBe('1DGleeyqVQmAB')
  })

  it('accepts the twitter.com, mobile and www spellings', () => {
    expect(parseXBroadcastId('https://twitter.com/i/broadcasts/1DGleeyqVQmAB')).toBe('1DGleeyqVQmAB')
    expect(parseXBroadcastId('https://mobile.x.com/i/broadcasts/1DGleeyqVQmAB')).toBe('1DGleeyqVQmAB')
    expect(parseXBroadcastId('https://www.x.com/i/broadcasts/1DGleeyqVQmAB')).toBe('1DGleeyqVQmAB')
  })

  it('tolerates a missing scheme, query string and trailing slash', () => {
    expect(parseXBroadcastId('x.com/i/broadcasts/1DGleeyqVQmAB')).toBe('1DGleeyqVQmAB')
    expect(parseXBroadcastId('https://x.com/i/broadcasts/1DGleeyqVQmAB/')).toBe('1DGleeyqVQmAB')
    expect(parseXBroadcastId('https://x.com/i/broadcasts/1DGleeyqVQmAB?s=20')).toBe('1DGleeyqVQmAB')
  })

  it('returns null for posts, other X routes and non-X hosts', () => {
    expect(parseXBroadcastId('https://x.com/CSGNet/status/1234567890')).toBeNull()
    expect(parseXBroadcastId('https://x.com/i/spaces/1DGleeyqVQmAB')).toBeNull()
    expect(parseXBroadcastId('https://fakex.com/i/broadcasts/1DGleeyqVQmAB')).toBeNull()
    expect(parseXBroadcastId('https://twitch.tv/csgnet')).toBeNull()
    expect(parseXBroadcastId('')).toBeNull()
  })

  it('rejects IDs that are not the 1-prefixed base62 shape', () => {
    expect(parseXBroadcastId('https://x.com/i/broadcasts/DGleeyqVQmAB')).toBeNull()
    expect(parseXBroadcastId('https://x.com/i/broadcasts/1-Gleeyq_VQmAB')).toBeNull()
    expect(parseXBroadcastId('https://x.com/i/broadcasts/1ab')).toBeNull()
  })
})

describe('canonicalPostUrl', () => {
  it('builds a stable outbound link from an ID', () => {
    expect(canonicalPostUrl('1234567890')).toBe('https://x.com/i/web/status/1234567890')
  })
})

describe('canonicalBroadcastUrl', () => {
  it('round-trips a parsed broadcast ID back to its permalink', () => {
    const url = 'https://x.com/i/broadcasts/1DGleeyqVQmAB'
    expect(canonicalBroadcastUrl(parseXBroadcastId(url)!)).toBe(url)
  })
})
