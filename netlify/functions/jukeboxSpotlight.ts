// Coin Jukebox — the SOL spotlight (TouchTunes for crypto TV). Anyone pays SOL to
// put their coin in the broadcast's rising spotlight; no need to hold or burn
// $CSGN. The SOL lands in the CSGN treasury, which recycles it into distribution,
// creator payouts and liquidity — nothing is burned. Dead simple for the user
// ("pay SOL, my coin goes on TV"). This endpoint is the trust boundary: it
// re-reads the confirmed on-chain payment before granting anything, and each
// payment signature is redeemable once.
//
// ⚠️  The on-chain payment + verification have not been run against a live mainnet
//     transaction in this repo — dry-run with a tiny payment before going public.
import { verifyProofToken } from './_shared/proofTokens'
import { getDoc, writeDoc } from './_shared/firebaseAdmin'
import { badRequest, conflict } from './_shared/errors'
import { json, parseJson, requireMethod, withHttp } from './_shared/http'
import { requireString } from './_shared/validators'
import { checkRateLimit, clientIp } from './_shared/rateLimit'
import { verifySolPayment } from './_shared/solana'
import { bumpOnAirAction } from './_shared/onAirActions'

type WalletProof = { type: string; walletAddress: string; exp: number; iat: number; jti: string }
type Body = { proofToken?: string; signature?: string; symbol?: string; coingeckoId?: string; dexPair?: string; dexChain?: string; note?: string }

const DEFAULT_SOL = 0.1
const LAMPORTS_PER_SOL = 1_000_000_000

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

  const ticker = await getDoc<{ spotlightSol?: number }>('config/ticker')
  const requiredSol = Number(ticker?.spotlightSol) > 0 ? Number(ticker!.spotlightSol) : DEFAULT_SOL
  const minLamports = Math.round(requiredSol * LAMPORTS_PER_SOL)

  // Trust boundary: re-read the confirmed on-chain SOL payment to the treasury.
  const paidLamports = await verifySolPayment(signature, wallet, minLamports)

  try {
    await writeDoc(`spotlightPays/${signature}`, { wallet, symbol, lamports: paidLamports, at: new Date().toISOString() }, { exists: false })
  } catch {
    throw conflict('That payment is already being redeemed.', 'signature_used')
  }

  const spotlight = {
    symbol,
    // A jukebox play is bought airtime, not an endorsement — the ticker renders
    // this as "PAID SPOTLIGHT" so a paid placement is never mistaken for a pick.
    paid: true,
    coingeckoId: String(body.coingeckoId || '').slice(0, 80),
    dexPair: String(body.dexPair || '').slice(0, 80),
    dexChain: String(body.dexChain || 'solana').toLowerCase().slice(0, 20),
    note: String(body.note || 'Spotlight played on the Coin Jukebox · csgn.fun').slice(0, 90),
  }
  await writeDoc('config/ticker', { spotlight, updatedAt: new Date().toISOString() }, { merge: true })
  await bumpOnAirAction('spotlight')

  return json(200, { ok: true, symbol, sol: paidLamports / LAMPORTS_PER_SOL, requiredSol })
})
