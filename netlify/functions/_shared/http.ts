import { HttpError } from './errors'

export interface HandlerEvent { httpMethod: string; headers: Record<string, string | undefined>; body: string | null; queryStringParameters?: Record<string, string | undefined> | null }
export interface HandlerResponse { statusCode: number; headers?: Record<string, string>; body: string }
export type Handler = (event: HandlerEvent) => Promise<HandlerResponse> | HandlerResponse

export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': process.env.CSGN_ALLOWED_ORIGIN || '',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
  }
}

export function json(statusCode: number, data: unknown, extraHeaders: Record<string, string> = {}): HandlerResponse {
  return {
    statusCode,
    headers: { ...corsHeaders(), 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(data),
  }
}

/**
 * A PUBLIC READ THAT THE CDN CAN SERVE WITHOUT WAKING A FUNCTION.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 *
 * Netlify bills function invocations and the wall clock they burn. Several
 * endpoints here answer the SAME question for everybody — the Meme 100, who is
 * live on the roster, the recommended-profiles rail — and each of them was
 * being invoked once per viewer per poll. Two hundred people with /watch open
 * is two hundred invocations a minute for one identical JSON body.
 *
 * `memo()` in cache.ts already stops that becoming Firestore reads, but a memo
 * hit is still a container being started and billed. This stops the request
 * reaching a container at all: the edge holds the body and serves it.
 *
 * ── The two headers ────────────────────────────────────────────────────────
 *
 *   Cache-Control              — what the VIEWER'S BROWSER may keep.
 *   Netlify-CDN-Cache-Control  — what the EDGE may keep, and for how long it
 *                                may keep serving a stale copy while it
 *                                refreshes in the background.
 *
 * They are separate on purpose. A short browser TTL keeps a member from seeing
 * their own action fail to appear; a longer edge TTL with stale-while-
 * revalidate is what actually collapses the invocation count, because the first
 * request after expiry is served instantly from the stale copy and exactly one
 * background refresh is triggered.
 *
 * ── NEVER use this for ─────────────────────────────────────────────────────
 *
 * Anything that varies by caller. A per-user balance, a member's own reel, an
 * admin queue. Caching one member's answer and serving it to the next is not a
 * performance bug, it is a data leak, and it is the reason this helper is a
 * separate named function rather than a flag on `json()`.
 */
export function cachedJson(
  data: unknown,
  { browserSeconds = 15, edgeSeconds = 60, staleSeconds = 300 }: {
    browserSeconds?: number
    edgeSeconds?: number
    staleSeconds?: number
  } = {},
): HandlerResponse {
  return json(200, data, {
    'Cache-Control': `public, max-age=${browserSeconds}`,
    'Netlify-CDN-Cache-Control': `public, s-maxage=${edgeSeconds}, stale-while-revalidate=${staleSeconds}`,
  })
}

/** The opposite, said explicitly. For a response that is correct only for the
 *  caller who asked, or only at the instant it was produced. */
export function uncachedJson(statusCode: number, data: unknown): HandlerResponse {
  return json(statusCode, data, { 'Cache-Control': 'no-store' })
}

export function html(statusCode: number, body: string): HandlerResponse {
  return { statusCode, headers: { ...corsHeaders(), 'Content-Type': 'text/html; charset=utf-8' }, body }
}

export function noContent(): HandlerResponse {
  return { statusCode: 204, headers: corsHeaders(), body: '' }
}

export function redirect(location: string): HandlerResponse {
  return { statusCode: 302, headers: { ...corsHeaders(), Location: location, 'Cache-Control': 'no-store' }, body: '' }
}

/**
 * Largest request body any endpoint accepts. Every real payload here is a few
 * hundred bytes — a proof token, a slot id, a mint. Without a ceiling, a caller
 * can post megabytes and make us pay to parse it, repeatedly, inside the rate
 * limit. Cheapest possible DoS, and the cheapest possible fix.
 */
export const MAX_BODY_BYTES = 16_000

/**
 * Parse a JSON body, bounded and non-throwing.
 *
 * Malformed JSON returns a 400 rather than a 500. That distinction matters
 * beyond tidiness: a 500 says we broke, gets logged as an incident, and hides
 * real failures in the noise — when what actually happened is that somebody
 * sent us junk, which is not an outage.
 */
export function parseJson<T = Record<string, unknown>>(event: HandlerEvent): T {
  if (!event.body) return {} as T
  if (event.body.length > MAX_BODY_BYTES) {
    throw new HttpError(413, 'body_too_large', 'Request body is too large.')
  }
  try {
    const parsed = JSON.parse(event.body)
    // Guard against `null`, arrays and primitives — every handler destructures
    // this as an object, and `null.field` is a 500 with a stack trace.
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new HttpError(400, 'invalid_body', 'Request body must be a JSON object.')
    }
    return parsed as T
  } catch (err) {
    if (err instanceof HttpError) throw err
    throw new HttpError(400, 'invalid_json', 'Request body is not valid JSON.')
  }
}

export function withHttp(handler: Handler): Handler {
  return async (event) => {
    try {
      if (event.httpMethod === 'OPTIONS') return noContent()
      return await handler(event)
    } catch (err) {
      if (err instanceof HttpError) return json(err.status, { error: err.code, message: err.message })
      console.error(err)
      return json(500, { error: 'internal_error', message: 'Internal server error' })
    }
  }
}

export function requireMethod(event: HandlerEvent, method: string): void {
  if (event.httpMethod !== method) throw new HttpError(405, 'method_not_allowed', 'Method not allowed')
}

export function bearerToken(event: HandlerEvent): string | null {
  const header = event.headers.authorization || event.headers.Authorization
  const match = header?.match(/^Bearer\s+(.+)$/i)
  return match?.[1] || null
}
