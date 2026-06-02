import { createHash } from 'node:crypto'
import { getDoc, writeDoc } from './firebaseAdmin'
import { HttpError } from './errors'
import type { HandlerEvent } from './http'

interface RateLimitDoc {
  count: number
  windowStart: number
  endpoint: string
}

export function clientIp(event: HandlerEvent): string {
  const forwarded = event.headers['x-forwarded-for'] || event.headers['x-nf-client-connection-ip'] || ''
  return forwarded.split(',')[0].trim() || 'unknown'
}

export async function checkRateLimit(ip: string, endpoint: string, limit: number, windowSeconds = 60): Promise<void> {
  const hash = createHash('sha256').update(`${ip}:${endpoint}`).digest('hex').slice(0, 32)
  const key = `rateLimits/${hash}`
  const now = Date.now()

  const doc = await getDoc<RateLimitDoc>(key)

  if (!doc || now - doc.windowStart > windowSeconds * 1000) {
    await writeDoc(key, { count: 1, windowStart: now, endpoint }, { merge: true })
    return
  }

  if (doc.count >= limit) {
    throw new HttpError(429, 'rate_limit_exceeded', 'Too many requests. Please try again later.')
  }

  await writeDoc(key, { count: doc.count + 1, windowStart: doc.windowStart, endpoint }, { merge: true })
}
