// Twitch Helix access, shared by every function that needs it.
//
// Lifted out of feePollerBackground so the app token has ONE cache and one
// refresh path. The poller used to keep its own module-level token variable;
// anything else that wanted Helix would have written a second one, and two
// caches means two token requests per container for a credential that is valid
// for weeks.
//
// Everything here answers with `null` on failure rather than throwing. A Helix
// outage must degrade one sample, never take down the run that also drives fee
// accrual and slot lifecycle.

import { cacheGet, cacheSet, singleFlight, fetchJson } from './cache'

const TOKEN_CACHE_KEY = 'twitch:appToken'
/** Refresh a minute early so a sample never rides an about-to-expire token. */
const TOKEN_SKEW_MS = 60_000

/**
 * Client-credentials app token. No user context, no scopes — which is exactly
 * why it can read public channel state without sending anyone through a second
 * consent screen.
 *
 * Uses the cache primitives rather than `memo()` directly for two reasons:
 * Twitch tells us the real lifetime in `expires_in`, and a FAILED token fetch
 * must not be cached — caching it would turn a one-second blip at id.twitch.tv
 * into a full TTL with no live sampling at all.
 */
export async function twitchAppToken(): Promise<string | null> {
  const clientId = process.env.TWITCH_CLIENT_ID
  const clientSecret = process.env.TWITCH_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  const cached = cacheGet<string>(TOKEN_CACHE_KEY)
  if (cached) return cached

  return singleFlight(TOKEN_CACHE_KEY, async () => {
    const data = await fetchJson<{ access_token?: string; expires_in?: number }>(
      'https://id.twitch.tv/oauth2/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' }).toString(),
      },
    )
    if (!data?.access_token) return null
    const ttlMs = Math.max(0, (data.expires_in ?? 3600) * 1000 - TOKEN_SKEW_MS)
    return cacheSet(TOKEN_CACHE_KEY, data.access_token, ttlMs)
  })
}

/** The twitch login inside a channel URL, or null if it isn't a Twitch URL. */
export function twitchLoginFromUrl(url?: string): string | null {
  if (!url) return null
  const match = String(url).match(/twitch\.tv\/([^/?#]+)/i)
  return match ? match[1].replace(/^@/, '').toLowerCase() : null
}

/** One sample of a channel's broadcast state. `live: false` is a real answer —
 *  Helix said the channel is offline — as distinct from `null`, below. */
export interface TwitchStreamSample {
  live: boolean
  viewerCount: number
  title: string
  gameName: string
  startedAt: string
}

/**
 * Sample one channel's current broadcast state.
 *
 * Returns null when we could not get an answer at all (no token, Helix down,
 * request timed out). Callers MUST NOT read that as "offline": a sample that
 * never happened is our problem, and counting it against the streamer is the
 * exact failure the airtime denominator exists to avoid.
 *
 * The response already carries viewers, title, game and start time on the same
 * request that answers live/not-live, so we keep all of it — this used to
 * reduce the whole payload to `data.length > 0` and throw the rest away.
 */
export async function sampleTwitchStream(login: string, token: string): Promise<TwitchStreamSample | null> {
  const data = await fetchJson<{ data?: Array<{ viewer_count?: number; title?: string; game_name?: string; started_at?: string; type?: string }> }>(
    `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(login)}`,
    { headers: { 'Client-Id': process.env.TWITCH_CLIENT_ID || '', Authorization: `Bearer ${token}` } },
  )
  if (!data || !Array.isArray(data.data)) return null

  const stream = data.data[0]
  if (!stream) return { live: false, viewerCount: 0, title: '', gameName: '', startedAt: '' }
  return {
    live: true,
    viewerCount: Math.max(0, Number(stream.viewer_count) || 0),
    title: String(stream.title || '').slice(0, 140),
    gameName: String(stream.game_name || '').slice(0, 60),
    startedAt: String(stream.started_at || ''),
  }
}


/**
 * Sample MANY channels in one request.
 *
 * Helix accepts up to 100 `user_login` parameters per call, which is the whole
 * reason a permanently-on live roster is affordable: watching every member of
 * the network costs one request per 100 members per minute, not one per member.
 * Sampling them individually would put the network's own rate limit between us
 * and knowing who is on.
 *
 * Returns a map keyed by the lowercased login. A login ABSENT from the map was
 * not answered for — same distinction as `sampleTwitchStream` returning null,
 * and just as important: an unanswered channel must never be recorded as
 * offline, because those samples decide who gets paid.
 */
export async function sampleTwitchStreams(
  logins: string[],
  token: string,
): Promise<Map<string, TwitchStreamSample>> {
  const out = new Map<string, TwitchStreamSample>()
  const clean = [...new Set(logins.map((l) => String(l || '').trim().toLowerCase()).filter(Boolean))]

  for (let i = 0; i < clean.length; i += 100) {
    const batch = clean.slice(i, i + 100)
    const qs = batch.map((l) => `user_login=${encodeURIComponent(l)}`).join('&')
    const data = await fetchJson<{ data?: Array<{ user_login?: string; viewer_count?: number; title?: string; game_name?: string; started_at?: string }> }>(
      `https://api.twitch.tv/helix/streams?${qs}`,
      { headers: { 'Client-Id': process.env.TWITCH_CLIENT_ID || '', Authorization: `Bearer ${token}` } },
    )
    // A batch we could not read leaves its logins out of the map entirely.
    // Marking them offline here would silently zero the airtime of everyone in
    // a batch that happened to time out.
    if (!data || !Array.isArray(data.data)) continue

    const liveNow = new Set<string>()
    for (const stream of data.data) {
      const login = String(stream.user_login || '').toLowerCase()
      if (!login) continue
      liveNow.add(login)
      out.set(login, {
        live: true,
        viewerCount: Math.max(0, Number(stream.viewer_count) || 0),
        title: String(stream.title || '').slice(0, 140),
        gameName: String(stream.game_name || '').slice(0, 60),
        startedAt: String(stream.started_at || ''),
      })
    }
    // Helix omits offline channels from the response rather than listing them,
    // so every login in a batch we DID read and did not get back is genuinely
    // offline — a real answer, not a missing one.
    for (const login of batch) {
      if (!liveNow.has(login)) out.set(login, { live: false, viewerCount: 0, title: '', gameName: '', startedAt: '' })
    }
  }

  return out
}
