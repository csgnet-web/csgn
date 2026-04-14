const X_AUTHORIZE_URL = 'https://x.com/i/oauth2/authorize'
const STATE_KEY = 'x_oauth_state'
const VERIFIER_KEY = 'x_oauth_verifier'
const RETURN_TO_KEY = 'x_oauth_return_to'

const FALLBACK_CLIENT_ID = 'eDA3SWFHSlVXT3NaY1FaWFBjSlA6MTpjaQ'

function getClientId() {
  return (import.meta.env.VITE_X_CLIENT_ID as string | undefined) || FALLBACK_CLIENT_ID
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
    scope: 'users.read',
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
  const params = new URLSearchParams(search)
  const code = params.get('code')
  const state = params.get('state')
  const error = params.get('error')
  const errorDescription = params.get('error_description')

  if (error) throw new Error(`X auth failed: ${errorDescription || error}`)
  if (!code || !state) throw new Error('Missing X OAuth response fields')

  const expectedState = localStorage.getItem(STATE_KEY)
  const verifier = localStorage.getItem(VERIFIER_KEY)
  if (!expectedState || expectedState !== state) throw new Error('Invalid X OAuth state')
  if (!verifier) throw new Error('Missing X OAuth code verifier')

  const tokenRes = await fetch('/.netlify/functions/x-token-exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, codeVerifier: verifier, redirectUri: getXRedirectUri() }),
  })
  if (!tokenRes.ok) throw new Error(`Unable to exchange X OAuth code for token: ${await tokenRes.text()}`)

  const payload = await tokenRes.json() as { username?: string }
  if (!payload.username) throw new Error('No X username returned')

  localStorage.removeItem(STATE_KEY)
  localStorage.removeItem(VERIFIER_KEY)

  return payload.username
}
