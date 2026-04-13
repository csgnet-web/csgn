const crypto = require('crypto')

const REQUEST_TOKEN_URL = 'https://api.x.com/oauth/request_token'

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
  try {
    const callback = event.queryStringParameters?.callback
    if (!callback) return { statusCode: 400, body: JSON.stringify({ error: 'Missing callback' }) }

    const oauth = {
      oauth_callback: callback,
      oauth_consumer_key: API_KEY,
      oauth_nonce: crypto.randomBytes(16).toString('hex'),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_version: '1.0',
    }

    oauth.oauth_signature = signOAuth({ method: 'POST', url: REQUEST_TOKEN_URL, params: oauth })

    const res = await fetch(REQUEST_TOKEN_URL, {
      method: 'POST',
      headers: { Authorization: authHeader(oauth) },
    })
    const text = await res.text()
    if (!res.ok) return { statusCode: res.status, body: text }

    const data = new URLSearchParams(text)
    const oauthToken = data.get('oauth_token')
    const oauthTokenSecret = data.get('oauth_token_secret')
    if (!oauthToken || !oauthTokenSecret) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Invalid X request token response' }) }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        oauthToken,
        oauthTokenSecret,
        authorizeUrl: `https://api.x.com/oauth/authorize?oauth_token=${oauthToken}`,
      }),
    }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }) }
  }
}
