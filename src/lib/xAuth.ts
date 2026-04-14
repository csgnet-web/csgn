export async function connectXAccount() {
  const res = await fetch('/.netlify/functions/x-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })

  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Unable to connect X account: ${text}`)
  }

  const payload = JSON.parse(text) as { username?: string }
  if (!payload.username) {
    throw new Error('No X username returned by server.')
  }

  return payload.username
}
