// Buy-and-burn coin spotlight. A holder burns $CSGN on-chain (deflationary) and
// in return their coin is raised in the broadcast's crypto dock spotlight. This
// endpoint is the TRUST BOUNDARY: it never takes the burn on faith — it re-reads
// the confirmed transaction from Solana and re-checks the mint, authority and
// amount before granting anything, and each burn signature can be redeemed once.
//
// ⚠️  The on-chain path (client burn construction + this verification) has not
//     been exercised against a live mainnet transaction in this repo. Dry-run it
//     with a tiny burn before opening buy-and-burn to the public.
import { verifyProofToken } from './_shared/proofTokens'
import { getDoc, writeDoc } from './_shared/firebaseAdmin'
import { badRequest, conflict } from './_shared/errors'
import { json, parseJson, requireMethod, withHttp } from './_shared/http'
import { requireString } from './_shared/validators'
import { checkRateLimit, clientIp } from './_shared/rateLimit'
import { verifyCsgnBurn } from './_shared/solana'
import { bumpOnAirAction } from './_shared/onAirActions'

type WalletProof = { type: string; walletAddress: string; exp: number; iat: number; jti: string }
type Body = { proofToken?: string; signature?: string; symbol?: string; coingeckoId?: string; dexPair?: string; dexChain?: string; note?: string }

const DEFAULT_BURN_CSGN = 500_000

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  await checkRateLimit(clientIp(event), 'burnSpotlight', 10)

  const body = parseJson<Body>(event)
  const proof = verifyProofToken<WalletProof>(requireString(body.proofToken, 'proofToken'), 'phantom_wallet')
  const wallet = proof.walletAddress
  const signature = requireString(body.signature, 'signature')
  const symbol = requireString(body.symbol, 'symbol').toUpperCase().slice(0, 12)
  if (!/^[A-Z0-9$]{2,12}$/.test(symbol)) throw badRequest('Enter a valid ticker symbol (2–12 chars).', 'bad_symbol')

  // Replay guard: one spotlight per burn signature. Reserve it BEFORE granting so
  // a concurrent duplicate can never double-spend the same burn.
  if (await getDoc(`spotlightBurns/${signature}`)) throw conflict('That burn has already been used for a spotlight.', 'signature_used')

  // Required burn amount — admin-configurable via config/ticker.spotlightBurnCsgn.
  const ticker = await getDoc<{ spotlightBurnCsgn?: number }>('config/ticker')
  const required = Number(ticker?.spotlightBurnCsgn) > 0 ? Number(ticker!.spotlightBurnCsgn) : DEFAULT_BURN_CSGN

  // Trust boundary: re-read the confirmed on-chain burn. Throws unless it's a
  // real, successful CSGN burn of >= `required`, authorized by this wallet.
  const burned = await verifyCsgnBurn(signature, wallet, required)

  // Reserve the signature (exists:false → fails if a racing request beat us).
  try {
    await writeDoc(`spotlightBurns/${signature}`, { wallet, symbol, burned, at: new Date().toISOString() }, { exists: false })
  } catch {
    throw conflict('That burn is already being redeemed.', 'signature_used')
  }

  const spotlight = {
    symbol,
    coingeckoId: String(body.coingeckoId || '').slice(0, 80),
    dexPair: String(body.dexPair || '').slice(0, 80),
    dexChain: String(body.dexChain || 'solana').toLowerCase().slice(0, 20),
    note: String(body.note || 'Spotlight bought & burned by a holder · csgn.fun').slice(0, 90),
  }
  // Grant: the ticker's spotlight engine raises this coin on air within ~a minute.
  await writeDoc('config/ticker', { spotlight, updatedAt: new Date().toISOString() }, { merge: true })
  await bumpOnAirAction('spotlight')

  return json(200, { ok: true, symbol, burned, required })
})
