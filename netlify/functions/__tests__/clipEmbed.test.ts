import { describe, it, expect } from 'vitest'
import { parseClipUrl, clipKey, clampClipSeconds, CLIP_DEFAULT_SECONDS } from '../_shared/clipEmbed'

describe('parseClipUrl — YouTube', () => {
  it('reads every shape of a YouTube link', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
      'youtube.com/watch?v=dQw4w9WgXcQ',
    ]) {
      expect(parseClipUrl(url)?.videoId, url).toBe('dQw4w9WgXcQ')
    }
  })

  it('ignores tracking and timestamp junk around the id', () => {
    const parsed = parseClipUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&si=abc123')
    expect(parsed?.canonicalUrl).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  })

  it('builds an embed that plays without a person present', () => {
    const embed = parseClipUrl('https://youtu.be/dQw4w9WgXcQ')!.embedUrl
    expect(embed).toContain('autoplay=1')
    expect(embed).toContain('controls=0')
    // No "up next" grid from somebody else's channel on our broadcast.
    expect(embed).toContain('rel=0')
    // Sound stays ON — a muted channel is a dead channel.
    expect(embed).not.toContain('mute=1')
  })
})

describe('parseClipUrl — TikTok', () => {
  it('reads a standard post link', () => {
    const parsed = parseClipUrl('https://www.tiktok.com/@someone/video/7301234567890123456')
    expect(parsed?.platform).toBe('tiktok')
    expect(parsed?.videoId).toBe('7301234567890123456')
    expect(parsed?.embedUrl).toContain('/embed/v2/7301234567890123456')
    expect(parsed?.canonicalUrl).toContain('@someone')
  })

  // vm.tiktok.com links are redirects. Resolving one needs a network call, and
  // this function is pure — so it refuses rather than guessing, and the member
  // gets asked for the full link instead of a broken segment going to air.
  it('refuses a short link it cannot resolve without a network call', () => {
    expect(parseClipUrl('https://vm.tiktok.com/ZMabcdef/')).toBeNull()
  })
})

describe('parseClipUrl — Instagram', () => {
  it('reads reels and posts', () => {
    expect(parseClipUrl('https://www.instagram.com/reel/Cx1y2Z3aBcD/')?.videoId).toBe('Cx1y2Z3aBcD')
    expect(parseClipUrl('https://instagram.com/p/Cx1y2Z3aBcD/')?.platform).toBe('instagram')
    expect(parseClipUrl('https://www.instagram.com/reels/Cx1y2Z3aBcD/')?.canonicalUrl)
      .toBe('https://www.instagram.com/reel/Cx1y2Z3aBcD/')
  })

  it('appends the embed path', () => {
    expect(parseClipUrl('https://www.instagram.com/reel/Cx1y2Z3aBcD/')?.embedUrl)
      .toBe('https://www.instagram.com/reel/Cx1y2Z3aBcD/embed/')
  })
})

describe('parseClipUrl — what it refuses', () => {
  it('returns null rather than airing something it could not place', () => {
    for (const bad of [
      '', '   ', 'not a url', 'https://', 'ftp://youtube.com/watch?v=abc',
      'https://www.youtube.com', 'https://www.youtube.com/@channel',
      'https://www.tiktok.com/@someone', 'https://www.instagram.com/someone/',
      'https://vimeo.com/12345', 'https://example.com/video.mp4',
      'https://www.youtube.com/watch?v=!!!',
    ]) {
      expect(parseClipUrl(bad), bad).toBeNull()
    }
  })

  // A lookalike host is the classic way to get an arbitrary page onto a
  // broadcast. Matching must be on the exact host, never a substring.
  it('is not fooled by a lookalike domain', () => {
    expect(parseClipUrl('https://youtube.com.evil.tld/watch?v=dQw4w9WgXcQ')).toBeNull()
    expect(parseClipUrl('https://notyoutube.com/watch?v=dQw4w9WgXcQ')).toBeNull()
    expect(parseClipUrl('https://evil.tld/https://youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull()
  })
})

describe('clipKey', () => {
  it('collapses the same post pasted different ways into one key', () => {
    const a = parseClipUrl('https://youtu.be/dQw4w9WgXcQ')!
    const b = parseClipUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=9')!
    const c = parseClipUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ')!
    expect(clipKey(a)).toBe(clipKey(b))
    expect(clipKey(b)).toBe(clipKey(c))
  })

  it('separates the same id on different platforms', () => {
    const yt = parseClipUrl('https://youtu.be/dQw4w9WgXcQ')!
    const ig = parseClipUrl('https://www.instagram.com/reel/dQw4w9WgXcQ/')!
    expect(clipKey(yt)).not.toBe(clipKey(ig))
  })
})

describe('clampClipSeconds', () => {
  it('keeps a sane declared length', () => {
    expect(clampClipSeconds(30)).toBe(30)
    expect(clampClipSeconds(90)).toBe(90)
  })

  it('clamps the extremes rather than trusting them', () => {
    expect(clampClipSeconds(1)).toBe(5)
    expect(clampClipSeconds(9999)).toBe(120)
    expect(clampClipSeconds(-5)).toBe(CLIP_DEFAULT_SECONDS)
  })

  it('falls back for junk', () => {
    expect(clampClipSeconds(undefined)).toBe(CLIP_DEFAULT_SECONDS)
    expect(clampClipSeconds('abc')).toBe(CLIP_DEFAULT_SECONDS)
    expect(clampClipSeconds(NaN)).toBe(CLIP_DEFAULT_SECONDS)
  })
})
