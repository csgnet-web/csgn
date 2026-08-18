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

/** A crop, in whole seconds from the start of the source. `endSeconds` is
 *  exclusive of nothing — it is simply where we stop. */
export interface ClipTrim { startSeconds?: number; endSeconds?: number }

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

/**
 * Apply a member's crop to an embed URL.
 *
 * YOUTUBE IS THE ONLY PLATFORM WHERE A CROP IS REAL. Its player takes `start`
 * and `end` parameters, so a trimmed clip genuinely begins and ends where the
 * member said. TikTok and Instagram embeds accept no such thing — their players
 * always begin at zero — so for those a "trim" can only shorten the segment from
 * the front, which the schedule already does by giving it fewer seconds. Saying
 * that plainly in the UI is better than shipping a control that silently does
 * nothing on two platforms out of three.
 */
export function applyTrim(clip: ParsedClip, trim: ClipTrim): string {
  const start = Math.max(0, Math.floor(Number(trim.startSeconds) || 0))
  const end = Math.max(0, Math.floor(Number(trim.endSeconds) || 0))
  if (clip.platform !== 'youtube' || (start === 0 && end === 0)) return clip.embedUrl

  const params: string[] = []
  if (start > 0) params.push(`start=${start}`)
  if (end > start) params.push(`end=${end}`)
  return params.length ? `${clip.embedUrl}&${params.join('&')}` : clip.embedUrl
}

/** Can a member's crop actually be honoured on this platform? */
export const supportsTrim = (platform: string): boolean => platform === 'youtube'

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

/**
 * What we air when the platform will not tell us the runtime.
 *
 * TikTok and Instagram publish no duration at all, and YouTube only does with an
 * API key configured, so this is not a rare edge. It is deliberately near the
 * middle of a short-form clip rather than short: under-running just ends the
 * segment early and hands the seconds back, while over-running gets cut off
 * mid-sentence on television, which is the one that looks broken.
 */
export const CLIP_FALLBACK_SECONDS = 45
export const CLIP_MIN_SECONDS = 5
/**
 * Longest single segment the scheduler will lay down.
 *
 * A RUNAWAY GUARD, not an editorial limit. A member's real clip length is aired
 * in full — cropping is only ever needed when their earned airtime is shorter
 * than the video, never because we decided a video was too long. Fifteen minutes
 * is far past anything short-form and still bounded, so a mis-read duration
 * cannot hand one clip a whole afternoon.
 */
export const CLIP_MAX_SECONDS = 900

/** Bound a duration to something the scheduler can actually air. Exact input in,
 *  exact output out — this only catches junk and runaways. */
export function clampClipSeconds(input: unknown): number {
  const n = Math.floor(Number(input) || 0)
  if (!Number.isFinite(n) || n <= 0) return CLIP_FALLBACK_SECONDS
  return Math.min(CLIP_MAX_SECONDS, Math.max(CLIP_MIN_SECONDS, n))
}


/**
 * Bound a member's requested crop to a window that actually exists inside their
 * video.
 *
 * Pure, and separate from the endpoint, because this decides how much airtime a
 * segment asks the scheduler for — get it wrong and the broadcast runs a clip
 * into dead air, or plays it from a negative offset.
 *
 * The bug this was extracted to fix: the endpoint computed the start as
 * `Math.min(source - CLIP_MIN_SECONDS, Math.max(0, requested))`. For any video
 * shorter than CLIP_MIN_SECONDS — which a 3-second TikTok is — the left operand
 * is NEGATIVE, and `Math.min` happily returns it. That negative start went into
 * the embed URL as `?start=-2`.
 *
 * Rules, in order:
 *   • A source we could not measure cannot be cropped at all (caller's check).
 *   • The start can never be negative, and never so late that less than the
 *     minimum remains — but on a video too short to hold a minimum window, the
 *     answer is "no crop", not "a nonsense one".
 *   • An end at or past the source means "play to the end", stored as 0 so the
 *     embed carries no `end` parameter.
 */
export interface BoundedTrim { startSeconds: number; endSeconds: number; seconds: number }

export function boundClipTrim(sourceSeconds: number, requestedStart: unknown, requestedEnd: unknown): BoundedTrim {
  const source = Math.max(0, Math.floor(Number(sourceSeconds) || 0))
  if (source <= 0) return { startSeconds: 0, endSeconds: 0, seconds: CLIP_FALLBACK_SECONDS }

  // Too short to hold a minimum window — there is no crop to make. Airing it
  // whole is the honest answer; a "crop" of a 3-second clip is not a feature.
  if (source <= CLIP_MIN_SECONDS) {
    return { startSeconds: 0, endSeconds: 0, seconds: clampClipSeconds(source) }
  }

  const latestStart = source - CLIP_MIN_SECONDS
  const start = Math.max(0, Math.min(latestStart, Math.floor(Number(requestedStart) || 0)))

  const rawEnd = Math.floor(Number(requestedEnd) || 0)
  const end = rawEnd > 0
    ? Math.min(source, Math.max(start + CLIP_MIN_SECONDS, rawEnd))
    : source

  return {
    startSeconds: start,
    // 0 means "to the end", which is what keeps `end=` off the embed URL.
    endSeconds: end >= source ? 0 : end,
    seconds: clampClipSeconds(end - start),
  }
}
