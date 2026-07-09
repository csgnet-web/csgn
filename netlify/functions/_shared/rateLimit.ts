import { createHash } from 'node:crypto'
import { getDoc, writeDoc } from './firebaseAdmin'
import { HttpError } from './errors'
import type { HandlerEvent } from './http'

interface RateLimitDoc {
  count: number
  windowStart: number
  endpoint: string
}

/** rateLimits docs self-clean via the Firestore TTL policy on expiresAt. */
const RATE_LIMIT_DOC_TTL_MS = 24 * 60 * 60 * 1000

export function clientIp(event: HandlerEvent): string {
  // x-nf-client-connection-ip is set by Netlify's edge and can't be forged by
  // the caller; x-forwarded-for's first hop is client-supplied and spoofable,
  // so it is only a fallback.
  const nf = event.headers['x-nf-client-connection-ip']
  if (nf && nf.trim()) return nf.trim()
  return (event.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown'
}

/**
 * Per-container pre-filter: once an ip:endpoint pair has been seen `limit`
 * times inside the window, reject before any Firestore I/O. Without this, a
 * flood of already-blocked requests still bills 1 read per request. The
 * Firestore doc below remains the cross-container source of truth.
 */
const memCounters = new Map<string, { count: number; windowStart: number }>()
const MEM_COUNTERS_MAX = 5000

const rateLimitError = () => new HttpError(429, 'rate_limit_exceeded', 'Too many requests. Please try again later.')

export async function checkRateLimit(ip: string, endpoint: string, limit: number, windowSeconds = 60): Promise<void> {
  const now = Date.now()
  const memKey = `${ip}:${endpoint}`
  const mem = memCounters.get(memKey)
  if (mem && now - mem.windowStart <= windowSeconds * 1000) {
    if (mem.count >= limit) throw rateLimitError()
    mem.count += 1
  } else {
    if (memCounters.size >= MEM_COUNTERS_MAX) memCounters.clear()
    memCounters.set(memKey, { count: 1, windowStart: now })
  }

  const hash = createHash('sha256').update(memKey).digest('hex').slice(0, 32)
  const key = `rateLimits/${hash}`

  const doc = await getDoc<RateLimitDoc>(key)

  if (!doc || now - doc.windowStart > windowSeconds * 1000) {
    await writeDoc(key, { count: 1, windowStart: now, endpoint, expiresAt: new Date(now + RATE_LIMIT_DOC_TTL_MS) }, { merge: true })
    return
  }

  if (doc.count >= limit) {
    throw rateLimitError()
  }

  await writeDoc(key, { count: doc.count + 1, windowStart: doc.windowStart, endpoint, expiresAt: new Date(now + RATE_LIMIT_DOC_TTL_MS) }, { merge: true })
}
