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

type Body = { twitchProofToken?: string; forwardConsent?: boolean }
type TwitchProof = {
  type: string; twitchUserId: string; username: string
  displayName: string; profileImageUrl: string; exp: number; iat: number; jti: string
}
type UserDoc = { twitch?: { verified?: boolean; twitchUserId?: string; username?: string; forwardConsent?: boolean } }

/**
 * THE FORWARDING GRANT.
 *
 * Linking Twitch used to mean one thing: prove you own the channel, so you can
 * claim a block. It now also carries a permission — that CSGN may pick up any
 * stream on that channel and re-broadcast it on the network — and that
 * permission is the entire reason a streamer never has to touch the schedule
 * again. They connect once and stream as they always would; we watch the
 * channel and put them on when they are live.
 *
 * It is stored as a VERSIONED, TIMESTAMPED, SEPARATE flag rather than being
 * implied by the link, for three reasons:
 *
 *  1. Re-broadcasting somebody's video is a real permission with real legal
 *     weight (see /terms §4). "They clicked connect" is not a record of it.
 *     `consentVersion` is what lets us prove WHICH wording they agreed to when
 *     the terms change.
 *  2. It has to be revocable without unlinking the channel — a streamer may
 *     well want to claim blocks deliberately but not be forwarded automatically.
 *  3. `_shared/liveRoster.ts` re-checks it on every single pass, so revoking it
 *     stops the sampling within a minute rather than at some later cleanup.
 */
const FORWARD_CONSENT_VERSION = 1

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
  const forwardConsent = body.forwardConsent === true
  const now = new Date()

  // Re-linking the same channel is where a consent CHANGE lands: the member
  // ticked (or unticked) the box and pressed connect again. Treating it as a
  // pure no-op would make the grant impossible to withdraw from the UI.
  if (user.twitch?.verified && user.twitch.twitchUserId === twitch.twitchUserId) {
    if (forwardConsent !== (user.twitch.forwardConsent === true)) {
      await commitWrites([updateWrite(`users/${authUser.uid}`, {
        twitch: {
          ...user.twitch,
          forwardConsent,
          forwardConsentVersion: forwardConsent ? FORWARD_CONSENT_VERSION : null,
          forwardConsentAt: forwardConsent ? now : null,
        },
        updatedAt: now,
      }, true)])
      await auditLog(forwardConsent ? 'twitchForwardConsentGranted' : 'twitchForwardConsentRevoked', authUser.uid, {
        twitchUserId: twitch.twitchUserId, username: twitch.username,
      })
    }
    return json(200, {
      ok: true, alreadyLinked: true, forwardConsent,
      twitch: { username: twitch.username, displayName: twitch.displayName },
    })
  }
  if (user.twitch?.verified) {
    throw conflict('This account already has a different Twitch channel linked.', 'twitch_already_linked')
  }

  const claimed = await getDoc(`uniqueTwitchUsers/${twitch.twitchUserId}`)
  if (claimed) throw conflict('This Twitch account is already linked to a CSGN account.', 'duplicate_twitch')

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
          // Off unless explicitly granted. A permission to re-broadcast
          // somebody's work must never be the default of a connect button.
          forwardConsent,
          forwardConsentVersion: forwardConsent ? FORWARD_CONSENT_VERSION : null,
          forwardConsentAt: forwardConsent ? now : null,
        },
        updatedAt: now,
      }, true),
    ])
  } catch {
    throw conflict('This Twitch account is already linked to a CSGN account.', 'duplicate_twitch')
  }

  await auditLog('linkTwitch', authUser.uid, { twitchUserId: twitch.twitchUserId, username: twitch.username, forwardConsent })
  return json(200, { ok: true, forwardConsent, twitch: { username: twitch.username, displayName: twitch.displayName, profileImageUrl: twitch.profileImageUrl || '' } })
})
