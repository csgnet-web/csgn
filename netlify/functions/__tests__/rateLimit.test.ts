import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../_shared/firebaseAdmin', () => ({
  getDoc: vi.fn(),
  writeDoc: vi.fn(),
}))

import { getDoc, writeDoc } from '../_shared/firebaseAdmin'
import { clientIp, checkRateLimit } from '../_shared/rateLimit'
import { HttpError } from '../_shared/errors'
import type { HandlerEvent } from '../_shared/http'

const mockedGetDoc = vi.mocked(getDoc)
const mockedWriteDoc = vi.mocked(writeDoc)

function event(headers: Record<string, string>): HandlerEvent {
  return { headers } as unknown as HandlerEvent
}

describe('clientIp', () => {
  it('prefers the Netlify-set header over spoofable x-forwarded-for', () => {
    expect(clientIp(event({
      'x-nf-client-connection-ip': '203.0.113.9',
      'x-forwarded-for': '6.6.6.6, 203.0.113.9',
    }))).toBe('203.0.113.9')
  })

  it('falls back to the first x-forwarded-for hop', () => {
    expect(clientIp(event({ 'x-forwarded-for': '198.51.100.4, 10.0.0.1' }))).toBe('198.51.100.4')
  })

  it('returns unknown when no header is present', () => {
    expect(clientIp(event({}))).toBe('unknown')
  })
})

describe('checkRateLimit', () => {
  beforeEach(() => {
    mockedGetDoc.mockReset()
    mockedWriteDoc.mockReset()
    mockedGetDoc.mockResolvedValue(null)
    mockedWriteDoc.mockResolvedValue(undefined)
  })

  it('writes an expiresAt Date so rateLimits docs are TTL-cleanable', async () => {
    await checkRateLimit('1.1.1.1', 'ttl-check', 5)
    expect(mockedWriteDoc).toHaveBeenCalledTimes(1)
    const payload = mockedWriteDoc.mock.calls[0][1] as Record<string, unknown>
    expect(payload.expiresAt).toBeInstanceOf(Date)
    expect((payload.expiresAt as Date).getTime()).toBeGreaterThan(Date.now())
  })

  it('rejects via the Firestore counter when the shared count is at the limit', async () => {
    mockedGetDoc.mockResolvedValue({ count: 5, windowStart: Date.now(), endpoint: 'shared' })
    await expect(checkRateLimit('2.2.2.2', 'shared', 5)).rejects.toMatchObject({ status: 429, code: 'rate_limit_exceeded' })
    expect(mockedWriteDoc).not.toHaveBeenCalled()
  })

  it('stops billing Firestore once the in-memory counter trips', async () => {
    const limit = 3
    for (let i = 0; i < limit; i++) {
      await checkRateLimit('3.3.3.3', 'flood', limit)
    }
    expect(mockedGetDoc).toHaveBeenCalledTimes(limit)

    // Flood: every further call must be rejected before any Firestore I/O.
    for (let i = 0; i < 5; i++) {
      await expect(checkRateLimit('3.3.3.3', 'flood', limit)).rejects.toBeInstanceOf(HttpError)
    }
    expect(mockedGetDoc).toHaveBeenCalledTimes(limit)
  })

  it('keeps counters per ip:endpoint pair', async () => {
    const limit = 1
    await checkRateLimit('4.4.4.4', 'pair-a', limit)
    await expect(checkRateLimit('4.4.4.4', 'pair-a', limit)).rejects.toBeInstanceOf(HttpError)
    await expect(checkRateLimit('4.4.4.4', 'pair-b', limit)).resolves.toBeUndefined()
    await expect(checkRateLimit('5.5.5.5', 'pair-a', limit)).resolves.toBeUndefined()
  })
})
