/**
 * Sign up with Phantom — the wallet IS the account.
 *
 * The whole registration is: prove the wallet, pick a username. No email, no
 * password, no verification round trip. That is not a shortcut, it is the
 * honest shape of this product's credential:
 *
 *  - The credential was ALREADY the wallet. `loginWithPhantom` has always let a
 *    registered holder in on an Ed25519 signature over a single-use server
 *    nonce, so the password an account was created with was, from the second
 *    sign-in onward, a second weaker key nobody used.
 *  - A signature over a server nonce beats a password on every axis that
 *    matters here: nothing shared is transmitted, nothing is replayable (the
 *    challenge is single-use and short-lived), and a database breach leaks no
 *    credential to reuse. Phantom is also required to claim an hour regardless,
 *    since creator fees are paid to that wallet.
 *  - Email verification was never the abuse gate its cost implied. It stopped
 *    nobody determined from registering; the gates with teeth are the Twitch
 *    link (required to claim an hour, and an account with real history behind
 *    it), the per-user concurrent-claim limit, and the on-chain check below.
 *
 * What is genuinely lost is RECOVERY and CONTACT: with no email there is no
 * reset path if a seed phrase is gone, and no way to reach a streamer off-site.
 * That is why email stays available — as an optional addition on an existing
 * account, and as the classic email+password sign-up for anyone who wants it
 * (see finalizeCreateAccount.ts). It is no longer the toll gate on the door.
 *
 * ── Why this isn't the v1.17 wallet sign-up that got reverted ───────────────
 *
 * Wallet-only registration shipped once (v1.17) and was pulled in v1.18 for a
 * correct reason: it "made mass registration far too cheap". A keypair is free,
 * instant and generated offline — as a registration cost that is *weaker* than
 * a verified email, not stronger, because throwaway inboxes at least need mail
 * infrastructure that can be blocklisted.
 *
 * That objection is answered here rather than ignored, by charging for the
 * thing an attacker cannot fake for free: ON-CHAIN HISTORY. The wallet must
 * hold lamports or have signed at least one transaction (`isEstablishedWallet`).
 * Funding and transacting thousands of wallets costs real SOL on a public
 * ledger; a real Phantom user passes without noticing. Rate limiting per IP
 * stays on top of it.
 *
 * If the chain can't be reached, this FAILS OPEN and records `walletCheck:
 * 'unavailable'` on the account. That is deliberate: this gate is anti-spam,
 * not anti-fraud — nothing about a claim, a payout or an admin power rests on
 * it — and an RPC outage locking every new member out of the product is a worse
 * failure than a handful of unchecked accounts an admin can audit after.
 *
 * Security posture, mirroring loginWithPhantom.ts:
 *  - Consumes the same short-lived `phantom_wallet` proof minted by
 *    createPhantomChallenge → verifyPhantomSignature. Signature checking has
 *    exactly one audited implementation and this is not a second one.
 *  - Never touches an EXISTING account. A wallet that already has one is a
 *    conflict, not a takeover: `uniquePhantomWallets/{address}` is written with
 *    `exists: false`, so two concurrent sign-ups on one wallet cannot both win,
 *    and re-running this can never re-point a wallet at a different uid.
 *  - The uid is server-minted and random. The Firebase Auth user itself is
 *    created by the client's `signInWithCustomToken` exchange, so a caller can
 *    never name the uid they land on.
 *  - Rate limited per IP like every other auth endpoint.
 */
import { randomUUID } from 'node:crypto'
import { auditLog } from './_shared/audit'
import { conflict, HttpError } from './_shared/errors'
import { createWrite, commitWrites, getDoc, createCustomToken } from './_shared/firebaseAdmin'
import { verifyProofToken } from './_shared/proofTokens'
import { json, parseJson, requireMethod, withHttp } from './_shared/http'
import { normalizeUsername, normalizeWalletAddress, usernameKey } from './_shared/validators'
import { checkRateLimit, clientIp } from './_shared/rateLimit'
import { isEstablishedWallet } from './_shared/solana'

/**
 * Lamports a wallet must hold to register on balance alone (0.001 SOL). Any
 * on-chain history clears the gate regardless of balance, so this only has to
 * be high enough that a dust-spray across freshly minted keypairs costs the
 * sprayer more than it costs us. Override with CSGN_SIGNUP_MIN_LAMPORTS.
 */
const MIN_SIGNUP_LAMPORTS = Number(process.env.CSGN_SIGNUP_MIN_LAMPORTS || 1_000_000)

type Body = { username?: string; phantomProofToken?: string; twitchProofToken?: string }
type PhantomProof = { type: string; walletAddress: string; exp: number; iat: number; jti: string }
type TwitchProof = { type: string; twitchUserId: string; username: string; displayName: string; profileImageUrl: string; exp: number; iat: number; jti: string }

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  await checkRateLimit(clientIp(event), 'signupWithPhantom', 5)
  const body = parseJson<Body>(event)
  const username = normalizeUsername(body.username || '')
  const usernameLower = usernameKey(username)
  const phantom = verifyProofToken<PhantomProof>(body.phantomProofToken || '', 'phantom_wallet')
  // The address is already validated where the proof is minted, so this is
  // belt-and-braces — but it goes straight into a Firestore document path below,
  // and a path component is not somewhere to rely on a check made two functions
  // away staying where it is.
  const walletAddress = normalizeWalletAddress(phantom.walletAddress)

  // Twitch is optional at sign-up for the same reason it is optional in
  // finalizeCreateAccount: it is the broadcast permission, not the credential,
  // and it is only needed to CLAIM an hour. It also cannot always be completed
  // in the browser the user arrives in — Twitch's login offers "Sign in with
  // Apple", and Apple refuses OAuth inside embedded webviews like Phantom's.
  const twitch = body.twitchProofToken
    ? verifyProofToken<TwitchProof>(body.twitchProofToken, 'twitch_account')
    : null

  const [existingWallet, existingUsername, existingTwitch] = await Promise.all([
    getDoc(`uniquePhantomWallets/${walletAddress}`),
    getDoc(`uniqueUsernames/${usernameLower}`),
    twitch ? getDoc(`uniqueTwitchUsers/${twitch.twitchUserId}`) : Promise.resolve(null),
  ])
  if (existingWallet) throw conflict('This wallet already has a CSGN account — sign in with Phantom instead.', 'duplicate_phantom')
  if (existingUsername) throw conflict('That username is already taken.', 'duplicate_username')
  if (existingTwitch) throw conflict('This Twitch account is already linked to a CSGN account.', 'duplicate_twitch')

  // The sybil gate — see the header. Checked AFTER the cheap uniqueness reads so
  // a duplicate never costs an RPC round trip. The chain call is kept in its own
  // try so ONLY an RPC failure falls open; the rejection below is a decision,
  // not an error, and is made outside the catch where nothing can swallow it.
  let established: boolean | null = null
  try {
    established = await isEstablishedWallet(walletAddress, MIN_SIGNUP_LAMPORTS)
  } catch (err) {
    console.warn('signup wallet check unavailable:', err)
  }
  if (established === false) {
    throw new HttpError(
      403,
      'wallet_not_established',
      'This wallet has no Solana activity yet. Fund it or make one transaction, then sign up — or create your account with an email and password instead.',
    )
  }
  const walletCheck = established === true ? 'established' : 'unavailable'

  const uid = `w_${randomUUID().replace(/-/g, '')}`
  const now = new Date()
  const userDoc = {
    uid,
    // Kept as empty strings rather than omitted so every reader sees one shape
    // and nobody has to distinguish "wallet account" from "malformed doc".
    // An address added later from the account page fills these in.
    email: '',
    emailLower: '',
    username,
    usernameLower,
    /** How the account was created. Wallet accounts have no password to reset,
     *  which is what the account page needs to know before offering one. */
    authMethod: 'phantom',
    phantom: { verified: true, walletAddress, verifiedAt: now },
    /** Result of the on-chain sybil check at sign-up. 'unavailable' means the
     *  RPC was unreachable and the account was let through — auditable, and the
     *  only reason this is stored rather than merely logged. */
    walletCheck,
    twitch: twitch
      ? { verified: true, twitchUserId: twitch.twitchUserId, username: twitch.username, displayName: twitch.displayName, profileImageUrl: twitch.profileImageUrl || '', verifiedAt: now }
      : { verified: false },
    role: 'user',
    status: 'active',
    slotLimits: { maxConcurrentClaims: 2 },
    createdAt: now,
    updatedAt: now,
  }

  // Every write is create-only, so the wallet and username indexes are the
  // atomic guard: a second concurrent sign-up on either loses the whole commit
  // rather than half-writing an account.
  await commitWrites([
    createWrite(`uniqueUsernames/${usernameLower}`, { uid, username, createdAt: now }),
    createWrite(`uniquePhantomWallets/${walletAddress}`, { uid, createdAt: now }),
    ...(twitch ? [createWrite(`uniqueTwitchUsers/${twitch.twitchUserId}`, { uid, username: twitch.username, createdAt: now })] : []),
    createWrite(`users/${uid}`, userDoc),
  ])

  await auditLog('signupWithPhantom', uid, { usernameLower, walletAddress, twitchLinked: Boolean(twitch), walletCheck })
  // The Firebase Auth user does not exist yet — exchanging this token client-side
  // is what creates it, which is why the token is minted only after the account
  // documents have committed.
  return json(200, { customToken: createCustomToken(uid), user: userDoc })
})
