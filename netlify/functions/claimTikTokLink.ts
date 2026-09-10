/**
 * Claim the result of a TikTok SIGN-UP round trip — the endpoint the waiting
 * tab polls.
 *
 * The same shape as `claimTwitchLink`, for the same reason: most of our users
 * start inside an app's in-app browser, where they are signed out of everything
 * and federated sign-in does not work, so the OAuth finishes in Safari — a
 * browser that shares no storage with the tab they are looking at. Nothing can
 * be handed back through the URL, because the URL comes back to the wrong
 * browser.
 *
 * What is handed out here is a FIREBASE CUSTOM TOKEN, which is a stronger thing
 * than the Twitch flow's proof: exchanging it signs somebody in. Hence:
 *
 *  - The caller proves entitlement with the signed `tiktok_link` token minted by
 *    startTikTokOAuth, which never leaves the tab that started the flow. Forging
 *    one is forging an HMAC; guessing a state is guessing 192 random bits.
 *  - It is handed out EXACTLY ONCE — `used` is set before it is returned — so a
 *    captured response cannot be replayed into a second session.
 *  - It expires with the result document (10 minutes), and the token itself is
 *    minted with a five-minute life, so a claim that sits unexchanged dies.
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
  customToken?: string
  uid?: string
  username?: string
  created?: boolean
  displayName?: string
  avatarUrl?: string
}

/** Headroom over the client's poll schedule (~30 requests in the busiest
 *  minute — see pollDelayMs in src/lib/linkWait.ts) so somebody on a flaky
 *  connection is never rate limited out of their own sign-up. */
const POLL_LIMIT_PER_MINUTE = 60

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  await checkRateLimit(clientIp(event), 'claimTikTokLink', POLL_LIMIT_PER_MINUTE)

  const linkToken = requireString(parseJson<{ linkToken?: string }>(event).linkToken, 'linkToken')
  const proof = verifyProofToken<LinkProof>(linkToken, 'tiktok_link')

  const doc = await getDoc<ResultDoc>(`tiktokOAuthResults/${proof.state}`)
  // Nothing written yet — they are still on TikTok, or in another browser.
  if (!doc) return json(200, { status: 'pending' })

  if (doc.expiresAt && new Date(doc.expiresAt).getTime() <= Date.now()) {
    return json(200, { status: 'failed', error: 'oauth_state_expired' })
  }
  // Already claimed. Terminal rather than pending: a second claim means a
  // double-mounted effect or a refresh, and telling it to keep polling would
  // spin forever.
  if (doc.used) return json(200, { status: 'failed', error: 'handoff_used' })

  if (doc.error) {
    await writeDoc(`tiktokOAuthResults/${proof.state}`, { used: true, usedAt: new Date() }, { merge: true })
    return json(200, { status: 'failed', error: doc.error })
  }

  if (!doc.customToken) return json(200, { status: 'pending' })

  // Single-use: burn it before handing it out.
  await writeDoc(`tiktokOAuthResults/${proof.state}`, { used: true, usedAt: new Date() }, { merge: true })

  return json(200, {
    status: 'ready',
    customToken: doc.customToken,
    username: doc.username || '',
    created: doc.created === true,
    displayName: doc.displayName || '',
    avatarUrl: doc.avatarUrl || '',
  })
})
