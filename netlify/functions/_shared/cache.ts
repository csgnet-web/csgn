/**
 * COST AND BLAST-RADIUS CONTROL for serverless handlers.
 *
 * Three primitives, each fixing a specific way this backend would fall over
 * under load or under attack:
 *
 *   1. `memo` — a per-container TTL cache. Read endpoints that answer the same
 *      question for everybody should hit Firestore once per TTL, not once per
 *      request. Before this, `publicProfiles` read ~72 documents PER CALL at a
 *      60/min rate limit, so a single IP could bill 4,300 reads a minute
 *      without doing anything unusual. That's not a traffic problem, it's an
 *      invoice with a URL.
 *
 *   2. `fetchJson` — every outbound call with a HARD TIMEOUT. Netlify bills
 *      wall-clock and kills the invocation at its limit. A hanging DexScreener
 *      or Solana RPC connection therefore doesn't fail fast, it burns the whole
 *      budget and then fails anyway. Nothing in this codebase should ever call
 *      bare `fetch` against a third party again.
 *
 *   3. `singleFlight` — collapse concurrent identical work. When a cache entry
 *      expires under load, every in-flight request misses at once and they all
 *      stampede the same expensive read. One does the work; the rest await it.
 *
 * All three are per-container. Netlify runs many containers, so these reduce
 * cost and latency — they are NOT a correctness boundary, and nothing that
 * decides money or permissions may depend on them. Rate limiting keeps its
 * Firestore source of truth for exactly that reason.
 */

/* ─── TTL cache ─── */

interface Entry<T> { value: T; expiresAt: number }

const store = new Map<string, Entry<unknown>>()

/** Hard ceiling on distinct keys, so a cache can never become the memory leak
 *  that kills the container. Cleared wholesale rather than LRU-evicted: this is
 *  a cache, and the simplest eviction that can't leak is the right one. */
const MAX_ENTRIES = 500

export function cacheGet<T>(key: string, nowMs = Date.now()): T | undefined {
  const hit = store.get(key)
  if (!hit) return undefined
  if (hit.expiresAt <= nowMs) {
    store.delete(key)
    return undefined
  }
  return hit.value as T
}

export function cacheSet<T>(key: string, value: T, ttlMs: number, nowMs = Date.now()): T {
  if (store.size >= MAX_ENTRIES) store.clear()
  store.set(key, { value, expiresAt: nowMs + Math.max(0, ttlMs) })
  return value
}

/** Test seam, and the escape hatch when a write must invalidate a read. */
export const cacheClear = (key?: string): void => {
  if (key) store.delete(key)
  else store.clear()
}

export const cacheSize = (): number => store.size

/* ─── Single-flight ─── */

const inFlight = new Map<string, Promise<unknown>>()

/**
 * Run `work` once per key while it's in flight; concurrent callers share the
 * result. The `finally` cleanup is what stops a rejected promise being cached
 * forever — a transient failure must not become a permanent one.
 */
export function singleFlight<T>(key: string, work: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key) as Promise<T> | undefined
  if (existing) return existing
  const promise = work().finally(() => inFlight.delete(key))
  inFlight.set(key, promise)
  return promise
}

/**
 * Cached + de-duplicated read. The shape every hot GET handler should use.
 *
 * A failed load is NOT cached — the next request retries. Caching failures
 * turns a one-second blip into a full TTL of outage, which is the classic way a
 * cache makes an incident worse instead of better.
 */
export async function memo<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cacheGet<T>(key)
  if (hit !== undefined) return hit
  return singleFlight(key, async () => {
    const fresh = await load()
    return cacheSet(key, fresh, ttlMs)
  })
}

/* ─── Bounded outbound fetch ─── */

/** Default ceiling for any third-party call. Comfortably under every function's
 *  wall clock, so a dead upstream fails fast enough to still return an answer. */
export const DEFAULT_FETCH_TIMEOUT_MS = 6_000
/** Response bodies larger than this are refused unread. A third party — or
 *  something pretending to be one — must not be able to exhaust our memory. */
export const MAX_RESPONSE_BYTES = 2_000_000

export interface FetchJsonOptions {
  timeoutMs?: number
  method?: string
  headers?: Record<string, string>
  body?: string
}

/**
 * JSON fetch with a hard timeout and a response-size ceiling.
 *
 * Returns null on ANY failure — timeout, non-2xx, unparseable body, oversized
 * body. Callers get one branch to handle instead of four, and the poller can
 * degrade a single feed without taking the whole run down with it. When a
 * caller genuinely needs to distinguish failures (payment verification does),
 * it should not be using this.
 */
export async function fetchJson<T>(url: string, opts: FetchJsonOptions = {}): Promise<T | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers: opts.headers,
      body: opts.body,
      signal: controller.signal,
    })
    if (!res.ok) return null

    const declared = Number(res.headers.get('content-length') || 0)
    if (declared > MAX_RESPONSE_BYTES) return null

    const text = await res.text()
    // Re-check after reading: content-length is a hint, not a guarantee.
    if (text.length > MAX_RESPONSE_BYTES) return null
    return JSON.parse(text) as T
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
