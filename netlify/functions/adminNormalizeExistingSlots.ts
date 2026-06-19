import { requireAdminUser } from './_shared/auth'
import { auditLog } from './_shared/audit'
import { commitWrites, queryCollection, updateWrite } from './_shared/firebaseAdmin'
import { json, requireMethod, withHttp } from './_shared/http'

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  const user = await requireAdminUser(event)
  const slots = await queryCollection('slots', [], [], 500)
  const writes = slots.map((slot) => {
    const open = !slot.data.assignedUid && (slot.data.status === 'open' || !slot.data.status)
    return updateWrite(slot.path, { isClaimable: open, status: open ? 'open' : (slot.data.status || 'confirmed'), updatedAt: new Date() }, true)
  })
  for (let i = 0; i < writes.length; i += 400) await commitWrites(writes.slice(i, i + 400))
  await auditLog('adminNormalizeExistingSlots', user.uid, { count: writes.length })
  return json(200, { normalized: writes.length })
})
