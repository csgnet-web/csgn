import { requireUser } from './_shared/auth'
import { auditLog } from './_shared/audit'
import { badRequest, conflict } from './_shared/errors'
import { createWrite, commitWrites, getDoc } from './_shared/firebaseAdmin'
import { verifyProofToken } from './_shared/proofTokens'
import { json, parseJson, requireMethod, withHttp } from './_shared/http'
import { emailKey, normalizeEmail, normalizeUsername, usernameKey } from './_shared/validators'
import { checkRateLimit, clientIp } from './_shared/rateLimit'
import { TOS_VERSION } from './_shared/tos'

type Body = { username?: string; phantomProofToken?: string; twitchProofToken?: string; acceptedTos?: boolean }
type PhantomProof = { type: string; walletAddress: string; exp: number; iat: number; jti: string }
type TwitchProof = { type: string; twitchUserId: string; username: string; displayName: string; profileImageUrl: string; exp: number; iat: number; jti: string }

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  await checkRateLimit(clientIp(event), 'finalizeCreateAccount', 5)
  const authUser = await requireUser(event)
  if (!authUser.email) throw badRequest('Firebase user must have an email.', 'missing_email')
  const body = parseJson<Body>(event)
  if (body.acceptedTos !== true) throw badRequest('You must accept the Terms of Service to create an account.', 'tos_required')
  const username = normalizeUsername(body.username || '')
  const usernameLower = usernameKey(username)
  const emailLower = normalizeEmail(authUser.email)
  const phantom = verifyProofToken<PhantomProof>(body.phantomProofToken || '', 'phantom_wallet')
  const twitch = verifyProofToken<TwitchProof>(body.twitchProofToken || '', 'twitch_account')
  if (await getDoc(`users/${authUser.uid}`)) throw badRequest('Account already finalized.', 'account_exists')
  const [existingEmail, existingUsername, existingWallet, existingTwitch] = await Promise.all([
    getDoc(`uniqueEmails/${emailKey(emailLower)}`),
    getDoc(`uniqueUsernames/${usernameLower}`),
    getDoc(`uniquePhantomWallets/${phantom.walletAddress}`),
    getDoc(`uniqueTwitchUsers/${twitch.twitchUserId}`),
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
    twitch: { verified: true, twitchUserId: twitch.twitchUserId, username: twitch.username, displayName: twitch.displayName, profileImageUrl: twitch.profileImageUrl || '', verifiedAt: now },
    role: 'user',
    status: 'active',
    slotLimits: { maxConcurrentClaims: 2 },
    acceptedTosAt: now,
    tosVersion: TOS_VERSION,
    createdAt: now,
    updatedAt: now,
  }
  await commitWrites([
    createWrite(`uniqueEmails/${emailKey(emailLower)}`, { uid: authUser.uid, emailLower, createdAt: now }),
    createWrite(`uniqueUsernames/${usernameLower}`, { uid: authUser.uid, username, createdAt: now }),
    createWrite(`uniquePhantomWallets/${phantom.walletAddress}`, { uid: authUser.uid, createdAt: now }),
    createWrite(`uniqueTwitchUsers/${twitch.twitchUserId}`, { uid: authUser.uid, username: twitch.username, createdAt: now }),
    createWrite(`users/${authUser.uid}`, userDoc),
  ])
  await auditLog('finalizeCreateAccount', authUser.uid, { usernameLower, twitchUserId: twitch.twitchUserId })
  return json(200, { user: userDoc })
})
