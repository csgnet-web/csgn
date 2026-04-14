const X_AUTHORIZE_URL = 'https://x.com/i/oauth2/authorize'
const STATE_KEY = 'x_oauth_state'
const VERIFIER_KEY = 'x_oauth_verifier'
const RETURN_TO_KEY = 'x_oauth_return_to'

function getClientId() {
  const clientId = import.meta.env.VITE_X_CLIENT_ID as string | undefined
  if (!clientId) throw new Error('Missing VITE_X_CLIENT_ID')
  return clientId
}

function b64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomVerifier(length = 64) {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return b64Url(bytes)
}

async function createCodeChallenge(verifier: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return b64Url(new Uint8Array(digest))
}

export function getXRedirectUri() {
  return `${window.location.origin}/auth/x/callback`
}

export async function startXOAuth(returnTo: string) {
  const clientId = getClientId()
  const state = crypto.randomUUID()
  const verifier = randomVerifier(64)
  const codeChallenge = await createCodeChallenge(verifier)

  localStorage.setItem(STATE_KEY, state)
  localStorage.setItem(VERIFIER_KEY, verifier)
  localStorage.setItem(RETURN_TO_KEY, returnTo)

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: getXRedirectUri(),
    scope: 'users.read tweet.read offline.access',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })

  window.location.href = `${X_AUTHORIZE_URL}?${params.toString()}`
}

export function getXReturnTo() {
  return localStorage.getItem(RETURN_TO_KEY) || '/account'
}

export async function resolveXUserFromSearch(search: string) {
  const params = new URLSearchParams(search)
  const code = params.get('code')
  const state = params.get('state')
  const error = params.get('error')
  const errorDescription = params.get('error_description')

  if (error) throw new Error(`X auth failed: ${errorDescription || error}`)
  if (!code || !state) throw new Error('Missing X OAuth callback fields')

  const expectedState = localStorage.getItem(STATE_KEY)
  const verifier = localStorage.getItem(VERIFIER_KEY)
  if (!expectedState || expectedState !== state) throw new Error('Invalid X OAuth state')
  if (!verifier) throw new Error('Missing X OAuth code verifier')

  const res = await fetch('/.netlify/functions/x-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      codeVerifier: verifier,
      redirectUri: getXRedirectUri(),
    }),
  })

  if (!res.ok) throw new Error(`Unable to exchange X OAuth code for token: ${await res.text()}`)

  const payload = await res.json() as { username?: string }
  if (!payload.username) throw new Error('No X username returned')

  localStorage.removeItem(STATE_KEY)
  localStorage.removeItem(VERIFIER_KEY)

  return payload.username
}
