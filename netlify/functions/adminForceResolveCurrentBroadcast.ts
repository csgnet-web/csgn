import { requireAdminUser } from './_shared/auth'
import { auditLog } from './_shared/audit'
import { json, requireMethod, withHttp } from './_shared/http'
import { resolveBroadcast } from './resolveCurrentBroadcast'

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  const user = await requireAdminUser(event)
  const currentBroadcast = await resolveBroadcast()
  await auditLog('adminForceResolveCurrentBroadcast', user.uid, { source: currentBroadcast.source })
  return json(200, { currentBroadcast })
})
