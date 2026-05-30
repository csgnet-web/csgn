import { HttpError } from './errors'

export interface HandlerEvent { httpMethod: string; headers: Record<string, string | undefined>; body: string | null; queryStringParameters?: Record<string, string | undefined> | null }
export interface HandlerResponse { statusCode: number; headers?: Record<string, string>; body: string }
export type Handler = (event: HandlerEvent) => Promise<HandlerResponse> | HandlerResponse

export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': process.env.CSGN_ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
  }
}

export function json(statusCode: number, data: unknown): HandlerResponse {
  return { statusCode, headers: { ...corsHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(data) }
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

export function parseJson<T = Record<string, unknown>>(event: HandlerEvent): T {
  if (!event.body) return {} as T
  return JSON.parse(event.body) as T
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
