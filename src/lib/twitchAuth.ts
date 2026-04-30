const TWITCH_AUTHORIZE_URL = 'https://id.twitch.tv/oauth2/authorize'

const STATE_KEY = 'twitch_oauth_state'
const RETURN_TO_KEY = 'twitch_oauth_return_to'
const AUTH_FLOW_KEY = 'twitch_auth_flow'

const FALLBACK_CLIENT_ID = 'n1exwoae1t2yebr09kxnbnvwhovk3l'

function getClientId() {
  return (import.meta.env.VITE_TWITCH_CLIENT_ID as string | undefined) || FALLBACK_CLIENT_ID
}

export function getTwitchRedirectUri() {
  const callbackPath = '/auth/twitch/callback'
  const configuredBase = (import.meta.env.VITE_TWITCH_REDIRECT_BASE_URL as string | undefined)?.trim()

  if (configuredBase) {
    return `${configuredBase.replace(/\/$/, '')}${callbackPath}`
  }

  return `${window.location.origin}${callbackPath}`
}

export function startTwitchOAuth(returnTo: string) {
  const clientId = getClientId()
  if (!clientId) throw new Error('Missing VITE_TWITCH_CLIENT_ID')

  const state = crypto.randomUUID()
  localStorage.setItem(STATE_KEY, state)
  localStorage.setItem(RETURN_TO_KEY, returnTo)

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: getTwitchRedirectUri(),
    scope: 'user:read:email',
    state,
    force_verify: 'true',
  })

  window.location.href = `${TWITCH_AUTHORIZE_URL}?${params.toString()}`
}

export function getTwitchReturnTo() {
  return localStorage.getItem(RETURN_TO_KEY) || '/account'
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
  const query = new URLSearchParams(search)
  const code = query.get('code')
  const state = query.get('state')
  const error = query.get('error')
  const errorDescription = query.get('error_description')

  if (error) {
    throw new Error(`Twitch auth failed: ${error}${errorDescription ? ` (${decodeURIComponent(errorDescription)})` : ''}`)
  }

  if (!code || !state) throw new Error('Missing Twitch OAuth response fields')

  const expectedState = localStorage.getItem(STATE_KEY)
  if (!expectedState || expectedState !== state) throw new Error('Invalid Twitch OAuth state')

  const response = await fetch('/.netlify/functions/twitch-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      redirectUri: getTwitchRedirectUri(),
      clientId: getClientId(),
    }),
  })

  const json = (await response.json()) as { username?: string; error?: string; detail?: string }

  if (!response.ok || !json.username) {
    throw new Error(json.error || json.detail || `Twitch verification failed (${response.status})`)
  }

  localStorage.removeItem(STATE_KEY)

  return json.username.toLowerCase()
}
