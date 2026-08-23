/**
 * Attach a Phantom wallet to an EXISTING CSGN account.
 *
 * ── The bug this fixes ─────────────────────────────────────────────────────
 *
 * Sign-up has two doors. Wallet sign-up (`finalizeCreateAccount`) writes
 * `phantom: { verified: true, walletAddress }` and everything downstream works.
 * Social sign-up (`finalizeSocialAccount`) writes `phantom: { verified: false }`
 * — and until now there was NO function anywhere that could ever change that.
 *
 * The consequence was invisible and total. Holder airtime is allocated by live
 * $CSGN balance, and the poller reads that balance from
 * `users/{uid}.phantom.walletAddress`, skipping any account where
 * `phantom.verified` is not true. So an account created with Google, X or an
 * email link had a balance of zero forever, no matter what its owner actually
 * held — a member with 1.8 million $CSGN in their wallet was allocated zero
 * seconds of airtime and there was no page in the app that could fix it.
 *
 * That is why this exists: it is the missing half of the split credential
 * model. You sign in however you like, and you attach the wallet when the
 * wallet starts to matter — which is the moment you want airtime or fees.
 *
 * ── The trust boundary ─────────────────────────────────────────────────────
 *
 * Identical to sign-up, deliberately. The client sends a signed `phantom_wallet`
 * proof token minted by `verifyPhantomSignature` after the wallet signed a
 * challenge — never a raw address. Accepting an address from the body would let
 * anybody claim anybody's bag, and since the bag decides airtime, that is the
 * whole ballgame.
 *
 * The `uniquePhantomWallets` write is a CREATE, mirroring linkTwitch and
 * linkEmail: two accounts can never end up on one wallet because the database
 * refuses, not because a code path remembered to check. Without it, one wallet
 * could be attached to ten accounts and claim ten allocations of airtime for
 * one balance — which is precisely the sybil this whole model has to survive.
 */

import { requireUser } from './_shared/auth'
import { auditLog } from './_shared/audit'
import { conflict, notFound } from './_shared/errors'
import { commitWrites, createWrite, getDoc, updateWrite } from './_shared/firebaseAdmin'
import { verifyProofToken } from './_shared/proofTokens'
import { json, parseJson, requireMethod, withHttp } from './_shared/http'
import { checkRateLimit, clientIp } from './_shared/rateLimit'
import { getCsgnBalance } from './_shared/solana'

type Body = { phantomProofToken?: string }
type PhantomProof = { type: string; walletAddress: string; exp: number; iat: number; jti: string }
type UserDoc = { phantom?: { verified?: boolean; walletAddress?: string } }

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  await checkRateLimit(clientIp(event), 'linkPhantom', 10)

  const authUser = await requireUser(event)
  const body = parseJson<Body>(event)
  const phantom = verifyProofToken<PhantomProof>(body.phantomProofToken || '', 'phantom_wallet')
  const walletAddress = phantom.walletAddress

  const user = await getDoc<UserDoc>(`users/${authUser.uid}`)
  if (!user) throw notFound('No CSGN account found for this sign-in.')

  // Re-linking the SAME wallet is a no-op success — someone tapping "Connect
  // wallet" twice has not done anything wrong. Still returns the balance, so
  // the second tap refreshes the number on screen rather than looking inert.
  if (user.phantom?.verified && user.phantom.walletAddress === walletAddress) {
    return json(200, {
      ok: true,
      alreadyLinked: true,
      walletAddress,
      balance: await readBalance(walletAddress),
    })
  }
  if (user.phantom?.verified) {
    throw conflict(
      'This account already has a different wallet linked. Airtime and fees follow one wallet per account.',
      'phantom_already_linked',
    )
  }

  const claimed = await getDoc(`uniquePhantomWallets/${walletAddress}`)
  if (claimed) throw conflict('This wallet is already linked to another CSGN account.', 'duplicate_phantom')

  const now = new Date()
  try {
    await commitWrites([
      createWrite(`uniquePhantomWallets/${walletAddress}`, { uid: authUser.uid, createdAt: now }),
      updateWrite(`users/${authUser.uid}`, {
        phantom: { verified: true, walletAddress, verifiedAt: now },
        updatedAt: now,
      }, true),
    ])
  } catch {
    throw conflict('This wallet is already linked to another CSGN account.', 'duplicate_phantom')
  }

  await auditLog('linkPhantom', authUser.uid, { walletAddress })

  // Read the balance back so /studio can show the real allowance immediately
  // rather than "0 seconds" until the next scheduled rebuild — which is the
  // exact confusing state this function was written to end.
  return json(200, { ok: true, walletAddress, balance: await readBalance(walletAddress) })
})

/** A balance we cannot read is reported as null, not as zero. Zero is a claim
 *  about the wallet; null is a claim about the RPC, and the UI says so. */
async function readBalance(walletAddress: string): Promise<number | null> {
  try {
    return await getCsgnBalance(walletAddress)
  } catch {
    return null
  }
}
