import { getDoc, writeDoc } from './_shared/firebaseAdmin'
import { createProofToken } from './_shared/proofTokens'
import { redirect, requireMethod, withHttp, type HandlerResponse } from './_shared/http'
import { checkRateLimit, clientIp } from './_shared/rateLimit'

type StateDoc = { used?: boolean; expiresAt?: string; provider?: string }
type TwitchToken = { access_token: string }
type TwitchUser = { id: string; login: string; display_name: string; profile_image_url: string }

/** Result docs outlive the link token so a late claim gets a clean expiry
 *  rather than a mystery `pending`. */
const RESULT_TTL_MS = 20 * 60 * 1000

function frontendOrigin(): string {
  return (process.env.CSGN_ALLOWED_ORIGIN || '').replace(/\/+$/, '')
}

/**
 * Every outcome — success and failure alike — lands on the same in-app page,
 * and every outcome is ALSO written to the result document keyed by the OAuth
 * state.
 *
 * The redirect is for the browser that happens to be here. The document is for
 * the browser that isn't: when a user escapes Phantom's in-app browser to
 * finish Twitch in Safari (see src/lib/webview.ts), the tab that started the
 * sign-up is still open in Phantom, polling. If a failure were only ever
 * communicated by redirect, that tab would poll until it timed out and the user
 * would watch a spinner for five minutes instead of reading "that Twitch
 * account is already linked".
 *
 * So: write the outcome where the waiting tab can read it, then redirect the
 * browser that is actually here. Errors raised before the state is validated
 * have nowhere to be written and can only redirect.
 */
async function recordFailure(state: string | undefined, code: string): Promise<HandlerResponse> {
  if (state) {
    try {
      const now = new Date()
      await writeDoc(`twitchOAuthResults/${state}`, {
        provider: 'twitch',
        error: code,
        createdAt: now,
        expiresAt: new Date(now.getTime() + RESULT_TTL_MS),
        used: false,
      }, { exists: false })
    } catch (err) {
      // A result already exists for this state (a replayed callback), or
      // Firestore is unhappy. Neither changes what this browser should see.
      console.warn('twitchOAuthCallback could not record failure', err)
    }
  }
  const query = new URLSearchParams({ twitchError: code })
  if (state) query.set('state', state)
  return redirect(`${frontendOrigin()}/auth/twitch/complete?${query.toString()}`)
}

export const handler = withHttp(async (event) => {
  requireMethod(event, 'GET')
  // The single-use OAuth state makes this self-limiting for real flows, but a
  // bogus state still costs a Firestore read before it can be rejected, and
  // nothing else here is authenticated. 20/min is far above any human returning
  // from Twitch and far below a useful read-amplification attack.
  await checkRateLimit(clientIp(event), 'twitchOAuthCallback', 20)
  const params = event.queryStringParameters || {}
  const state = params.state || undefined
  try {
    // User denied authorization or Twitch returned an error.
    if (params.error) return await recordFailure(state, 'oauth_failed')

    const code = params.code
    if (!code || !state) return await recordFailure(state, 'oauth_state_expired')

    const stateDoc = await getDoc<StateDoc>(`oauthStates/${state}`)
    // Recorded against the state even though the state is the thing that failed:
    // a create-only write cannot clobber a result that already exists, so a
    // replayed callback tells the waiting tab "expired" only when there is
    // genuinely nothing for it to claim.
    if (!stateDoc || stateDoc.used || stateDoc.provider !== 'twitch') return await recordFailure(state, 'oauth_state_expired')
    if (!stateDoc.expiresAt || new Date(stateDoc.expiresAt).getTime() <= Date.now()) return await recordFailure(state, 'oauth_state_expired')

    const redirectUri = process.env.TWITCH_REDIRECT_URI || ''
    const tokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: process.env.TWITCH_CLIENT_ID || '', client_secret: process.env.TWITCH_CLIENT_SECRET || '', code, grant_type: 'authorization_code', redirect_uri: redirectUri }),
    })
    if (!tokenRes.ok) {
      // The body names the actual mismatch ("Parameter redirect_uri does not
      // match registered URI"), and without it this failure is unfixable from
      // the outside — it looks identical to every other Twitch error.
      console.error('twitch token exchange failed', tokenRes.status, await tokenRes.text().catch(() => ''))
      return await recordFailure(state, 'oauth_exchange_failed')
    }
    const token = await tokenRes.json() as TwitchToken

    const userRes = await fetch('https://api.twitch.tv/helix/users', { headers: { Authorization: `Bearer ${token.access_token}`, 'Client-Id': process.env.TWITCH_CLIENT_ID || '' } })
    if (!userRes.ok) {
      console.error('twitch helix/users failed', userRes.status)
      return await recordFailure(state, 'oauth_exchange_failed')
    }
    const user = ((await userRes.json()) as { data: TwitchUser[] }).data?.[0]
    if (!user?.id || !user.login) return await recordFailure(state, 'oauth_exchange_failed')

    // Single-use the OAuth state regardless of the duplicate outcome below.
    await writeDoc(`oauthStates/${state}`, { used: true, usedAt: new Date(), twitchUserId: user.id }, { merge: true })

    // Reject Twitch accounts already linked to a CSGN account.
    const existing = await getDoc(`uniqueTwitchUsers/${user.id}`)
    if (existing) return await recordFailure(state, 'duplicate_twitch')

    const twitch = { twitchUserId: user.id, username: user.login, displayName: user.display_name || user.login, profileImageUrl: user.profile_image_url || '' }
    const twitchProofToken = createProofToken('twitch_account', twitch, 15 * 60)

    // Keyed by the OAuth state, which is what the waiting tab holds a signed
    // bearer for. Create-only, so a replayed callback cannot overwrite a result
    // that has already been handed out.
    const now = new Date()
    await writeDoc(`twitchOAuthResults/${state}`, {
      provider: 'twitch',
      twitchProofToken,
      twitchUserId: twitch.twitchUserId,
      username: twitch.username,
      displayName: twitch.displayName,
      profileImageUrl: twitch.profileImageUrl,
      createdAt: now,
      expiresAt: new Date(now.getTime() + RESULT_TTL_MS),
      used: false,
    }, { exists: false })

    return redirect(`${frontendOrigin()}/auth/twitch/complete?state=${encodeURIComponent(state)}`)
  } catch (err) {
    console.error('twitchOAuthCallback failed', err)
    return await recordFailure(state, 'oauth_failed')
  }
})
