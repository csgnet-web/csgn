/**
 * WHERE THE MEME 100 GETS ITS COINS.
 *
 * ── The lesson that shaped this file ───────────────────────────────────────
 *
 * The board shipped four times and came back with two or three coins. Each
 * round fixed something real — thresholds too strict, a re-fetch that starved
 * enrichment, a search endpoint that was never a top-100 source — and each time
 * it stayed empty, because every version made the same structural mistake:
 *
 *   **It trusted each source to supply MARKET DATA in a shape we guessed.**
 *
 * Jupiter returns a hundred tokens. If its price field is `usdPrice` we read a
 * price; if the API renamed it, or nests it, or returns it as a string, we read
 * zero — and a coin with a price of zero is dropped by the quality filter. A
 * hundred candidates become none, silently, and the failure looks identical to
 * "nothing qualified".
 *
 * ── The fix: separate DISCOVERY from ENRICHMENT ────────────────────────────
 *
 * A source's only job is now to answer **"which mints are interesting right
 * now"**. That is a list of base58 strings. It cannot be got wrong by a
 * renamed field, because a mint address is unmistakable — it either matches
 * the regex or it does not, and we scan the whole JSON body for them rather
 * than reaching into a path we assumed.
 *
 * ONE enricher then reads real market state for every candidate, from one
 * provider, in one shape: DexScreener's token endpoint, which this codebase has
 * used successfully all along. Thirty mints per request, issued in PARALLEL —
 * the earlier version did twenty of these sequentially inside a serverless
 * invocation and the later batches timed out, which is what "starved" meant.
 *
 * The result is that adding a source is nearly risk-free. Worst case it
 * contributes mints that turn out not to qualify. It can no longer poison the
 * board with zero-priced rows, and it cannot break when somebody else ships an
 * API change.
 */
import { fetchJson } from './cache'

/** The shape the board pipeline works in — DexScreener's, because that is the
 *  single enricher. Nothing else produces this; everything else produces
 *  mints. */
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

export interface SourceDiag {
  source: string
  /** Mints this source proposed. */
  found: number
  /** Mints it proposed that nobody had proposed yet. */
  contributed: number
  ok: boolean
  note?: string
}

export const SOLANA_MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

/**
 * Pull every Solana-looking mint out of an arbitrary JSON body.
 *
 * Deliberately shape-blind. Instead of `data.tokens.map(t => t.id)` — which
 * breaks the day `tokens` becomes `data` or `id` becomes `address` — this walks
 * the whole structure and collects anything that looks like a mint.
 *
 * That sounds crude and is exactly right for this job: a base58 string of 32–44
 * characters inside a token API's response IS a mint, essentially always, and
 * the few false positives (a pool address, a program id) are removed by the
 * enricher, which simply finds no pair for them. Being slightly too permissive
 * costs one wasted slot in a batch; being too specific costs the entire source.
 */
export function harvestMints(body: unknown, cap = 400): string[] {
  const out: string[] = []
  const seen = new Set<string>()

  const walk = (node: unknown, depth: number) => {
    if (out.length >= cap || depth > 8) return
    if (typeof node === 'string') {
      if (SOLANA_MINT_RE.test(node) && !seen.has(node)) { seen.add(node); out.push(node) }
      return
    }
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1)
      return
    }
    if (node && typeof node === 'object') {
      for (const value of Object.values(node)) walk(value, depth + 1)
    }
  }

  walk(body, 0)
  return out
}

/* ═══════════════════════════════════════════════════════════════════════════
   DISCOVERY SOURCES — each answers "which mints are interesting", nothing more.
   Every one returns [] on any failure. None can break the board.
   ═══════════════════════════════════════════════════════════════════════════ */

async function mintsFrom(url: string, source: string, cap: number, timeoutMs = 8_000): Promise<{ source: string; mints: string[]; note?: string }> {
  try {
    const body = await fetchJson<unknown>(url, { timeoutMs })
    if (!body) return { source, mints: [], note: 'no response' }
    const mints = harvestMints(body, cap)
    return { source, mints, ...(mints.length === 0 ? { note: 'no mints in body' } : {}) }
  } catch (err) {
    return { source, mints: [], note: err instanceof Error ? err.message : 'failed' }
  }
}

const JUP = 'https://lite-api.jup.ag/tokens/v2'

/**
 * The discovery panel.
 *
 * Ordered roughly by how much we trust the source to surface things worth
 * putting on television, but order only decides who gets credited for a mint in
 * the diagnostics — every mint is enriched identically afterwards.
 */
function discoveryUrls(): Array<{ url: string; source: string; cap: number }> {
  return [
    // Jupiter — purpose-built "top N Solana tokens right now". Three different
    // cuts, because they disagree in useful ways: organic filters wash trading,
    // traded is raw volume, recent catches day-one coins that neither has yet.
    { url: `${JUP}/toporganicscore/24h?limit=100`, source: 'jupiter:organic', cap: 120 },
    { url: `${JUP}/toptraded/24h?limit=100`, source: 'jupiter:traded', cap: 120 },
    { url: `${JUP}/toptrending/24h?limit=100`, source: 'jupiter:trending', cap: 120 },
    { url: `${JUP}/recent?limit=60`, source: 'jupiter:recent', cap: 80 },

    // DexScreener promotional feeds — a real signal of intent, a poor signal of
    // size. Kept because they surface coins mid-run.
    { url: 'https://api.dexscreener.com/token-boosts/top/v1', source: 'dex:boosts-top', cap: 60 },
    { url: 'https://api.dexscreener.com/token-boosts/latest/v1', source: 'dex:boosts-new', cap: 60 },
    { url: 'https://api.dexscreener.com/token-profiles/latest/v1', source: 'dex:profiles', cap: 40 },
  ]
}

/**
 * THE MAJORS, by ticker.
 *
 * You asked for the real-world memecoins — the ones a person would name if you
 * asked them to list memecoins — to be on the board regardless of what a
 * trending feed happens to be surfacing. That is right: a "Meme 100" without
 * BONK is not credible, however good its long tail.
 *
 * These are searched BY SYMBOL rather than pinned by address, deliberately. I
 * do not have a way to verify a mint address from inside this environment, and
 * a wrong address hardcoded here would put the wrong coin on television — a
 * far worse failure than a missing one. Searching resolves the ticker to
 * whatever actually trades under it on Solana, with the deepest-liquidity pair
 * winning, which is both verifiable and self-correcting.
 *
 * An admin can still pin exact mints via `config/memeBoard.mints`, and those
 * bypass every threshold. This list is the floor, not the ceiling.
 */
export const MEME_MAJORS = [
  'BONK', 'WIF', 'POPCAT', 'MEW', 'BOME', 'MOTHER', 'GIGA', 'PNUT',
  'FWOG', 'MOODENG', 'CHILLGUY', 'ACT', 'GOAT', 'SPX', 'RETARDIO',
  'MICHI', 'PONKE', 'SC', 'BILLY', 'DADDY', 'HARAMBE', 'NEIRO',
  'ANSEM', 'TRUMP', 'MELANIA', 'AI16Z', 'GRIFFAIN', 'ARC', 'SWARMS',
] as const

/** Generic category words. These widen the tail without naming anybody. */
const CATEGORY_TERMS = ['pump', 'bonk', 'cat', 'dog', 'meme', 'ai', 'pepe', 'inu'] as const

async function searchMints(term: string, source: string): Promise<{ source: string; mints: string[]; note?: string }> {
  return mintsFrom(
    `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(term)}`,
    source, 60, 6_000,
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   ENRICHMENT — one provider, one shape, issued in parallel.
   ═══════════════════════════════════════════════════════════════════════════ */

const DEX_BATCH = 30
/** Batches issued at once. Six × 30 = 180 mints per wave, comfortably inside a
 *  function's budget, and DexScreener tolerates this rate. The sequential
 *  version of this is what starved every previous attempt. */
const DEX_CONCURRENCY = 6

export async function enrichMints(mints: string[]): Promise<Map<string, SourcePair>> {
  const best = new Map<string, SourcePair>()
  const batches: string[][] = []
  for (let i = 0; i < mints.length; i += DEX_BATCH) batches.push(mints.slice(i, i + DEX_BATCH))

  for (let i = 0; i < batches.length; i += DEX_CONCURRENCY) {
    const wave = batches.slice(i, i + DEX_CONCURRENCY)
    const results = await Promise.all(wave.map((batch) =>
      fetchJson<{ pairs?: SourcePair[] }>(
        `https://api.dexscreener.com/latest/dex/tokens/${batch.join(',')}`,
        { timeoutMs: 8_000 },
      )))
    for (const data of results) {
      for (const pair of data?.pairs || []) {
        if (pair.chainId && pair.chainId !== 'solana') continue
        const address = pair.baseToken?.address
        if (!address) continue
        const prev = best.get(address)
        // Deepest liquidity wins — a thin pair quotes a price nobody can trade.
        if (!prev || (pair.liquidity?.usd ?? 0) > (prev.liquidity?.usd ?? 0)) best.set(address, pair)
      }
    }
  }
  return best
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE WHOLE PIPELINE
   ═══════════════════════════════════════════════════════════════════════════ */

export interface DiscoveryResult {
  pairs: Map<string, SourcePair>
  diagnostics: SourceDiag[]
  /** Mints proposed but with no readable pair. High = enrichment struggling. */
  unresolved: number
}

/**
 * Every source, harvested, merged and enriched.
 *
 * @param extraMints Admin pins — enriched alongside everything else so a
 *                   pinned coin gets the same market data as a discovered one.
 * @param cap        Ceiling on mints enriched. The cost knob.
 */
export async function discoverAndEnrich(extraMints: string[] = [], cap = 360): Promise<DiscoveryResult> {
  const feeds = await Promise.all([
    ...discoveryUrls().map((d) => mintsFrom(d.url, d.source, d.cap)),
    // The majors, one search each. Run in the same wave so a slow search does
    // not add to the total time.
    ...MEME_MAJORS.map((symbol) => searchMints(symbol, `major:${symbol}`)),
    ...CATEGORY_TERMS.map((term) => searchMints(term, `term:${term}`)),
  ])

  const ordered: string[] = []
  const seen = new Set<string>()
  const diagnostics: SourceDiag[] = []

  // Admin pins first — they bypass thresholds later, so they must survive the
  // cap even on a run where discovery returns hundreds.
  for (const mint of extraMints) {
    if (SOLANA_MINT_RE.test(mint) && !seen.has(mint)) { seen.add(mint); ordered.push(mint) }
  }

  // Majors next, so a busy trending feed can never crowd BONK off the board.
  const majorFeeds = feeds.filter((f) => f.source.startsWith('major:'))
  const otherFeeds = feeds.filter((f) => !f.source.startsWith('major:'))

  const take = (feed: { source: string; mints: string[]; note?: string }, limit: number) => {
    let contributed = 0
    for (const mint of feed.mints.slice(0, limit)) {
      if (seen.has(mint)) continue
      seen.add(mint); ordered.push(mint); contributed++
    }
    diagnostics.push({
      source: feed.source,
      found: feed.mints.length,
      contributed,
      ok: feed.mints.length > 0,
      ...(feed.note ? { note: feed.note } : {}),
    })
  }

  // A ticker search returns the queried coin plus noise; the first few hits are
  // the ones actually matching, so majors are taken shallow and wide.
  for (const feed of majorFeeds) take(feed, 4)
  for (const feed of otherFeeds) take(feed, 400)

  const candidates = ordered.slice(0, cap)
  const pairs = await enrichMints(candidates)

  return {
    pairs,
    diagnostics,
    unresolved: candidates.length - pairs.size,
  }
}
