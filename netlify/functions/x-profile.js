function getConfig() {
  const clientId = process.env.X_CLIENT_ID
  const clientSecret = process.env.X_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Missing X_CLIENT_ID or X_CLIENT_SECRET in Netlify environment')
  }
  return { clientId, clientSecret }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' }

  try {
    const { code, codeVerifier, redirectUri } = JSON.parse(event.body || '{}')
    if (!code || !codeVerifier || !redirectUri) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing code/codeVerifier/redirectUri' }) }
    }

    const { clientId, clientSecret } = getConfig()
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

    const profileRes = await fetch('https://api.x.com/2/users/me?user.fields=username', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    const profileText = await profileRes.text()
    if (!profileRes.ok) return { statusCode: profileRes.status, body: profileText }

    const profileJson = JSON.parse(profileText)
    const username = profileJson?.data?.username
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
