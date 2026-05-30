import { randomBytes } from 'node:crypto'
import { writeDoc } from './_shared/firebaseAdmin'
import { json, requireMethod, withHttp, type HandlerEvent } from './_shared/http'

function publicCallbackForOrigin(origin: string): string {
  return `${origin.replace(/\/$/, '')}/auth/twitch/callback`
}

function resolveRedirectUri(event: HandlerEvent): string {
  const configured = process.env.TWITCH_REDIRECT_URI?.trim()
  if (configured) {
    if (!configured.includes('/.netlify/functions/twitchOAuthCallback')) return configured
    return publicCallbackForOrigin(new URL(configured).origin)
  }
  const origin = process.env.CSGN_ALLOWED_ORIGIN?.trim() || event.headers.origin || event.headers.Origin
  if (origin) return publicCallbackForOrigin(origin)
  const host = event.headers.host || event.headers.Host
  if (host) return `https://${host}/auth/twitch/callback`
  throw new Error('TWITCH_REDIRECT_URI or CSGN_ALLOWED_ORIGIN is required')
}

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  const state = randomBytes(24).toString('base64url')
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
  const redirectUri = resolveRedirectUri(event)
  await writeDoc(`oauthStates/${state}`, { provider: 'twitch', used: false, redirectUri, expiresAt, createdAt: new Date() })
  const params = new URLSearchParams({
    client_id: process.env.TWITCH_CLIENT_ID || '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'user:read:email',
    state,
  })
  return json(200, { authUrl: `https://id.twitch.tv/oauth2/authorize?${params.toString()}` })
})
