/**
 * THE LIVE ROSTER — who from the network is on air right now, and for how long.
 *
 * ── The problem this solves ────────────────────────────────────────────────
 *
 * The original model asked a streamer to think like a broadcaster: work out
 * which two-hour block they wanted, come back to the site, claim it, then
 * remember to actually be live when it started. Every one of those steps is a
 * place a working streamer drops out, and none of them are things they do for
 * any other platform they stream to. The result is a schedule full of empty
 * claimed blocks and a network with nothing to show.
 *
 * So the claim is no longer the path to air. A streamer connects Twitch ONCE,
 * grants CSGN permission to forward their stream, and then goes about their
 * normal week. We watch. When they go live, they appear on the operator's board
 * and can be put on the channel in one click.
 *
 * ── What this module does ──────────────────────────────────────────────────
 *
 *  1. READS every member who linked Twitch AND granted forwarding consent.
 *     Consent is checked here, every single pass, not merely at link time — a
 *     member who withdraws it stops being sampled on the next run.
 *  2. SAMPLES them in batches of 100 against Helix (one request per batch).
 *  3. RECORDS a minute against anyone who is live, in `liveMinutes/{uid}`.
 *  4. PUBLISHES the roster to `public/liveRoster` for the admin board.
 *
 * ── Why the minutes matter ─────────────────────────────────────────────────
 *
 * They are the payout denominator. Fees are split by time actually delivered to
 * the channel, and the only defensible measure of that is samples we took
 * ourselves, one a minute, recorded as they happened. Note what is NOT counted:
 * a member live on their own channel while CSGN is airing someone else is on
 * the roster but earns nothing, because they were not on OUR channel. Only
 * `onAirMinutes` — minutes where they were both live and selected — pays.
 * Conflating the two would pay everybody for streaming to their own audience.
 *
 * A SAMPLE WE COULD NOT TAKE IS NOT A ZERO. Helix failing is our problem, and
 * `sampleTwitchStreams` leaves unanswered logins out of its map precisely so a
 * timeout cannot quietly cost a streamer their minutes.
 */
import { queryCollection, getDoc, writeDoc, fieldFilter, commitWrites, updateWrite } from './firebaseAdmin'
import { sampleTwitchStreams, twitchAppToken } from './twitch'

/** How many linked channels one pass will watch. A cost ceiling, not a rule —
 *  at 100 logins per Helix request this is five requests. */
const ROSTER_MAX_MEMBERS = 500

/** A roster entry goes stale this long after its last live sample, so a member
 *  who closed OBS stops showing as live even if a pass is missed. */
export const ROSTER_STALE_MS = 4 * 60 * 1000

export interface RosterEntry {
  uid: string
  username: string
  twitchUsername: string
  displayName: string
  profileImageUrl: string
  live: boolean
  viewerCount: number
  title: string
  gameName: string
  startedAt: string
  /** Minutes we have sampled them live on their own channel, all time. */
  liveMinutes: number
  /** Minutes they were live AND selected onto the CSGN channel. This is the
   *  one that pays. */
  onAirMinutes: number
  sampledAt: string
}

interface UserRow {
  username?: string
  status?: string
  twitch?: {
    verified?: boolean
    username?: string
    displayName?: string
    profileImageUrl?: string
    /** The grant. Without it we do not sample the channel at all. */
    forwardConsent?: boolean
  }
}

/**
 * Take one pass over every consenting member.
 *
 * Called once a minute by the poller. Returns the roster it published so a
 * caller can act on it without a second read.
 */
export async function refreshLiveRoster(currentOnAirUid?: string | null): Promise<RosterEntry[]> {
  const token = await twitchAppToken()
  // No Twitch credentials configured. Leave the published roster ALONE rather
  // than overwriting it with an empty one — a missing env var should not read
  // on the admin board as "nobody in the network is streaming".
  if (!token) return []

  const rows = await queryCollection(
    'users',
    [fieldFilter('twitch.forwardConsent', 'EQUAL', true)],
    [],
    ROSTER_MAX_MEMBERS,
  )

  const members = rows.flatMap((row) => {
    const u = row.data as UserRow
    const login = String(u.twitch?.username || '').trim().toLowerCase()
    // Consent is necessary but not sufficient — the link itself must still be
    // verified, and a suspended account is off the air regardless of consent.
    if (!login || u.twitch?.verified !== true) return []
    if (u.status && u.status !== 'active') return []
    return [{
      uid: row.path.split('/').pop()!,
      username: String(u.username || ''),
      login,
      displayName: String(u.twitch?.displayName || u.username || login),
      profileImageUrl: String(u.twitch?.profileImageUrl || ''),
    }]
  })
  if (members.length === 0) {
    await writeDoc('public/liveRoster', { entries: [], updatedAt: new Date().toISOString() })
    return []
  }

  const samples = await sampleTwitchStreams(members.map((m) => m.login), token)
  const nowISO = new Date().toISOString()

  // Read the running minute counters for everyone we are about to sample.
  const counters = new Map<string, { liveMinutes: number; onAirMinutes: number }>()
  await Promise.all(members.map(async (m) => {
    const doc = await getDoc<{ liveMinutes?: number; onAirMinutes?: number }>(`liveMinutes/${m.uid}`)
    counters.set(m.uid, {
      liveMinutes: Math.max(0, Number(doc?.liveMinutes) || 0),
      onAirMinutes: Math.max(0, Number(doc?.onAirMinutes) || 0),
    })
  }))

  const entries: RosterEntry[] = []
  const writes = []

  for (const m of members) {
    const sample = samples.get(m.login)
    // Not in the map = Helix never answered for this login. Skip it entirely:
    // no entry, no counter change. Recording it as offline would be inventing
    // an observation, and these observations decide money.
    if (!sample) continue

    const running = counters.get(m.uid)!
    const onAirNow = sample.live && currentOnAirUid === m.uid
    const liveMinutes = running.liveMinutes + (sample.live ? 1 : 0)
    const onAirMinutes = running.onAirMinutes + (onAirNow ? 1 : 0)

    if (sample.live) {
      writes.push(updateWrite(`liveMinutes/${m.uid}`, {
        uid: m.uid,
        username: m.username,
        twitchUsername: m.login,
        liveMinutes,
        onAirMinutes,
        lastLiveAt: nowISO,
        ...(onAirNow ? { lastOnAirAt: nowISO } : {}),
      }, true))
    }

    entries.push({
      uid: m.uid,
      username: m.username,
      twitchUsername: m.login,
      displayName: m.displayName,
      profileImageUrl: m.profileImageUrl,
      live: sample.live,
      viewerCount: sample.viewerCount,
      title: sample.title,
      gameName: sample.gameName,
      startedAt: sample.startedAt,
      liveMinutes,
      onAirMinutes,
      sampledAt: nowISO,
    })
  }

  if (writes.length > 0) await commitWrites(writes)

  // Live first, then by viewers — the operator's board is a decision surface,
  // and the decision is almost always "who has an audience right now".
  const live = entries.filter((e) => e.live).sort((a, b) => b.viewerCount - a.viewerCount)
  const offline = entries.filter((e) => !e.live).sort((a, b) => a.displayName.localeCompare(b.displayName))

  await writeDoc('public/liveRoster', {
    entries: [...live, ...offline],
    liveCount: live.length,
    memberCount: entries.length,
    updatedAt: nowISO,
  })

  return [...live, ...offline]
}
