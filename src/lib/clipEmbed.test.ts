import { describe, it, expect } from 'vitest'
import { looksLikeClipUrl, clipLength, airtimeLabel } from './clipEmbed'

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
