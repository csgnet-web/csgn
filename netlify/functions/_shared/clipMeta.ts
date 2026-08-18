// What a pasted link actually IS — title, poster frame, and how long it runs.
//
// The member should never be asked how many seconds their clip is. They already
// made the thing; the platform already knows. Asking is a chore that invites a
// wrong answer, and a wrong answer here shows up as a segment that gets cut off
// mid-sentence on television.
//
// So we ask the platform. Every lookup here is best-effort and bounded: a
// provider that is slow, down, or has changed its response shape returns null
// and the caller falls back to a sane default. Nothing in this file may ever
// stop a member from posting.

import { fetchJson } from './cache'
import { type ParsedClip } from './clipEmbed'

export interface ClipMeta {
  title: string
  thumbnailUrl: string
  authorName: string
  /** Real runtime in seconds, when the platform will tell us. Null when it won't. */
  seconds: number | null
}

const EMPTY: ClipMeta = { title: '', thumbnailUrl: '', authorName: '', seconds: null }

/** Lookups are on the submit path, so they get a short leash. A member waiting
 *  four seconds to find out whether their link worked will assume it didn't. */
const META_TIMEOUT_MS = 2_500

/**
 * ISO 8601 duration (`PT1M30S`) → seconds. This is what the YouTube Data API
 * returns, and it is the only place a real runtime comes from today.
 */
export function parseIsoDuration(iso: string): number | null {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(String(iso ?? '').trim())
  if (!m) return null
  const [, d, h, min, sec] = m
  const total = (Number(d) || 0) * 86_400 + (Number(h) || 0) * 3_600 + (Number(min) || 0) * 60 + (Number(sec) || 0)
  return total > 0 ? Math.round(total) : null
}

/**
 * YouTube runtime, via the Data API.
 *
 * OPTIONAL BY DESIGN. Without `YOUTUBE_API_KEY` set this returns null and the
 * caller uses a default length — posting still works, the segment is just
 * assumed rather than measured. Making a member's ability to post depend on our
 * having remembered to configure an API key would be the wrong trade.
 */
async function youtubeSeconds(videoId: string): Promise<number | null> {
  const key = process.env.YOUTUBE_API_KEY
  if (!key) return null
  const data = await fetchJson<{ items?: Array<{ contentDetails?: { duration?: string } }> }>(
    `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(key)}`,
    { timeoutMs: META_TIMEOUT_MS },
  )
  const iso = data?.items?.[0]?.contentDetails?.duration
  return iso ? parseIsoDuration(iso) : null
}

/** oEmbed gives a title, an author and a poster frame on every platform that
 *  supports it — and a duration on none of them. */
async function oembed(url: string): Promise<{ title?: string; thumbnail_url?: string; author_name?: string } | null> {
  return fetchJson<{ title?: string; thumbnail_url?: string; author_name?: string }>(url, { timeoutMs: META_TIMEOUT_MS })
}

/**
 * Everything we can learn about a post without the member typing anything.
 *
 * Never throws. A platform outage costs a title and a thumbnail, not the post.
 */
export async function fetchClipMeta(parsed: ParsedClip): Promise<ClipMeta> {
  try {
    if (parsed.platform === 'youtube') {
      const [info, seconds] = await Promise.all([
        oembed(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(parsed.canonicalUrl)}`),
        youtubeSeconds(parsed.videoId),
      ])
      return {
        title: String(info?.title ?? '').slice(0, 120),
        thumbnailUrl: String(info?.thumbnail_url ?? ''),
        authorName: String(info?.author_name ?? '').slice(0, 60),
        seconds,
      }
    }

    if (parsed.platform === 'tiktok') {
      // TikTok's oEmbed is public and unauthenticated, and carries a title,
      // author and thumbnail — but no duration field.
      const info = await oembed(`https://www.tiktok.com/oembed?url=${encodeURIComponent(parsed.canonicalUrl)}`)
      return {
        title: String(info?.title ?? '').slice(0, 120),
        thumbnailUrl: String(info?.thumbnail_url ?? ''),
        authorName: String(info?.author_name ?? '').slice(0, 60),
        seconds: null,
      }
    }

    // Instagram's oEmbed needs a Facebook app token, so there is nothing to call
    // without one. Returning empty is honest; the clip still airs.
    return EMPTY
  } catch {
    return EMPTY
  }
}


/**
 * Resolve a TikTok/YouTube short link to the post it points at.
 *
 * `vm.tiktok.com/ZGxxxx` and `youtu.be/xyz` are what the share sheet on a phone
 * actually produces, so they are what members actually paste. `parseClipUrl` is
 * pure and cannot make a network call, so it rejects the TikTok ones outright —
 * which meant the single most common way to share a TikTok was answered with
 * "open it first so we get the real one". That is a correct sentence and a
 * terrible experience on the core action of the product.
 *
 * So this does the round trip: follow the redirect, hand the destination back
 * to the parser. Deliberately narrow — it only ever follows hosts we already
 * know are short-link services for platforms we support, so it cannot be used
 * to make the server fetch an arbitrary URL somebody pasted.
 *
 * Best effort. Returns the input unchanged on any failure, and the caller then
 * fails exactly as it did before.
 */
const SHORT_LINK_HOSTS = new Set(['vm.tiktok.com', 'vt.tiktok.com', 'm.tiktok.com'])

export async function resolveShortLink(input: string): Promise<string> {
  const raw = String(input ?? '').trim()
  if (!raw) return raw

  let url: URL
  try {
    url = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
  } catch {
    return raw
  }
  if (url.protocol !== 'https:') return raw
  if (!SHORT_LINK_HOSTS.has(url.hostname.replace(/^www\./i, '').toLowerCase())) return raw

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    // `redirect: 'follow'` and read `res.url` — HEAD is refused by TikTok's
    // edge, so this is a GET whose body we never read.
    const res = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CSGNBot/1.0; +https://csgn.fun)' },
    })
    clearTimeout(timer)
    const finalUrl = String(res.url || '')
    // Only accept a destination on the platform we expected. A short link that
    // redirects somewhere else is not a clip, it is a redirect chain, and
    // following it into the parser would be trusting an open redirect.
    if (/^https:\/\/(www\.)?tiktok\.com\//i.test(finalUrl)) return finalUrl
    return raw
  } catch {
    return raw
  }
}
