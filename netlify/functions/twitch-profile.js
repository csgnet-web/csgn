const TOKEN_URL = 'https://id.twitch.tv/oauth2/token'
const USERS_URL = 'https://api.twitch.tv/helix/users'

function getClientConfig(clientIdFromRequest) {
  const clientId = process.env.TWITCH_CLIENT_ID || clientIdFromRequest
  const clientSecret = process.env.TWITCH_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Missing Twitch OAuth credentials')
  }

  return { clientId, clientSecret }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  try {
    const { code, redirectUri, clientId: clientIdFromRequest } = JSON.parse(event.body || '{}')

    if (!code || !redirectUri) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing code or redirectUri' }),
      }
    }

    const { clientId, clientSecret } = getClientConfig(clientIdFromRequest)

    const tokenResponse = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    })

    const tokenPayload = await tokenResponse.json()
    const accessToken = tokenPayload?.access_token

    if (!tokenResponse.ok || !accessToken) {
      return {
        statusCode: tokenResponse.status || 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Unable to exchange Twitch OAuth code for token',
          detail: tokenPayload,
        }),
      }
    }

    const usersResponse = await fetch(USERS_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Client-Id': clientId,
      },
    })

    const usersPayload = await usersResponse.json()
    const username = usersPayload?.data?.[0]?.login

    if (!usersResponse.ok || !username) {
      return {
        statusCode: usersResponse.status || 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Unable to fetch Twitch profile',
          detail: usersPayload,
        }),
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
    }
  }
}
