/**
 * Player utilities: URL parsing + embed src construction.
 * Extracted here so logic can be unit-tested independently of React.
 */

import { parseXBroadcastId, parseXPostId } from '@/lib/xembed'

/**
 * `x_broadcast` and `x_post` are the two ways an X stream reaches us: the
 * broadcast permalink a streamer copies (x.com/i/broadcasts/…) and the post
 * that carries the same broadcast (x.com/{user}/status/…). They stay distinct
 * types because only the second one can be embedded — see XStage.
 */
export type StreamType = 'twitch' | 'youtube' | 'kick' | 'x_broadcast' | 'x_post'
export interface DetectedStream { type: StreamType; id: string }

// ── URL parsers ──────────────────────────────────────────────────────────────

export function parseTwitchChannel(url: string): string | null {
  const raw = url.trim()
  if (!raw) return null

  const simple = raw.match(/^[a-zA-Z0-9_]{3,25}$/)?.[0]
  if (simple) return simple

  try {
    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    const parsed = new URL(normalized)
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase()

    if (host === 'player.twitch.tv') {
      const q = parsed.searchParams.get('channel')
      return q && /^[a-zA-Z0-9_]{3,25}$/.test(q) ? q : null
    }

    if (host.endsWith('twitch.tv')) {
      const first = parsed.pathname.split('/').filter(Boolean)[0]
      return first && /^[a-zA-Z0-9_]{3,25}$/.test(first) ? first : null
    }
  } catch {
    return null
  }

  return null
}

/**
 * Kick channel from a kick.com / player.kick.com URL. Unlike Twitch we do NOT
 * accept a bare word here — a lone "xqc" is already claimed as a Twitch channel,
 * so Kick must be named by an explicit kick.com link to stay unambiguous. Kick
 * slugs are 3–25 chars of letters, digits, underscores and hyphens.
 */
export function parseKickChannel(url: string): string | null {
  const raw = url.trim()
  if (!raw) return null
  try {
    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    const parsed = new URL(normalized)
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase()
    if (host !== 'kick.com' && host !== 'player.kick.com') return null
    const first = parsed.pathname.split('/').filter(Boolean)[0]
    return first && /^[a-zA-Z0-9_-]{3,25}$/.test(first) ? first : null
  } catch {
    return null
  }
}

export function parseYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube(?:-nocookie)?\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

export function detectStream(url: string): DetectedStream | null {
  // X is matched FIRST. A bare word like `1DGleeyqVQmAB` is still a valid Twitch
  // channel and parseTwitchChannel would claim it, but the X parsers only accept
  // a real x.com/twitter.com URL, so nothing bare is stolen from Twitch here —
  // this ordering only guarantees a full X URL is never mis-read.
  const broadcast = parseXBroadcastId(url)
  if (broadcast) return { type: 'x_broadcast', id: broadcast }
  const post = parseXPostId(url)
  if (post) return { type: 'x_post', id: post }
  const ch = parseTwitchChannel(url)
  if (ch) return { type: 'twitch', id: ch }
  const yt = parseYouTubeId(url)
  if (yt) return { type: 'youtube', id: yt }
  const kick = parseKickChannel(url)
  if (kick) return { type: 'kick', id: kick }
  return null
}

/** True for the two X stream shapes — the sources XStage knows how to forward. */
export function isXStream(stream: DetectedStream | null): boolean {
  return stream?.type === 'x_broadcast' || stream?.type === 'x_post'
}

// ── Embed src builders ───────────────────────────────────────────────────────

/**
 * Build a YouTube embed src that autoplays with audio unmuted.
 *
 * Strategy — muted-start + JS unmute:
 *   mute=1 + autoplay=1  → muted autoplay is allowed by all browsers; the
 *                           video starts playing immediately.
 *   enablejsapi=1        → allows the parent page to post IFrame API commands.
 *
 * The CSGNPlayer component then immediately posts `unMute` + `setVolume(100)`
 * via postMessage once the iframe fires its `load` event. Because the video is
 * already running when we unmute, the browser accepts it — resulting in
 * audio-on autoplay from every navigation path.
 *
 * The iframe MUST also carry allow="autoplay" for browsers to honour these.
 */
export function buildYouTubeSrc(videoId: string, muted = true): string {
  const params = new URLSearchParams({
    autoplay: '1',
    mute: muted ? '1' : '0',
    enablejsapi: '1', // allows postMessage commands (unMute / setVolume)
    rel: '0',
    modestbranding: '1',
    controls: '0',
    iv_load_policy: '3',
    disablekb: '1',
    playsinline: '1',
  })
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`
}

// NOTE: there is deliberately no `buildTwitchSrc` here. Twitch is the one
// platform /player does NOT drive with a raw iframe URL — it constructs the
// Twitch Embed JS API player so it can read live/offline events and playback
// progress (see masterControl.ts + FeedGate). A URL builder for it would be an
// unused second way to do the same thing, and the wrong one.

/**
 * Build a Kick embed src. Kick has no JS embed API on par with Twitch's, so on
 * /player a Kick channel is forwarded as an OVERRIDE iframe (like YouTube) rather
 * than driven through the Twitch live-detection pipeline.
 *
 *   autoplay=true — start immediately
 *   muted=false   — audio on (honoured inside OBS; a normal browser tab may need
 *                   the viewer's tap, same caveat as the YouTube override)
 */
export function buildKickSrc(channel: string, muted = false): string {
  const params = new URLSearchParams({
    autoplay: 'true',
    muted: muted ? 'true' : 'false',
  })
  return `https://player.kick.com/${channel}?${params.toString()}`
}

/** Required value for the iframe's `allow` attribute on every embedded player —
 *  without it the browser refuses the autoplay the params above request. */
export const PLAYER_ALLOW = 'autoplay; fullscreen; encrypted-media; picture-in-picture'
