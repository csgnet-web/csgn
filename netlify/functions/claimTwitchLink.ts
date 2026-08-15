/**
 * Claim the result of a Twitch round trip — the endpoint the waiting tab polls.
 *
 * Replaces `consumeTwitchOAuthResult`, which could only ever be called by the
 * browser that came back from Twitch holding a handoff id in its URL. That
 * assumption is exactly what broke for the users we actually have: they start
 * in Phantom's in-app browser, where Twitch's Google / Apple / Amazon buttons
 * cannot work, so the OAuth finishes in Safari and the handoff id lands in the
 * wrong browser.
 *
 * Here the caller proves entitlement with the signed `twitch_link` token minted
 * by startTwitchOAuth, which never leaves the tab that started the flow. So
 * whichever browser completes the OAuth, the proof is handed to the tab the
 * user is actually looking at — and to nobody else.
 *
 * Trust boundary:
 *  - The link token is an HMAC over the OAuth state. Forging one is forging a
 *    signature; guessing a state is guessing 192 random bits.
 *  - The proof is handed out exactly once (`used` is set before it is returned),
 *    so a captured response cannot be replayed into a second account.
 *  - `pending` is a 200, not an error. Polling is the normal case and a stream
 *    of 404s in the logs would bury the failures that matter.
 */
import { getDoc, writeDoc } from './_shared/firebaseAdmin'
import { verifyProofToken } from './_shared/proofTokens'
import { json, parseJson, requireMethod, withHttp } from './_shared/http'
import { requireString } from './_shared/validators'
import { checkRateLimit, clientIp } from './_shared/rateLimit'

type LinkProof = { type: string; state: string; exp: number; iat: number; jti: string }

type ResultDoc = {
  used?: boolean
  expiresAt?: string
  error?: string
  twitchProofToken?: string
  twitchUserId?: string
  username?: string
  displayName?: string
  profileImageUrl?: string
}

/**
 * Headroom over the client's poll schedule (~30 requests in the busiest
 * minute — see pollDelayMs in src/lib/twitchLink.ts) so a user on a flaky
 * connection retrying is never rate limited out of their own sign-up, while a
 * scripted caller still hits a ceiling.
 */
const POLL_LIMIT_PER_MINUTE = 60

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  await checkRateLimit(clientIp(event), 'claimTwitchLink', POLL_LIMIT_PER_MINUTE)

  const linkToken = requireString(parseJson<{ linkToken?: string }>(event).linkToken, 'linkToken')
  const proof = verifyProofToken<LinkProof>(linkToken, 'twitch_link')

  const doc = await getDoc<ResultDoc>(`twitchOAuthResults/${proof.state}`)
  // Nothing written yet — the user is still on Twitch, or in another browser.
  if (!doc) return json(200, { status: 'pending' })

  if (doc.expiresAt && new Date(doc.expiresAt).getTime() <= Date.now()) {
    return json(200, { status: 'failed', error: 'oauth_state_expired' })
  }
  // Already claimed. Terminal rather than pending: a second claim means a
  // double-mounted effect or a refresh, and telling it to keep polling would
  // spin forever.
  if (doc.used) return json(200, { status: 'failed', error: 'handoff_used' })

  if (doc.error) {
    await writeDoc(`twitchOAuthResults/${proof.state}`, { used: true, usedAt: new Date() }, { merge: true })
    return json(200, { status: 'failed', error: doc.error })
  }

  if (!doc.twitchProofToken) return json(200, { status: 'pending' })

  // Single-use: burn it before handing it out.
  await writeDoc(`twitchOAuthResults/${proof.state}`, { used: true, usedAt: new Date() }, { merge: true })

  return json(200, {
    status: 'ready',
    twitchProofToken: doc.twitchProofToken,
    twitchUserId: doc.twitchUserId,
    username: doc.username,
    displayName: doc.displayName,
    profileImageUrl: doc.profileImageUrl,
  })
})
