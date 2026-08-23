/**
 * Begin a TikTok connection.
 *
 * Unlike the Twitch flow, this is bound to a SIGNED-IN member from the first
 * step: the state document carries their uid, so the callback can finish the
 * link server-side without the original tab having to be involved at all.
 *
 * That is not a shortcut, it is a better shape for this particular case. Twitch
 * needs its polling dance because it happens during sign-UP, when there is no
 * account yet and the person may finish OAuth in a different browser entirely
 * (Phantom's webview cannot complete Twitch's Apple sign-in — see
 * src/lib/webview.ts). Here the account already exists, so whichever browser
 * finishes the round trip, the right member gets connected.
 */
import { randomBytes } from 'node:crypto'
import { requireUser } from './_shared/auth'
import { badRequest } from './_shared/errors'
import { writeDoc } from './_shared/firebaseAdmin'
import { json, requireMethod, withHttp } from './_shared/http'
import { checkRateLimit, clientIp } from './_shared/rateLimit'
import { tiktokAuthUrl, tiktokConfigured } from './_shared/tiktok'

const STATE_TTL_MS = 15 * 60 * 1000

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  const authUser = await requireUser(event)
  await checkRateLimit(clientIp(event), 'startTikTokOAuth', 5)

  // Named plainly rather than failing at the redirect: an unconfigured
  // integration should tell the operator what is missing, not hand the member a
  // TikTok error page about a bad client key.
  if (!tiktokConfigured()) {
    throw badRequest('TikTok is not configured on this deployment.', 'tiktok_not_configured')
  }

  const state = randomBytes(24).toString('base64url')
  await writeDoc(`oauthStates/${state}`, {
    provider: 'tiktok',
    uid: authUser.uid,
    used: false,
    expiresAt: new Date(Date.now() + STATE_TTL_MS),
    createdAt: new Date(),
  })

  return json(200, { authUrl: tiktokAuthUrl(state), state })
})
