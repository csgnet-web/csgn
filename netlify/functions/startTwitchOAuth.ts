/**
 * Begin a Twitch round trip.
 *
 * Returns three things, and the third is the interesting one:
 *
 *   authUrl   — where to send the user.
 *   state     — CSRF state, and also the key the result gets written under.
 *   linkToken — a signed, 15-minute bearer bound to that state.
 *
 * The linkToken is what makes the flow survive a browser change. Most of our
 * users arrive in Phantom's in-app browser, where Twitch's federated sign-in
 * buttons cannot work (see src/lib/webview.ts), so the OAuth has to finish in
 * Safari or Chrome — a browser that shares no cookies, no storage and no URL
 * with the tab the user started in. Handing the caller a bearer for the pending
 * result lets the ORIGINAL tab poll for it and finish the sign-up itself,
 * instead of us trying and failing to smuggle a proof back across browsers.
 *
 * It is an HMAC proof token rather than a random value in a Firestore doc for a
 * plain cost reason: the client polls it, so it is verified tens of times per
 * sign-up, and a signature check is free while a document read is not.
 */
import { randomBytes } from 'node:crypto'
import { writeDoc } from './_shared/firebaseAdmin'
import { createProofToken } from './_shared/proofTokens'
import { json, requireMethod, withHttp } from './_shared/http'
import { badRequest } from './_shared/errors'
import { checkRateLimit, clientIp } from './_shared/rateLimit'

/** Matches the `twitch_link` proof TTL below and the result doc's expiry. */
const LINK_TTL_SECONDS = 15 * 60

function twitchRedirectUri(): string {
  const redirectUri = process.env.TWITCH_REDIRECT_URI?.trim()
  if (!redirectUri) throw badRequest('TWITCH_REDIRECT_URI is not configured.', 'missing_twitch_redirect_uri')
  return redirectUri
}

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  await checkRateLimit(clientIp(event), 'startTwitchOAuth', 5)
  const state = randomBytes(24).toString('base64url')
  const expiresAt = new Date(Date.now() + LINK_TTL_SECONDS * 1000)
  const redirectUri = twitchRedirectUri()
  await writeDoc(`oauthStates/${state}`, { provider: 'twitch', used: false, expiresAt, createdAt: new Date() })
  const params = new URLSearchParams({
    client_id: process.env.TWITCH_CLIENT_ID || '',
    redirect_uri: redirectUri,
    response_type: 'code',
    // Only what we store: the channel id, login, display name and avatar.
    // `user:read:email` is kept because Twitch's own consent screen is skipped
    // entirely for anyone who has authorised CSGN before, so the scope costs a
    // returning user nothing and gives support a way to reach a streamer.
    scope: 'user:read:email',
    state,
  })
  return json(200, {
    authUrl: `https://id.twitch.tv/oauth2/authorize?${params.toString()}`,
    state,
    linkToken: createProofToken('twitch_link', { state }, LINK_TTL_SECONDS),
  })
})
