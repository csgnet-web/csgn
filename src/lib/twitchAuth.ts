const TWITCH_AUTHORIZE_URL = 'https://id.twitch.tv/oauth2/authorize'
const TWITCH_USERS_URL = 'https://api.twitch.tv/helix/users'

const STATE_KEY = 'twitch_oauth_state'
const RETURN_TO_KEY = 'twitch_oauth_return_to'

function getClientId() {
  return import.meta.env.VITE_TWITCH_CLIENT_ID as string | undefined
}

export function getTwitchRedirectUri() {
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
