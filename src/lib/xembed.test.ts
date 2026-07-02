import { describe, it, expect } from 'vitest'
import { parseXPostId, isBroadcastUrl, canonicalPostUrl } from './xembed'

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

describe('canonicalPostUrl', () => {
  it('builds a stable outbound link from an ID', () => {
    expect(canonicalPostUrl('1234567890')).toBe('https://x.com/i/web/status/1234567890')
  })
})
