import { requireUser } from './_shared/auth'
import { auditLog } from './_shared/audit'
import { badRequest, conflict, forbidden, notFound } from './_shared/errors'
import { beginTransaction, commitWrites, fieldFilter, getDoc, queryCollection, updateWrite } from './_shared/firebaseAdmin'
import { json, parseJson, requireMethod, withHttp } from './_shared/http'
import { resolveBroadcast } from './resolveCurrentBroadcast'
import { checkRateLimit, clientIp } from './_shared/rateLimit'

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
type SlotDoc = { status?: string; type?: string; isClaimable?: boolean; assignedUid?: string; startTime?: string; endTime?: string }

/** Legacy 'ceo' docs are the same 7 PM–3 AM block as the new 'network' type. */
const isNetworkSlot = (slot: SlotDoc): boolean => slot.type === 'network' || slot.type === 'ceo'
/**
 * Mirrors isSlotClaimable in src/lib/slotModel.ts — assignment decides, not
 * status. On an UNASSIGNED slot the status is bookkeeping that drifts (an admin
 * flips the airing hour to 'live', a legacy doc says 'confirmed'), and none of it
 * means a person took the hour. Only an explicit 'completed' stops a claim, so
 * the hour currently on the air stays claimable — that's the most valuable one,
 * since the claimant can go live right now. If you change this rule, change it in
 * slotModel.ts too or the button and the server will disagree.
 */
const blocksClaim = (status?: string): boolean => status === 'completed'

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
  await checkRateLimit(clientIp(event), 'claimSlot', 20)
  const authUser = await requireUser(event)
  const slotId = parseJson<Body>(event).slotId
  if (!slotId || !/^[a-zA-Z0-9_-]{3,120}$/.test(slotId)) throw badRequest('Valid slotId is required.', 'invalid_slot_id')
  const transaction = await beginTransaction()
  const user = await getDoc<UserDoc>(`users/${authUser.uid}`, transaction)
  const isAdmin = user?.role === 'admin'
  if (!isAdmin && authUser.email_verified !== true) throw forbidden('Email verification required before claiming slots')
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
  // assignedUid is the real "someone took this". `isClaimable` is a denormalized
  // mirror written by the seeders — it goes stale the moment a status is edited
  // by hand, so it is kept up to date but never used to veto a claim.
  if (slot.assignedUid) throw conflict('Slot is not available', 'slot_unavailable')
  if (!slot.endTime || new Date(slot.endTime).getTime() <= nowMs) throw conflict('Past slots cannot be claimed', 'slot_past')
  // The 7 PM–3 AM ET network block is CSGN Originals — unless an admin switches
  // the block off globally, which hands those hours back to open claiming.
  if (isNetworkSlot(slot)) {
    const meta = await getDoc<{ networkBlockEnabled?: boolean }>('config/scheduleMeta', transaction)
    if (meta?.networkBlockEnabled !== false) {
      throw conflict('This is a CSGN Originals slot and is not open for claiming.', 'network_slot')
    }
  }
  if (blocksClaim(slot.status)) throw conflict('Slot is not available', 'slot_unavailable')
  const max = user.slotLimits?.maxConcurrentClaims || 2
  const allUserSlots = await queryCollection('slots', [fieldFilter('assignedUid', 'EQUAL', authUser.uid)], [], 20)
  const claimed = allUserSlots.filter((s) => {
    const endTime = s.data.endTime
    return typeof endTime === 'string' && new Date(endTime).getTime() > nowMs
  })
  if (!isAdmin && claimed.length >= max) throw conflict(`You can claim up to ${max} future/live slots.`, 'claim_limit_reached')
  const now = new Date()
  const twitchChannelUrl = `https://www.twitch.tv/${twitchUsername}`
  await commitWrites([updateWrite(`slots/${slotId}`, {
    status: 'confirmed', isClaimable: false, sourceType: 'user_twitch', assignedUid: authUser.uid, assignedUsername: user.username || twitchUsername,
    assignedName: user.username || twitchUsername, twitchUserId, twitchUsername, twitchChannelUrl, streamUrl: twitchChannelUrl,
    walletAddress, claimedAt: now, updatedAt: now,
  })], transaction)
  await auditLog('claimSlot', authUser.uid, { slotId })
  await resolveBroadcast().catch((err) => console.warn('resolve after claim failed', err))
  return json(200, { ok: true, slotId })
})
