import { randomBytes } from 'node:crypto'
import { writeDoc } from './_shared/firebaseAdmin'
import { json, requireMethod, withHttp } from './_shared/http'

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  const state = randomBytes(24).toString('base64url')
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
  await writeDoc(`oauthStates/${state}`, { provider: 'twitch', used: false, expiresAt, createdAt: new Date() })
  const params = new URLSearchParams({
    client_id: process.env.TWITCH_CLIENT_ID || '',
    redirect_uri: process.env.TWITCH_REDIRECT_URI || '',
    response_type: 'code',
    scope: 'user:read:email',
    state,
  })
  return json(200, { authUrl: `https://id.twitch.tv/oauth2/authorize?${params.toString()}` })
})
