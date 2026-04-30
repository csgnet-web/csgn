const TWITCH_AUTHORIZE_URL = 'https://id.twitch.tv/oauth2/authorize'

const STATE_KEY = 'twitch_oauth_state'
const VERIFIER_KEY = 'twitch_oauth_verifier'
const RETURN_TO_KEY = 'twitch_oauth_return_to'
const AUTH_FLOW_KEY = 'twitch_auth_flow'

const FALLBACK_CLIENT_ID = 'n1exwoae1t2yebr09kxnbnvwhovk3l'

function getClientId() {
  return (import.meta.env.VITE_TWITCH_CLIENT_ID as string | undefined) || FALLBACK_CLIENT_ID
}

function base64Url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function randomCodeVerifier(length = 64) {
  return base64Url(crypto.getRandomValues(new Uint8Array(length)))
}

async function createCodeChallenge(codeVerifier: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier))
  return base64Url(new Uint8Array(digest))
}

export function getTwitchRedirectUri() {
  const callbackPath = '/auth/twitch/callback'
  const configuredBase = (import.meta.env.VITE_TWITCH_REDIRECT_BASE_URL as string | undefined)?.trim()
  if (configuredBase) return `${configuredBase.replace(/\/$/, '')}${callbackPath}`
  return `${window.location.origin}${callbackPath}`
}

export async function startTwitchOAuth(returnTo: string) {
  const clientId = getClientId()
  if (!clientId) throw new Error('Missing VITE_TWITCH_CLIENT_ID')

  const state = crypto.randomUUID()
  const codeVerifier = randomCodeVerifier()
  const codeChallenge = await createCodeChallenge(codeVerifier)

  localStorage.setItem(STATE_KEY, state)
  localStorage.setItem(VERIFIER_KEY, codeVerifier)
  localStorage.setItem(RETURN_TO_KEY, returnTo)

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: getTwitchRedirectUri(),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    force_verify: 'true',
  })

  window.location.href = `${TWITCH_AUTHORIZE_URL}?${params.toString()}`
}

export function getTwitchReturnTo() {
  const returnTo = localStorage.getItem(RETURN_TO_KEY) || '/account'
  localStorage.removeItem(RETURN_TO_KEY)
  return returnTo
}

function clearTwitchOAuthState() {
  localStorage.removeItem(STATE_KEY)
  localStorage.removeItem(VERIFIER_KEY)
}

export interface TwitchAuthFlowState {
  twitchUsername: string
  existingUid?: string
  existingAuthEmail?: string
}

export function setTwitchAuthFlowState(data: TwitchAuthFlowState) {
  localStorage.setItem(AUTH_FLOW_KEY, JSON.stringify(data))
}

export function getTwitchAuthFlowState(): TwitchAuthFlowState | null {
  try {
    const raw = localStorage.getItem(AUTH_FLOW_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<TwitchAuthFlowState>
    if (!parsed.twitchUsername) return null
    return {
      twitchUsername: parsed.twitchUsername,
      existingUid: parsed.existingUid,
      existingAuthEmail: parsed.existingAuthEmail,
    }
  } catch {
    return null
  }
}

export function clearTwitchAuthFlowState() {
  localStorage.removeItem(AUTH_FLOW_KEY)
}

export async function resolveTwitchUserFromCallback(search: string) {
  const params = new URLSearchParams(search)
  const code = params.get('code')
  const state = params.get('state')
  const error = params.get('error')
  const errorDescription = params.get('error_description')

  if (error) {
    clearTwitchOAuthState()
    throw new Error(`Twitch auth failed: ${error}${errorDescription ? ` (${decodeURIComponent(errorDescription)})` : ''}`)
  }

  if (!code || !state) {
    clearTwitchOAuthState()
    throw new Error('Missing Twitch OAuth callback fields: expected code and state.')
  }

  const expectedState = localStorage.getItem(STATE_KEY)
  const codeVerifier = localStorage.getItem(VERIFIER_KEY)
  if (!expectedState || expectedState !== state) {
    clearTwitchOAuthState()
    throw new Error('Invalid Twitch OAuth state')
  }
  if (!codeVerifier) {
    clearTwitchOAuthState()
    throw new Error('Missing Twitch OAuth verifier')
  }

  const response = await fetch('/.netlify/functions/twitch-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      codeVerifier,
      redirectUri: getTwitchRedirectUri(),
      clientId: getClientId(),
    }),
  })

  const text = await response.text()
  if (!response.ok) {
    clearTwitchOAuthState()
    throw new Error(`Unable to exchange Twitch OAuth code: ${text}`)
  }

  const payload = JSON.parse(text) as { username?: string }
  const username = payload.username?.trim().toLowerCase()
  if (!username) {
    clearTwitchOAuthState()
    throw new Error('Twitch OAuth exchange succeeded but no username was returned.')
  }

  clearTwitchOAuthState()
  return username
}
