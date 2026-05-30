import { requireAdminUser } from './_shared/auth'
import { auditLog } from './_shared/audit'
import { writeDoc } from './_shared/firebaseAdmin'
import { json, requireMethod, withHttp } from './_shared/http'
import { resolveBroadcast } from './resolveCurrentBroadcast'

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  const user = await requireAdminUser(event)
  await writeDoc('config/emergencyOverride', { enabled: false, clearedBy: user.uid, updatedAt: new Date() }, { merge: true })
  const currentBroadcast = await resolveBroadcast()
  await auditLog('adminClearEmergencyOverride', user.uid)
  return json(200, { currentBroadcast })
})
