import { requireUser } from './_shared/auth'
import { auditLog } from './_shared/audit'
import { badRequest, conflict } from './_shared/errors'
import { createWrite, commitWrites, getDoc } from './_shared/firebaseAdmin'
import { verifyProofToken } from './_shared/proofTokens'
import { json, parseJson, requireMethod, withHttp } from './_shared/http'
import { emailKey, normalizeEmail, normalizeUsername, usernameKey } from './_shared/validators'
import { checkRateLimit, clientIp } from './_shared/rateLimit'

type Body = { username?: string; phantomProofToken?: string; twitchProofToken?: string }
type PhantomProof = { type: string; walletAddress: string; exp: number; iat: number; jti: string }
type TwitchProof = { type: string; twitchUserId: string; username: string; displayName: string; profileImageUrl: string; exp: number; iat: number; jti: string }

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  await checkRateLimit(clientIp(event), 'finalizeCreateAccount', 5)
  const authUser = await requireUser(event)
  if (!authUser.email) throw badRequest('Firebase user must have an email.', 'missing_email')
  const body = parseJson<Body>(event)
  const username = normalizeUsername(body.username || '')
  const usernameLower = usernameKey(username)
  const emailLower = normalizeEmail(authUser.email)
  const phantom = verifyProofToken<PhantomProof>(body.phantomProofToken || '', 'phantom_wallet')

  // TWITCH IS OPTIONAL AT SIGN-UP. Phantom is the credential; Twitch is the
  // broadcast permission, and it is only needed to CLAIM A SLOT (see claimSlot).
  //
  // This is not a convenience — it's a correctness fix. Twitch's login page
  // offers "Sign in with Apple", and Apple REFUSES OAuth inside embedded
  // webviews ("disallowed_useragent"). A large share of our users arrive in
  // Phantom's in-app browser, where that combination is simply impossible. When
  // Twitch was mandatory, those users could not create an account at all.
  //
  // Now they get an account, and a clear notice telling them to link Twitch
  // before claiming an hour. See linkTwitch.ts for the second half.
  const twitch = body.twitchProofToken
    ? verifyProofToken<TwitchProof>(body.twitchProofToken, 'twitch_account')
    : null

  if (await getDoc(`users/${authUser.uid}`)) throw badRequest('Account already finalized.', 'account_exists')
  const [existingEmail, existingUsername, existingWallet, existingTwitch] = await Promise.all([
    getDoc(`uniqueEmails/${emailKey(emailLower)}`),
    getDoc(`uniqueUsernames/${usernameLower}`),
    getDoc(`uniquePhantomWallets/${phantom.walletAddress}`),
    twitch ? getDoc(`uniqueTwitchUsers/${twitch.twitchUserId}`) : Promise.resolve(null),
  ])
  if (existingEmail) throw conflict('An account with this email already exists.', 'duplicate_email')
  if (existingUsername) throw conflict('That username is already taken.', 'duplicate_username')
  if (existingWallet) throw conflict('This Phantom wallet is already linked to a CSGN account.', 'duplicate_phantom')
  if (existingTwitch) throw conflict('This Twitch account is already linked to a CSGN account.', 'duplicate_twitch')
  const now = new Date()
  const userDoc = {
    uid: authUser.uid,
    email: authUser.email,
    emailLower,
    username,
    usernameLower,
    phantom: { verified: true, walletAddress: phantom.walletAddress, verifiedAt: now },
    // An unlinked account carries an explicit `verified: false` rather than no
    // twitch field at all, so every consumer reads the same shape and nobody has
    // to distinguish "absent" from "not yet done".
    twitch: twitch
      ? { verified: true, twitchUserId: twitch.twitchUserId, username: twitch.username, displayName: twitch.displayName, profileImageUrl: twitch.profileImageUrl || '', verifiedAt: now }
      : { verified: false },
    role: 'user',
    status: 'active',
    slotLimits: { maxConcurrentClaims: 2 },
    createdAt: now,
    updatedAt: now,
  }
  await commitWrites([
    createWrite(`uniqueEmails/${emailKey(emailLower)}`, { uid: authUser.uid, emailLower, createdAt: now }),
    createWrite(`uniqueUsernames/${usernameLower}`, { uid: authUser.uid, username, createdAt: now }),
    createWrite(`uniquePhantomWallets/${phantom.walletAddress}`, { uid: authUser.uid, createdAt: now }),
    ...(twitch ? [createWrite(`uniqueTwitchUsers/${twitch.twitchUserId}`, { uid: authUser.uid, username: twitch.username, createdAt: now })] : []),
    createWrite(`users/${authUser.uid}`, userDoc),
  ])
  await auditLog('finalizeCreateAccount', authUser.uid, { usernameLower, twitchUserId: twitch?.twitchUserId ?? null, twitchLinked: Boolean(twitch) })
  return json(200, { user: userDoc })
})
