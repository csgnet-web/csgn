exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

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
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    })

    const text = await tokenRes.text()
    if (!tokenRes.ok) {
      return { statusCode: tokenRes.status, body: text }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: text,
    }
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
    }
  }
}
