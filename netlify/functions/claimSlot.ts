import { requireUser } from './_shared/auth'
import { auditLog } from './_shared/audit'
import { badRequest, conflict, forbidden, notFound } from './_shared/errors'
import { beginTransaction, commitWrites, fieldFilter, getDoc, queryCollection, updateWrite } from './_shared/firebaseAdmin'
import { json, parseJson, requireMethod, withHttp } from './_shared/http'
import { resolveBroadcast } from './resolveCurrentBroadcast'

const DEFAULT_ADMIN_TWITCH = 'csgnet'

type Body = { slotId?: string }
type UserDoc = {
  username?: string
  status?: string
  role?: string
  slotLimits?: { maxConcurrentClaims?: number }
  phantom?: { walletAddress?: string; verified?: boolean }
  twitch?: { twitchUserId?: string; username?: string; verified?: boolean }
  twitchUsername?: string
  walletAddress?: string
  socialLinks?: { twitch?: string }
}
type SlotDoc = { status?: string; isClaimable?: boolean; assignedUid?: string; startTime?: string; endTime?: string }

function twitchUsernameFromDefaultUrl(): string {
  const configured = process.env.CSGN_DEFAULT_STREAM_URL || ''
  const match = configured.match(/twitch\.tv\/([^/?#]+)/i)
  return match?.[1]?.replace(/^@/, '').toLowerCase() || DEFAULT_ADMIN_TWITCH
}

function cleanTwitchUsername(value: string): string {
  return value.trim().replace(/^@/, '').toLowerCase()
}

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  const authUser = await requireUser(event)
  const slotId = parseJson<Body>(event).slotId
  if (!slotId || !/^[a-zA-Z0-9_-]{3,120}$/.test(slotId)) throw badRequest('Valid slotId is required.', 'invalid_slot_id')
  const transaction = await beginTransaction()
  const user = await getDoc<UserDoc>(`users/${authUser.uid}`, transaction)
  const isAdmin = user?.role === 'admin'
  if (!user || (user.status !== 'active' && !isAdmin)) throw forbidden('Active CSGN account required')

  const twitchUsername = cleanTwitchUsername(
    user.twitch?.username || (isAdmin ? (user.twitchUsername || user.socialLinks?.twitch || twitchUsernameFromDefaultUrl()) : ''),
  )
  const twitchUserId = user.twitch?.twitchUserId || (isAdmin ? `admin:${twitchUsername}` : '')
  const walletAddress = user.phantom?.walletAddress || (isAdmin ? (user.walletAddress || 'admin') : '')
  if (!isAdmin && (!user.phantom?.verified || !walletAddress || !user.twitch?.verified || !twitchUsername || !twitchUserId)) {
    throw forbidden('Verified Phantom and Twitch are required')
  }
  if (!twitchUsername || !twitchUserId || !walletAddress) throw forbidden('A Twitch channel and wallet are required to claim slots')

  const slot = await getDoc<SlotDoc>(`slots/${slotId}`, transaction)
  if (!slot) throw notFound('Slot not found')
  const nowMs = Date.now()
  if (slot.status !== 'open' || slot.assignedUid || slot.isClaimable === false) throw conflict('Slot is not available', 'slot_unavailable')
  if (!slot.endTime || new Date(slot.endTime).getTime() <= nowMs) throw conflict('Past slots cannot be claimed', 'slot_past')
  const max = user.slotLimits?.maxConcurrentClaims || 2
  const claimed = await queryCollection('slots', [fieldFilter('assignedUid', 'EQUAL', authUser.uid), fieldFilter('endTime', 'GREATER_THAN', new Date().toISOString())], [], 10)
  if (!isAdmin && claimed.length >= max) throw conflict(`You can claim up to ${max} future/live slots.`, 'claim_limit_reached')
  const now = new Date()
  const twitchChannelUrl = `https://www.twitch.tv/${twitchUsername}`
  await commitWrites([updateWrite(`slots/${slotId}`, {
    status: 'claimed', isClaimable: false, sourceType: 'user_twitch', assignedUid: authUser.uid, assignedUsername: user.username || twitchUsername,
    assignedName: user.username || twitchUsername, twitchUserId, twitchUsername, twitchChannelUrl, streamUrl: twitchChannelUrl,
    walletAddress, claimedAt: now, updatedAt: now,
  })], transaction)
  await auditLog('claimSlot', authUser.uid, { slotId })
  await resolveBroadcast().catch((err) => console.warn('resolve after claim failed', err))
  return json(200, { ok: true, slotId })
})
