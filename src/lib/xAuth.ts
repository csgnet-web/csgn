const X_AUTHORIZE_URL = 'https://x.com/i/oauth2/authorize'
const STATE_KEY = 'x_oauth_state'
const VERIFIER_KEY = 'x_oauth_verifier'
const RETURN_TO_KEY = 'x_oauth_return_to'

const FALLBACK_X_CLIENT_ID = 'eDA3SWFHSlVXT3NaY1FaWFBjSlA6MTpjaQ'

function getClientId() {
  return (import.meta.env.VITE_X_CLIENT_ID as string | undefined) || FALLBACK_X_CLIENT_ID
}

function base64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomCodeVerifier(length = 64) {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return base64Url(bytes)
}

async function createCodeChallenge(codeVerifier: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier))
  return base64Url(new Uint8Array(digest))
}

export function getXRedirectUri() {
  return `${window.location.origin}/auth/x/callback`
}

export async function startXOAuth(returnTo: string) {
  const clientId = getClientId()
  const state = crypto.randomUUID()
  const codeVerifier = randomCodeVerifier()
  const codeChallenge = await createCodeChallenge(codeVerifier)

  localStorage.setItem(STATE_KEY, state)
  localStorage.setItem(VERIFIER_KEY, codeVerifier)
  localStorage.setItem(RETURN_TO_KEY, returnTo)

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: getXRedirectUri(),
    scope: 'users.read',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })

  window.location.href = `${X_AUTHORIZE_URL}?${params.toString()}`
}

export function getXReturnTo() {
  const returnTo = localStorage.getItem(RETURN_TO_KEY) || '/account'
  localStorage.removeItem(RETURN_TO_KEY)
  return returnTo
}

function clearXOAuthState() {
  localStorage.removeItem(STATE_KEY)
  localStorage.removeItem(VERIFIER_KEY)
}

export async function resolveXUserFromSearch(search: string) {
  const params = new URLSearchParams(search)
  const code = params.get('code')
  const state = params.get('state')
  const error = params.get('error')
  const errorDescription = params.get('error_description')

  if (error) {
    clearXOAuthState()
    throw new Error(`X auth failed: ${errorDescription || error}`)
  }

  if (!code || !state) {
    clearXOAuthState()
    throw new Error('Missing X OAuth callback fields: expected code and state query params.')
  }

  const expectedState = localStorage.getItem(STATE_KEY)
  const codeVerifier = localStorage.getItem(VERIFIER_KEY)

  if (!expectedState || expectedState !== state) {
    clearXOAuthState()
    throw new Error('Invalid X OAuth state. Please retry linking your account.')
  }

  if (!codeVerifier) {
    clearXOAuthState()
    throw new Error('Missing X OAuth code verifier. Please retry linking your account.')
  }

  const res = await fetch('/.netlify/functions/x-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      codeVerifier,
      redirectUri: getXRedirectUri(),
      clientId: getClientId(),
    }),
  })

  const body = await res.text()
  if (!res.ok) {
    clearXOAuthState()
    throw new Error(`Unable to exchange X OAuth code for token: ${body}`)
  }

  const payload = JSON.parse(body) as { username?: string }
  if (!payload.username) {
    clearXOAuthState()
    throw new Error('X OAuth exchange succeeded but no username was returned.')
  }

  clearXOAuthState()
  return payload.username
}
