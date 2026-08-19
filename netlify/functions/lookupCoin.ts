/**
 * LOOK UP ANY SOLANA MINT.
 *
 * The Meme 100 is a curated set — coins have to clear on-chain thresholds to
 * make it, and that is right for a RANKING that goes on television. But it is
 * wrong as a limit on what somebody may back or bid for: a member who wants to
 * put their own coin in the spotlight, or vote for something that launched this
 * morning, should not be told "not on the board" as if the coin does not exist.
 *
 * So the board is the pick list and this is the escape hatch. Paste any mint
 * and we look it up live, show what it actually is, and let the member decide.
 * What it does NOT do is add the coin to the board — the ranking's thresholds
 * stay exactly as strict as they were.
 *
 * ── The one real check ─────────────────────────────────────────────────────
 *
 * A mint with no tradeable pair is refused. Not for curation reasons — because
 * a coin nobody can trade cannot be a coin anybody meaningfully backed, and
 * putting its ticker on the broadcast would be putting a string on television
 * that resolves to nothing.
 */
import { badRequest, notFound } from './_shared/errors'
import { json, requireMethod, withHttp } from './_shared/http'
import { checkRateLimit, clientIp } from './_shared/rateLimit'
import { fetchJson, memo } from './_shared/cache'

const SOLANA_MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const LOOKUP_TTL_MS = 60_000

interface DexPair {
  chainId?: string
  baseToken?: { address?: string; symbol?: string; name?: string }
  priceUsd?: string
  marketCap?: number
  fdv?: number
  volume?: { h24?: number }
  priceChange?: { h24?: number }
  liquidity?: { usd?: number }
  url?: string
  info?: { imageUrl?: string }
  pairCreatedAt?: number
}

export const handler = withHttp(async (event) => {
  requireMethod(event, 'GET')
  await checkRateLimit(clientIp(event), 'lookupCoin', 30)

  const address = String(event.queryStringParameters?.address || '').trim()
  if (!SOLANA_MINT_RE.test(address)) {
    throw badRequest('That is not a Solana contract address.', 'bad_mint')
  }

  const data = await memo(`coin:${address}`, LOOKUP_TTL_MS, () =>
    fetchJson<{ pairs?: DexPair[] }>(`https://api.dexscreener.com/latest/dex/tokens/${address}`))

  const pairs = (data?.pairs ?? []).filter((p) => !p.chainId || p.chainId === 'solana')
  if (pairs.length === 0) {
    throw notFound('No Solana trading pair found for that address.')
  }

  // Deepest liquidity wins — a thin pair quotes a price nobody can trade at.
  const best = pairs.reduce((a, b) => ((b.liquidity?.usd ?? 0) > (a.liquidity?.usd ?? 0) ? b : a))

  return json(200, {
    coin: {
      address,
      symbol: String(best.baseToken?.symbol || '').toUpperCase().slice(0, 12) || address.slice(0, 4).toUpperCase(),
      name: String(best.baseToken?.name || '').slice(0, 60),
      imageUrl: String(best.info?.imageUrl || ''),
      priceUsd: Number(best.priceUsd) || 0,
      marketCapUsd: Number(best.marketCap ?? best.fdv) || 0,
      volumeH24Usd: Number(best.volume?.h24) || 0,
      priceChangeH24Pct: Number(best.priceChange?.h24) || 0,
      liquidityUsd: Number(best.liquidity?.usd) || 0,
      pairUrl: String(best.url || `https://dexscreener.com/solana/${address}`),
      /** Not on the published Meme 100 — the caller shows this so nobody
       *  thinks pasting an address added their coin to the ranking. */
      onBoard: false,
    },
  })
})
