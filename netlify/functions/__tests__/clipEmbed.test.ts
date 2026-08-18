import { describe, it, expect } from 'vitest'
import {
  parseClipUrl, clipKey, clampClipSeconds, applyTrim, supportsTrim, boundClipTrim,
  CLIP_MIN_SECONDS, CLIP_FALLBACK_SECONDS, CLIP_MAX_SECONDS,
} from '../_shared/clipEmbed'

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

  // A real runtime passes through UNTOUCHED. Cropping is only ever needed when
  // a member's earned airtime is shorter than their video — never because we
  // decided a video was too long.
  it('passes a real duration through exactly', () => {
    expect(clampClipSeconds(17)).toBe(17)
    expect(clampClipSeconds(184)).toBe(184)
    expect(clampClipSeconds(600)).toBe(600)
  })

  it('only catches junk and runaways', () => {
    expect(clampClipSeconds(1)).toBe(5)
    expect(clampClipSeconds(99_999)).toBe(CLIP_MAX_SECONDS)
    expect(clampClipSeconds(-5)).toBe(CLIP_FALLBACK_SECONDS)
  })

  it('falls back for junk', () => {
    expect(clampClipSeconds(undefined)).toBe(CLIP_FALLBACK_SECONDS)
    expect(clampClipSeconds('abc')).toBe(CLIP_FALLBACK_SECONDS)
    expect(clampClipSeconds(NaN)).toBe(CLIP_FALLBACK_SECONDS)
  })
})

describe('applyTrim', () => {
  const yt = parseClipUrl('https://youtu.be/dQw4w9WgXcQ')!
  const tt = parseClipUrl('https://www.tiktok.com/@a/video/7301234567890123456')!

  it('crops a YouTube embed for real', () => {
    const url = applyTrim(yt, { startSeconds: 12, endSeconds: 42 })
    expect(url).toContain('start=12')
    expect(url).toContain('end=42')
  })

  it('leaves the embed alone when there is nothing to crop', () => {
    expect(applyTrim(yt, {})).toBe(yt.embedUrl)
    expect(applyTrim(yt, { startSeconds: 0, endSeconds: 0 })).toBe(yt.embedUrl)
  })

  it('ignores an end that is not after the start', () => {
    const url = applyTrim(yt, { startSeconds: 30, endSeconds: 10 })
    expect(url).toContain('start=30')
    expect(url).not.toContain('end=')
  })

  // TikTok and Instagram players always begin at zero. A trim control that
  // pretended otherwise would be a button that silently does nothing.
  it('cannot crop platforms whose players ignore it', () => {
    expect(applyTrim(tt, { startSeconds: 12, endSeconds: 42 })).toBe(tt.embedUrl)
    expect(supportsTrim('youtube')).toBe(true)
    expect(supportsTrim('tiktok')).toBe(false)
    expect(supportsTrim('instagram')).toBe(false)
  })
})

describe('boundClipTrim', () => {
  it('keeps a normal crop exactly as asked', () => {
    expect(boundClipTrim(120, 10, 40)).toEqual({ startSeconds: 10, endSeconds: 40, seconds: 30 })
  })

  it('NEVER returns a negative start, however short the source', () => {
    // The bug this function was extracted for: the old inline arithmetic
    // computed `Math.min(source - 5, requested)`, which for a 3-second video is
    // Math.min(-2, 0) === -2, and shipped `?start=-2` to the player.
    for (const source of [1, 2, 3, 4, 5]) {
      const t = boundClipTrim(source, 0, 0)
      expect(t.startSeconds).toBeGreaterThanOrEqual(0)
      expect(t.endSeconds).toBeGreaterThanOrEqual(0)
    }
    expect(boundClipTrim(3, 99, 0).startSeconds).toBe(0)
  })

  it('airs a too-short video whole rather than inventing a crop', () => {
    expect(boundClipTrim(4, 2, 3)).toEqual({ startSeconds: 0, endSeconds: 0, seconds: 5 })
  })

  it('stores an end at or past the source as 0, meaning "play to the end"', () => {
    expect(boundClipTrim(60, 10, 60).endSeconds).toBe(0)
    expect(boundClipTrim(60, 10, 900).endSeconds).toBe(0)
  })

  it('refuses to let the start run past a minimum window from the end', () => {
    const t = boundClipTrim(60, 59, 0)
    expect(t.startSeconds).toBe(55)
  })

  it('forces at least the minimum window when the end is asked for before it', () => {
    const t = boundClipTrim(120, 30, 31)
    expect(t.endSeconds - t.startSeconds).toBeGreaterThanOrEqual(CLIP_MIN_SECONDS)
  })

  it('treats an unmeasured source as uncroppable and falls back', () => {
    expect(boundClipTrim(0, 5, 10)).toEqual({ startSeconds: 0, endSeconds: 0, seconds: CLIP_FALLBACK_SECONDS })
  })

  it('ignores junk input instead of propagating NaN into a URL', () => {
    const t = boundClipTrim(120, 'abc', null)
    expect(t).toEqual({ startSeconds: 0, endSeconds: 0, seconds: 120 })
  })

  it('produces a start applyTrim can safely render', () => {
    const yt = parseClipUrl('https://youtu.be/dQw4w9WgXcQ')!
    const t = boundClipTrim(3, 99, 0)
    expect(applyTrim(yt, t)).not.toContain('start=-')
  })
})
