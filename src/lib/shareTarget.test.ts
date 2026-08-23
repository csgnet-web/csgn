import { describe, it, expect } from 'vitest'
import { parseShare, parseShareSearch, firstUrl } from './shareTarget'

describe('firstUrl', () => {
  it('finds a bare url', () => {
    expect(firstUrl('https://x.com/a/status/1')).toBe('https://x.com/a/status/1')
  })
  it('finds a url inside a sentence', () => {
    expect(firstUrl('look at this https://tiktok.com/@a/video/1 lol')).toBe('https://tiktok.com/@a/video/1')
  })
  // A link at the end of a caption arrives welded to the punctuation.
  it('strips trailing punctuation', () => {
    expect(firstUrl('see https://x.com/a/status/1.')).toBe('https://x.com/a/status/1')
    expect(firstUrl('(https://x.com/a/status/1)')).toBe('https://x.com/a/status/1')
  })
  it('is empty when there is no url', () => {
    expect(firstUrl('no link here')).toBe('')
    expect(firstUrl(null)).toBe('')
  })
})

describe('parseShare', () => {
  // The three real senders, as they actually behave.
  it('reads X, which fills url properly', () => {
    const r = parseShare({ title: '', text: 'my post https://x.com/a/status/1', url: 'https://x.com/a/status/1' })
    expect(r.url).toBe('https://x.com/a/status/1')
    expect(r.title).toBe('my post')
  })

  it('reads Instagram, which puts everything in text and leaves url empty', () => {
    const r = parseShare({
      title: '', url: '',
      text: 'Check this out https://www.instagram.com/reel/ABC123/?igsh=xyz',
    })
    expect(r.url).toBe('https://www.instagram.com/reel/ABC123/?igsh=xyz')
    expect(r.title).toBe('Check this out')
  })

  it('reads TikTok, which puts the link at the end of a caption', () => {
    const r = parseShare({
      title: '', url: '',
      text: 'the funniest thing all week #fyp https://www.tiktok.com/@user/video/7300000000000000000',
    })
    expect(r.url).toBe('https://www.tiktok.com/@user/video/7300000000000000000')
    expect(r.title).toContain('funniest thing')
  })

  it('falls back to title when that is the only field with a link', () => {
    const r = parseShare({ title: 'https://youtu.be/abc', text: '', url: '' })
    expect(r.url).toBe('https://youtu.be/abc')
  })

  // "Opened /share by hand" and "the sheet sent something unreadable" need
  // different messages, so they need to be distinguishable.
  it('distinguishes an empty share from an unreadable one', () => {
    expect(parseShare({}).hadContent).toBe(false)
    expect(parseShare({ text: 'no link in here' }).hadContent).toBe(true)
    expect(parseShare({ text: 'no link in here' }).url).toBe('')
  })

  it('caps a runaway caption', () => {
    const r = parseShare({ text: `${'x'.repeat(400)} https://x.com/a/status/1` })
    expect(r.title.length).toBeLessThanOrEqual(80)
  })

  it('never returns the url as the title', () => {
    const r = parseShare({ text: 'https://x.com/a/status/1', url: 'https://x.com/a/status/1' })
    expect(r.title).toBe('')
  })
})

describe('parseShareSearch', () => {
  it('reads an encoded query string', () => {
    const r = parseShareSearch('?title=&text=nice%20one%20https%3A%2F%2Fx.com%2Fa%2Fstatus%2F1&url=')
    expect(r.url).toBe('https://x.com/a/status/1')
    expect(r.title).toBe('nice one')
  })
  it('handles a leading question mark or none', () => {
    expect(parseShareSearch('url=https://x.com/a/status/1').url).toBe('https://x.com/a/status/1')
  })
})
