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
import { operatorAlerts, recommendedMode, DEFAULT_LIVE_VIEWER_FLOOR } from './_shared/operatorAlerts'
import { publishChannelMode } from './_shared/channelModeStore'
import type { ModeSlot } from './_shared/channelMode'
import { resolveBroadcast } from './resolveCurrentBroadcast'
import { twitchLoginFromUrl } from './_shared/twitch'

interface RosterDoc { entries?: RosterEntry[]; updatedAt?: string; liveCount?: number }
type Body = {
  uid?: string
  action?: 'put_on_air' | 'take_off_air' | 'put_guest_on_air'
  /** Guest only: the channel to carry, and who to credit on screen. */
  guestUrl?: string
  guestName?: string
}

export const handler = withHttp(async (event) => {
  const admin = await requireAdminUser(event)

  if (event.httpMethod === 'GET') {
    const stored = await getDoc<RosterDoc>('public/liveRoster')
    const ageMs = Date.now() - Date.parse(stored?.updatedAt || '')
    const slot = await currentSlot()
    // A roster older than the stale window is not shown as fact. Rebuilding on
    // demand keeps the board usable when the scheduled poller is not running —
    // the same failure that left the Meme 100 empty, pre-empted here.
    const entries = Number.isFinite(ageMs) && ageMs < ROSTER_STALE_MS
      ? (stored?.entries ?? [])
      : await refreshLiveRoster(slot?.assignedUid ?? null)

    const meta = await getDoc<{ liveViewerFloor?: number }>('config/scheduleMeta')
    const viewerFloor = Number(meta?.liveViewerFloor) >= 0 && meta?.liveViewerFloor != null
      ? Number(meta.liveViewerFloor)
      : DEFAULT_LIVE_VIEWER_FLOOR

    const alertInput = {
      roster: entries.map((e) => ({
        uid: e.uid, username: e.username, displayName: e.displayName,
        live: e.live, viewerCount: e.viewerCount,
      })),
      onAirUid: slot?.assignedUid ?? null,
      onAirMinutes: minutesSince(slot?.startTime),
      viewerFloor,
    }

    return json(200, {
      entries,
      updatedAt: stored?.updatedAt ?? null,
      onAirUid: slot?.assignedUid ?? null,
      onAirIsGuest: slot?.sourceType === 'operator_guest',
      onAirName: slot?.assignedName ?? null,
      staleAfterMs: ROSTER_STALE_MS,
      viewerFloor,
      // What to do, and why. Computed server-side so the board and any future
      // notifier cannot disagree about whether something needs attention.
      alerts: operatorAlerts(alertInput),
      recommendation: recommendedMode(alertInput),
    })
  }

  requireMethod(event, 'POST')
  const body = parseJson<Body>(event)
  // Explicit allowlist rather than a ternary — an unrecognised action must not
  // silently fall through to putting somebody on television.
  const ACTIONS = ['put_on_air', 'take_off_air', 'put_guest_on_air'] as const
  type Action = (typeof ACTIONS)[number]
  const requested = String(body.action || 'put_on_air') as Action
  if (!ACTIONS.includes(requested)) throw badRequest('Unknown action.', 'bad_action')
  const action: Action = requested

  const slot = await currentSlot()
  if (!slot) throw notFound('There is no block covering right now to put anyone on.')

  if (action === 'take_off_air') {
    await commitWrites([updateWrite(`slots/${slot.id}`, {
      status: 'open', isClaimable: true,
      assignedUid: null, assignedUsername: null, assignedName: null,
      twitchUserId: null, twitchUsername: null, twitchChannelUrl: null, streamUrl: null,
      sourceType: null, isGuest: null, guestAddedBy: null, updatedAt: new Date(),
    }, true)])
    const currentBroadcast = await resolveBroadcast()
    await announceMode({ startTime: slot.startTime, status: 'open', type: slot.type })
    await auditLog('adminTakeOffAir', admin.uid, { slotId: slot.id })
    return json(200, { ok: true, slotId: slot.id, currentBroadcast })
  }

  // ── A GUEST ──
  //
  // Somebody with no CSGN account: a friend of the network, a project founder,
  // a one-off. They cannot be looked up, they have granted us nothing, and the
  // operator is vouching for them personally — so the slot is marked
  // `operator_guest` and the schedule and the board both SAY it was an admin
  // choice rather than a member going live. A guest that looks identical to a
  // member on the public schedule would make the roster meaningless.
  if (action === 'put_guest_on_air') {
    const guestUrl = String(body.guestUrl || '').trim()
    if (!/^https:\/\//.test(guestUrl)) throw badRequest('A guest needs a full https stream URL.', 'invalid_guest_url')
    const login = twitchLoginFromUrl(guestUrl)
    const guestName = String(body.guestName || login || 'Guest').slice(0, 40)

    await commitWrites([updateWrite(`slots/${slot.id}`, {
      status: 'live',
      isClaimable: false,
      sourceType: 'operator_guest',
      // No uid: a guest is not a member and must never be credited with
      // on-air minutes, which is what the fee split is computed from.
      assignedUid: null,
      assignedUsername: guestName,
      assignedName: guestName,
      isGuest: true,
      guestAddedBy: admin.uid,
      twitchUsername: login || '',
      twitchChannelUrl: guestUrl,
      streamUrl: guestUrl,
      updatedAt: new Date(),
    }, true)])

    const currentBroadcast = await resolveBroadcast()
    await announceMode({
      startTime: slot.startTime, status: 'live', type: slot.type,
      assignedName: guestName, isGuest: true, sourceType: 'operator_guest',
    })
    await auditLog('adminPutGuestOnAir', admin.uid, { slotId: slot.id, guestUrl, guestName })
    return json(200, { ok: true, slotId: slot.id, guest: true, guestName, currentBroadcast })
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
    // Cleared explicitly: putting a member on a slot a guest just held must not
    // leave the guest marking behind on the schedule.
    isGuest: null,
    guestAddedBy: null,
    updatedAt: new Date(),
  }, true)])

  const currentBroadcast = await resolveBroadcast()
  await announceMode({
    startTime: slot.startTime, status: 'live', type: slot.type,
    assignedUid: uid, assignedName: user.username || login, sourceType: 'operator_live',
  })
  await auditLog('adminPutOnAir', admin.uid, { slotId: slot.id, uid, twitchUsername: login })
  return json(200, { ok: true, slotId: slot.id, uid, twitchUsername: login, currentBroadcast })
})

/** The block covering right now, if there is one. */
async function currentSlot(): Promise<{ id: string; assignedUid?: string; assignedName?: string; sourceType?: string; startTime?: string; type?: string } | null> {
  const now = new Date().toISOString()
  const rows = await queryCollection(
    'slots',
    [fieldFilter('startTime', 'LESS_THAN_OR_EQUAL', now)],
    [order('startTime', 'DESCENDING')],
    5,
  )
  for (const row of rows) {
    const d = row.data as { startTime?: string; endTime?: string; assignedUid?: string; assignedName?: string; sourceType?: string; type?: string }
    if (typeof d.endTime === 'string' && d.endTime > now) {
      return {
        id: row.path.split('/').pop()!,
        assignedUid: d.assignedUid,
        assignedName: d.assignedName,
        sourceType: d.sourceType,
        startTime: d.startTime,
        type: d.type,
      }
    }
  }
  return null
}

/** Minutes since a slot started, for the long-shift nudge. */
function minutesSince(startTime?: string): number {
  const start = Date.parse(startTime ?? '')
  if (!Number.isFinite(start)) return 0
  return Math.max(0, Math.floor((Date.now() - start) / 60_000))
}

/**
 * Republish the public "what's on and why" sign right after an operator action.
 *
 * The poller does this every minute anyway, so this is purely about LATENCY:
 * without it, somebody put on air at 8:00:05 has the site telling visitors the
 * clip reel is running for the rest of the minute. On a channel where the whole
 * promise is "we cut to you while you're live", a sign that is a minute behind
 * the picture is the difference between a network and a webpage about one.
 *
 * The slot shape is built from what we just WROTE rather than re-read, because
 * a read here would race the write we just committed. Best-effort: an operator
 * action that succeeded must not report failure because the sign lagged.
 */
async function announceMode(slot: ModeSlot): Promise<void> {
  try {
    const [meta, roster] = await Promise.all([
      getDoc<{ networkBlockEnabled?: boolean }>('config/scheduleMeta'),
      getDoc<RosterDoc>('public/liveRoster'),
    ])
    await publishChannelMode({
      slot,
      networkBlockEnabled: meta?.networkBlockEnabled !== false,
      liveCount: (roster?.entries ?? []).filter((e) => e?.live).length,
    })
  } catch (err) {
    console.warn('[adminLiveNow] channel mode publish failed', err)
  }
}
