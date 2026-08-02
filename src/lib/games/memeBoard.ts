/**
 * THE MEME 100 BOARD — a real ranking you pick from, not a text box.
 *
 * The old vote asked you to TYPE A TICKER. That has three problems, and they
 * compound: you can vote for a coin that doesn't exist, two people can spell the
 * same coin differently ($BONK / BONK / Bonk), and — worst — the tally is a list
 * of strings with no prices, no contract addresses and no way to tell whether
 * "MOON" is a $400M coin or something launched nine minutes ago. A vote nobody
 * can audit isn't a ranking, it's a suggestion box.
 *
 * So the board is now a curated SET with real data attached:
 *
 *   • The contract address is the identity. Symbols collide; mints don't. A
 *     ballot is cast against a CA, so "which BONK?" has exactly one answer.
 *   • Every entry carries live price, market cap, 24h volume and 24h change,
 *     enriched server-side from DexScreener so no client burns API quota.
 *   • The rank is computed, published, and reproducible from the numbers on the
 *     card. Anyone can check our arithmetic.
 *
 * The set itself is curated (admin lists the mints) rather than scraped off a
 * "top memecoins" endpoint. That's deliberate: this board goes ON AIR, and an
 * open nomination field on a broadcast is a moderation incident waiting to
 * happen. Curating the ballot and letting holders rank it is the same shape as
 * the 30-Minute Draft — vote among vetted options, don't nominate freely.
 *
 * Pure module. Enrichment and persistence live in the poller.
 */

/* ─── Shape ─── */

export interface MemeCoin {
  /** Solana mint. THE identity — symbols are decoration. */
  address: string
  symbol: string
  name: string
  imageUrl: string
  priceUsd: number
  marketCapUsd: number
  volumeH24Usd: number
  priceChangeH24Pct: number
  /** DexScreener pair URL, so a voter can go look before they back it. */
  pairUrl: string
  /** True once server enrichment has filled the numbers in. */
  priced: boolean
}

/** A coin plus its standing on the board. */
export interface RankedMemeCoin extends MemeCoin {
  rank: number
  /** 0–1 blend. Published so the ordering is checkable, not magic. */
  power: number
  /** $CSGN weight backing this coin. */
  votes: number
  /** Distinct wallets backing it. Decoration — tokens are the signal. */
  voters: number
  /** Share of all vote weight on the board, 0–1. */
  voteShare: number
}

export interface VoteCell { tokens?: number; wallets?: number }

/* ─── Validation ─── */

/** A Solana mint is 32 bytes base58 — 32–44 chars, no 0/O/I/l. */
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
export const isValidMint = (address: string): boolean => BASE58.test(String(address ?? ''))

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * Normalize one stored entry.
 *
 * Returns null for anything without a valid mint. That check is the whole
 * integrity of the board: an entry with a malformed address can still be voted
 * on, and then the tally has weight sitting on a coin that cannot be looked up.
 */
export function normalizeMemeCoin(raw: unknown): MemeCoin | null {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const address = String(d.address ?? '').trim()
  if (!isValidMint(address)) return null

  const symbol = String(d.symbol ?? '').trim().toUpperCase().slice(0, 12)
  const priceUsd = num(d.priceUsd)

  return {
    address,
    symbol: symbol || address.slice(0, 4).toUpperCase(),
    name: String(d.name ?? '').trim().slice(0, 60) || symbol,
    imageUrl: String(d.imageUrl ?? '').trim().slice(0, 300),
    priceUsd,
    marketCapUsd: num(d.marketCapUsd),
    volumeH24Usd: num(d.volumeH24Usd),
    priceChangeH24Pct: Number.isFinite(Number(d.priceChangeH24Pct)) ? Number(d.priceChangeH24Pct) : 0,
    pairUrl: String(d.pairUrl ?? '').trim().slice(0, 300) || `https://dexscreener.com/solana/${address}`,
    priced: priceUsd > 0,
  }
}

export function normalizeMemeBoard(raw: unknown): MemeCoin[] {
  const list = Array.isArray(raw) ? raw : []
  const seen = new Set<string>()
  const out: MemeCoin[] = []
  for (const entry of list) {
    const coin = normalizeMemeCoin(entry)
    // One card per mint. A duplicate would split its own vote weight in half,
    // which looks exactly like the coin being less popular than it is.
    if (!coin || seen.has(coin.address)) continue
    seen.add(coin.address)
    out.push(coin)
  }
  return out
}

/* ─── The power score ─── */

/**
 * Weights, published because a ranking whose formula is secret is a ranking
 * people assume is rigged. Same blend the broadcast ticker uses, so the board on
 * air and the board in the app can never disagree.
 */
export const POWER_WEIGHTS = {
  /** Holder $CSGN vote weight. The largest single term, on purpose — this is a
   *  community ranking, and the community's stake should out-vote the market. */
  votes: 0.35,
  volume: 0.25,
  marketCap: 0.15,
  /** Turnover (vol/mcap) + absolute 24h move. A proxy for "is anything actually
   *  happening here", which is what separates a live coin from a big dead one. */
  buzz: 0.25,
} as const

/** Normalize a field across the set, so one huge coin can't swamp every term. */
function normalizer<T>(items: T[], pick: (item: T) => number): (item: T) => number {
  const max = Math.max(1e-9, ...items.map(pick))
  return (item) => pick(item) / max
}

/**
 * Rank the board. Best first, `rank` 1-indexed.
 *
 * An unpriced coin (enrichment hasn't run, or DexScreener has no pair) still
 * appears and can still be voted on — it just scores on votes alone. Dropping it
 * would silently remove a coin an admin deliberately added, and "my coin
 * vanished" is a worse bug than "my coin is ranked low".
 */
export function rankMemeBoard(coins: MemeCoin[], votes: Record<string, VoteCell> = {}): RankedMemeCoin[] {
  if (coins.length === 0) return []

  const votesOf = (c: MemeCoin) => Math.max(0, Number(votes[c.address]?.tokens) || 0)
  const buzzOf = (c: MemeCoin) =>
    (c.marketCapUsd > 0 ? c.volumeH24Usd / c.marketCapUsd : 0) + Math.abs(c.priceChangeH24Pct) / 100

  const nVotes = normalizer(coins, votesOf)
  const nVol = normalizer(coins, (c) => c.volumeH24Usd)
  const nMc = normalizer(coins, (c) => c.marketCapUsd)
  const nBuzz = normalizer(coins, buzzOf)

  const totalVotes = coins.reduce((sum, c) => sum + votesOf(c), 0)

  return coins
    .map((c) => ({
      ...c,
      power:
        POWER_WEIGHTS.votes * nVotes(c) +
        POWER_WEIGHTS.volume * nVol(c) +
        POWER_WEIGHTS.marketCap * nMc(c) +
        POWER_WEIGHTS.buzz * nBuzz(c),
      votes: votesOf(c),
      voters: Math.max(0, Number(votes[c.address]?.wallets) || 0),
      voteShare: totalVotes > 0 ? votesOf(c) / totalVotes : 0,
      rank: 0,
    }))
    // Power first; ties break on raw vote weight, then alphabetically, so the
    // order is stable across refreshes instead of shuffling on every render.
    .sort((a, b) => (b.power - a.power) || (b.votes - a.votes) || a.symbol.localeCompare(b.symbol))
    .map((c, i) => ({ ...c, rank: i + 1 }))
}

/**
 * The community pick: #1 on the board, but only once real holder weight backs
 * it. Without that check the "community pick" is just the biggest coin, which is
 * a market observation dressed up as a vote.
 */
export function communityPick(ranked: RankedMemeCoin[]): RankedMemeCoin | null {
  const top = ranked[0]
  return top && top.votes > 0 ? top : null
}

/* ─── Display ─── */

/** Short mint for a card: `GFV7…pump`. Full address goes on the copy button. */
export function shortMint(address: string): string {
  const a = String(address ?? '')
  return a.length > 12 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a
}

export function compactUsd(value: number): string {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return '—'
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

/** Prices span nine orders of magnitude here; fixed decimals don't work. */
export function memePrice(value: number): string {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return '—'
  if (n >= 1) return `$${n.toFixed(2)}`
  if (n >= 0.01) return `$${n.toFixed(4)}`
  if (n >= 0.000001) return `$${n.toFixed(8).replace(/0+$/, '')}`
  return `$${n.toExponential(2)}`
}

/** Filter the board by a free-text query over symbol, name or address. */
export function searchBoard(coins: RankedMemeCoin[], query: string): RankedMemeCoin[] {
  const q = String(query ?? '').trim().toLowerCase()
  if (!q) return coins
  return coins.filter((c) =>
    c.symbol.toLowerCase().includes(q) ||
    c.name.toLowerCase().includes(q) ||
    c.address.toLowerCase().includes(q))
}
