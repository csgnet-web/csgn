/**
 * Begin a TikTok round trip — for two different callers, on purpose.
 *
 * ── LINK (signed in) ───────────────────────────────────────────────────────
 *
 * A member connecting their account from /studio. The state document carries
 * their uid, so the callback finishes the link server-side without the original
 * tab having to be involved at all. That is not a shortcut: the account already
 * exists, so whichever browser finishes the round trip, the right member gets
 * connected.
 *
 * ── SIGN UP (signed out) ───────────────────────────────────────────────────
 *
 * Somebody creating an account with TikTok and nothing else. There is no uid to
 * put on the state, so this behaves like the Twitch flow instead: it mints a
 * signed `tiktok_link` token bound to the state, the originating tab holds it,
 * and the callback writes the outcome — a Firebase custom token — under that
 * state for the holder to claim.
 *
 * Why the polling shape is mandatory here rather than nice to have: most of our
 * traffic arrives inside an app's in-app browser, and a webview has its own
 * cookie jar. The user is signed into TikTok on their phone and signed OUT
 * inside the webview, so the OAuth has to finish in Safari or Chrome — a
 * browser that shares nothing with the tab they started in. See
 * `src/lib/webview.ts`.
 *
 * ── The rule that keeps this safe ──────────────────────────────────────────
 *
 * The two paths are decided by whether a valid ID token was presented, never by
 * anything in the body. A caller cannot ask for the sign-up path while holding
 * a session, and cannot ask for the link path without one — so there is no way
 * to aim a link at somebody else's account.
 */
import { randomBytes } from 'node:crypto'
import { optionalUser } from './_shared/auth'
import { badRequest } from './_shared/errors'
import { writeDoc } from './_shared/firebaseAdmin'
import { createProofToken } from './_shared/proofTokens'
import { json, requireMethod, withHttp } from './_shared/http'
import { checkRateLimit, clientIp } from './_shared/rateLimit'
import { tiktokAuthUrl, tiktokConfigured } from './_shared/tiktok'

/** Matches the `tiktok_link` proof TTL and the result doc's expiry. */
export const TIKTOK_LINK_TTL_SECONDS = 15 * 60

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  // Signed out is the sign-up door and gets a tighter limit than a member
  // reconnecting: it is the one an unauthenticated stranger can reach.
  const authUser = await optionalUser(event)
  await checkRateLimit(clientIp(event), authUser ? 'startTikTokOAuth' : 'startTikTokSignup', authUser ? 5 : 8)

  // Named plainly rather than failing at the redirect: an unconfigured
  // integration should tell the operator what is missing, not hand the member a
  // TikTok error page about a bad client key.
  if (!tiktokConfigured()) {
    throw badRequest('TikTok is not configured on this deployment.', 'tiktok_not_configured')
  }

  const state = randomBytes(24).toString('base64url')
  await writeDoc(`oauthStates/${state}`, {
    provider: 'tiktok',
    // Present on the link path, absent on the sign-up path. The callback
    // branches on exactly this and nothing else.
    uid: authUser?.uid ?? null,
    intent: authUser ? 'link' : 'signup',
    used: false,
    expiresAt: new Date(Date.now() + TIKTOK_LINK_TTL_SECONDS * 1000),
    createdAt: new Date(),
  })

  return json(200, {
    authUrl: tiktokAuthUrl(state),
    state,
    // Only the sign-up path needs a bearer to claim a result with. Handing one
    // to a signed-in member would be a second, weaker way to reach an account
    // that already has a session.
    linkToken: authUser ? null : createProofToken('tiktok_link', { state }, TIKTOK_LINK_TTL_SECONDS),
    intent: authUser ? 'link' : 'signup',
  })
})
