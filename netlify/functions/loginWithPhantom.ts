/**
 * Sign in with Phantom.
 *
 * The credential is an Ed25519 signature over a single-use server nonce, which
 * is already produced and validated by the existing pair
 * `createPhantomChallenge` → `verifyPhantomSignature`. This function
 * deliberately does NOT re-implement signature checking: it consumes the
 * short-lived `phantom_wallet` proof token that flow mints, so there is exactly
 * one audited verification path in the codebase.
 *
 * Security posture:
 *  - **Never creates accounts.** An unlinked wallet is a 404, so this can't be
 *    used to mint an account or bypass the email + Twitch + Phantom
 *    registration requirements.
 *  - **Never re-links wallets.** The wallet → uid mapping is written once at
 *    registration (`uniquePhantomWallets/{address}`) and only read here.
 *  - The proof token is short-lived and its underlying challenge is single-use
 *    and replay-protected, so a captured request can't be re-run.
 *  - Rate limited per IP like every other auth endpoint.
 */
import { getDoc, createCustomToken } from './_shared/firebaseAdmin'
import { notFound } from './_shared/errors'
import { verifyProofToken } from './_shared/proofTokens'
import { json, parseJson, requireMethod, withHttp } from './_shared/http'
import { requireString } from './_shared/validators'
import { checkRateLimit, clientIp } from './_shared/rateLimit'
import { auditLog } from './_shared/audit'

type PhantomProof = { type: string; walletAddress: string; exp: number; iat: number; jti: string }
type WalletIndex = { uid?: string }
type Body = { proofToken?: string }

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  await checkRateLimit(clientIp(event), 'loginWithPhantom', 10)

  const proof = verifyProofToken<PhantomProof>(
    requireString(parseJson<Body>(event).proofToken, 'proofToken'),
    'phantom_wallet',
  )

  // Direct index read — registration writes uniquePhantomWallets/{address}.
  const index = await getDoc<WalletIndex>(`uniquePhantomWallets/${proof.walletAddress}`)
  if (!index?.uid) {
    throw notFound('No CSGN account is linked to this wallet. Create an account first.')
  }

  const customToken = createCustomToken(index.uid)
  await auditLog('loginWithPhantom', index.uid, { walletAddress: proof.walletAddress })
  return json(200, { customToken })
})
