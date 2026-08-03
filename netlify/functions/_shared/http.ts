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
