const crypto = require('crypto')

const ACCESS_TOKEN_URL = 'https://api.x.com/oauth/access_token'
const VERIFY_URL = 'https://api.x.com/1.1/account/verify_credentials.json?skip_status=true&include_email=false'

const API_KEY = process.env.X_API_KEY || 'eWlFHctYHGBJWrqvnw4tCG1dl'
const API_KEY_SECRET = process.env.X_API_KEY_SECRET || 'hE9l2zl9FaLJ8jHHYcwFHKrWGeUimgYRAvfprUt5s3ww8fHKAW'

const enc = (v) => encodeURIComponent(v).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)

function signOAuth({ method, url, params, tokenSecret = '' }) {
  const sorted = Object.keys(params).sort().map((k) => `${enc(k)}=${enc(params[k])}`).join('&')
  const base = [method.toUpperCase(), enc(url), enc(sorted)].join('&')
  const key = `${enc(API_KEY_SECRET)}&${enc(tokenSecret)}`
  return crypto.createHmac('sha1', key).update(base).digest('base64')
}

function authHeader(params) {
  return 'OAuth ' + Object.keys(params).sort().map((k) => `${enc(k)}="${enc(params[k])}"`).join(', ')
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' }

  try {
    const { oauthToken, oauthVerifier, oauthTokenSecret } = JSON.parse(event.body || '{}')
    if (!oauthToken || !oauthVerifier || !oauthTokenSecret) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing OAuth fields' }) }
    }

    const oauth = {
      oauth_consumer_key: API_KEY,
      oauth_nonce: crypto.randomBytes(16).toString('hex'),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_token: oauthToken,
      oauth_verifier: oauthVerifier,
      oauth_version: '1.0',
    }
    oauth.oauth_signature = signOAuth({ method: 'POST', url: ACCESS_TOKEN_URL, params: oauth, tokenSecret: oauthTokenSecret })

    const tokenRes = await fetch(ACCESS_TOKEN_URL, {
      method: 'POST',
      headers: { Authorization: authHeader(oauth) },
    })
    const tokenText = await tokenRes.text()
    if (!tokenRes.ok) return { statusCode: tokenRes.status, body: tokenText }

    const tokenData = new URLSearchParams(tokenText)
    const accessToken = tokenData.get('oauth_token')
    const accessTokenSecret = tokenData.get('oauth_token_secret')
    if (!accessToken || !accessTokenSecret) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Invalid X access token response' }) }
    }

    const verifyOAuth = {
      oauth_consumer_key: API_KEY,
      oauth_nonce: crypto.randomBytes(16).toString('hex'),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_token: accessToken,
      oauth_version: '1.0',
    }
    verifyOAuth.oauth_signature = signOAuth({ method: 'GET', url: VERIFY_URL.split('?')[0], params: verifyOAuth, tokenSecret: accessTokenSecret })

    const verifyRes = await fetch(VERIFY_URL, {
      headers: { Authorization: authHeader(verifyOAuth) },
    })
    const verifyText = await verifyRes.text()
    if (!verifyRes.ok) return { statusCode: verifyRes.status, body: verifyText }

    const profile = JSON.parse(verifyText)
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: profile.screen_name || profile.name || null }),
    }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }) }
  }
}
