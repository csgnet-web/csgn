import { randomBytes } from 'node:crypto'
import { getDoc, writeDoc } from './_shared/firebaseAdmin'
import { createProofToken } from './_shared/proofTokens'
import { redirect, requireMethod, withHttp, type HandlerResponse } from './_shared/http'

type StateDoc = { used?: boolean; expiresAt?: string; provider?: string }
type TwitchToken = { access_token: string }
type TwitchUser = { id: string; login: string; display_name: string; profile_image_url: string }

function frontendOrigin(): string {
  return (process.env.CSGN_ALLOWED_ORIGIN || '').replace(/\/+$/, '')
}

function redirectError(code: string): HandlerResponse {
  return redirect(`${frontendOrigin()}/?auth=register&twitchError=${code}`)
}

export const handler = withHttp(async (event) => {
  requireMethod(event, 'GET')
  try {
    const params = event.queryStringParameters || {}
    // User denied authorization or Twitch returned an error.
    if (params.error) return redirectError('oauth_failed')

    const code = params.code
    const state = params.state
    if (!code || !state) return redirectError('oauth_state_expired')

    const stateDoc = await getDoc<StateDoc>(`oauthStates/${state}`)
    if (!stateDoc || stateDoc.used || stateDoc.provider !== 'twitch') return redirectError('oauth_state_expired')
    if (!stateDoc.expiresAt || new Date(stateDoc.expiresAt).getTime() <= Date.now()) return redirectError('oauth_state_expired')

    const redirectUri = process.env.TWITCH_REDIRECT_URI || ''
    const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: process.env.TWITCH_CLIENT_ID || '', client_secret: process.env.TWITCH_CLIENT_SECRET || '', code, grant_type: 'authorization_code', redirect_uri: redirectUri }),
    })
    if (!tokenRes.ok) return redirectError('oauth_exchange_failed')
    const token = await tokenRes.json() as TwitchToken

    const userRes = await fetch('https://api.twitch.tv/helix/users', { headers: { Authorization: `Bearer ${token.access_token}`, 'Client-Id': process.env.TWITCH_CLIENT_ID || '' } })
    if (!userRes.ok) return redirectError('oauth_exchange_failed')
    const user = ((await userRes.json()) as { data: TwitchUser[] }).data?.[0]
    if (!user?.id || !user.login) return redirectError('oauth_exchange_failed')

    // Single-use the OAuth state regardless of the duplicate outcome below.
    await writeDoc(`oauthStates/${state}`, { used: true, usedAt: new Date(), twitchUserId: user.id }, { merge: true })

    // Reject Twitch accounts already linked to a CSGN account.
    const existing = await getDoc(`uniqueTwitchUsers/${user.id}`)
    if (existing) return redirectError('duplicate_twitch')

    const twitch = { twitchUserId: user.id, username: user.login, displayName: user.display_name || user.login, profileImageUrl: user.profile_image_url || '' }
    const twitchProofToken = createProofToken('twitch_account', twitch, 15 * 60)

    // One-time handoff doc so a mobile browser can pick up the proof via a full-page redirect.
    const handoffId = randomBytes(24).toString('base64url')
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000)
    await writeDoc(`twitchOAuthResults/${handoffId}`, {
      provider: 'twitch',
      twitchProofToken,
      twitchUserId: twitch.twitchUserId,
      username: twitch.username,
      displayName: twitch.displayName,
      profileImageUrl: twitch.profileImageUrl,
      createdAt: now,
      expiresAt,
      used: false,
    }, { exists: false })

    return redirect(`${frontendOrigin()}/auth/twitch/complete?handoffId=${handoffId}`)
  } catch (err) {
    console.error('twitchOAuthCallback failed', err)
    return redirectError('oauth_failed')
  }
})
