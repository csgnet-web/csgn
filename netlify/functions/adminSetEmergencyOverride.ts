import { requireAdminUser } from './_shared/auth'
import { auditLog } from './_shared/audit'
import { badRequest } from './_shared/errors'
import { writeDoc } from './_shared/firebaseAdmin'
import { json, parseJson, requireMethod, withHttp } from './_shared/http'
import { resolveBroadcast } from './resolveCurrentBroadcast'

type Body = { streamUrl?: string; reason?: string }

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  const user = await requireAdminUser(event)
  const { streamUrl, reason } = parseJson<Body>(event)
  if (!streamUrl || !/^https:\/\//.test(streamUrl)) throw badRequest('A valid https streamUrl is required.', 'invalid_stream_url')
  await writeDoc('config/emergencyOverride', { enabled: true, streamUrl, reason: reason || '', updatedBy: user.uid, updatedAt: new Date() })
  const currentBroadcast = await resolveBroadcast()
  await auditLog('adminSetEmergencyOverride', user.uid, { streamUrl })
  return json(200, { currentBroadcast })
})
