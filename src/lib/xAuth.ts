const X_AUTHORIZE_URL = 'https://x.com/i/oauth2/authorize'
const STATE_KEY = 'x_oauth_state'
const RETURN_TO_KEY = 'x_oauth_return_to'

const FALLBACK_CLIENT_ID = 'eDA3SWFHSlVXT3NaY1FaWFBjSlA6MTpjaQ'

function getClientId() {
  return (import.meta.env.VITE_X_CLIENT_ID as string | undefined) || FALLBACK_CLIENT_ID
}

export function getXRedirectUri() {
  return `${window.location.origin}/auth/x/callback`
}

export async function startXOAuth(returnTo: string) {
  const clientId = getClientId()
  if (!clientId) throw new Error('Missing VITE_X_CLIENT_ID')

  const state = crypto.randomUUID()
  localStorage.setItem(STATE_KEY, state)
  localStorage.setItem(RETURN_TO_KEY, returnTo)

  const params = new URLSearchParams({
    response_type: 'token',
    client_id: clientId,
    redirect_uri: getXRedirectUri(),
    scope: 'users.read',
    state,
    force_verify: 'true',
  })

  window.location.href = `${X_AUTHORIZE_URL}?${params.toString()}`
}

export function getXReturnTo() {
  return localStorage.getItem(RETURN_TO_KEY) || '/account'
}

export async function resolveXUserFromHash(hash: string) {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const accessToken = params.get('access_token')
  const state = params.get('state')
  const error = params.get('error')
  const errorDescription = params.get('error_description')

  if (error) throw new Error(`X auth failed: ${errorDescription || error}`)
  if (!accessToken || !state) throw new Error('Missing X OAuth response fields')

  const expectedState = localStorage.getItem(STATE_KEY)
  if (!expectedState || expectedState !== state) throw new Error('Invalid X OAuth state')

  const profileRes = await fetch('/.netlify/functions/x-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken }),
  })
  if (!profileRes.ok) throw new Error(`Unable to load X profile: ${await profileRes.text()}`)

  const payload = await profileRes.json() as { username?: string }
  if (!payload.username) throw new Error('No X username returned')

  localStorage.removeItem(STATE_KEY)
  return payload.username
}
