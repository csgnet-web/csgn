const SECRET_KEY_PREFIX = 'x_oauth_temp_secret_'
const RETURN_TO_KEY = 'x_oauth_return_to'

export function getXRedirectUri() {
  return `${window.location.origin}/auth/x/callback`
}

export async function startXOAuth(returnTo: string) {
  localStorage.setItem(RETURN_TO_KEY, returnTo)

  const params = new URLSearchParams({ callback: getXRedirectUri() })
  const res = await fetch(`/.netlify/functions/x-oauth-start?${params.toString()}`)
  if (!res.ok) throw new Error(await res.text())

  const json = await res.json() as { oauthToken?: string; oauthTokenSecret?: string; authorizeUrl?: string }
  if (!json.oauthToken || !json.oauthTokenSecret || !json.authorizeUrl) {
    throw new Error('Invalid X OAuth start response')
  }

  localStorage.setItem(`${SECRET_KEY_PREFIX}${json.oauthToken}`, json.oauthTokenSecret)
  window.location.href = json.authorizeUrl
}

export function getXReturnTo() {
  return localStorage.getItem(RETURN_TO_KEY) || '/account'
}

export async function resolveXUserFromSearch(search: string) {
  const params = new URLSearchParams(search)
  const oauthToken = params.get('oauth_token')
  const oauthVerifier = params.get('oauth_verifier')
  const denied = params.get('denied')

  if (denied) throw new Error('X authorization was denied by the user.')
  if (!oauthToken || !oauthVerifier) throw new Error('Missing X OAuth callback fields')

  const secretKey = `${SECRET_KEY_PREFIX}${oauthToken}`
  const oauthTokenSecret = localStorage.getItem(secretKey)
  if (!oauthTokenSecret) throw new Error('Missing temporary X OAuth token secret')

  const res = await fetch('/.netlify/functions/x-oauth-finish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oauthToken, oauthVerifier, oauthTokenSecret }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Unable to finish X OAuth: ${text}`)
  }

  const data = await res.json() as { username?: string }
  if (!data.username) throw new Error('No X username returned')

  localStorage.removeItem(secretKey)

  return data.username
}
