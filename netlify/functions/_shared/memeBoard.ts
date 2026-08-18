/**
 * THE MEME 100 — building the board, in one place.
 *
 * ── Why this is its own module ─────────────────────────────────────────────
 *
 * This used to live inside the scheduled fee poller, and the board was empty in
 * production for a reason that had nothing to do with the ranking: the ONLY
 * thing that ever wrote `public/memeBoard` was one step near the end of a long
 * background invocation, and the only thing that ever read it was a browser
 * hitting Firestore directly. That is two independent single points of failure
 * stacked on the one screen a visitor judges the product by —
 *
 *   • if the scheduled function is not running, or an earlier step in it throws,
 *     the board is never written at all; and
 *   • if `firestore.rules` has not been deployed with a public read on that doc,
 *     the browser's read is denied and the page renders the SAME
 *     "board is building" empty state it shows for a genuinely empty board.
 *
 * Both failures are invisible and look identical from the outside, which is why
 * this sat broken. So the logic moved here, where two callers share it: the
 * poller still refreshes it on its own cadence, and `netlify/functions/
 * memeBoard.ts` serves it over HTTP — building it on demand when the stored copy
 * is missing or stale, and reading through firebase-admin, which bypasses rules.
 * A visitor now gets a board even if the scheduler is asleep and the rules file
 * was never deployed.
 *
 * ── What the board is ──────────────────────────────────────────────────────
 *
 *
 * Discovery, not curation. The board used to be a hand-typed list of mints,
 * which meant the "Meme 100" was really "the coins someone remembered to add".
 * Now it's assembled from what is actually trading on Solana right now:
 *
 *   1. DISCOVER — DexScreener's boosted-token and latest-profile feeds give a
 *      wide, constantly-churning set of Solana mints that people are actively
 *      promoting and trading.
 *   2. ENRICH — read the real pool state for each mint. Deepest-liquidity pair
 *      wins, because a thin pair quotes a price nobody can trade at.
 *   3. FILTER — apply hard on-chain thresholds (below). This is the step that
 *      turns a firehose into a board.
 *   4. RANK — by 24h volume, and keep the top MEME_BOARD_SIZE.
 *
 * The thresholds are the whole safety story, because this list goes ON AIR and
 * is the ballot for a token-weighted vote. Without them, a rug minted ninety
 * seconds ago with $200 of liquidity lands on the broadcast next to real coins,
 * and the vote legitimises it. So a coin has to clear all of:
 *
 *   • MIN_LIQUIDITY_USD  — someone can actually trade it
 *   • MIN_VOLUME_H24_USD — it is actually being traded
 *   • MIN_PAIR_AGE_MS    — it has survived longer than a launch snipe
 *
 * A DENYLIST (`config/memeBoard.deny`) remains, because "it cleared the numbers"
 * is not the same as "we are happy to put it on television". An ALLOWLIST
 * (`config/memeBoard.mints`) still works too and is always included regardless
 * of thresholds — that's how $CSGN itself stays on its own board.
 */

import { fetchJson } from './cache'
import { getDoc, writeDoc } from './firebaseAdmin'

export const MEME_BOARD_INTERVAL_MS = 5 * 60 * 1000
/** DexScreener accepts up to 30 comma-separated addresses per request. */
const DEX_TOKENS_BATCH = 30
/** How many coins the published board carries. It is called the Meme 100. */
const MEME_BOARD_SIZE = 100
/**
 * Discovery cap — how many candidate mints we enrich per run.
 *
 * Raised from 120. The board was coming back with FIVE coins, and the arithmetic
 * of why is worth writing down: three search terms returned a few dozen pairs
 * each, most of them the same handful of majors, and the filters then removed
 * almost everything that was left. A hundred-name board cannot be built from a
 * hundred-and-twenty candidates when the pass rate is under ten percent.
 */
const MEME_DISCOVERY_CAP = 600

/**
 * On-chain quality gates. A coin must clear ALL of these.
 *
 * ── Why these moved ────────────────────────────────────────────────────────
 *
 * The old numbers (25k liquidity, 50k volume, 24h age) were written to keep a
 * rug minted ninety seconds ago off television, which is the right instinct.
 * But they were tuned against a firehose we were not actually receiving, and
 * combined with thin discovery they produced a board of five coins — which is
 * not a Meme 100, and which excluded most of what was genuinely trending.
 *
 * The 24-hour age gate was the worst of the three for this product. A memecoin's
 * entire interesting life is often its first day; requiring it to survive one
 * before it can appear means the board is systematically a day late to
 * everything, which for a channel about what is happening RIGHT NOW is the
 * opposite of the point.
 *
 * So the gates are now: real liquidity somebody could trade against, real volume
 * today, and old enough not to be a snipe — with age cut to six hours and
 * liquidity and volume set where a coin has to be genuinely traded rather than
 * merely large. The safety story is unchanged in kind; it is calibrated to the
 * actual candidate pool rather than an imagined one.
 */
const MIN_LIQUIDITY_USD = 15_000
const MIN_VOLUME_H24_USD = 25_000
const MIN_PAIR_AGE_MS = 6 * 60 * 60 * 1000

/**
 * A coin whose 24h volume is a large multiple of its liquidity is either
 * genuinely on fire or being washed. Above this ratio we require MORE
 * liquidity before believing it — the cheap version of a wash-trade filter,
 * and the one gate that is about honesty rather than size.
 */
const SUSPICIOUS_TURNOVER = 50
const SUSPICIOUS_MIN_LIQUIDITY_USD = 60_000

const SOLANA_MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
/** Wrapped SOL and the major stables are not memecoins. */
const MEME_BOARD_EXCLUDE = new Set([
  'So11111111111111111111111111111111111111112',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
])

interface DexPair {
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

/**
 * Search terms used to discover coins BY TRADING, not by promotion.
 *
 * Every Solana memecoin of any size trades against one of these, so searching
 * them returns pairs ranked by real market activity. Deliberately generic — a
 * list of ticker names here would put us straight back to curating by hand.
 */
const MEME_SEARCH_TERMS = [
  // Quote assets: every Solana memecoin of any size trades against one of
  // these, so searching them returns pairs ranked by real market activity.
  'SOL', 'USDC', 'WSOL', 'USDT',
  // Venue names. DexScreener matches these against pair and DEX metadata, and
  // they are where Solana memecoins are actually born and traded — this is the
  // single biggest widening of the candidate pool, and the reason the board can
  // now fill a hundred names instead of five.
  'pump', 'raydium', 'meteora', 'orca', 'bonk',
]

/**
 * Candidate Solana mints.
 *
 * TWO KINDS OF SOURCE, and the difference is the whole point of this function.
 *
 * `token-boosts` and `token-profiles` are PROMOTIONAL feeds: they list coins
 * whose teams paid DexScreener for a boost, or who recently filled in a profile.
 * That is a fine signal of intent and a terrible signal of size. On its own it
 * meant the "Meme 100" was really "the hundred coins someone paid to promote" —
 * a genuinely large, heavily traded coin whose team never bought a boost could
 * not appear on the board at all, however much volume it did.
 *
 * The search feed is the corrective: it returns pairs by actual market activity
 * against the majors, so a coin earns its way onto the board by being traded.
 * Both sets are merged, then every candidate is enriched with real pool state
 * and ranked by 24h volume, so promotion can put a coin in front of us but only
 * trading can rank it.
 *
 * Each source degrades independently — `fetchJson` returns null on any failure,
 * and a missing feed just means fewer candidates this run, never an empty board.
 */
async function discoverSolanaMints(): Promise<string[]> {
  type PromoRow = { chainId?: string; tokenAddress?: string }
  const [boosts, profiles, ...searches] = await Promise.all([
    fetchJson<PromoRow[]>('https://api.dexscreener.com/token-boosts/top/v1'),
    fetchJson<PromoRow[]>('https://api.dexscreener.com/token-profiles/latest/v1'),
    ...MEME_SEARCH_TERMS.map((term) =>
      fetchJson<{ pairs?: DexPair[] }>(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(term)}`),
    ),
  ])

  const seen = new Set<string>()
  const add = (mint: string, into: string[]) => {
    if (!SOLANA_MINT_RE.test(mint) || seen.has(mint) || MEME_BOARD_EXCLUDE.has(mint)) return
    seen.add(mint)
    into.push(mint)
  }

  // Traded first, so that when the discovery cap bites it is the promoted tail
  // that gets dropped rather than the coins with real volume behind them.
  const traded: string[] = []
  const searchPairs = searches.flatMap((s) => s?.pairs ?? [])
    .filter((p) => !p.chainId || p.chainId === 'solana')
    .sort((a, b) => (b.volume?.h24 ?? 0) - (a.volume?.h24 ?? 0))
  for (const pair of searchPairs) add(String(pair.baseToken?.address || ''), traded)

  const promoted: string[] = []
  for (const row of [...(boosts || []), ...(profiles || [])]) {
    if (row?.chainId !== 'solana') continue
    add(String(row.tokenAddress || ''), promoted)
  }

  return [...traded, ...promoted].slice(0, MEME_DISCOVERY_CAP)
}

/** Deepest-liquidity Solana pair per mint. */
async function enrichMints(mints: string[]): Promise<Map<string, DexPair>> {
  const best = new Map<string, DexPair>()
  for (let i = 0; i < mints.length; i += DEX_TOKENS_BATCH) {
    const batch = mints.slice(i, i + DEX_TOKENS_BATCH)
    const data = await fetchJson<{ pairs?: DexPair[] }>(
      `https://api.dexscreener.com/latest/dex/tokens/${batch.join(',')}`,
    )
    for (const pair of data?.pairs || []) {
      if (pair.chainId && pair.chainId !== 'solana') continue
      const addr = pair.baseToken?.address
      if (!addr) continue
      const prev = best.get(addr)
      if (!prev || (pair.liquidity?.usd ?? 0) > (prev.liquidity?.usd ?? 0)) best.set(addr, pair)
    }
  }
  return best
}

const toBoardCoin = (address: string, p: DexPair | undefined) => ({
  address,
  symbol: String(p?.baseToken?.symbol || '').toUpperCase().slice(0, 12),
  name: String(p?.baseToken?.name || '').slice(0, 60),
  imageUrl: String(p?.info?.imageUrl || ''),
  priceUsd: Number(p?.priceUsd) || 0,
  marketCapUsd: Number(p?.marketCap ?? p?.fdv) || 0,
  volumeH24Usd: Number(p?.volume?.h24) || 0,
  priceChangeH24Pct: Number(p?.priceChange?.h24) || 0,
  liquidityUsd: Number(p?.liquidity?.usd) || 0,
  pairUrl: String(p?.url || `https://dexscreener.com/solana/${address}`),
})

/** What a build run actually did — returned rather than logged, so the HTTP
 *  caller can tell a visitor "upstream is down" apart from "nothing qualified".
 *  `skipped` means the stored board was still fresh and was left alone. */
export interface MemeBoardResult {
  ok: boolean
  coins: number
  candidates: number
  skipped: boolean
  reason: 'built' | 'fresh' | 'no_candidates' | 'none_qualified' | 'error'
  error?: string
}

/**
 * Rebuild `public/memeBoard`, unless the stored copy is still inside the
 * refresh interval.
 *
 * `force` skips the freshness check — used by the HTTP endpoint when the stored
 * doc is missing entirely, which is exactly the cold-start case where waiting
 * for the next scheduled run means showing a visitor an empty board for up to
 * five minutes.
 */
export async function refreshMemeBoard({ force = false } = {}): Promise<MemeBoardResult> {
  try {
    const existing = await getDoc<{ updatedAt?: string; coins?: unknown[] }>('public/memeBoard')
    const last = Date.parse(existing?.updatedAt || '')
    const fresh = Number.isFinite(last) && Date.now() - last < MEME_BOARD_INTERVAL_MS
    const hasCoins = Array.isArray(existing?.coins) && existing!.coins!.length > 0
    // A FRESH BUT EMPTY board is not a reason to skip. The old check looked only
    // at the timestamp, so one failed run wrote nothing, and every run for the
    // next five minutes then declined to try — which is how an empty board
    // becomes a permanently empty board.
    if (!force && fresh && hasCoins) {
      return { ok: true, coins: existing!.coins!.length, candidates: 0, skipped: true, reason: 'fresh' }
    }

    const cfg = await getDoc<{ mints?: unknown; deny?: unknown }>('config/memeBoard')
    const clean = (v: unknown) => (Array.isArray(v) ? v : [])
      .map((m) => String(m ?? '').trim())
      .filter((m) => SOLANA_MINT_RE.test(m))
    const pinned = clean(cfg?.mints).slice(0, 40)
    const denied = new Set(clean(cfg?.deny))

    const discovered = (await discoverSolanaMints()).filter((m) => !denied.has(m))
    const candidates = [...new Set([...pinned, ...discovered])].slice(0, MEME_DISCOVERY_CAP + pinned.length)
    if (candidates.length === 0) {
      return { ok: false, coins: 0, candidates: 0, skipped: false, reason: 'no_candidates' }
    }

    const enriched = await enrichMints(candidates)
    const now = Date.now()
    const pinnedSet = new Set(pinned)

    const qualifies = (address: string, p: DexPair | undefined): boolean => {
      // Pinned coins bypass the thresholds — that's what pinning means, and it's
      // how $CSGN stays on its own board on a quiet day.
      if (pinnedSet.has(address)) return true
      if (!p) return false
      const liquidity = p.liquidity?.usd ?? 0
      const volume = p.volume?.h24 ?? 0
      if (liquidity < MIN_LIQUIDITY_USD) return false
      if (volume < MIN_VOLUME_H24_USD) return false
      // A pair with no creation timestamp is unknowable, not young — treating
      // it as brand new excluded a chunk of legitimately old coins.
      if (p.pairCreatedAt && now - p.pairCreatedAt < MIN_PAIR_AGE_MS) return false
      // Wash-trade smell: enormous volume against a thin pool. Not banned —
      // that is sometimes just a coin having a day — but it has to be deep
      // enough that the volume could plausibly be real.
      if (liquidity > 0 && volume / liquidity > SUSPICIOUS_TURNOVER && liquidity < SUSPICIOUS_MIN_LIQUIDITY_USD) return false
      return true
    }

    const coins = candidates
      .filter((address) => !denied.has(address))
      .filter((address) => qualifies(address, enriched.get(address)))
      .map((address) => toBoardCoin(address, enriched.get(address)))
      // A coin with no readable pair enriches to an all-zero row. Those are not
      // a board, they are placeholders — and a row reading "$ · $0" on air is
      // worse than one fewer coin.
      .filter((c) => c.symbol && c.priceUsd > 0)
      // Volume is the honest "what is actually happening" sort for the board
      // itself; the app re-ranks by power score once holder votes are folded in.
      .sort((a, b) => b.volumeH24Usd - a.volumeH24Usd)
      .slice(0, MEME_BOARD_SIZE)

    // Never publish an empty board over a good one — a discovery-feed outage
    // would otherwise wipe the ballot mid-vote.
    if (coins.length === 0) {
      return { ok: false, coins: 0, candidates: candidates.length, skipped: false, reason: 'none_qualified' }
    }

    await writeDoc('public/memeBoard', {
      coins,
      source: 'onchain',
      // Published so the board is auditable: how many candidates we looked at,
      // and how many cleared the on-chain gates to actually make it on air.
      discovery: { candidates: candidates.length, qualified: coins.length },
      thresholds: {
        minLiquidityUsd: MIN_LIQUIDITY_USD,
        minVolumeH24Usd: MIN_VOLUME_H24_USD,
        minPairAgeHours: MIN_PAIR_AGE_MS / 3_600_000,
      },
      updatedAt: new Date().toISOString(),
    })
    return { ok: true, coins: coins.length, candidates: candidates.length, skipped: false, reason: 'built' }
  } catch (err) {
    console.warn('refreshMemeBoard failed', err)
    return {
      ok: false, coins: 0, candidates: 0, skipped: false, reason: 'error',
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

