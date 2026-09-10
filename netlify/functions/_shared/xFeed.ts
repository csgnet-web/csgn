/**
 * WHAT CRYPTO IS TALKING ABOUT, from X — and a way to answer the same question
 * when X is not available.
 *
 * ── What this needs from X, stated plainly ─────────────────────────────────
 *
 * `GET /2/tweets/search/recent`, which is a PAID endpoint. X's free access tier
 * is write-only plus a single read of your own user, so there is no free way to
 * read a timeline you do not own. Recent search starts at the Basic tier.
 * `X_BEARER_TOKEN` is an app-only bearer from the X developer portal.
 *
 * That is a real bill for a rail that updates every couple of hours, so this
 * module is built to be honest about being switched off: with no token
 * configured it returns nothing and says so, and the caller falls back to the
 * market data the channel already pays for. The rail keeps updating either
 * way — it is just reading the chart instead of the timeline.
 *
 * ── Everything here is untrusted ───────────────────────────────────────────
 *
 * A post is written by anyone. `_shared/rightNow.ts` states the threat and owns
 * the defence; this module's only job is to fetch, parse and hand back text.
 * It deliberately does no filtering of its own beyond structural sanity — one
 * filter in one place, or there are two standards.
 */
import { fetchJson } from './cache'

const RECENT_SEARCH_URL = 'https://api.x.com/2/tweets/search/recent'

/** The default query. Crypto-native, English, original posts only, and no
 *  links — a post that is mostly a link is an advert, and the rail cannot carry
 *  the link anyway. Overridable with `X_RAIL_QUERY` so the operator can point
 *  it at a list of accounts, a cashtag, or their own community without a
 *  deploy. */
const DEFAULT_QUERY = '(crypto OR solana OR memecoin OR $SOL) -is:retweet -is:reply -has:links lang:en'

/** How many posts to read per run. Small on purpose: this is raw material for
 *  four lines, not a dataset, and every field costs against the tier's cap. */
const MAX_RESULTS = 25

/** Ignore anything with less traction than this. A post nobody engaged with is
 *  not "what crypto is talking about", it is one person talking. */
const MIN_ENGAGEMENT = 5

export interface XPost {
  id: string
  text: string
  /** likes + reposts + replies, for ranking. */
  engagement: number
  createdAt: string
}

export function xConfigured(): boolean {
  return Boolean(process.env.X_BEARER_TOKEN)
}

export function railQuery(): string {
  return (process.env.X_RAIL_QUERY || '').trim() || DEFAULT_QUERY
}

interface RawSearch {
  data?: Array<{
    id?: string
    text?: string
    created_at?: string
    public_metrics?: { like_count?: number; retweet_count?: number; reply_count?: number; quote_count?: number }
  }>
  errors?: Array<{ title?: string; detail?: string }>
}

/**
 * Parse a recent-search response into ranked posts.
 *
 * Pure and exported so X's response shape is pinned by a test rather than
 * discovered at 3 AM when the rail stops updating. A body with `errors` and no
 * `data` — which X answers with a 200 — parses to an empty list rather than
 * throwing, because a bad query must not take the run down.
 */
export function parseXSearch(body: unknown, minEngagement = MIN_ENGAGEMENT): XPost[] {
  const rows = (body as RawSearch | null)?.data
  if (!Array.isArray(rows)) return []

  return rows
    .map((row) => {
      const m = row?.public_metrics ?? {}
      return {
        id: String(row?.id ?? ''),
        // Collapse to one line here: a post's newlines are not information the
        // rail can use, and they make every downstream length check lie.
        text: String(row?.text ?? '').replace(/\s+/g, ' ').trim(),
        engagement:
          (Number(m.like_count) || 0)
          + (Number(m.retweet_count) || 0)
          + (Number(m.reply_count) || 0)
          + (Number(m.quote_count) || 0),
        createdAt: String(row?.created_at ?? ''),
      }
    })
    // A post with no id or no text is not a post. A post that is only a mention
    // or a cashtag carries no sentence for a model to work from.
    .filter((post) => post.id && post.text.length >= 20 && post.engagement >= minEngagement)
    .sort((a, b) => b.engagement - a.engagement)
}

/**
 * Read the timeline. Answers `null` when X is not configured — distinct from
 * `[]`, which means "configured, asked, nothing came back", and the caller says
 * something different about each.
 */
export async function fetchXPosts(limit = MAX_RESULTS): Promise<XPost[] | null> {
  if (!xConfigured()) return null

  const params = new URLSearchParams({
    query: railQuery(),
    max_results: String(Math.min(100, Math.max(10, limit))),
    'tweet.fields': 'public_metrics,created_at',
  })

  try {
    const body = await fetchJson<unknown>(`${RECENT_SEARCH_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${process.env.X_BEARER_TOKEN}` },
      timeoutMs: 8_000,
    })
    return parseXSearch(body)
  } catch (err) {
    // A rate limit or an outage at X is not a reason to fail the run — the
    // caller has a fallback, and a rail that stops updating when X hiccups is
    // a rail nobody trusts.
    console.warn('[rightNow] X search failed:', err)
    return []
  }
}

/* ─── The fallback: what the channel already knows ─── */

export interface MarketCoin { symbol?: unknown; priceChange24h?: unknown; marketCap?: unknown; name?: unknown }

/**
 * Turn the Meme 100 board into raw material.
 *
 * The board is rebuilt every five minutes by the poller and already lives at
 * `public/memeBoard`, so this costs one document read and no third-party call.
 * It is a genuinely good substitute: "what moved today" is most of what the
 * timeline is talking about anyway, one step removed.
 *
 * Pure, and exported, for the same reason as `parseXSearch`.
 */
export function marketMaterial(coins: readonly MarketCoin[], limit = 12): string[] {
  return coins
    .map((coin) => ({
      symbol: String(coin?.symbol ?? '').trim().slice(0, 16),
      change: Number(coin?.priceChange24h),
      cap: Number(coin?.marketCap),
    }))
    .filter((coin) => coin.symbol && Number.isFinite(coin.change))
    // Biggest movers in either direction — a flat coin is not material.
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
    .slice(0, limit)
    .map((coin) => {
      const direction = coin.change >= 0 ? 'up' : 'down'
      const cap = Number.isFinite(coin.cap) && coin.cap > 0
        ? ` at about $${Math.round(coin.cap).toLocaleString('en-US')} market cap`
        : ''
      return `${coin.symbol} is ${direction} ${Math.abs(coin.change).toFixed(1)}% over 24h${cap}`
    })
}
