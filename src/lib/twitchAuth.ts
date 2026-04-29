const TWITCH_AUTHORIZE_URL = 'https://id.twitch.tv/oauth2/authorize'
const TWITCH_USERS_URL = 'https://api.twitch.tv/helix/users'

const STATE_KEY = 'twitch_oauth_state'
const RETURN_TO_KEY = 'twitch_oauth_return_to'
const AUTH_FLOW_KEY = 'twitch_auth_flow'

const FALLBACK_CLIENT_ID = 'n1exwoae1t2yebr09kxnbnvwhovk3l'

function getClientId() {
  return (import.meta.env.VITE_TWITCH_CLIENT_ID as string | undefined) || FALLBACK_CLIENT_ID
}

export function getTwitchRedirectUri() {
  // Always anchor the redirect to the same origin that started the flow.
  // www.csgn.fun is normalized to csgn.fun in main.tsx so localStorage state
  // and Twitch's redirect both live on the apex domain.
  return `${window.location.origin}/auth/twitch/callback`
}

export function startTwitchOAuth(returnTo: string) {
  const clientId = getClientId()
  if (!clientId) throw new Error('Missing VITE_TWITCH_CLIENT_ID')

  const state = crypto.randomUUID()
  localStorage.setItem(STATE_KEY, state)
  localStorage.setItem(RETURN_TO_KEY, returnTo)

  const params = new URLSearchParams({
    response_type: 'token',
    client_id: clientId,
    redirect_uri: getTwitchRedirectUri(),
    scope: '',
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

export async function resolveTwitchUserFromHash(hash: string) {
  const clientId = getClientId()
  if (!clientId) throw new Error('Missing VITE_TWITCH_CLIENT_ID')

  const hashParams = new URLSearchParams(hash.replace(/^#/, ''))
  const accessToken = hashParams.get('access_token')
  const state = hashParams.get('state')
  const error = hashParams.get('error')

  if (error) throw new Error(`Twitch auth failed: ${error}`)
  if (!accessToken || !state) throw new Error('Missing Twitch OAuth response fields')

  const expectedState = localStorage.getItem(STATE_KEY)
  if (!expectedState || expectedState !== state) throw new Error('Invalid Twitch OAuth state')

  const response = await fetch(TWITCH_USERS_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Client-Id': clientId,
    },
  })

  if (!response.ok) throw new Error('Unable to validate Twitch account')

  const json = await response.json() as { data?: Array<{ login?: string }> }
  const login = json.data?.[0]?.login
  if (!login) throw new Error('No Twitch username returned')

  localStorage.removeItem(STATE_KEY)

  return login
}
