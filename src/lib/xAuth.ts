const X_AUTHORIZE_URL = 'https://twitter.com/i/oauth2/authorize'
const X_TOKEN_URL = 'https://api.x.com/2/oauth2/token'
const X_ME_URL = 'https://api.x.com/2/users/me?user.fields=username'

const STATE_KEY = 'x_oauth_state'
const VERIFIER_KEY = 'x_oauth_verifier'
const RETURN_TO_KEY = 'x_oauth_return_to'

function getClientId() {
  return import.meta.env.VITE_X_CLIENT_ID as string | undefined
}

function b64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomString(len = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  return b64Url(bytes)
}

async function toCodeChallenge(verifier: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return b64Url(new Uint8Array(digest))
}

export function getXRedirectUri() {
  return `${window.location.origin}/auth/x/callback`
}

export async function startXOAuth(returnTo: string) {
  const clientId = getClientId()
  if (!clientId) throw new Error('Missing VITE_X_CLIENT_ID')

  const state = randomString(16)
  const verifier = randomString(64)
  const challenge = await toCodeChallenge(verifier)

  localStorage.setItem(STATE_KEY, state)
  localStorage.setItem(VERIFIER_KEY, verifier)
  localStorage.setItem(RETURN_TO_KEY, returnTo)

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: getXRedirectUri(),
    scope: 'users.read tweet.read',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })

  window.location.href = `${X_AUTHORIZE_URL}?${params.toString()}`
}

export function getXReturnTo() {
  return localStorage.getItem(RETURN_TO_KEY) || '/account'
}

export async function resolveXUserFromSearch(search: string) {
  const clientId = getClientId()
  if (!clientId) throw new Error('Missing VITE_X_CLIENT_ID')

  const params = new URLSearchParams(search)
  const code = params.get('code')
  const state = params.get('state')
  const error = params.get('error')

  if (error) throw new Error(`X auth failed: ${error}`)
  if (!code || !state) throw new Error('Missing X OAuth response fields')

  const expectedState = localStorage.getItem(STATE_KEY)
  const verifier = localStorage.getItem(VERIFIER_KEY)
  if (!expectedState || expectedState !== state) throw new Error('Invalid X OAuth state')
  if (!verifier) throw new Error('Missing X OAuth code verifier')

  const tokenRes = await fetch(X_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id: clientId,
      redirect_uri: getXRedirectUri(),
      code_verifier: verifier,
    }),
  })
  if (!tokenRes.ok) throw new Error('Unable to exchange X OAuth code for token')
  const tokenJson = await tokenRes.json() as { access_token?: string }
  if (!tokenJson.access_token) throw new Error('No X access token returned')

  const meRes = await fetch(X_ME_URL, {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  })
  if (!meRes.ok) throw new Error('Unable to load X profile')
  const meJson = await meRes.json() as { data?: { username?: string } }
  const username = meJson.data?.username
  if (!username) throw new Error('No X username returned')

  localStorage.removeItem(STATE_KEY)
  localStorage.removeItem(VERIFIER_KEY)

  return username
}
