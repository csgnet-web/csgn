import { getDoc, writeDoc } from './_shared/firebaseAdmin'
import { unauthorized } from './_shared/errors'
import { createProofToken } from './_shared/proofTokens'
import { html, requireMethod, withHttp } from './_shared/http'

type StateDoc = { used?: boolean; expiresAt?: string; provider?: string }
type TwitchToken = { access_token: string }
type TwitchUser = { id: string; login: string; display_name: string; profile_image_url: string }

function popupHtml(payload: Record<string, unknown>) {
  const json = JSON.stringify(payload).replace(/</g, '\\u003c')
  return `<!doctype html><html><body><script>
    const payload = ${json};
    if (window.opener) window.opener.postMessage(payload, '*');
    document.body.textContent = payload.error ? 'Twitch verification failed.' : 'Twitch verified. You may close this window.';
    setTimeout(() => window.close(), 800);
  </script></body></html>`
}

export const handler = withHttp(async (event) => {
  requireMethod(event, 'GET')
  const error = event.queryStringParameters?.error
  const errorDescription = event.queryStringParameters?.error_description
  if (error) return html(200, popupHtml({ type: 'csgn:twitchProof', error, message: errorDescription || error }))

  const code = event.queryStringParameters?.code
  const state = event.queryStringParameters?.state
  if (!code || !state) return html(200, popupHtml({ type: 'csgn:twitchProof', error: 'missing_oauth_params', message: 'Missing Twitch OAuth code or state.' }))
  const stateDoc = await getDoc<StateDoc>(`oauthStates/${state}`)
  if (!stateDoc || stateDoc.used || stateDoc.provider !== 'twitch') throw unauthorized('Invalid OAuth state')
  if (!stateDoc.expiresAt || new Date(stateDoc.expiresAt).getTime() <= Date.now()) throw unauthorized('OAuth state expired')

  const redirectUri = process.env.TWITCH_REDIRECT_URI || ''
  console.info('twitchOAuthCallback redirect_uri configured:', Boolean(redirectUri), redirectUri || '(missing)')
  const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.TWITCH_CLIENT_ID || '', client_secret: process.env.TWITCH_CLIENT_SECRET || '', code, grant_type: 'authorization_code', redirect_uri: redirectUri }),
  })
  if (!tokenRes.ok) throw unauthorized('Twitch token exchange failed')
  const token = await tokenRes.json() as TwitchToken
  const userRes = await fetch('https://api.twitch.tv/helix/users', { headers: { Authorization: `Bearer ${token.access_token}`, 'Client-Id': process.env.TWITCH_CLIENT_ID || '' } })
  if (!userRes.ok) throw unauthorized('Twitch user lookup failed')
  const user = ((await userRes.json()) as { data: TwitchUser[] }).data?.[0]
  if (!user?.id || !user.login) throw unauthorized('Twitch user lookup failed')
  await writeDoc(`oauthStates/${state}`, { used: true, usedAt: new Date(), twitchUserId: user.id }, { merge: true })
  const twitch = { twitchUserId: user.id, username: user.login, displayName: user.display_name || user.login, profileImageUrl: user.profile_image_url || '' }
  const proofToken = createProofToken('twitch_account', twitch, 15 * 60)
  return html(200, popupHtml({ type: 'csgn:twitchProof', proofToken, twitch }))
})
