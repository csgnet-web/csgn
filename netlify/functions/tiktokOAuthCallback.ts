/**
 * Finish a TikTok round trip — a link, or a whole account.
 *
 * ── LINK (the state names a member) ────────────────────────────────────────
 *
 * The state document already names them (see startTikTokOAuth), so this
 * completes the link itself and sends the browser back to /studio with a result
 * in the query string. There is no proof token and no polling: the client never
 * holds anything, which also means the client never holds a refresh token.
 *
 * ── SIGN UP (the state names nobody) ───────────────────────────────────────
 *
 * TikTok is the CREDENTIAL. Their open id is looked up in
 * `uniqueTikTokUsers/{openId}` — a returning person is signed in, a new one gets
 * an account, and neither is asked which of the two they are, because we know.
 * The outcome is a Firebase custom token written under the OAuth state, for the
 * originating tab to claim with the `tiktok_link` bearer it has been holding.
 *
 * The custom token goes in a DOCUMENT, never in the redirect URL. A token in a
 * URL is in browser history, in any referrer, and in whichever browser happened
 * to finish the OAuth — which, for most of our users, is not the browser they
 * are looking at.
 *
 * ── No wallet, deliberately ────────────────────────────────────────────────
 *
 * This account can watch, post clips and be reviewed with no wallet at all. The
 * wallet is where money LANDS, so it is asked for when there is money to land —
 * see docs/signup-flow.md. Requiring it here would put the entire non-crypto
 * creator market on the wrong side of the door, which is the thing this door
 * exists to fix.
 *
 * ── Where the tokens live ──────────────────────────────────────────────────
 *
 * `tiktokTokens/{uid}` — a collection with NO Firestore rule, so it is
 * unreachable from any browser and readable only through firebase-admin. The
 * member's own document gets a small public-ish summary (display name, avatar,
 * whether the connection is live) and never the credentials. A refresh token in
 * a document a client can read is a refresh token that has leaked.
 */
import { randomUUID } from 'node:crypto'
import { commitWrites, createWrite, createCustomToken, getDoc, writeDoc } from './_shared/firebaseAdmin'
import { redirect, requireMethod, withHttp, type HandlerResponse } from './_shared/http'
import { checkRateLimit, clientIp } from './_shared/rateLimit'
import { auditLog } from './_shared/audit'
import { allocateUsername } from './_shared/handles'
import { usernameKey } from './_shared/validators'
import { exchangeCode, fetchProfile, type TikTokProfile, type TikTokTokens } from './_shared/tiktok'

type StateDoc = { used?: boolean; expiresAt?: string; provider?: string; uid?: string; intent?: string }

/** How long a claimable sign-up result survives unclaimed. Longer than the
 *  client's five-minute poll so a slow round trip is still claimable, short
 *  enough that an abandoned one is not a custom token sitting in a database. */
const RESULT_TTL_MS = 10 * 60 * 1000

function frontendOrigin(): string {
  return (process.env.CSGN_ALLOWED_ORIGIN || '').replace(/\/+$/, '')
}

/** Back to /studio — the LINK path, where a member started. */
function back(params: Record<string, string>): HandlerResponse {
  return redirect(`${frontendOrigin()}/studio?${new URLSearchParams(params).toString()}`)
}

/**
 * Back to the sign-up landing page. It gets the STATE and nothing else: the tab
 * that started the flow recognises the state and claims the result with its own
 * bearer, and a browser that was merely handed the link recognises nothing and
 * says "go back to where you started".
 */
function landing(params: Record<string, string>): HandlerResponse {
  return redirect(`${frontendOrigin()}/auth/tiktok?${new URLSearchParams(params).toString()}`)
}

/** Record the outcome of a sign-up round trip for the waiting tab to claim. */
async function writeSignupResult(state: string, data: Record<string, unknown>): Promise<void> {
  await writeDoc(`tiktokOAuthResults/${state}`, {
    ...data,
    used: false,
    expiresAt: new Date(Date.now() + RESULT_TTL_MS),
    createdAt: new Date(),
  })
}

/**
 * Sign in the person this TikTok account already belongs to, or make them an
 * account. Returns the uid and whether it was created.
 */
async function resolveAccount(profile: TikTokProfile, openId: string): Promise<{ uid: string; username: string; created: boolean }> {
  const index = await getDoc<{ uid?: string }>(`uniqueTikTokUsers/${openId}`)
  if (index?.uid) {
    const user = await getDoc<{ username?: string }>(`users/${index.uid}`)
    return { uid: index.uid, username: String(user?.username || ''), created: false }
  }

  // Their own handle first, then their display name, then a minted one — seeded
  // on the open id so a retried sign-up converges rather than wandering.
  const username = (await allocateUsername(profile.username || profile.displayName || '', openId))
  if (!username) throw new Error('username_unavailable')

  const uid = `tt_${randomUUID().replace(/-/g, '')}`
  const now = new Date()
  const userDoc = {
    uid,
    // Empty rather than absent so every reader sees one shape — the same
    // convention wallet accounts follow.
    email: '',
    emailLower: '',
    username,
    usernameLower: usernameKey(username),
    displayName: profile.displayName || username,
    /** How the account was created. There is no password to reset on one of
     *  these, which is what /account needs to know before offering one. */
    authMethod: 'tiktok',
    signupMethod: 'tiktok',
    /** NOT VERIFIED, and that is the whole point of this door. The wallet is
     *  asked for at payout, because that is the first moment it does anything. */
    phantom: { verified: false },
    twitch: { verified: false },
    role: 'user',
    status: 'active',
    slotLimits: { maxConcurrentClaims: 2 },
    createdAt: now,
    updatedAt: now,
  }

  // Create-only writes, so the handle index and the TikTok index are the atomic
  // guard: two simultaneous sign-ups on the same account lose the whole commit
  // rather than half-writing one.
  await commitWrites([
    createWrite(`uniqueUsernames/${usernameKey(username)}`, { uid, username, createdAt: now }),
    createWrite(`uniqueTikTokUsers/${openId}`, { uid, username, createdAt: now }),
    createWrite(`users/${uid}`, userDoc),
  ])

  return { uid, username, created: true }
}

/** Store the credentials and the member-visible summary. Shared by both paths —
 *  a sign-up connects the account in the same breath, which is the entire
 *  argument for this door: one tap and their clips are importable. */
async function storeConnection(uid: string, tokens: TikTokTokens, profile: TikTokProfile | null): Promise<void> {
  const openId = tokens.openId || profile?.openId || ''
  await writeDoc(`tiktokTokens/${uid}`, {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessExpiresAt: tokens.accessExpiresAt,
    refreshExpiresAt: tokens.refreshExpiresAt,
    openId,
    scope: tokens.scope,
    updatedAt: new Date(),
  })
  await writeDoc(`users/${uid}`, {
    tiktok: {
      connected: true,
      openId,
      username: profile?.username || '',
      displayName: profile?.displayName || '',
      avatarUrl: profile?.avatarUrl || '',
      // Stored so the UI can warn BEFORE the connection dies rather than
      // after: a member whose import silently stopped working never tells us.
      refreshExpiresAt: tokens.refreshExpiresAt,
      connectedAt: new Date(),
    },
  }, { merge: true })
}

export const handler = withHttp(async (event) => {
  requireMethod(event, 'GET')
  // A bogus state still costs a Firestore read before it can be rejected, and
  // nothing here is authenticated by a session.
  await checkRateLimit(clientIp(event), 'tiktokOAuthCallback', 20)

  const params = event.queryStringParameters || {}
  const state = params.state || ''
  // Which door this was is not known until the state document is read, so an
  // early failure has to pick a landing page. /studio is the safe one: a member
  // who was linking ends up where they started, and a stranger who never got an
  // account ends up on a page that will ask them to sign in.
  let signup = false

  try {
    const code = params.code
    if (!state) return back({ tiktok: 'expired' })

    const stateDoc = await getDoc<StateDoc>(`oauthStates/${state}`)
    if (!stateDoc || stateDoc.used || stateDoc.provider !== 'tiktok') {
      return back({ tiktok: 'expired' })
    }
    signup = !stateDoc.uid
    const bail = async (reason: string): Promise<HandlerResponse> => {
      // A sign-up failure has to reach the tab that is WAITING, not just the
      // browser that happens to be here — otherwise it spins for five minutes
      // and then says nothing. Every outcome is written, success and failure
      // alike; that is the whole lesson of the Twitch flow.
      if (signup) {
        await writeSignupResult(state, { error: reason })
        return landing({ state, tiktok: reason })
      }
      return back({ tiktok: reason })
    }

    // The member pressed Cancel on TikTok's consent screen. Not an error worth
    // a scary word — they simply changed their mind.
    if (params.error) return await bail('cancelled')
    if (!code) return await bail('expired')

    if (!stateDoc.expiresAt || new Date(stateDoc.expiresAt).getTime() <= Date.now()) {
      return await bail('expired')
    }
    // Single-use before anything else can go wrong, so a replayed callback
    // cannot re-run the exchange.
    await writeDoc(`oauthStates/${state}`, { used: true, usedAt: new Date() }, { merge: true })

    const tokens = await exchangeCode(code)
    if (!tokens) return await bail('failed')

    const profile = await fetchProfile(tokens.accessToken)

    if (!signup) {
      const uid = stateDoc.uid!
      await storeConnection(uid, tokens, profile)
      await auditLog('linkTikTok', uid, { openId: tokens.openId || '' })
      return back({ tiktok: 'connected' })
    }

    // ── The sign-up path ──
    const openId = tokens.openId || profile?.openId || ''
    if (!openId) {
      // Without a stable id there is nothing to key an account on, and keying it
      // on a display name would merge two strangers who share one.
      return await bail('failed')
    }

    const account = await resolveAccount(profile ?? { openId, displayName: '', avatarUrl: '', username: '' }, openId)
    await storeConnection(account.uid, tokens, profile)

    await writeSignupResult(state, {
      // Minted only after the account documents have committed: exchanging this
      // token client-side is what creates the Firebase Auth user.
      customToken: createCustomToken(account.uid),
      uid: account.uid,
      username: account.username,
      created: account.created,
      displayName: profile?.displayName || '',
      avatarUrl: profile?.avatarUrl || '',
    })

    await auditLog(account.created ? 'signupWithTikTok' : 'loginWithTikTok', account.uid, {
      openId,
      username: account.username,
    })
    return landing({ state, tiktok: 'ready' })
  } catch (err) {
    console.error('tiktokOAuthCallback failed', err)
    if (signup && state) {
      // Best-effort: if even this write fails the waiting tab times out quietly,
      // which is the behaviour it is built for.
      await writeSignupResult(state, { error: 'failed' }).catch(() => {})
      return landing({ state, tiktok: 'failed' })
    }
    return back({ tiktok: 'failed' })
  }
})
