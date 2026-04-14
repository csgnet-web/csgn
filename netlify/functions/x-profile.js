const crypto = require('crypto')

const X_API_BASE = 'https://api.x.com/1.1'
const VERIFY_CREDENTIALS_URL = `${X_API_BASE}/account/verify_credentials.json?skip_status=true&include_entities=false`

// User requested a no-Netlify-env setup, so credentials are wired directly here.
const CONSUMER_KEY = 'eWlFHctYHGBJWrqvnw4tCG1dl'
const CONSUMER_SECRET = 'hE9l2zl9FaLJ8jHHYcwFHKrWGeUimgYRAvfprUt5s3ww8fHKAW'
const ACCESS_TOKEN = '1966661365222764545-5HAcAgTuKwWoCO3DXfRkEFUDYcXtqj'
const ACCESS_TOKEN_SECRET = 'mmVp0vIXoLuPUfHjhqUPfD19p67qah4HnlqajMrQf9D9I'

function percentEncode(value) {
  return encodeURIComponent(value)
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29')
}

function createOAuthHeader(method, url) {
  const oauth = {
    oauth_consumer_key: CONSUMER_KEY,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: ACCESS_TOKEN,
    oauth_version: '1.0',
  }

  const parameterString = Object.keys(oauth)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(oauth[key])}`)
    .join('&')

  const signatureBaseString = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(parameterString),
  ].join('&')

  const signingKey = `${percentEncode(CONSUMER_SECRET)}&${percentEncode(ACCESS_TOKEN_SECRET)}`
  const signature = crypto.createHmac('sha1', signingKey).update(signatureBaseString).digest('base64')

  const authParams = { ...oauth, oauth_signature: signature }
  const authHeader = `OAuth ${Object.keys(authParams)
    .sort()
    .map((key) => `${percentEncode(key)}="${percentEncode(authParams[key])}"`)
    .join(', ')}`

  return authHeader
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  try {
    const authorization = createOAuthHeader('GET', VERIFY_CREDENTIALS_URL)
    const profileRes = await fetch(VERIFY_CREDENTIALS_URL, {
      method: 'GET',
      headers: {
        Authorization: authorization,
      },
    })

    const body = await profileRes.text()
    if (!profileRes.ok) {
      return {
        statusCode: profileRes.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Unable to verify X credentials', details: body }),
      }
    }

    const payload = JSON.parse(body)
    const username = payload?.screen_name

    if (!username) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No username returned from X verify_credentials' }),
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
