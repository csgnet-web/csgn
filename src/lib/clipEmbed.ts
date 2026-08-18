/**
 * Client-side helpers for clips. Display and instant feedback only.
 *
 * The real parsing lives in `netlify/functions/_shared/clipEmbed.ts` and runs on
 * submit. This file deliberately does NOT mirror it: a second parser would be a
 * second answer to "what is about to go on television", and the two would drift.
 * What is here is the cheapest possible check — is this even one of the three
 * platforms — so the form can say so before a round trip.
 */

export type ClipPlatform = 'youtube' | 'tiktok' | 'instagram'

export const CLIP_PLATFORM_LABELS: Record<ClipPlatform, string> = {
  youtube: 'YouTube',
  tiktok: 'TikTok',
  instagram: 'Instagram',
}

export const CLIP_MIN_SECONDS = 5
export const CLIP_MAX_SECONDS = 120
export const CLIP_DEFAULT_SECONDS = 30

const CLIP_HOSTS = [
  'youtube.com', 'youtu.be', 'm.youtube.com',
  'tiktok.com', 'm.tiktok.com',
  'instagram.com', 'instagr.am',
]

/**
 * Does this look like a link we support?
 *
 * Optimistic by design — it answers "is this worth submitting", not "will this
 * air". A link that passes here can still be rejected by the server (a profile
 * page, a short link we cannot resolve), and that is fine: the cost of being
 * slightly too permissive is one round trip, while being too strict means
 * telling somebody their perfectly good link is broken.
 */
export function looksLikeClipUrl(input: string): boolean {
  const raw = String(input ?? '').trim()
  if (!raw) return false
  try {
    const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
    const host = url.hostname.replace(/^www\./i, '').toLowerCase()
    return CLIP_HOSTS.includes(host) && url.pathname.replace(/\/+$/, '').length > 1
  } catch {
    return false
  }
}

/** mm:ss for a clip length. */
export const clipLength = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds))
  return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`
}

/** "4m 20s" for a total airtime allowance — the number this whole feature is about. */
export function airtimeLabel(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  if (s < 60) return `${s} sec`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return rem === 0 ? `${m} min` : `${m} min ${rem} sec`
}
