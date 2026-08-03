import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  cacheGet, cacheSet, cacheClear, cacheSize, memo, singleFlight, fetchJson,
  MAX_RESPONSE_BYTES,
} from '../_shared/cache'

beforeEach(() => cacheClear())
afterEach(() => vi.restoreAllMocks())

describe('the TTL cache', () => {
  it('returns a stored value inside its TTL', () => {
    cacheSet('k', { a: 1 }, 1000, 0)
    expect(cacheGet('k', 500)).toEqual({ a: 1 })
  })

  it('expires exactly at the TTL boundary, not after it', () => {
    cacheSet('k', 'v', 1000, 0)
    expect(cacheGet('k', 999)).toBe('v')
    expect(cacheGet('k', 1000)).toBeUndefined()
  })

  it('evicts an expired entry rather than leaving it to accumulate', () => {
    cacheSet('k', 'v', 10, 0)
    cacheGet('k', 100)
    expect(cacheSize()).toBe(0)
  })

  it('misses cleanly on an unknown key', () => {
    expect(cacheGet('nope')).toBeUndefined()
  })

  it('can store falsy values without them reading as a miss', () => {
    cacheSet('zero', 0, 1000, 0)
    cacheSet('empty', '', 1000, 0)
    expect(cacheGet('zero', 1)).toBe(0)
    expect(cacheGet('empty', 1)).toBe('')
  })

  it('clears one key or all of them', () => {
    cacheSet('a', 1, 1000, 0)
    cacheSet('b', 2, 1000, 0)
    cacheClear('a')
    expect(cacheGet('a', 1)).toBeUndefined()
    expect(cacheGet('b', 1)).toBe(2)
    cacheClear()
    expect(cacheSize()).toBe(0)
  })

  it('is BOUNDED — a cache must never become the memory leak that kills the container', () => {
    for (let i = 0; i < 600; i++) cacheSet(`k${i}`, i, 60_000, 0)
    expect(cacheSize()).toBeLessThanOrEqual(500)
  })
})

describe('single-flight', () => {
  it('runs the work once for concurrent callers and shares the result', async () => {
    const work = vi.fn(async () => 'done')
    const [a, b, c] = await Promise.all([
      singleFlight('k', work), singleFlight('k', work), singleFlight('k', work),
    ])
    expect(work).toHaveBeenCalledOnce()
    expect([a, b, c]).toEqual(['done', 'done', 'done'])
  })

  it('runs again after the first settles — it de-dupes, it does not cache', async () => {
    const work = vi.fn(async () => 'x')
    await singleFlight('k', work)
    await singleFlight('k', work)
    expect(work).toHaveBeenCalledTimes(2)
  })

  it('does NOT wedge on a rejection — a blip must not become permanent', async () => {
    const failing = vi.fn(async () => { throw new Error('boom') })
    await expect(singleFlight('k', failing)).rejects.toThrow('boom')
    const ok = vi.fn(async () => 'recovered')
    await expect(singleFlight('k', ok)).resolves.toBe('recovered')
  })

  it('keeps different keys independent', async () => {
    const a = vi.fn(async () => 'a')
    const b = vi.fn(async () => 'b')
    await Promise.all([singleFlight('a', a), singleFlight('b', b)])
    expect(a).toHaveBeenCalledOnce()
    expect(b).toHaveBeenCalledOnce()
  })
})

describe('memo', () => {
  it('loads once and serves the cache after that', async () => {
    const load = vi.fn(async () => ({ n: 1 }))
    expect(await memo('k', 60_000, load)).toEqual({ n: 1 })
    expect(await memo('k', 60_000, load)).toEqual({ n: 1 })
    expect(load).toHaveBeenCalledOnce()
  })

  it('collapses a concurrent stampede into ONE load', async () => {
    // The failure this prevents: a cache expiring under load, and every
    // in-flight request missing at once and hitting Firestore together.
    const load = vi.fn(async () => 'v')
    await Promise.all(Array.from({ length: 25 }, () => memo('k', 60_000, load)))
    expect(load).toHaveBeenCalledOnce()
  })

  it('does NOT cache a failure — one bad second must not become a full TTL of outage', async () => {
    const failing = vi.fn(async () => { throw new Error('upstream down') })
    await expect(memo('k', 60_000, failing)).rejects.toThrow()
    const ok = vi.fn(async () => 'back')
    expect(await memo('k', 60_000, ok)).toBe('back')
  })

  it('reloads once the TTL lapses', async () => {
    const load = vi.fn(async () => 'v')
    await memo('k', 1, load)
    await new Promise((r) => setTimeout(r, 5))
    await memo('k', 1, load)
    expect(load).toHaveBeenCalledTimes(2)
  })
})

describe('fetchJson', () => {
  const mockFetch = (impl: (url: string, init: RequestInit) => Promise<Response>) => {
    vi.stubGlobal('fetch', vi.fn(impl))
  }
  const jsonResponse = (body: unknown, headers: Record<string, string> = {}) =>
    ({ ok: true, headers: new Headers(headers), text: async () => JSON.stringify(body) }) as Response

  it('parses a good response', async () => {
    mockFetch(async () => jsonResponse({ hello: 'world' }))
    expect(await fetchJson('https://x.test')).toEqual({ hello: 'world' })
  })

  it('ALWAYS passes an abort signal — an unbounded call burns the whole invocation', async () => {
    let seen: RequestInit | undefined
    mockFetch(async (_u, init) => { seen = init; return jsonResponse({}) })
    await fetchJson('https://x.test')
    expect(seen?.signal).toBeDefined()
  })

  it('returns null on a non-2xx instead of throwing', async () => {
    mockFetch(async () => ({ ok: false, headers: new Headers(), text: async () => '' }) as Response)
    expect(await fetchJson('https://x.test')).toBeNull()
  })

  it('returns null on unparseable JSON', async () => {
    mockFetch(async () => ({ ok: true, headers: new Headers(), text: async () => 'not json' }) as Response)
    expect(await fetchJson('https://x.test')).toBeNull()
  })

  it('returns null when the network throws or the request aborts', async () => {
    mockFetch(async () => { throw new Error('ECONNRESET') })
    expect(await fetchJson('https://x.test')).toBeNull()
  })

  it('refuses an oversized body by declared content-length, unread', async () => {
    const text = vi.fn(async () => '{}')
    mockFetch(async () => ({
      ok: true,
      headers: new Headers({ 'content-length': String(MAX_RESPONSE_BYTES + 1) }),
      text,
    }) as unknown as Response)
    expect(await fetchJson('https://x.test')).toBeNull()
    expect(text).not.toHaveBeenCalled()
  })

  it('refuses an oversized body that LIED about its content-length', async () => {
    mockFetch(async () => ({
      ok: true,
      headers: new Headers({ 'content-length': '10' }),
      text: async () => 'x'.repeat(MAX_RESPONSE_BYTES + 1),
    }) as unknown as Response)
    expect(await fetchJson('https://x.test')).toBeNull()
  })

  it('forwards method, headers and body for POST calls', async () => {
    let seen: RequestInit | undefined
    mockFetch(async (_u, init) => { seen = init; return jsonResponse({ ok: true }) })
    await fetchJson('https://x.test', { method: 'POST', headers: { 'X-A': '1' }, body: '{"a":1}' })
    expect(seen?.method).toBe('POST')
    expect(seen?.body).toBe('{"a":1}')
  })
})
