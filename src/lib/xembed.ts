/**
 * X (Twitter) embed utilities: URL parsing for broadcast posts.
 * X widgets embed a POST by its numeric status ID — raw x.com/i/broadcasts/…
 * URLs cannot be embedded, only the post that carries the broadcast.
 * Extracted here so logic can be unit-tested independently of React.
 */

const X_HOSTS = new Set(['x.com', 'twitter.com', 'mobile.twitter.com', 'mobile.x.com'])

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

/** True for x.com/i/broadcasts/… links, which look right but are NOT embeddable. */
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
