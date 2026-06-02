import { randomBytes } from 'node:crypto'
import { writeDoc } from './_shared/firebaseAdmin'
import { json, requireMethod, withHttp } from './_shared/http'
import { badRequest } from './_shared/errors'
import { checkRateLimit, clientIp } from './_shared/rateLimit'

function twitchRedirectUri(): string {
  const redirectUri = process.env.TWITCH_REDIRECT_URI?.trim()
  if (!redirectUri) throw badRequest('TWITCH_REDIRECT_URI is not configured.', 'missing_twitch_redirect_uri')
  return redirectUri
}

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  await checkRateLimit(clientIp(event), 'startTwitchOAuth', 5)
  const state = randomBytes(24).toString('base64url')
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
  const redirectUri = twitchRedirectUri()
  await writeDoc(`oauthStates/${state}`, { provider: 'twitch', used: false, expiresAt, createdAt: new Date() })
  const params = new URLSearchParams({
    client_id: process.env.TWITCH_CLIENT_ID || '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'user:read:email',
    state,
  })
  return json(200, { authUrl: `https://id.twitch.tv/oauth2/authorize?${params.toString()}` })
})
