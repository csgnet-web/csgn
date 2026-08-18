/**
 * THE OPERATOR'S BOARD — everybody in the network who is live right now.
 *
 * This is the control surface the whole "streamers don't manage a schedule"
 * model rests on. Members connect Twitch once and grant forwarding consent;
 * `_shared/liveRoster.ts` samples them every minute; this endpoint shows the
 * operator who is on and lets them put one of them on the channel in a click.
 *
 * GET  → the roster (live first, by viewers).
 * POST → put a member on air, or take the channel back.
 *
 * ── Why "put on air" writes a SLOT rather than an override ─────────────────
 *
 * There was an easier implementation: point `config/emergencyOverride` at the
 * streamer's URL. It would have worked on screen and been wrong everywhere
 * else, because the slot is what the rest of the system runs on. The fee
 * ledger, the airtime sampler, the ticker's "live now", `/schedule`'s record of
 * who aired, and the payout runner all read slots. An override would have put a
 * face on the channel that earned nothing and appeared in no history.
 *
 * So this assigns the CURRENT block to that member — the same shape claimSlot
 * writes, minus the claiming. The operator's click is the claim. Everything
 * downstream then works with no new plumbing, which is the point.
 */
import { requireAdminUser } from './_shared/auth'
import { auditLog } from './_shared/audit'
import { badRequest, notFound } from './_shared/errors'
import {
  commitWrites, fieldFilter, getDoc, order, queryCollection, updateWrite,
} from './_shared/firebaseAdmin'
import { json, parseJson, requireMethod, withHttp } from './_shared/http'
import { refreshLiveRoster, ROSTER_STALE_MS, type RosterEntry } from './_shared/liveRoster'
import { resolveBroadcast } from './resolveCurrentBroadcast'

interface RosterDoc { entries?: RosterEntry[]; updatedAt?: string; liveCount?: number }
type Body = { uid?: string; action?: 'put_on_air' | 'take_off_air' }

export const handler = withHttp(async (event) => {
  const admin = await requireAdminUser(event)

  if (event.httpMethod === 'GET') {
    const stored = await getDoc<RosterDoc>('public/liveRoster')
    const ageMs = Date.now() - Date.parse(stored?.updatedAt || '')
    // A roster older than the stale window is not shown as fact. Rebuilding on
    // demand keeps the board usable when the scheduled poller is not running —
    // the same failure that left the Meme 100 empty, pre-empted here.
    const entries = Number.isFinite(ageMs) && ageMs < ROSTER_STALE_MS
      ? (stored?.entries ?? [])
      : await refreshLiveRoster(await currentOnAirUid())

    return json(200, {
      entries,
      updatedAt: stored?.updatedAt ?? null,
      onAirUid: await currentOnAirUid(),
      staleAfterMs: ROSTER_STALE_MS,
    })
  }

  requireMethod(event, 'POST')
  const body = parseJson<Body>(event)
  const action = body.action === 'take_off_air' ? 'take_off_air' : 'put_on_air'

  const slot = await currentSlot()
  if (!slot) throw notFound('There is no block covering right now to put anyone on.')

  if (action === 'take_off_air') {
    await commitWrites([updateWrite(`slots/${slot.id}`, {
      status: 'open', isClaimable: true,
      assignedUid: null, assignedUsername: null, assignedName: null,
      twitchUserId: null, twitchUsername: null, twitchChannelUrl: null, streamUrl: null,
      sourceType: null, updatedAt: new Date(),
    }, true)])
    const currentBroadcast = await resolveBroadcast()
    await auditLog('adminTakeOffAir', admin.uid, { slotId: slot.id })
    return json(200, { ok: true, slotId: slot.id, currentBroadcast })
  }

  const uid = String(body.uid || '').trim()
  if (!uid) throw badRequest('Which member?', 'missing_uid')

  const user = await getDoc<{
    username?: string
    twitch?: { verified?: boolean; username?: string; twitchUserId?: string; forwardConsent?: boolean }
  }>(`users/${uid}`)
  if (!user) throw notFound('No such member.')

  const login = String(user.twitch?.username || '').trim()
  if (!user.twitch?.verified || !login) throw badRequest('That member has no verified Twitch channel.', 'no_twitch')
  // CONSENT IS RE-CHECKED HERE, not merely at link time. The roster is a
  // snapshot and could have been built before somebody withdrew — putting them
  // on air off a stale snapshot would forward a stream we no longer may.
  if (user.twitch.forwardConsent !== true) {
    throw badRequest('That member has not granted permission to forward their stream.', 'no_consent')
  }

  const channelUrl = `https://www.twitch.tv/${login}`
  await commitWrites([updateWrite(`slots/${slot.id}`, {
    status: 'live',
    isClaimable: false,
    sourceType: 'operator_live',
    assignedUid: uid,
    assignedUsername: user.username || login,
    assignedName: user.username || login,
    twitchUserId: user.twitch.twitchUserId || '',
    twitchUsername: login,
    twitchChannelUrl: channelUrl,
    streamUrl: channelUrl,
    updatedAt: new Date(),
  }, true)])

  const currentBroadcast = await resolveBroadcast()
  await auditLog('adminPutOnAir', admin.uid, { slotId: slot.id, uid, twitchUsername: login })
  return json(200, { ok: true, slotId: slot.id, uid, twitchUsername: login, currentBroadcast })
})

/** The block covering right now, if there is one. */
async function currentSlot(): Promise<{ id: string; assignedUid?: string } | null> {
  const now = new Date().toISOString()
  const rows = await queryCollection(
    'slots',
    [fieldFilter('startTime', 'LESS_THAN_OR_EQUAL', now)],
    [order('startTime', 'DESCENDING')],
    5,
  )
  for (const row of rows) {
    const d = row.data as { startTime?: string; endTime?: string; assignedUid?: string }
    if (typeof d.endTime === 'string' && d.endTime > now) {
      return { id: row.path.split('/').pop()!, assignedUid: d.assignedUid }
    }
  }
  return null
}

/** Who the channel is currently carrying, so the board can mark them. */
async function currentOnAirUid(): Promise<string | null> {
  const slot = await currentSlot()
  return slot?.assignedUid ?? null
}
