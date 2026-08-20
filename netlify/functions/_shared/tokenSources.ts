/**
 * WHERE THE MEME 100 GETS ITS COINS.
 *
 * ── Why this file exists ───────────────────────────────────────────────────
 *
 * The board shipped three times and came back with two coins each time. Each
 * round I fixed a real bug — thresholds too strict, then a re-fetch that
 * starved enrichment — and each time the board stayed empty, because the actual
 * problem was upstream of all of it:
 *
 *   **DexScreener's `/latest/dex/search` was never a top-100 source.**
 *
 * It is a SEARCH endpoint. It returns a capped handful of pairs matching a
 * string, across every chain, dominated by the same majors whatever you ask
 * for. Seventeen search terms against it produce a few dozen distinct Solana
 * mints, most of them the same ones. No amount of threshold tuning turns that
 * into a hundred names, because the hundred names were never in the response.
 *
 * So discovery is now built on sources that are actually FOR this: endpoints
 * whose entire job is "the top N Solana tokens right now".
 *
 * ── The design rule ────────────────────────────────────────────────────────
 *
 * EVERY SOURCE IS INDEPENDENT AND OPTIONAL. Each returns what it can and null
 * on any failure; the board is the union of whatever answered. One provider
 * being down, rate-limiting, or changing its response shape costs us that
 * provider's coins and nothing else.
 *
 * That is not defensive over-engineering — it is the direct lesson of this bug.
 * A single-source pipeline gave no signal about WHY it was empty, and three
 * separate fixes went into the wrong layer as a result. Every source now
 * reports how many coins it contributed, published on the board document, so
 * "which of these is broken" is a question the data answers.
 *
 * ── Parsing is deliberately lenient ────────────────────────────────────────
 *
 * Field names are read with fallbacks (`usdPrice` OR `price`, `mcap` OR
 * `marketCap` OR `fdv`). These are third-party APIs that version without
 * telling anybody, and a renamed field should cost us one number rather than
 * the whole source. Anything unparseable becomes zero and gets filtered by the
 * quality gates downstream, which is exactly where that decision belongs.
 */
import { fetchJson } from './cache'

/** The shape the board pipeline works in. Deliberately DexScreener-flavoured,
 *  because that is what the enrichment path already produces — every other
 *  source is adapted into it rather than the pipeline learning three shapes. */
export interface SourcePair {
  chainId?: string
  pairCreatedAt?: number
  baseToken?: { address?: string; symbol?: string; name?: string }
  priceUsd?: string
  marketCap?: number
  fdv?: number
  volume?: { h24?: number }
  priceChange?: { h24?: number }
  url?: string
  liquidity?: { usd?: number }
  info?: { imageUrl?: string }
}

export interface SourceResult {
  /** Human name, for the diagnostics published on the board. */
  source: string
  pairs: Map<string, SourcePair>
  /** Null when the source could not be reached or returned nothing usable. */
  ok: boolean
  note?: string
}

const SOLANA_MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const num = (...candidates: unknown[]): number => {
  for (const c of candidates) {
    const n = Number(c)
    if (Number.isFinite(n) && n !== 0) return n
  }
  return 0
}

/* ─────────────────────────────────────────────────────────────────────────
   JUPITER — the primary source.

   Jupiter's token API v2 has endpoints whose entire purpose is "the top N
   Solana tokens right now", ranked, with market stats attached. One request
   returns a hundred tokens with price, market cap, liquidity, 24h volume and
   24h change already on them — which is both the right data and roughly a
   twentieth of the requests the old path made to assemble worse data.

   `toporganicscore` is the interesting one: Jupiter scores tokens by ORGANIC
   trading — filtering wash volume and bot churn — which is very close to the
   judgement the Meme 100 is trying to make, arrived at by somebody with far
   more data than we have. `toptraded` is the raw-volume companion, used as a
   second pass so a coin trading hard without a good organic score can still
   appear and be ranked on our own terms.

   Public, no API key. If the shape changes, the lenient parsing below costs us
   fields rather than the source.
   ───────────────────────────────────────────────────────────────────────── */

const JUPITER_BASE = 'https://lite-api.jup.ag/tokens/v2'

interface JupToken {
  id?: string
  address?: string
  symbol?: string
  name?: string
  icon?: string
  logoURI?: string
  usdPrice?: number
  price?: number
  mcap?: number
  marketCap?: number
  fdv?: number
  liquidity?: number
  holderCount?: number
  organicScore?: number
  firstPool?: { createdAt?: string | number }
  stats24h?: {
    priceChange?: number
    buyVolume?: number
    sellVolume?: number
    volume?: number
  }
}

function jupToPair(t: JupToken): { address: string; pair: SourcePair } | null {
  const address = String(t.id || t.address || '')
  if (!SOLANA_MINT_RE.test(address)) return null

  // Jupiter reports buy and sell volume separately; the board wants the total.
  const s = t.stats24h ?? {}
  const volume = num(s.volume, (Number(s.buyVolume) || 0) + (Number(s.sellVolume) || 0))

  // `firstPool.createdAt` is when the token first had a market — the same thing
  // DexScreener calls `pairCreatedAt`, and what the age gate is really asking.
  const createdRaw = t.firstPool?.createdAt
  const createdAt = typeof createdRaw === 'string' ? Date.parse(createdRaw) : Number(createdRaw) || 0

  return {
    address,
    pair: {
      chainId: 'solana',
      pairCreatedAt: Number.isFinite(createdAt) && createdAt > 0 ? createdAt : undefined,
      baseToken: { address, symbol: String(t.symbol || ''), name: String(t.name || '') },
      priceUsd: String(num(t.usdPrice, t.price) || 0),
      marketCap: num(t.mcap, t.marketCap, t.fdv),
      fdv: num(t.fdv, t.mcap),
      volume: { h24: volume },
      priceChange: { h24: Number(s.priceChange) || 0 },
      liquidity: { usd: num(t.liquidity) },
      info: { imageUrl: String(t.icon || t.logoURI || '') },
      url: `https://dexscreener.com/solana/${address}`,
    },
  }
}

async function jupiterList(path: string, label: string): Promise<SourceResult> {
  const pairs = new Map<string, SourcePair>()
  try {
    const data = await fetchJson<JupToken[] | { tokens?: JupToken[] }>(`${JUPITER_BASE}/${path}`, { timeoutMs: 8_000 })
    // Accept both a bare array and an envelope — the API has shipped both.
    const list = Array.isArray(data) ? data : (data?.tokens ?? [])
    for (const token of list) {
      const mapped = jupToPair(token)
      if (mapped) pairs.set(mapped.address, mapped.pair)
    }
    return { source: label, pairs, ok: pairs.size > 0, note: pairs.size === 0 ? 'no usable tokens' : undefined }
  } catch (err) {
    return { source: label, pairs, ok: false, note: err instanceof Error ? err.message : 'failed' }
  }
}

/** Top tokens by Jupiter's organic-activity score — wash volume filtered out
 *  by somebody with far more data than we have. The primary source. */
export const jupiterOrganic = (limit = 100) =>
  jupiterList(`toporganicscore/24h?limit=${limit}`, 'jupiter:organic')

/** Top tokens by raw 24h volume. Catches a coin trading hard that the organic
 *  score has not caught up with — ranked on our own terms once here. */
export const jupiterTraded = (limit = 100) =>
  jupiterList(`toptraded/24h?limit=${limit}`, 'jupiter:traded')

/** Recently launched tokens with real markets. A memecoin's whole interesting
 *  life is often its first day, and a board about right now that systematically
 *  misses day-one coins is a board that is always late. */
export const jupiterRecent = (limit = 60) =>
  jupiterList(`recent?limit=${limit}`, 'jupiter:recent')

/* ─────────────────────────────────────────────────────────────────────────
   DEXSCREENER — kept, but demoted.

   The boost feeds are a genuine signal of intent and a terrible signal of size,
   so they top up the list rather than filling it. The search endpoint stays as
   a last-resort source for the case where Jupiter is unreachable entirely.
   ───────────────────────────────────────────────────────────────────────── */

const DEX_TOKENS_BATCH = 30

/** Enrich bare mints through DexScreener. Used for admin pins and for the
 *  promo feeds, which carry an address and nothing else. */
export async function dexEnrich(mints: string[]): Promise<Map<string, SourcePair>> {
  const best = new Map<string, SourcePair>()
  for (let i = 0; i < mints.length; i += DEX_TOKENS_BATCH) {
    const batch = mints.slice(i, i + DEX_TOKENS_BATCH)
    const data = await fetchJson<{ pairs?: SourcePair[] }>(
      `https://api.dexscreener.com/latest/dex/tokens/${batch.join(',')}`,
      { timeoutMs: 8_000 },
    )
    for (const pair of data?.pairs || []) {
      if (pair.chainId && pair.chainId !== 'solana') continue
      const addr = pair.baseToken?.address
      if (!addr) continue
      const prev = best.get(addr)
      // Deepest liquidity wins — a thin pair quotes a price nobody can trade at.
      if (!prev || (pair.liquidity?.usd ?? 0) > (prev.liquidity?.usd ?? 0)) best.set(addr, pair)
    }
  }
  return best
}

interface PromoRow { chainId?: string; tokenAddress?: string }

/** Mints from the DexScreener promotional feeds. Addresses only — they need
 *  enriching, so this is capped tight. */
export async function dexPromoted(cap = 60): Promise<SourceResult> {
  const pairs = new Map<string, SourcePair>()
  try {
    const [top, latest, profiles] = await Promise.all([
      fetchJson<PromoRow[]>('https://api.dexscreener.com/token-boosts/top/v1', { timeoutMs: 6_000 }),
      fetchJson<PromoRow[]>('https://api.dexscreener.com/token-boosts/latest/v1', { timeoutMs: 6_000 }),
      fetchJson<PromoRow[]>('https://api.dexscreener.com/token-profiles/latest/v1', { timeoutMs: 6_000 }),
    ])
    const mints: string[] = []
    for (const row of [...(top || []), ...(latest || []), ...(profiles || [])]) {
      if (row?.chainId !== 'solana') continue
      const address = String(row.tokenAddress || '')
      if (SOLANA_MINT_RE.test(address) && !mints.includes(address)) mints.push(address)
      if (mints.length >= cap) break
    }
    if (mints.length > 0) {
      for (const [address, pair] of await dexEnrich(mints)) pairs.set(address, pair)
    }
    return { source: 'dexscreener:boosts', pairs, ok: pairs.size > 0 }
  } catch (err) {
    return { source: 'dexscreener:boosts', pairs, ok: false, note: err instanceof Error ? err.message : 'failed' }
  }
}

/**
 * The old search path, kept as a floor.
 *
 * It is a bad top-100 source — that is the whole finding of this file — but it
 * is a bad source that has historically answered when others did not, and a
 * board with twenty coins beats a board with none.
 */
const SEARCH_TERMS = ['SOL', 'USDC', 'bonk', 'pump', 'meme', 'cat', 'dog', 'ai'] as const

export async function dexSearch(): Promise<SourceResult> {
  const pairs = new Map<string, SourcePair>()
  try {
    const results = await Promise.all(SEARCH_TERMS.map((term) =>
      fetchJson<{ pairs?: SourcePair[] }>(
        `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(term)}`,
        { timeoutMs: 6_000 },
      )))
    for (const result of results) {
      for (const pair of result?.pairs ?? []) {
        if (pair.chainId && pair.chainId !== 'solana') continue
        const address = String(pair.baseToken?.address || '')
        if (!SOLANA_MINT_RE.test(address)) continue
        const prev = pairs.get(address)
        if (!prev || (pair.liquidity?.usd ?? 0) > (prev.liquidity?.usd ?? 0)) pairs.set(address, pair)
      }
    }
    return { source: 'dexscreener:search', pairs, ok: pairs.size > 0 }
  } catch (err) {
    return { source: 'dexscreener:search', pairs, ok: false, note: err instanceof Error ? err.message : 'failed' }
  }
}

/**
 * Every source, merged, with a per-source count for the diagnostics.
 *
 * Order matters only for which pair data wins a collision: the first source to
 * report a mint keeps its numbers, so the highest-quality source is asked
 * first. Jupiter's stats are more complete than a search hit's, so Jupiter
 * goes first and DexScreener fills gaps rather than overwriting.
 */
export async function discoverAllSources(): Promise<{
  pairs: Map<string, SourcePair>
  diagnostics: Array<{ source: string; found: number; contributed: number; ok: boolean; note?: string }>
}> {
  const results = await Promise.all([
    jupiterOrganic(100),
    jupiterTraded(100),
    jupiterRecent(60),
    dexPromoted(60),
    dexSearch(),
  ])

  const pairs = new Map<string, SourcePair>()
  const diagnostics = results.map((result) => {
    let contributed = 0
    for (const [address, pair] of result.pairs) {
      if (pairs.has(address)) continue
      pairs.set(address, pair)
      contributed++
    }
    return {
      source: result.source,
      found: result.pairs.size,
      contributed,
      ok: result.ok,
      ...(result.note ? { note: result.note } : {}),
    }
  })

  return { pairs, diagnostics }
}
