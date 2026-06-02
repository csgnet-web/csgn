import { getDoc, writeDoc } from './_shared/firebaseAdmin'
import { badRequest } from './_shared/errors'
import { json, parseJson, requireMethod, withHttp } from './_shared/http'
import { checkRateLimit, clientIp } from './_shared/rateLimit'

type ResultDoc = {
  used?: boolean
  expiresAt?: string
  twitchProofToken?: string
  twitchUserId?: string
  username?: string
  displayName?: string
  profileImageUrl?: string
}

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  await checkRateLimit(clientIp(event), 'consumeTwitchOAuthResult', 10)
  const { handoffId } = parseJson<{ handoffId?: string }>(event)
  if (!handoffId) throw badRequest('Missing handoffId.', 'missing_handoff_id')

  const doc = await getDoc<ResultDoc>(`twitchOAuthResults/${handoffId}`)
  if (!doc || !doc.twitchProofToken) throw badRequest('Twitch handoff not found.', 'handoff_not_found')
  if (doc.used) throw badRequest('Twitch handoff already used.', 'handoff_used')
  if (!doc.expiresAt || new Date(doc.expiresAt).getTime() <= Date.now()) throw badRequest('Twitch handoff expired.', 'handoff_expired')

  // Single-use: mark consumed before returning the proof.
  await writeDoc(`twitchOAuthResults/${handoffId}`, { used: true, usedAt: new Date() }, { merge: true })

  return json(200, {
    twitchProofToken: doc.twitchProofToken,
    twitchUserId: doc.twitchUserId,
    username: doc.username,
    displayName: doc.displayName,
    profileImageUrl: doc.profileImageUrl,
  })
})
