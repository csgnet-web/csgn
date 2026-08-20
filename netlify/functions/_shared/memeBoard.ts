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
 *   • liquidity — someone can actually trade it
 *   • 24h volume — it is actually being traded
 *   • pair age  — it has survived longer than a launch snipe
 *
 * These are TIERED (see `TIERS` below) rather than a single set: the board fills
 * from the strictest tier down until it has a hundred names, so the top is
 * always the strongest coins available and only the tail is ever marginal.
 *
 * A DENYLIST (`config/memeBoard.deny`) remains, because "it cleared the numbers"
 * is not the same as "we are happy to put it on television". An ALLOWLIST
 * (`config/memeBoard.mints`) still works too and is always included regardless
 * of thresholds — that's how $CSGN itself stays on its own board.
 */

import { getDoc, writeDoc } from './firebaseAdmin'
import { discoverAndEnrich, type SourcePair } from './tokenSources'

export const MEME_BOARD_INTERVAL_MS = 5 * 60 * 1000
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
const MEME_DISCOVERY_CAP = 360

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
/**
 * TIERED THRESHOLDS, filled in order.
 *
 * A single set of gates has one failure mode and we hit it twice: tune them for
 * safety and the board comes back with five coins; tune them for volume and a
 * rug that launched ninety seconds ago goes on television. Neither is
 * acceptable and there is no single pair of numbers that is both.
 *
 * So the board is filled in PASSES. Everything clearing tier 1 goes on first;
 * if there are still slots left, tier 2 fills them; then tier 3. A coin's tier
 * travels with it, so the UI can mark the tail honestly rather than presenting
 * a marginal coin as if it cleared the same bar as the leaders.
 *
 * This is what makes "the Meme 100" a hundred names on a quiet day and still
 * the strongest hundred available on a busy one — the top of the board is
 * always tier 1, and relaxation only ever affects the tail.
 */
interface Tier {
  name: 'core' | 'wide' | 'tail'
  minLiquidityUsd: number
  minVolumeH24Usd: number
  minPairAgeMs: number
}

const TIERS: Tier[] = [
  // Real money, real trading, survived a day. The coins we would put on air
  // with no caveat at all.
  { name: 'core', minLiquidityUsd: 25_000, minVolumeH24Usd: 50_000, minPairAgeMs: 24 * 60 * 60 * 1000 },
  // Genuinely traded, a few hours old. Most of a normal board.
  { name: 'wide', minLiquidityUsd: 10_000, minVolumeH24Usd: 15_000, minPairAgeMs: 6 * 60 * 60 * 1000 },
  // The tail. Still has to be tradeable and still has to have survived an
  // hour — this is a lower bar, not the absence of one.
  { name: 'tail', minLiquidityUsd: 3_000, minVolumeH24Usd: 3_000, minPairAgeMs: 60 * 60 * 1000 },
]

/**
 * A coin whose 24h volume is a large multiple of its liquidity is either
 * genuinely on fire or being washed. Above this ratio we require MORE
 * liquidity before believing it — the cheap version of a wash-trade filter,
 * and the one gate that is about honesty rather than size.
 */
const SUSPICIOUS_TURNOVER = 50
const SUSPICIOUS_MIN_LIQUIDITY_USD = 60_000

const SOLANA_MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
/**
 * Wrapped SOL and the major stables are not memecoins.
 *
 * This matters far more now than it did. The old search-based discovery
 * happened to bury them; Jupiter's top-traded list puts them at the very TOP,
 * because by volume they are the biggest things on Solana by an enormous
 * margin. Without this the Meme 100 would open with SOL, USDC and USDT — which
 * is a correct list of what is traded and a useless list of memecoins.
 */
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
  /** How long this coin has had a market, in whole days.
   *
   *  A scoring input, not just a label. A memecoin that has survived a year is
   *  a materially different proposition from one that launched on Tuesday, and
   *  ranking purely on today's activity treats them as equals — which is how a
   *  board of "top memecoins" ends up with no BONK on it. Zero when the pair
   *  age is unknown, which the scorer reads as "no credit" rather than "new". */
  ageDays: p?.pairCreatedAt ? Math.max(0, Math.floor((Date.now() - p.pairCreatedAt) / 86_400_000)) : 0,
  pairUrl: String(p?.url || `https://dexscreener.com/solana/${address}`),
})

/* ─── Never let a good board collapse ─── */

/** A published board row. Loose on purpose — this function's job is to carry
 *  rows forward without caring what is on them. */
export interface CarriedCoin { address?: unknown; tier?: unknown; carriedFrom?: unknown }

/** How stale a carried-over coin may be before it is dropped rather than
 *  shown. A day-old price on a scoreboard is defensible; a week-old one is a
 *  lie with a number on it. */
export const MEME_CARRY_MAX_AGE_MS = 24 * 60 * 60 * 1000

/**
 * TOP THE BOARD UP FROM THE LAST GOOD ONE.
 *
 * This is the answer to the failure that has been reported more than any other
 * on this project: **the board came back with three coins.**
 *
 * Every previous fix attacked the cause — thresholds, re-fetch starvation, the
 * wrong source type, shape-dependent parsing. All were real and all are fixed.
 * None of them could promise the symptom would not happen again, because the
 * board depends on third-party feeds that can and will have a bad five minutes.
 *
 * So this attacks the SYMPTOM instead, and it is the only thing here that can
 * actually guarantee an outcome: a rebuild may add coins and may refresh them,
 * but it can never shrink the board. A run that finds three coins publishes
 * those three plus ninety-seven carried from the last good board. After one
 * healthy build, "only three tokens loaded" stops being reachable.
 *
 * Two rules keep it honest:
 *   • A carried coin is MARKED (`carriedFrom`), so the UI and the diagnostics
 *     can tell fresh data from held data. Silently presenting stale numbers as
 *     live ones would be trading one lie for another.
 *   • A carried coin older than `MEME_CARRY_MAX_AGE_MS` is dropped. Better a
 *     short board than a board of day-old prices.
 *
 * Pure, so the guarantee is pinned by tests rather than hoped for.
 */
export function topUpBoard<T extends CarriedCoin>(
  fresh: T[],
  previous: CarriedCoin[],
  previousUpdatedAt: string | null | undefined,
  size = MEME_BOARD_SIZE,
  nowMs = Date.now(),
): T[] {
  if (fresh.length >= size) return fresh.slice(0, size)

  const prevMs = Date.parse(previousUpdatedAt || '')
  // No usable timestamp means we cannot say how old these are, and an unknown
  // age is treated as too old — the same rule every reader in this codebase
  // follows for a value it cannot verify.
  if (!Number.isFinite(prevMs) || nowMs - prevMs > MEME_CARRY_MAX_AGE_MS) return fresh

  const have = new Set(fresh.map((c) => String(c.address ?? '')))
  const carried: T[] = []
  for (const coin of previous) {
    if (fresh.length + carried.length >= size) break
    const address = String(coin?.address ?? '')
    if (!address || have.has(address)) continue
    have.add(address)
    carried.push({
      ...(coin as T),
      // Preserve the ORIGINAL carry stamp when a coin has been held before, so
      // the age check measures how long the data has actually been stale rather
      // than resetting every five minutes and letting a row live forever.
      carriedFrom: coin.carriedFrom ?? new Date(prevMs).toISOString(),
    })
  }
  // A carried row that has itself aged out goes, even though the board it came
  // from is recent — that is the case the naive check misses.
  const live = carried.filter((c) => {
    const t = Date.parse(String((c as CarriedCoin).carriedFrom ?? ''))
    return Number.isFinite(t) && nowMs - t <= MEME_CARRY_MAX_AGE_MS
  })
  return [...fresh, ...live]
}

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

    // EVERY SOURCE, MERGED. See _shared/tokenSources.ts — the board is the
    // union of whatever answered, so one provider being down costs that
    // provider's coins and nothing else. `sources` is published on the board
    // document, which is how "why is this thin" became a question the data
    // answers instead of three rounds of guessing.
    // Sources propose MINTS; one enricher reads market state for all of them.
    // See _shared/tokenSources.ts — a source can no longer poison the board
    // with zero-priced rows or break on somebody else's API rename.
    const { pairs: discovered, diagnostics: sources, unresolved } = await discoverAndEnrich(
      pinned, MEME_DISCOVERY_CAP,
    )
    for (const address of discovered.keys()) {
      // Denylisted by an admin, or a stablecoin / wrapped SOL. A pinned mint
      // survives both — pinning is the deliberate override.
      if (denied.has(address) || (MEME_BOARD_EXCLUDE.has(address) && !pinned.includes(address))) {
        discovered.delete(address)
      }
    }

    const candidates = [...discovered.keys()]
    if (candidates.length === 0) {
      return { ok: false, coins: 0, candidates: 0, skipped: false, reason: 'no_candidates' }
    }

    const enriched = discovered
    const now = Date.now()
    const pinnedSet = new Set(pinned)

    const clearsTier = (p: SourcePair | undefined, tier: Tier): boolean => {
      if (!p) return false
      const liquidity = p.liquidity?.usd ?? 0
      const volume = p.volume?.h24 ?? 0
      if (liquidity < tier.minLiquidityUsd) return false
      if (volume < tier.minVolumeH24Usd) return false
      // A pair with no creation timestamp is unknowable, not young — treating
      // it as brand new excluded a chunk of legitimately old coins.
      if (p.pairCreatedAt && now - p.pairCreatedAt < tier.minPairAgeMs) return false
      // Wash-trade smell: enormous volume against a thin pool. Applies at EVERY
      // tier, including the tail — relaxing size is a judgement call, letting
      // through an obvious laundromat is not.
      if (liquidity > 0 && volume / liquidity > SUSPICIOUS_TURNOVER && liquidity < SUSPICIOUS_MIN_LIQUIDITY_USD) return false
      return true
    }

    const usable = candidates
      .filter((address) => !denied.has(address))
      .map((address) => ({ address, pair: enriched.get(address), coin: toBoardCoin(address, enriched.get(address)) }))
      // A coin with no readable pair enriches to an all-zero row. Those are not
      // a board, they are placeholders — and a row reading "$ · $0" on air is
      // worse than one fewer coin.
      .filter((row) => row.coin.symbol && row.coin.priceUsd > 0)

    const chosen = new Map<string, ReturnType<typeof toBoardCoin> & { tier: string }>()

    // Pinned first and unconditionally — that is what pinning means, and it is
    // how $CSGN stays on its own board on a quiet day.
    for (const row of usable) {
      if (pinnedSet.has(row.address)) chosen.set(row.address, { ...row.coin, tier: 'pinned' })
    }

    // Then each tier in turn, best-volume first within the tier, until full.
    for (const tier of TIERS) {
      if (chosen.size >= MEME_BOARD_SIZE) break
      const passing = usable
        .filter((row) => !chosen.has(row.address) && clearsTier(row.pair, tier))
        .sort((a, b) => b.coin.volumeH24Usd - a.coin.volumeH24Usd)
      for (const row of passing) {
        if (chosen.size >= MEME_BOARD_SIZE) break
        chosen.set(row.address, { ...row.coin, tier: tier.name })
      }
    }

    // Volume is the honest "what is actually happening" sort for the board
    // itself; the app re-ranks by power score once holder votes are folded in.
    const built = [...chosen.values()].sort((a, b) => b.volumeH24Usd - a.volumeH24Usd)

    // THE BOARD CANNOT SHRINK. A run that comes back thin tops itself up from
    // the last good board rather than publishing three coins over ninety-seven.
    // See topUpBoard — this is the only guarantee in this file that does not
    // depend on somebody else's API having a good day.
    const previousCoins = Array.isArray(existing?.coins) ? (existing!.coins! as CarriedCoin[]) : []
    const coins = topUpBoard(built, previousCoins, existing?.updatedAt, MEME_BOARD_SIZE)
    const carried = coins.length - built.length

    // ── SANITY CHECK, LOGGED ──
    // Four builds came back with two or three coins and the logs said nothing
    // useful, because a thin board and a healthy one produced identical output.
    // This line is the difference between "check the source table" and another
    // round of guessing.
    if (built.length < MEME_BOARD_SIZE / 2) {
      console.warn(
        `[memeBoard] THIN BUILD: ${built.length}/${MEME_BOARD_SIZE} fresh from ${candidates.length} candidates ` +
        `(${unresolved} had no readable pair, ${carried} carried forward). Sources: ` +
        sources.map((s) => `${s.source}=${s.found}/+${s.contributed}${s.note ? `(${s.note})` : ''}`).join(' '),
      )
    }

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
      // WHICH SOURCE GAVE US WHAT. The single most useful thing on this
      // document when the board looks thin.
      sources,
      discovery: {
        candidates: candidates.length,
        qualified: built.length,
        /** How many rows on this board came from a PREVIOUS build because this
         *  one came back thin. Zero on a healthy run. Anything else says the
         *  feeds are struggling even though the board looks full — which is
         *  exactly the thing that would otherwise be invisible. */
        carried,
        /** Mints proposed but with no readable DexScreener pair. A high number
         *  means enrichment is struggling, which is a completely different
         *  problem from thresholds being strict — telling those two apart took
         *  four attempts. */
        unresolved,
        /** How many candidates were dropped for having no readable price at
         *  all. A high number here means enrichment is starving, which is a
         *  different problem from thresholds being too strict — and telling
         *  them apart took far too long the first time. */
        unpriced: candidates.length - usable.length,
        // How many came from each tier, so a thin board is legible at a glance
        // rather than a mystery: "40 core, 60 tail" says something very
        // different from "100 core".
        byTier: coins.reduce<Record<string, number>>((acc, c) => {
          acc[c.tier] = (acc[c.tier] ?? 0) + 1
          return acc
        }, {}),
      },
      tiers: TIERS,
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

