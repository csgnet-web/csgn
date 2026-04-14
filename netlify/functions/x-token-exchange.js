exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' }

  try {
    const { code, codeVerifier, redirectUri } = JSON.parse(event.body || '{}')
    if (!code || !codeVerifier || !redirectUri) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required payload fields' }) }
    }

    const clientId = process.env.X_CLIENT_ID || process.env.VITE_X_CLIENT_ID || 'eDA3SWFHSlVXT3NaY1FaWFBjSlA6MTpjaQ'
    const clientSecret = process.env.X_CLIENT_SECRET || process.env.VITE_X_CLIENT_SECRET || 'DVbNuXtklbTMKud7DOjd7z9T1FLgLsUMB_ZKU_06EDph2THmI4'
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

    const tokenRes = await fetch('https://api.x.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basic}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: clientId,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    })

    const tokenText = await tokenRes.text()
    if (!tokenRes.ok) return { statusCode: tokenRes.status, body: tokenText }

    const tokenJson = JSON.parse(tokenText)
    const accessToken = tokenJson.access_token
    if (!accessToken) return { statusCode: 500, body: JSON.stringify({ error: 'No access token returned by X' }) }

    const meRes = await fetch('https://api.x.com/2/users/me?user.fields=username', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const meText = await meRes.text()
    if (!meRes.ok) return { statusCode: meRes.status, body: meText }

    const meJson = JSON.parse(meText)
    const username = meJson?.data?.username
    if (!username) return { statusCode: 500, body: JSON.stringify({ error: 'No username returned by X profile endpoint' }) }

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
