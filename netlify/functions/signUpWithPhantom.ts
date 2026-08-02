/**
 * Create a CSGN account from a wallet alone.
 *
 * Phantom is the credential. A signature over a single-use server nonce proves
 * control of the wallet, and that's enough to have an account — no email, no
 * password, no Twitch. Those get attached later, when they're actually needed:
 *
 *   • EMAIL gates claiming a slot (see claimSlot). Attached via setAccountEmail.
 *   • TWITCH gates going on air. Attached via linkTwitch.
 *
 * Why this exists: the old flow demanded email + password + Twitch up front, and
 * a meaningful share of arrivals come through Phantom's in-app browser where
 * Twitch's "Sign in with Apple" cannot complete at all. Those users bounced off
 * registration entirely. Now the wallet is the door and everything else is a
 * prompt on the profile.
 *
 * The uid is derived from the wallet (`phantom:<address>`), which makes the whole
 * thing idempotent: a double-submit or a retry resolves to the same account
 * rather than a second one. Firebase Auth materialises the user record on first
 * `signInWithCustomToken`, so there is no separate account-creation call to keep
 * in sync with this document.
 */

import { auditLog } from './_shared/audit'
import { conflict } from './_shared/errors'
import { commitWrites, createCustomToken, createWrite, getDoc } from './_shared/firebaseAdmin'
import { verifyProofToken } from './_shared/proofTokens'
import { json, parseJson, requireMethod, withHttp } from './_shared/http'
import { normalizeUsername, requireString, usernameKey } from './_shared/validators'
import { checkRateLimit, clientIp } from './_shared/rateLimit'

type PhantomProof = { type: string; walletAddress: string; exp: number; iat: number; jti: string }
type Body = { proofToken?: string; username?: string }
type WalletIndex = { uid?: string }

/** Deterministic uid from the wallet — makes account creation idempotent. */
export const uidForWallet = (walletAddress: string): string => `phantom:${walletAddress}`

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  await checkRateLimit(clientIp(event), 'signUpWithPhantom', 5)

  const body = parseJson<Body>(event)
  const proof = verifyProofToken<PhantomProof>(requireString(body.proofToken, 'proofToken'), 'phantom_wallet')
  const wallet = proof.walletAddress
  const username = normalizeUsername(body.username || '')
  const usernameLower = usernameKey(username)

  // Already registered? Hand back a token rather than an error. A user pressing
  // "sign up" with a wallet that already has an account meant to sign in, and
  // telling them off for it is a dead end with no button on it.
  const existingWallet = await getDoc<WalletIndex>(`uniquePhantomWallets/${wallet}`)
  if (existingWallet?.uid) {
    return json(200, { customToken: createCustomToken(existingWallet.uid), existing: true })
  }

  if (await getDoc(`uniqueUsernames/${usernameLower}`)) {
    throw conflict('That username is already taken.', 'duplicate_username')
  }

  const uid = uidForWallet(wallet)
  const now = new Date()
  const userDoc = {
    uid,
    // No email yet. Explicitly empty rather than absent, so every consumer reads
    // one shape and nothing has to distinguish "missing" from "not yet given".
    email: '',
    username,
    usernameLower,
    phantom: { verified: true, walletAddress: wallet, verifiedAt: now },
    twitch: { verified: false },
    role: 'user',
    status: 'active',
    slotLimits: { maxConcurrentClaims: 2 },
    createdAt: now,
    updatedAt: now,
  }

  try {
    await commitWrites([
      // CREATEs, so two concurrent sign-ups on the same wallet or username can
      // never both succeed — the database refuses rather than the code checking.
      createWrite(`uniqueUsernames/${usernameLower}`, { uid, username, createdAt: now }),
      createWrite(`uniquePhantomWallets/${wallet}`, { uid, createdAt: now }),
      createWrite(`users/${uid}`, userDoc),
    ])
  } catch {
    throw conflict('That username was just taken. Please pick another.', 'duplicate_username')
  }

  await auditLog('signUpWithPhantom', uid, { walletAddress: wallet, usernameLower })
  return json(200, { customToken: createCustomToken(uid), existing: false })
})
