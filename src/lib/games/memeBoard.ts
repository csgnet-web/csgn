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
  /** Which discovery tier this coin cleared — 'pinned', 'core', 'wide' or
   *  'tail'. The board fills from the strictest tier down, so this is how far
   *  we had to relax to find a hundred names. Shown on the row so a marginal
   *  coin is never presented as if it cleared the same bar as the leaders. */
  tier?: string
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
  /** `power` as a 0–100 figure a person can read, and the four terms that made
   *  it — each already multiplied by its weight, so they sum to `score`. This is
   *  what lets the board answer "why is this coin here" on the card itself
   *  instead of in a FAQ nobody opens. */
  score: number
  /** The four weighted terms, each 0-100 and summing to `score`. */
  breakdown: { votes: number; volume: number; momentum: number; size: number }
  /** The weights actually applied. Differs from POWER_WEIGHTS when no votes
   *  have been cast and that term is redistributed — see rankMemeBoard. */
  weights: { votes: number; volume: number; momentum: number; size: number }
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
    tier: String(d.tier ?? '').trim().slice(0, 12) || undefined,
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
  /** Holder $CSGN vote weight. The community's stake in the ranking. */
  votes: 0.30,
  /** What actually traded in 24h, on a log scale. */
  volume: 0.25,
  /** Turnover + how far it moved. THE TRENDING TERM — see below. */
  momentum: 0.30,
  /** Market cap, log scale. An anchor, not a driver. */
  size: 0.15,
} as const

/**
 * ── Why the weights changed ────────────────────────────────────────────────
 *
 * The board was ranking nothing like what was actually trending. Three reasons,
 * all structural rather than a matter of taste:
 *
 * 1. THE VOTES TERM WAS DEAD WEIGHT AT LAUNCH. It carried 35% of the score and
 *    nobody had voted, so every coin scored zero on it and the maximum
 *    achievable score was 65. Worse, the ranking was decided entirely by the
 *    remaining terms while a third of the formula sat idle. That weight is now
 *    REDISTRIBUTED across the market terms whenever no votes exist, so the
 *    score means the same thing on day one as it will on day one hundred.
 *
 * 2. MARKET CAP WAS RANKING BY SIZE. A 15% term normalized against the biggest
 *    coin on the board hands the largest, least interesting coin a free 15
 *    points for being large. Size is a sanity anchor — it stops a $2k coin with
 *    four trades topping a memecoin chart — but it is the opposite of trending,
 *    so it is now the smallest term and it is logarithmic.
 *
 * 3. LINEAR NORMALIZATION FLATTENED EVERYTHING. Market data is power-law
 *    distributed: divide by the max and the tenth-biggest coin scores about
 *    0.02, so ninety of a hundred rows were indistinguishable near zero. Volume
 *    and size are normalized on a LOG scale, which is the scale these
 *    quantities actually live on.
 *
 * What replaces size as the driver is MOMENTUM: turnover (24h volume against
 * market cap) plus the absolute size of the 24h move. That is the measurable
 * form of "something is happening here", and it is what makes a coin worth
 * putting on a channel about right now rather than one worth holding.
 */

/** Normalize on a log scale, so a power-law field does not collapse to zero
 *  for everything except its largest member. */
function logNormalizer<T>(items: T[], pick: (item: T) => number): (item: T) => number {
  const logs = items.map((i) => Math.log10(1 + Math.max(0, pick(i))))
  const max = Math.max(1e-9, ...logs)
  return (item) => Math.log10(1 + Math.max(0, pick(item))) / max
}

/** Normalize linearly. Correct for votes, where the raw ratio IS the meaning. */
function normalizer<T>(items: T[], pick: (item: T) => number): (item: T) => number {
  const max = Math.max(1e-9, ...items.map(pick))
  return (item) => Math.max(0, pick(item)) / max
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

  /**
   * Turnover, capped. A coin trading five times its own market cap in a day is
   * a screaming signal; one trading five hundred times is a wash trade, and
   * without a cap it would take the top of the board every time.
   */
  const momentumOf = (c: MemeCoin) => {
    const turnover = c.marketCapUsd > 0 ? Math.min(5, c.volumeH24Usd / c.marketCapUsd) / 5 : 0
    const move = Math.min(1, Math.abs(c.priceChangeH24Pct) / 100)
    return turnover * 0.6 + move * 0.4
  }

  const totalVotes = coins.reduce((sum, c) => sum + votesOf(c), 0)

  // With no votes cast, the votes weight is spread across the market terms in
  // their existing proportions rather than left on the floor.
  const marketWeight = POWER_WEIGHTS.volume + POWER_WEIGHTS.momentum + POWER_WEIGHTS.size
  const spread = totalVotes > 0 ? 0 : POWER_WEIGHTS.votes
  const W = {
    votes: totalVotes > 0 ? POWER_WEIGHTS.votes : 0,
    volume: POWER_WEIGHTS.volume + spread * (POWER_WEIGHTS.volume / marketWeight),
    momentum: POWER_WEIGHTS.momentum + spread * (POWER_WEIGHTS.momentum / marketWeight),
    size: POWER_WEIGHTS.size + spread * (POWER_WEIGHTS.size / marketWeight),
  }

  const nVotes = normalizer(coins, votesOf)
  const nVol = logNormalizer(coins, (c) => c.volumeH24Usd)
  const nSize = logNormalizer(coins, (c) => c.marketCapUsd)
  const nMomentum = normalizer(coins, momentumOf)

  return coins
    .map((c) => {
      // Each term is its normalized value times its weight, so the four add up
      // to `power` exactly — a breakdown that does not sum to the total is a
      // breakdown nobody can check.
      const breakdown = {
        votes: W.votes * nVotes(c),
        volume: W.volume * nVol(c),
        momentum: W.momentum * nMomentum(c),
        size: W.size * nSize(c),
      }
      const power = breakdown.votes + breakdown.volume + breakdown.momentum + breakdown.size
      return {
        ...c,
        power,
        // 0–100, rounded. The weights sum to 1, so power is already a fraction
        // of a perfect score — no rescaling, which keeps the number comparable
        // between refreshes instead of floating with whatever is on the board.
        score: Math.round(power * 100),
        breakdown: {
          votes: Math.round(breakdown.votes * 100),
          volume: Math.round(breakdown.volume * 100),
          momentum: Math.round(breakdown.momentum * 100),
          size: Math.round(breakdown.size * 100),
        },
        /** The weights actually used, so the UI can label the bars honestly
         *  when the votes term has been redistributed. */
        weights: W,
        votes: votesOf(c),
        voters: Math.max(0, Number(votes[c.address]?.wallets) || 0),
        voteShare: totalVotes > 0 ? votesOf(c) / totalVotes : 0,
        rank: 0,
      }
    })
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
