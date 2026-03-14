import { describe, it, expect } from 'vitest'
import {
  parseTwitchChannel,
  parseYouTubeId,
  detectStream,
  buildYouTubeSrc,
  buildTwitchSrc,
  PLAYER_ALLOW,
} from './player'

// ── parseTwitchChannel ───────────────────────────────────────────────────────

describe('parseTwitchChannel', () => {
  it('extracts channel from full twitch.tv URL', () => {
    expect(parseTwitchChannel('https://www.twitch.tv/xqc')).toBe('xqc')
  })
  it('extracts channel from URL without www', () => {
    expect(parseTwitchChannel('https://twitch.tv/pokimane')).toBe('pokimane')
  })
  it('extracts channel from URL with trailing slash', () => {
    expect(parseTwitchChannel('https://twitch.tv/ninja/')).toBe('ninja')
  })
  it('handles uppercase in URL', () => {
    expect(parseTwitchChannel('https://Twitch.TV/Streamer123')).toBe('Streamer123')
  })
  it('returns null for non-twitch URL', () => {
    expect(parseTwitchChannel('https://youtube.com/watch?v=abc1234defg')).toBeNull()
  })
  it('returns null for empty string', () => {
    expect(parseTwitchChannel('')).toBeNull()
  })
})

// ── parseYouTubeId ───────────────────────────────────────────────────────────

describe('parseYouTubeId', () => {
  const ID = 'dQw4w9WgXcQ'

  it('extracts ID from standard watch URL', () => {
    expect(parseYouTubeId(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID)
  })
  it('extracts ID from watch URL with extra params', () => {
    expect(parseYouTubeId(`https://www.youtube.com/watch?t=30&v=${ID}&feature=share`)).toBe(ID)
  })
  it('extracts ID from youtu.be short URL', () => {
    expect(parseYouTubeId(`https://youtu.be/${ID}`)).toBe(ID)
  })
  it('extracts ID from /live/ URL (YouTube Live permalink)', () => {
    expect(parseYouTubeId(`https://www.youtube.com/live/${ID}`)).toBe(ID)
  })
  it('extracts ID from /embed/ URL', () => {
    expect(parseYouTubeId(`https://www.youtube.com/embed/${ID}`)).toBe(ID)
  })
  it('extracts ID from youtube-nocookie embed URL', () => {
    expect(parseYouTubeId(`https://www.youtube-nocookie.com/embed/${ID}`)).toBe(ID)
  })
  it('returns null for Twitch URL', () => {
    expect(parseYouTubeId('https://twitch.tv/xqc')).toBeNull()
  })
  it('returns null for empty string', () => {
    expect(parseYouTubeId('')).toBeNull()
  })
})

// ── detectStream ─────────────────────────────────────────────────────────────

describe('detectStream', () => {
  it('detects Twitch stream', () => {
    const result = detectStream('https://www.twitch.tv/xqc')
    expect(result).toEqual({ type: 'twitch', id: 'xqc' })
  })
  it('detects YouTube stream from watch URL', () => {
    const result = detectStream('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(result).toEqual({ type: 'youtube', id: 'dQw4w9WgXcQ' })
  })
  it('detects YouTube Live stream from /live/ URL', () => {
    const result = detectStream('https://www.youtube.com/live/dQw4w9WgXcQ')
    expect(result).toEqual({ type: 'youtube', id: 'dQw4w9WgXcQ' })
  })
  it('returns null for unrecognised URL', () => {
    expect(detectStream('https://example.com/stream')).toBeNull()
  })
})

// ── buildYouTubeSrc ─────────────────────────────────────────────────────────
//
// Strategy: muted-start + JS unmute.
//   mute=1 + autoplay=1  → muted autoplay is always permitted by browsers;
//                           the video starts playing immediately.
//   enablejsapi=1        → the YouTubePlayer component posts unMute +
//                           setVolume(100) on iframe load, resulting in
//                           audio-on playback from every navigation path.

describe('buildYouTubeSrc', () => {
  const src = buildYouTubeSrc('dQw4w9WgXcQ')
  const url = new URL(src)

  it('uses youtube-nocookie domain', () => {
    expect(url.hostname).toBe('www.youtube-nocookie.com')
  })
  it('embeds the video ID in the path', () => {
    expect(url.pathname).toBe('/embed/dQw4w9WgXcQ')
  })
  it('sets autoplay=1 (autoplay ON)', () => {
    expect(url.searchParams.get('autoplay')).toBe('1')
  })
  it('sets mute=1 (starts muted for guaranteed autoplay; JS unmutes on load)', () => {
    expect(url.searchParams.get('mute')).toBe('1')
  })
  it('sets enablejsapi=1 (required for postMessage unMute command)', () => {
    expect(url.searchParams.get('enablejsapi')).toBe('1')
  })
  it('sets playsinline=1 (inline on iOS, no forced fullscreen)', () => {
    expect(url.searchParams.get('playsinline')).toBe('1')
  })
})

// ── buildTwitchSrc ───────────────────────────────────────────────────────────

describe('buildTwitchSrc', () => {
  const src = buildTwitchSrc('xqc', 'localhost')
  const url = new URL(src)

  it('targets the Twitch player', () => {
    expect(url.hostname).toBe('player.twitch.tv')
  })
  it('sets the channel', () => {
    expect(url.searchParams.get('channel')).toBe('xqc')
  })
  it('sets the parent hostname', () => {
    expect(url.searchParams.get('parent')).toBe('localhost')
  })
  it('sets autoplay=true (autoplay ON)', () => {
    expect(url.searchParams.get('autoplay')).toBe('true')
  })
  it('sets muted=false (audio ON)', () => {
    expect(url.searchParams.get('muted')).toBe('false')
  })
})

// ── PLAYER_ALLOW ─────────────────────────────────────────────────────────────

describe('PLAYER_ALLOW', () => {
  it('includes "autoplay" permission', () => {
    expect(PLAYER_ALLOW).toContain('autoplay')
  })
  it('includes "fullscreen" permission', () => {
    expect(PLAYER_ALLOW).toContain('fullscreen')
  })
})
