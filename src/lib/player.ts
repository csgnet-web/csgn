/**
 * Player utilities: URL parsing + embed src construction.
 * Extracted here so logic can be unit-tested independently of React.
 */

export type StreamType = 'twitch' | 'youtube'
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
export function buildYouTubeSrc(videoId: string): string {
  const params = new URLSearchParams({
    autoplay: '1',
    mute: '1',        // start muted → guaranteed autoplay; JS unmutes on load
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
