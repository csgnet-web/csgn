const FALLBACK_CLIENT_ID = 'eDA3SWFHSlVXT3NaY1FaWFBjSlA6MTpjaQ'
const FALLBACK_CLIENT_SECRET = 'DVbNuXtklbTMKud7DOjd7z9T1FLgLsUMB_ZKU_06EDph2THmI4'

function getClientConfig(clientIdFromRequest) {
  const clientId = process.env.X_CLIENT_ID || clientIdFromRequest || FALLBACK_CLIENT_ID
  const clientSecret = process.env.X_CLIENT_SECRET || FALLBACK_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Missing X client credentials for OAuth exchange')
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
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

    const tokenRes = await fetch('https://api.x.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: clientId,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    })

    const tokenBody = await tokenRes.text()
    if (!tokenRes.ok) {
      return {
        statusCode: tokenRes.status,
        headers: { 'Content-Type': 'application/json' },
        body: tokenBody,
      }
    }

    const tokenJson = JSON.parse(tokenBody)
    const accessToken = tokenJson?.access_token

    if (!accessToken) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No access_token returned from X token endpoint' }),
      }
    }

    const meRes = await fetch('https://api.x.com/2/users/me?user.fields=username', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    const meBody = await meRes.text()
    if (!meRes.ok) {
      return {
        statusCode: meRes.status,
        headers: { 'Content-Type': 'application/json' },
        body: meBody,
      }
    }

    const meJson = JSON.parse(meBody)
    const username = meJson?.data?.username

    if (!username) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No username returned by X users/me endpoint' }),
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
