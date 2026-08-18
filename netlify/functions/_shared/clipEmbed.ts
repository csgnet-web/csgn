// AUTHORITATIVE. The client has a cheap host check in src/lib/clipEmbed.ts for
// instant "that isn't a link we can use" feedback, but it deliberately does NOT
// mirror this parser — everything that decides what goes on air is decided
// here, from the URL the member actually submitted.
/**
 * A clip is a LINK to a post that already exists — on YouTube, TikTok or
 * Instagram — not a file anybody uploaded to us.
 *
 * That decision is the whole reason this feature is small. Hosting video means
 * storage, transcoding, a CDN bill, and taking on the job of deciding what a
 * file actually contains. Linking means the platform already did all of that,
 * the creator already has the post, and what we store is a string.
 *
 * What this module does is turn a URL a member pasted into something the player
 * can actually put on screen. Pure, so every platform's quirks are pinned by a
 * test rather than discovered on air.
 */

export type ClipPlatform = 'youtube' | 'tiktok' | 'instagram'

export interface ParsedClip {
  platform: ClipPlatform
  /** The platform's own id for the post. */
  videoId: string
  /** Tidied link back to the original post — what we show, credit and link to. */
  canonicalUrl: string
  /** The URL /player loads in an iframe. */
  embedUrl: string
}

export const CLIP_PLATFORM_LABELS: Record<ClipPlatform, string> = {
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
}

/**
 * Embed parameters, and why each one is there.
 *
 * `autoplay` because nobody is standing at the broadcast to press play.
 * `controls=0` and `rel=0` because a progress bar and a grid of "up next"
 * thumbnails from another channel are not part of our broadcast.
 * `playsinline` because without it iOS hijacks playback fullscreen.
 *
 * NOT muted. A silent channel is a dead channel, and OBS's browser source
 * allows autoplay with sound — which a normal browser will not. That is the one
 * meaningful difference between how this looks on the broadcast and how it
 * looks in a preview tab, and it is worth knowing before someone reports the
 * preview as broken.
 */
const YOUTUBE_PARAMS = 'autoplay=1&controls=0&rel=0&playsinline=1&modestbranding=1'

const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,20}$/
const TIKTOK_ID = /^\d{6,32}$/
const INSTAGRAM_ID = /^[A-Za-z0-9_-]{5,30}$/

/** Strip tracking junk and a trailing slash so two links to one post match. */
function cleanHost(url: URL): string {
  return url.hostname.replace(/^www\./i, '').toLowerCase()
}

/**
 * Parse a pasted link. Returns null for anything we cannot confidently place —
 * a bare domain, a profile page, a shortened link we cannot resolve, or a
 * platform we do not support. Null means "ask them for a different link", never
 * "put it on air and hope".
 */
export function parseClipUrl(input: string): ParsedClip | null {
  const raw = String(input ?? '').trim()
  if (!raw) return null

  let url: URL
  try {
    url = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null

  const host = cleanHost(url)
  const segments = url.pathname.split('/').filter(Boolean)

  // ── YouTube ──
  if (host === 'youtu.be') {
    const id = segments[0] ?? ''
    return YOUTUBE_ID.test(id) ? youtube(id) : null
  }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    const watch = url.searchParams.get('v')
    if (watch && YOUTUBE_ID.test(watch)) return youtube(watch)
    // /shorts/ID and /embed/ID both carry the id in the same position.
    if ((segments[0] === 'shorts' || segments[0] === 'embed' || segments[0] === 'live') && YOUTUBE_ID.test(segments[1] ?? '')) {
      return youtube(segments[1])
    }
    return null
  }

  // ── TikTok ──
  if (host === 'tiktok.com' || host === 'm.tiktok.com') {
    // /@handle/video/1234567890  — the id is always the segment after "video".
    const at = segments.indexOf('video')
    const id = at >= 0 ? segments[at + 1] : ''
    if (id && TIKTOK_ID.test(id)) return tiktok(id, segments[0]?.startsWith('@') ? segments[0] : '')
    return null
  }
  // vm.tiktok.com / vt.tiktok.com short links redirect to the real post, and
  // resolving them needs a network round trip this pure function must not make.
  if (host === 'vm.tiktok.com' || host === 'vt.tiktok.com') return null

  // ── Instagram ──
  if (host === 'instagram.com' || host === 'instagr.am') {
    const kind = segments[0]
    if ((kind === 'reel' || kind === 'reels' || kind === 'p' || kind === 'tv') && INSTAGRAM_ID.test(segments[1] ?? '')) {
      return instagram(segments[1], kind === 'reels' ? 'reel' : kind)
    }
    return null
  }

  return null
}

function youtube(videoId: string): ParsedClip {
  return {
    platform: 'youtube',
    videoId,
    canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?${YOUTUBE_PARAMS}`,
  }
}

function tiktok(videoId: string, handle: string): ParsedClip {
  return {
    platform: 'tiktok',
    videoId,
    canonicalUrl: handle
      ? `https://www.tiktok.com/${handle}/video/${videoId}`
      : `https://www.tiktok.com/video/${videoId}`,
    embedUrl: `https://www.tiktok.com/embed/v2/${videoId}`,
  }
}

function instagram(videoId: string, kind: string): ParsedClip {
  return {
    platform: 'instagram',
    videoId,
    canonicalUrl: `https://www.instagram.com/${kind}/${videoId}/`,
    embedUrl: `https://www.instagram.com/${kind}/${videoId}/embed/`,
  }
}

/**
 * Two links to the same post are the same clip.
 *
 * Used to stop a member filling the schedule with one video pasted eight
 * different ways — youtu.be, /shorts, with a timestamp, with a tracking tag.
 */
export const clipKey = (parsed: ParsedClip): string => `${parsed.platform}:${parsed.videoId}`

/** How long we assume a clip runs when the member has not said.
 *  Deliberately short: over-running the segment is what makes the schedule
 *  drift, and a clip that ends early just hands its remaining seconds back. */
export const CLIP_DEFAULT_SECONDS = 30
export const CLIP_MIN_SECONDS = 5
export const CLIP_MAX_SECONDS = 120

/** Clamp a member-declared duration into what the scheduler will actually air. */
export function clampClipSeconds(input: unknown): number {
  const n = Math.floor(Number(input) || 0)
  if (!Number.isFinite(n) || n <= 0) return CLIP_DEFAULT_SECONDS
  return Math.min(CLIP_MAX_SECONDS, Math.max(CLIP_MIN_SECONDS, n))
}
