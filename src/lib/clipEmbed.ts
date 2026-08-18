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
/** What a clip is assumed to run when the platform will not tell us — TikTok and
 *  Instagram publish no duration, and YouTube only does with an API key. The
 *  member is never asked; a wrong guess costs a slightly clipped segment, and
 *  asking would cost the post. */
export const CLIP_DEFAULT_SECONDS = 30

/**
 * ON-AIR LOOK — a member's own visual language.
 *
 * The lower third that appears under their clip on the broadcast. Choosing it
 * is the thing that turns "I pasted a link" into "that's my segment", and it
 * costs one tap. Stored on the member, applied to every clip they run.
 */
export interface OnAirLook {
  id: string
  label: string
  /** Tailwind gradient stops for the card, and the accent bar under the name. */
  gradient: string
  accent: string
  ring: string
}

export const ON_AIR_LOOKS: OnAirLook[] = [
  { id: 'signal', label: 'Signal', gradient: 'from-primary-600 to-primary-500', accent: 'bg-primary-500', ring: 'ring-primary-500/40' },
  { id: 'money', label: 'Money', gradient: 'from-emerald-600 to-emerald-400', accent: 'bg-emerald-400', ring: 'ring-emerald-400/40' },
  { id: 'gold', label: 'Gold', gradient: 'from-amber-500 to-yellow-400', accent: 'bg-amber-400', ring: 'ring-amber-400/40' },
  { id: 'ice', label: 'Ice', gradient: 'from-cyan-500 to-sky-400', accent: 'bg-cyan-400', ring: 'ring-cyan-400/40' },
  { id: 'violet', label: 'Violet', gradient: 'from-violet-600 to-fuchsia-500', accent: 'bg-violet-500', ring: 'ring-violet-500/40' },
  { id: 'mono', label: 'Mono', gradient: 'from-gray-600 to-gray-400', accent: 'bg-white', ring: 'ring-white/30' },
]

export const lookById = (id: string | undefined): OnAirLook =>
  ON_AIR_LOOKS.find((l) => l.id === id) ?? ON_AIR_LOOKS[0]

/**
 * A poster frame for a clip card, without an API call.
 *
 * YouTube publishes thumbnails at a stable, guessable path, so those get a real
 * frame for free. TikTok and Instagram do not — their thumbnails are behind
 * oEmbed and signed URLs that expire — so those get a designed platform card
 * instead. A designed card beats a broken image, and it beats a spinner that
 * resolves into a broken image.
 */
export function clipPoster(platform: string, videoId: string): string | null {
  return platform === 'youtube' && videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null
}

/** The look a platform gets when it has no poster frame. */
export const PLATFORM_STYLE: Record<string, { gradient: string; mark: string }> = {
  youtube: { gradient: 'from-red-600/30 to-red-900/10', mark: '▶' },
  tiktok: { gradient: 'from-cyan-500/25 to-fuchsia-600/15', mark: '♪' },
  instagram: { gradient: 'from-fuchsia-600/25 to-amber-500/15', mark: '◎' },
}

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
