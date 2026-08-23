/**
 * THE COIN JUKEBOX — an open auction for the broadcast spotlight, in $CSGN.
 *
 * ── What changed, and why ──────────────────────────────────────────────────
 *
 * This used to be a FIXED PRICE in either SOL or $CSGN. Two problems with that,
 * and they compound:
 *
 *  1. A fixed price is either too cheap or too expensive, and it is wrong in a
 *     different direction every week as the token moves. There is no number an
 *     admin can type that is still right in a month.
 *  2. Accepting SOL meant the one surface where somebody spends real money to
 *     be on our channel had nothing to do with our token. A project could buy
 *     the spotlight without ever touching $CSGN, so the busiest revenue line on
 *     the network created zero demand for the thing the network runs on.
 *
 * So it is now a BID, and $CSGN is the only currency. The highest live bid holds
 * the spotlight; to take it from them you pay more than they did. That prices
 * itself, it cannot go stale, and every play routes buy pressure through the
 * token — which is the entire economic argument for having a token at all.
 *
 * ── The rules ──────────────────────────────────────────────────────────────
 *
 *  • $CSGN ONLY. No SOL path, on purpose (see above).
 *  • THE MONEY GOES TO THE TREASURY. Not burned. `/treasury` publishes the
 *     wallet and what comes out of it — creator payouts, distribution,
 *     liquidity. A burn would be theatre; a payout is a product.
 *  • A NEW BID MUST CLEAR THE STANDING ONE by at least MIN_RAISE. Outbidding by
 *     one token is how an auction becomes a gas war over nothing.
 *  • A BID EXPIRES. Nobody buys the spotlight forever for one payment —
 *     SPOTLIGHT_TTL_MS after it lands, the floor resets and the slot reopens.
 *  • ONE SIGNATURE, ONE PLAY. The payment is re-read on-chain here and the
 *     signature doc is a CREATE, so a replayed signature loses to the database
 *     rather than to a code path someone remembered to write.
 *
 * ⚠️  The on-chain payment + verification have not been exercised against a live
 *     mainnet transaction in this repo — dry-run with a small bid first.
 */
import { verifyProofToken } from './_shared/proofTokens'
import { getDoc, writeDoc } from './_shared/firebaseAdmin'
import { badRequest, conflict } from './_shared/errors'
import { json, parseJson, requireMethod, withHttp } from './_shared/http'
import { requireString } from './_shared/validators'
import { checkRateLimit, clientIp } from './_shared/rateLimit'
import { verifySplPayment, CSGN_MINT_ADDRESS, CSGN_TOKEN_DECIMALS } from './_shared/solana'
import { bumpOnAirAction } from './_shared/onAirActions'
import { fetchJson } from './_shared/cache'
import {
  nextJukeboxFloor, pushJukeboxWinner, JUKEBOX_BASE_FLOOR_CSGN, JUKEBOX_TTL_MS,
  type JukeboxWinner,
} from './_shared/jukebox'

type WalletProof = { type: string; walletAddress: string; exp: number; iat: number; jti: string }
type Body = { proofToken?: string; signature?: string; address?: string; coingeckoId?: string; dexPair?: string; dexChain?: string; note?: string }

interface SpotlightDoc {
  symbol?: string
  bidCsgn?: number
  bidAt?: string
  wallet?: string
}

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  await checkRateLimit(clientIp(event), 'jukeboxSpotlight', 10)

  const body = parseJson<Body>(event)
  const proof = verifyProofToken<WalletProof>(requireString(body.proofToken, 'proofToken'), 'phantom_wallet')
  const wallet = proof.walletAddress
  const signature = requireString(body.signature, 'signature')
  // ── THE COIN IS A MINT, NOT A TYPED TICKER ──
  //
  // A free-text symbol put a string on television that resolved to nothing —
  // two projects can share a ticker, and a viewer who looks one up finds the
  // wrong coin. The bidder now names a contract address; we read the symbol off
  // the chain. Any Solana mint with a real pair is biddable: the Meme 100's
  // thresholds decide what makes the RANKING, not what somebody may pay to put
  // in the spotlight.
  const address = String(body.address || '').trim()
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    throw badRequest('Pick a coin, or paste its Solana contract address.', 'bad_mint')
  }
  const resolved = await resolveCoin(address)
  if (!resolved) throw badRequest('No Solana trading pair found for that address.', 'unknown_mint')
  const symbol = resolved.symbol

  if (await getDoc(`spotlightPays/${signature}`)) throw conflict('That payment has already been used for a spotlight.', 'signature_used')

  // The floor is derived from the standing bid, never typed by an admin.
  const [ticker, cfg, published] = await Promise.all([
    getDoc<{ spotlight?: SpotlightDoc }>('config/ticker'),
    getDoc<{ jukeboxFloorCsgn?: number }>('config/tokenGates'),
    getDoc<{ history?: JukeboxWinner[] }>('public/jukebox'),
  ])
  const baseFloor = Number(cfg?.jukeboxFloorCsgn) > 0 ? Number(cfg!.jukeboxFloorCsgn) : JUKEBOX_BASE_FLOOR_CSGN
  const standing = ticker?.spotlight ?? {}
  const required = nextJukeboxFloor(
    { bidCsgn: Number(standing.bidCsgn) || 0, bidAt: standing.bidAt ?? null },
    baseFloor,
    Date.now(),
  )

  // Trust boundary: re-read the confirmed on-chain SPL transfer to the treasury.
  // `minRaw` is what makes a lowball bid fail here rather than on screen.
  const minRaw = BigInt(Math.round(required)) * 10n ** BigInt(CSGN_TOKEN_DECIMALS)
  const { raw } = await verifySplPayment(signature, wallet, CSGN_MINT_ADDRESS, minRaw)
  const paidAmount = Number(raw) / 10 ** CSGN_TOKEN_DECIMALS

  const nowISO = new Date().toISOString()
  try {
    await writeDoc(
      `spotlightPays/${signature}`,
      { wallet, symbol, currency: 'CSGN', csgn: paidAmount, at: nowISO },
      { exists: false },
    )
  } catch {
    throw conflict('That payment is already being redeemed.', 'signature_used')
  }

  const spotlight = {
    symbol,
    // The mint travels with the placement, so anything downstream — the ticker,
    // a viewer, an auditor — can resolve the ticker to exactly one coin.
    address,
    // A jukebox play is bought airtime, not an endorsement — the ticker renders
    // this as "PAID SPOTLIGHT" so a paid placement is never mistaken for a pick.
    paid: true,
    bidCsgn: paidAmount,
    bidAt: nowISO,
    wallet,
    coingeckoId: String(body.coingeckoId || '').slice(0, 80),
    dexPair: String(body.dexPair || '').slice(0, 80),
    dexChain: String(body.dexChain || 'solana').toLowerCase().slice(0, 20),
    note: String(body.note || 'Spotlight won on the Coin Jukebox · csgn.fun').slice(0, 90),
  }
  await writeDoc('config/ticker', { spotlight, updatedAt: nowISO }, { merge: true })
  // Published separately so the page can read the standing bid without being
  // able to read config/ticker, which carries admin-only fields.
  await writeDoc('public/jukebox', {
    symbol,
    address,
    bidCsgn: paidAmount,
    bidAt: nowISO,
    expiresAt: new Date(Date.now() + JUKEBOX_TTL_MS).toISOString(),
    baseFloorCsgn: baseFloor,
    ttlMs: JUKEBOX_TTL_MS,
    // The outgoing holder joins the history. Published on the same document so
    // the whole panel — who holds it, for how long, who held it before, and
    // what each of them paid — is one read.
    history: pushJukeboxWinner(published?.history, {
      symbol: standing.symbol,
      bidCsgn: Number(standing.bidCsgn) || 0,
      bidAt: standing.bidAt ?? null,
      wallet: standing.wallet,
    }),
    // What the NEXT bid must pay, computed here so the page never re-implements
    // the auction rule — it reads this until `expiresAt`, then reads the floor.
    // The server re-derives it authoritatively on every bid regardless, so a
    // stale number on screen loses the on-chain check, not the auction.
    nextBidCsgn: nextJukeboxFloor({ bidCsgn: paidAmount, bidAt: nowISO }, baseFloor, Date.now()),
    updatedAt: nowISO,
  })
  await bumpOnAirAction('spotlight')

  return json(200, {
    ok: true,
    symbol,
    currency: 'CSGN' as const,
    amount: paidAmount,
    requiredAmount: required,
    expiresAt: new Date(Date.now() + JUKEBOX_TTL_MS).toISOString(),
  })
})


/** Read a mint's symbol off the chain. The bidder names an address; the ticker
 *  is never taken from what they typed. */
async function resolveCoin(address: string): Promise<{ symbol: string } | null> {
  interface Pair { chainId?: string; baseToken?: { symbol?: string }; liquidity?: { usd?: number } }
  const data = await fetchJson<{ pairs?: Pair[] }>(
    `https://api.dexscreener.com/latest/dex/tokens/${address}`,
    { timeoutMs: 4_000 },
  )
  const pairs = (data?.pairs ?? []).filter((p) => !p.chainId || p.chainId === 'solana')
  if (pairs.length === 0) return null
  const best = pairs.reduce((a, b) => ((b.liquidity?.usd ?? 0) > (a.liquidity?.usd ?? 0) ? b : a))
  const symbol = String(best.baseToken?.symbol || '').toUpperCase().slice(0, 12)
  return { symbol: symbol || address.slice(0, 4).toUpperCase() }
}
