/**
 * Link a Twitch account to an EXISTING CSGN account.
 *
 * The second half of the optional-Twitch sign-up (see finalizeCreateAccount).
 * You create an account with Phantom, and you attach Twitch when you're ready to
 * claim an hour — which is the only thing it gates.
 *
 * That split exists for a concrete reason: Twitch's login page offers "Sign in
 * with Apple", and Apple refuses OAuth inside embedded webviews. A user arriving
 * in Phantom's in-app browser literally cannot complete that hop. Splitting the
 * step means they get an account there and finish the link in a real browser,
 * instead of bouncing off sign-up entirely.
 *
 * Same trust boundary as sign-up: the client sends a signed `twitch_account`
 * proof token minted by the OAuth callback, never a raw username. The uniqueness
 * lock is a CREATE, so two accounts can never end up on one Twitch channel — the
 * database refuses rather than the code remembering to check.
 */

import { requireUser } from './_shared/auth'
import { auditLog } from './_shared/audit'
import { conflict, notFound } from './_shared/errors'
import { commitWrites, createWrite, getDoc, updateWrite } from './_shared/firebaseAdmin'
import { verifyProofToken } from './_shared/proofTokens'
import { json, parseJson, requireMethod, withHttp } from './_shared/http'
import { checkRateLimit, clientIp } from './_shared/rateLimit'

type Body = { twitchProofToken?: string }
type TwitchProof = {
  type: string; twitchUserId: string; username: string
  displayName: string; profileImageUrl: string; exp: number; iat: number; jti: string
}
type UserDoc = { twitch?: { verified?: boolean; twitchUserId?: string; username?: string } }

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  await checkRateLimit(clientIp(event), 'linkTwitch', 10)

  const authUser = await requireUser(event)
  const body = parseJson<Body>(event)
  const twitch = verifyProofToken<TwitchProof>(body.twitchProofToken || '', 'twitch_account')

  const user = await getDoc<UserDoc>(`users/${authUser.uid}`)
  if (!user) throw notFound('No CSGN account found for this sign-in.')

  // Re-linking the SAME channel is a no-op success, not an error — a user who
  // taps "Connect Twitch" twice should not be told they've done something wrong.
  if (user.twitch?.verified && user.twitch.twitchUserId === twitch.twitchUserId) {
    return json(200, { ok: true, alreadyLinked: true, twitch: { username: twitch.username, displayName: twitch.displayName } })
  }
  if (user.twitch?.verified) {
    throw conflict('This account already has a different Twitch channel linked.', 'twitch_already_linked')
  }

  const claimed = await getDoc(`uniqueTwitchUsers/${twitch.twitchUserId}`)
  if (claimed) throw conflict('This Twitch account is already linked to a CSGN account.', 'duplicate_twitch')

  const now = new Date()
  try {
    await commitWrites([
      // CREATE, so a concurrent link of the same channel loses rather than
      // silently overwriting the first one.
      createWrite(`uniqueTwitchUsers/${twitch.twitchUserId}`, {
        uid: authUser.uid, username: twitch.username, createdAt: now,
      }),
      updateWrite(`users/${authUser.uid}`, {
        twitch: {
          verified: true,
          twitchUserId: twitch.twitchUserId,
          username: twitch.username,
          displayName: twitch.displayName,
          profileImageUrl: twitch.profileImageUrl || '',
          verifiedAt: now,
        },
        updatedAt: now,
      }, true),
    ])
  } catch {
    throw conflict('This Twitch account is already linked to a CSGN account.', 'duplicate_twitch')
  }

  await auditLog('linkTwitch', authUser.uid, { twitchUserId: twitch.twitchUserId, username: twitch.username })
  return json(200, { ok: true, twitch: { username: twitch.username, displayName: twitch.displayName, profileImageUrl: twitch.profileImageUrl || '' } })
})
