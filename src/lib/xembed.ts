/**
 * X (Twitter) embed utilities: URL parsing for broadcasts and the posts that
 * carry them.
 *
 * Two shapes matter, and they are NOT interchangeable:
 *
 *   POST       x.com/{user}/status/{numeric id}
 *              The only shape widgets.js can embed. Rendering the post renders
 *              the live broadcast player inside it — this is what /watch uses.
 *
 *   BROADCAST  x.com/i/broadcasts/{base62 id}
 *              The permalink a streamer copies out of X. It is the canonical
 *              way an X stream gets handed to us, so /player accepts it, but it
 *              cannot be embedded by widgets.js and X serves the page with
 *              `frame-ancestors 'self'`, so an iframe of it is refused too.
 *              See components/player/XStage.tsx for how /player forwards one
 *              anyway without ever putting a dead frame on the encode.
 *
 * Extracted here so logic can be unit-tested independently of React.
 */

const X_HOSTS = new Set(['x.com', 'twitter.com', 'mobile.twitter.com', 'mobile.x.com'])

/** Broadcast IDs are Snowflake-derived base62, always '1'-prefixed (e.g. 1DGleeyqVQmAB). */
const BROADCAST_ID_RE = /^1[A-Za-z0-9]{6,24}$/

/** Extract the numeric status ID from an X post URL, or null if not an X post. */
export function parseXPostId(url: string): string | null {
  const raw = url.trim()
  if (!raw) return null

  try {
    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    const parsed = new URL(normalized)
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase()
    if (!X_HOSTS.has(host)) return null

    const segments = parsed.pathname.split('/').filter(Boolean)
    // /{user}/status/{id} or /i/web/status/{id}
    const statusIdx = segments.indexOf('status')
    if (statusIdx === -1) return null
    const id = segments[statusIdx + 1]
    return id && /^\d{5,25}$/.test(id) ? id : null
  } catch {
    return null
  }
}

/**
 * Extract the base62 broadcast ID from an x.com/i/broadcasts/… URL, or null.
 *
 * This is the link a streamer actually has for an X stream — X's own "copy
 * link" on a live broadcast produces it — so it is what /player is handed when
 * an hour is being forwarded from X rather than Twitch.
 */
export function parseXBroadcastId(url: string): string | null {
  const raw = url.trim()
  if (!raw) return null

  try {
    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    const parsed = new URL(normalized)
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase()
    if (!X_HOSTS.has(host)) return null

    const segments = parsed.pathname.split('/').filter(Boolean)
    // /i/broadcasts/{id}
    if (segments[0] !== 'i' || segments[1] !== 'broadcasts') return null
    const id = segments[2]
    return id && BROADCAST_ID_RE.test(id) ? id : null
  } catch {
    return null
  }
}

/** True for x.com/i/broadcasts/… links, which widgets.js cannot embed. */
export function isBroadcastUrl(url: string): boolean {
  const raw = url.trim()
  if (!raw) return false
  try {
    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    const parsed = new URL(normalized)
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase()
    return X_HOSTS.has(host) && /^\/i\/broadcasts\//.test(parsed.pathname)
  } catch {
    return false
  }
}

/** Canonical post URL for a status ID (used for "Watch on X" outbound links). */
export function canonicalPostUrl(id: string): string {
  return `https://x.com/i/web/status/${id}`
}

/** Canonical broadcast URL for a broadcast ID (outbound link + frame attempt). */
export function canonicalBroadcastUrl(id: string): string {
  return `https://x.com/i/broadcasts/${id}`
}
