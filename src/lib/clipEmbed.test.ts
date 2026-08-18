import { describe, it, expect } from 'vitest'
import {
  looksLikeClipUrl, clipLength, airtimeLabel,
  CLIP_CUTS, cutForSeconds, lookById, ON_AIR_LOOKS, clipPoster,
  CLIP_MIN_SECONDS, CLIP_MAX_SECONDS,
} from './clipEmbed'

describe('looksLikeClipUrl', () => {
  it('accepts the three platforms so the form can respond instantly', () => {
    expect(looksLikeClipUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true)
    expect(looksLikeClipUrl('https://www.tiktok.com/@a/video/7301234567890123456')).toBe(true)
    expect(looksLikeClipUrl('instagram.com/reel/Cx1y2Z3aBcD/')).toBe(true)
  })

  it('rejects what is obviously not a clip link', () => {
    expect(looksLikeClipUrl('')).toBe(false)
    expect(looksLikeClipUrl('hello')).toBe(false)
    expect(looksLikeClipUrl('https://vimeo.com/12345')).toBe(false)
    expect(looksLikeClipUrl('https://youtube.com')).toBe(false)
    expect(looksLikeClipUrl('https://youtube.com.evil.tld/watch?v=x')).toBe(false)
  })

  // It is allowed to be optimistic — the server has the last word. Being too
  // strict here means telling somebody their good link is broken.
  it('lets a link the server will reject through rather than pre-judging it', () => {
    expect(looksLikeClipUrl('https://www.tiktok.com/@someone')).toBe(true)
  })
})

describe('display helpers', () => {
  it('formats a clip length', () => {
    expect(clipLength(45)).toBe('45s')
    expect(clipLength(90)).toBe('1m 30s')
  })

  it('formats an airtime allowance in words a person reads', () => {
    expect(airtimeLabel(30)).toBe('30 sec')
    expect(airtimeLabel(260)).toBe('4 min 20 sec')
    expect(airtimeLabel(300)).toBe('5 min')
    expect(airtimeLabel(0)).toBe('0 sec')
  })
})

describe('cuts', () => {
  it('offers a ladder of lengths so nobody types a number', () => {
    expect(CLIP_CUTS.length).toBeGreaterThanOrEqual(4)
    // Ascending, and every one inside what the scheduler will actually air.
    const seconds = CLIP_CUTS.map((c) => c.seconds)
    expect([...seconds].sort((a, b) => a - b)).toEqual(seconds)
    expect(Math.min(...seconds)).toBeGreaterThanOrEqual(CLIP_MIN_SECONDS)
    expect(Math.max(...seconds)).toBeLessThanOrEqual(CLIP_MAX_SECONDS)
  })

  it('maps a stored length back to the nearest cut', () => {
    expect(cutForSeconds(30).id).toBe('standard')
    expect(cutForSeconds(60).id).toBe('feature')
    // A legacy clip saved with a hand-typed length still lands on a real chip
    // rather than showing nothing selected.
    expect(cutForSeconds(33).id).toBe('standard')
    expect(cutForSeconds(9999).id).toBe('block')
  })
})

describe('on-air looks', () => {
  it('always resolves to a real look, including for junk', () => {
    expect(lookById('gold').label).toBe('Gold')
    expect(lookById(undefined).id).toBe(ON_AIR_LOOKS[0].id)
    expect(lookById('does-not-exist').id).toBe(ON_AIR_LOOKS[0].id)
  })
})

describe('clipPoster', () => {
  it('builds a real YouTube frame without an API call', () => {
    expect(clipPoster('youtube', 'dQw4w9WgXcQ')).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg')
  })

  // TikTok and Instagram thumbnails need signed URLs that expire. A designed
  // platform card beats a broken image every time.
  it('returns null where there is no stable thumbnail', () => {
    expect(clipPoster('tiktok', '7301234567890123456')).toBeNull()
    expect(clipPoster('instagram', 'Cx1y2Z3aBcD')).toBeNull()
    expect(clipPoster('youtube', '')).toBeNull()
  })
})
