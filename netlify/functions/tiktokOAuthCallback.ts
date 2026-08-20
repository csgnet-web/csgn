/**
 * Finish a TikTok connection.
 *
 * The state document already names the member (see startTikTokOAuth), so this
 * completes the link itself and sends the browser back to /studio with a result
 * in the query string. There is no proof token and no polling: the client never
 * holds anything, which also means the client never holds a refresh token.
 *
 * ── Where the tokens live ──────────────────────────────────────────────────
 *
 * `tiktokTokens/{uid}` — a collection with NO Firestore rule, so it is
 * unreachable from any browser and readable only through firebase-admin. The
 * member's own document gets a small public-ish summary (display name, avatar,
 * whether the connection is live) and never the credentials. A refresh token in
 * a document a client can read is a refresh token that has leaked.
 */
import { getDoc, writeDoc } from './_shared/firebaseAdmin'
import { redirect, requireMethod, withHttp, type HandlerResponse } from './_shared/http'
import { checkRateLimit, clientIp } from './_shared/rateLimit'
import { auditLog } from './_shared/audit'
import { exchangeCode, fetchProfile } from './_shared/tiktok'

type StateDoc = { used?: boolean; expiresAt?: string; provider?: string; uid?: string }

function frontendOrigin(): string {
  return (process.env.CSGN_ALLOWED_ORIGIN || '').replace(/\/+$/, '')
}

function back(params: Record<string, string>): HandlerResponse {
  return redirect(`${frontendOrigin()}/studio?${new URLSearchParams(params).toString()}`)
}

export const handler = withHttp(async (event) => {
  requireMethod(event, 'GET')
  // A bogus state still costs a Firestore read before it can be rejected, and
  // nothing here is authenticated by a session.
  await checkRateLimit(clientIp(event), 'tiktokOAuthCallback', 20)

  const params = event.queryStringParameters || {}
  const state = params.state || ''
  try {
    // The member pressed Cancel on TikTok's consent screen. Not an error worth
    // a scary word — they simply changed their mind.
    if (params.error) return back({ tiktok: 'cancelled' })

    const code = params.code
    if (!code || !state) return back({ tiktok: 'expired' })

    const stateDoc = await getDoc<StateDoc>(`oauthStates/${state}`)
    if (!stateDoc || stateDoc.used || stateDoc.provider !== 'tiktok' || !stateDoc.uid) {
      return back({ tiktok: 'expired' })
    }
    if (!stateDoc.expiresAt || new Date(stateDoc.expiresAt).getTime() <= Date.now()) {
      return back({ tiktok: 'expired' })
    }
    // Single-use before anything else can go wrong, so a replayed callback
    // cannot re-run the exchange.
    await writeDoc(`oauthStates/${state}`, { used: true, usedAt: new Date() }, { merge: true })

    const tokens = await exchangeCode(code)
    if (!tokens) return back({ tiktok: 'failed' })

    const profile = await fetchProfile(tokens.accessToken)

    const uid = stateDoc.uid
    await writeDoc(`tiktokTokens/${uid}`, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessExpiresAt: tokens.accessExpiresAt,
      refreshExpiresAt: tokens.refreshExpiresAt,
      openId: tokens.openId || profile?.openId || '',
      scope: tokens.scope,
      updatedAt: new Date(),
    })

    await writeDoc(`users/${uid}`, {
      tiktok: {
        connected: true,
        openId: tokens.openId || profile?.openId || '',
        username: profile?.username || '',
        displayName: profile?.displayName || '',
        avatarUrl: profile?.avatarUrl || '',
        // Stored so the UI can warn BEFORE the connection dies rather than
        // after: a member whose import silently stopped working never tells us.
        refreshExpiresAt: tokens.refreshExpiresAt,
        connectedAt: new Date(),
      },
    }, { merge: true })

    await auditLog('linkTikTok', uid, { openId: tokens.openId || '' })
    return back({ tiktok: 'connected' })
  } catch (err) {
    console.error('tiktokOAuthCallback failed', err)
    return back({ tiktok: 'failed' })
  }
})
