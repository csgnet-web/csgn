exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' }

  try {
    const { accessToken } = JSON.parse(event.body || '{}')
    if (!accessToken) return { statusCode: 400, body: JSON.stringify({ error: 'Missing accessToken' }) }

    const profileRes = await fetch('https://api.x.com/2/users/me?user.fields=username', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    const text = await profileRes.text()
    if (!profileRes.ok) return { statusCode: profileRes.status, body: text }

    const json = JSON.parse(text)
    const username = json?.data?.username
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
