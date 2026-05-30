import { requireUser } from './_shared/auth'
import { auditLog } from './_shared/audit'
import { badRequest } from './_shared/errors'
import { createWrite, commitWrites, getDoc } from './_shared/firebaseAdmin'
import { verifyProofToken } from './_shared/proofTokens'
import { json, parseJson, requireMethod, withHttp } from './_shared/http'
import { emailKey, normalizeEmail, normalizeUsername, usernameKey } from './_shared/validators'

type Body = { username?: string; phantomProofToken?: string; twitchProofToken?: string }
type PhantomProof = { type: string; walletAddress: string; exp: number; iat: number; jti: string }
type TwitchProof = { type: string; twitchUserId: string; username: string; displayName: string; profileImageUrl: string; exp: number; iat: number; jti: string }

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  const authUser = await requireUser(event)
  if (!authUser.email) throw badRequest('Firebase user must have an email.', 'missing_email')
  const body = parseJson<Body>(event)
  const username = normalizeUsername(body.username || '')
  const usernameLower = usernameKey(username)
  const emailLower = normalizeEmail(authUser.email)
  const phantom = verifyProofToken<PhantomProof>(body.phantomProofToken || '', 'phantom_wallet')
  const twitch = verifyProofToken<TwitchProof>(body.twitchProofToken || '', 'twitch_account')
  if (await getDoc(`users/${authUser.uid}`)) throw badRequest('Account already finalized.', 'account_exists')
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
