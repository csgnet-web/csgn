/**
 * Player utilities: URL parsing + embed src construction.
 * Extracted here so logic can be unit-tested independently of React.
 */

export type StreamType = 'twitch' | 'youtube'
export interface DetectedStream { type: StreamType; id: string }

// ── URL parsers ──────────────────────────────────────────────────────────────

export function parseTwitchChannel(url: string): string | null {
  const m = url.match(/(?:twitch\.tv\/)([a-zA-Z0-9_]+)/i)
  return m ? m[1] : null
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
  const ch = parseTwitchChannel(url)
  if (ch) return { type: 'twitch', id: ch }
  const yt = parseYouTubeId(url)
  if (yt) return { type: 'youtube', id: yt }
  return null
}

// ── Embed src builders ───────────────────────────────────────────────────────

/**
 * Build a YouTube embed src that autoplays with audio unmuted.
 *
 * Key params:
 *   autoplay=1   — start playback immediately
 *   mute=0       — do NOT mute (audio on)
 *   playsinline=1 — stay inline on iOS (avoids forced fullscreen)
 *
 * The iframe MUST also carry allow="autoplay" for browsers to honour these.
 */
export function buildYouTubeSrc(videoId: string): string {
  const params = new URLSearchParams({
    autoplay: '1',
    mute: '0',
    rel: '0',
    modestbranding: '1',
    controls: '0',
    iv_load_policy: '3',
    disablekb: '1',
    playsinline: '1',
  })
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`
}

/**
 * Build a Twitch embed src that autoplays with audio unmuted.
 *
 * Key params:
 *   autoplay=true  — start playback immediately
 *   muted=false    — do NOT mute (audio on)
 *
 * The iframe MUST also carry allow="autoplay" for browsers to honour these.
 */
export function buildTwitchSrc(channel: string, hostname: string): string {
  const params = new URLSearchParams({
    channel,
    parent: hostname,
    autoplay: 'true',
    muted: 'false',
  })
  return `https://player.twitch.tv/?${params.toString()}`
}

/** Required value for the iframe's `allow` attribute on both players. */
export const PLAYER_ALLOW = 'autoplay; fullscreen; encrypted-media; picture-in-picture'
