const TOKEN_URL = 'https://id.twitch.tv/oauth2/token'
const USERS_URL = 'https://api.twitch.tv/helix/users'

const FALLBACK_CLIENT_ID = 'n1exwoae1t2yebr09kxnbnvwhovk3l'

function getClientConfig(clientIdFromRequest) {
  const clientId = process.env.TWITCH_CLIENT_ID || clientIdFromRequest || FALLBACK_CLIENT_ID
  const clientSecret = process.env.TWITCH_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Missing Twitch client credentials for OAuth exchange')
  }

  return { clientId, clientSecret }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  try {
    const { code, codeVerifier, redirectUri, clientId: clientIdFromRequest } = JSON.parse(event.body || '{}')

    if (!code || !codeVerifier || !redirectUri) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing code/codeVerifier/redirectUri' }),
      }
    }

    const { clientId, clientSecret } = getClientConfig(clientIdFromRequest)

    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    })

    const tokenText = await tokenRes.text()
    if (!tokenRes.ok) {
      return {
        statusCode: tokenRes.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Unable to exchange Twitch OAuth code', detail: tokenText }),
      }
    }

    const tokenPayload = JSON.parse(tokenText)
    const accessToken = tokenPayload?.access_token

    if (!accessToken) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No access_token returned from Twitch token endpoint' }),
      }
    }

    const meRes = await fetch(USERS_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Client-Id': clientId,
      },
    })

    const meText = await meRes.text()
    if (!meRes.ok) {
      return {
        statusCode: meRes.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Twitch users lookup failed', detail: meText }),
      }
    }

    const mePayload = JSON.parse(meText)
    const username = mePayload?.data?.[0]?.login

    if (!username) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No Twitch username returned by users endpoint' }),
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    }
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
    }
  }
}
