// Admin one-shot: bring EVERY slot — existing and future — onto the current
// two-block model, derived purely from when the slot airs:
//   7 PM – 3 AM ET  → 'network' (CSGN Originals)
//   every other hour → 'open'   (claimable by any verified account)
// Also clears the auction-era statuses so those hours become claimable again,
// and re-syncs isClaimable. Assigned slots keep their assignment and confirmed
// status — this re-types the schedule, it doesn't evict anyone.
import { requireAdminUser } from './_shared/auth'
import { auditLog } from './_shared/audit'
import { commitWrites, queryCollection, updateWrite, order } from './_shared/firebaseAdmin'
import { json, requireMethod, withHttp } from './_shared/http'
import { slotTypeForStartTime } from './_shared/schedule'

/**
 * Auction-era statuses collapse away; the four real ones pass through. Network
 * slots are programmed rather than claimed, so an unassigned one is 'confirmed'
 * (CSGN Originals), never "open".
 */
function normalizeStatus(raw: unknown, assigned: boolean, network: boolean): string {
  const v = String(raw || '')
  if (v === 'live' || v === 'completed') return v
  return assigned || network ? 'confirmed' : 'open'
}

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  const user = await requireAdminUser(event)

  // Ordered so a very long schedule (e.g. a year-long reseed) is covered.
  const slots = await queryCollection('slots', [], [order('startTime', 'ASCENDING')], 5000)

  let retyped = 0
  const writes = slots.map((slot) => {
    const data = slot.data as { startTime?: string; status?: unknown; assignedUid?: string | null; type?: unknown }
    const assigned = !!data.assignedUid
    const type = slotTypeForStartTime(String(data.startTime || ''))
    const status = normalizeStatus(data.status, assigned, type === 'network')
    if (data.type !== type) retyped++
    return updateWrite(slot.path, {
      type,
      status,
      // Network slots are reserved; open slots are claimable when unassigned.
      isClaimable: type === 'open' && !assigned && status === 'open',
      updatedAt: new Date(),
    }, true)
  })

  for (let i = 0; i < writes.length; i += 400) await commitWrites(writes.slice(i, i + 400))
  await auditLog('adminNormalizeExistingSlots', user.uid, { count: writes.length, retyped })
  return json(200, { normalized: writes.length, retyped })
})
