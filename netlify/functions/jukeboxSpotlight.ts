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
import { nextJukeboxFloor, JUKEBOX_BASE_FLOOR_CSGN, JUKEBOX_TTL_MS } from './_shared/jukebox'

type WalletProof = { type: string; walletAddress: string; exp: number; iat: number; jti: string }
type Body = { proofToken?: string; signature?: string; symbol?: string; coingeckoId?: string; dexPair?: string; dexChain?: string; note?: string }

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
  const symbol = requireString(body.symbol, 'symbol').toUpperCase().slice(0, 12)
  if (!/^[A-Z0-9$]{2,12}$/.test(symbol)) throw badRequest('Enter a valid ticker symbol (2–12 chars).', 'bad_symbol')

  if (await getDoc(`spotlightPays/${signature}`)) throw conflict('That payment has already been used for a spotlight.', 'signature_used')

  // The floor is derived from the standing bid, never typed by an admin.
  const [ticker, cfg] = await Promise.all([
    getDoc<{ spotlight?: SpotlightDoc }>('config/ticker'),
    getDoc<{ jukeboxFloorCsgn?: number }>('config/tokenGates'),
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
    bidCsgn: paidAmount,
    bidAt: nowISO,
    expiresAt: new Date(Date.now() + JUKEBOX_TTL_MS).toISOString(),
    baseFloorCsgn: baseFloor,
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
