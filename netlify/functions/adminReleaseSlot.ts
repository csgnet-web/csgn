import { requireAdminUser } from './_shared/auth'
import { auditLog } from './_shared/audit'
import { badRequest } from './_shared/errors'
import { updateWrite, commitWrites } from './_shared/firebaseAdmin'
import { json, parseJson, requireMethod, withHttp } from './_shared/http'
import { resolveBroadcast } from './resolveCurrentBroadcast'

type Body = { slotId?: string }

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  const user = await requireAdminUser(event)
  const { slotId } = parseJson<Body>(event)
  if (!slotId || !/^[a-zA-Z0-9_-]{3,120}$/.test(slotId)) throw badRequest('Valid slotId is required.', 'invalid_slot_id')
  await commitWrites([updateWrite(`slots/${slotId}`, {
    status: 'open', isClaimable: true, sourceType: 'open', assignedUid: null, assignedUsername: null, assignedName: null,
    twitchUserId: null, twitchUsername: null, twitchChannelUrl: null, walletAddress: null, streamUrl: process.env.CSGN_DEFAULT_STREAM_URL || 'https://www.twitch.tv/csgnet', updatedAt: new Date(), releasedAt: new Date(), releasedBy: user.uid,
  })])
  const currentBroadcast = await resolveBroadcast()
  await auditLog('adminReleaseSlot', user.uid, { slotId })
  return json(200, { ok: true, currentBroadcast })
})
