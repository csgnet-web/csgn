const FALLBACK_CLIENT_ID = 'eDA3SWFHSlVXT3NaY1FaWFBjSlA6MTpjaQ'
const FALLBACK_CLIENT_SECRET = 'DVbNuXtklbTMKud7DOjd7z9T1FLgLsUMB_ZKU_06EDph2THmI4'
const TOKEN_URL = 'https://api.x.com/2/oauth2/token'
const ME_URL = 'https://api.x.com/2/users/me?user.fields=username'

function getClientConfig(clientIdFromRequest) {
  const clientId = process.env.X_CLIENT_ID || clientIdFromRequest || FALLBACK_CLIENT_ID
  const clientSecret = process.env.X_CLIENT_SECRET || FALLBACK_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Missing X client credentials for OAuth exchange')
  }

  return { clientId, clientSecret }
}

function maskClientId(clientId) {
  if (!clientId || clientId.length < 8) return 'unknown'
  return `${clientId.slice(0, 4)}...${clientId.slice(-4)}`
}

async function exchangeWithBasic({ code, codeVerifier, redirectUri, clientId, clientSecret }) {
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  return fetch(TOKEN_URL, {
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
}

async function exchangeWithClientSecretPost({ code, codeVerifier, redirectUri, clientId, clientSecret }) {
  return fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  })
}

function buildForbiddenHint({ redirectUri, clientId }) {
  return [
    'X token exchange returned 403 Forbidden.',
    'Most likely cause: client credentials and OAuth app settings do not match this callback request.',
    `callback used: ${redirectUri}`,
    `client id used: ${maskClientId(clientId)}`,
    'Verify in X Developer Portal: OAuth 2.0 enabled, callback URL exact match, app type and client auth method match.',
  ].join(' ')
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
    const exchangeInput = { code, codeVerifier, redirectUri, clientId, clientSecret }

    let tokenRes = await exchangeWithBasic(exchangeInput)
    let tokenBody = await tokenRes.text()
    let exchangeMethod = 'client_secret_basic'

    if (!tokenRes.ok && (tokenRes.status === 401 || tokenRes.status === 403)) {
      const fallbackRes = await exchangeWithClientSecretPost(exchangeInput)
      const fallbackBody = await fallbackRes.text()
      if (fallbackRes.ok) {
        tokenRes = fallbackRes
        tokenBody = fallbackBody
        exchangeMethod = 'client_secret_post'
      } else {
        return {
          statusCode: fallbackRes.status,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: 'Unable to exchange X OAuth code for token',
            detail: {
              primaryAttempt: {
                method: 'client_secret_basic',
                status: tokenRes.status,
                body: tokenBody,
              },
              fallbackAttempt: {
                method: 'client_secret_post',
                status: fallbackRes.status,
                body: fallbackBody,
              },
              hint: fallbackRes.status === 403 ? buildForbiddenHint({ redirectUri, clientId }) : undefined,
            },
          }),
        }
      }
    }

    if (!tokenRes.ok) {
      return {
        statusCode: tokenRes.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Unable to exchange X OAuth code for token',
          detail: {
            method: exchangeMethod,
            status: tokenRes.status,
            body: tokenBody,
            hint: tokenRes.status === 403 ? buildForbiddenHint({ redirectUri, clientId }) : undefined,
          },
        }),
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

    const meRes = await fetch(ME_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    const meBody = await meRes.text()
    if (!meRes.ok) {
      return {
        statusCode: meRes.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'X token exchange succeeded, but users/me failed',
          detail: {
            status: meRes.status,
            body: meBody,
          },
        }),
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
