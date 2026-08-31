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
 *  who closed OBS stops showing as live even if a pass is missed.
 *
 *  MUST COMFORTABLY EXCEED THE POLLER'S IDLE CADENCE. The poller no longer
 *  refreshes this every minute — when nobody is live it rebuilds the roster
 *  every ~10 minutes, because a pass that samples Twitch for a network where
 *  nothing is happening is the single thing that was burning the Netlify
 *  allowance. A window shorter than that cadence would mark a perfectly good
 *  roster stale between passes and report "nobody is live" as fact.
 *
 *  It is safe to be generous here precisely because it is not the only guard:
 *  `adminLiveNow` rebuilds on demand whenever an operator opens the board, so
 *  the decision surface is never reading a stale roster no matter what this is
 *  set to. This value only governs the passive, published copy. */
export const ROSTER_STALE_MS = 14 * 60 * 1000

/**
 * The most minutes a single observation may credit.
 *
 * MUST BE >= THE CRON PERIOD in netlify.toml. Each sample credits the time
 * since the previous one, so this is the cap that stops a gap — a missed tick,
 * an idle stretch, a redeploy — from paying for time nobody was watched.
 */
export const MAX_SAMPLE_CREDIT_MIN = 3

/**
 * How many minutes one positive observation is worth.
 *
 * THIS IS A PAYOUT DENOMINATOR. Read it before touching the cron.
 *
 * It used to be a literal `+ 1`, which quietly encoded "the poller runs once a
 * minute" into every member's minute counter. Nothing said so, and nothing
 * checked it. The moment the cron period changed, every streamer on the network
 * would have been under-credited by exactly that factor — not with an error,
 * but with plausible-looking numbers that were simply too small, and no way to
 * tell from the data that it had happened. Crediting the measured gap instead
 * makes the counter mean the same thing at any cadence, which is what makes the
 * cron period a cost decision rather than a payout decision.
 *
 * `lastAt` is the last time we saw this member in this same state, so the gap
 * is genuinely time they were live while we were watching. A member coming back
 * after a break carries an old `lastAt` and is clamped to MAX_SAMPLE_CREDIT_MIN
 * — a bounded over-credit that fails toward the streamer, which is the posture
 * the rest of this module already takes (see "A SAMPLE WE COULD NOT TAKE IS NOT
 * A ZERO" above).
 */
export function creditMinutes(lastAt: string | undefined, nowMs: number): number {
  const last = Date.parse(String(lastAt ?? ''))
  // No previous observation, or one we cannot read as a past instant: this is
  // the first sample of a live run and is worth a single minute.
  if (!Number.isFinite(last) || last <= 0 || last > nowMs) return 1
  const gap = Math.round((nowMs - last) / 60_000)
  // Two samples inside the same minute — a retry, an operator waking the
  // poller — must not both pay. The minute has already been credited.
  if (gap <= 0) return 0
  return Math.min(gap, MAX_SAMPLE_CREDIT_MIN)
}

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

  // Sample Twitch and read the previously published roster at the same time.
  // The published copy is what lets the counter reads below stay proportional
  // to who is actually live rather than to how big the network is.
  const [samples, published] = await Promise.all([
    sampleTwitchStreams(members.map((m) => m.login), token),
    getDoc<{ entries?: RosterEntry[] }>('public/liveRoster'),
  ])
  const nowISO = new Date().toISOString()
  const nowMs = Date.parse(nowISO)

  // ── Why the counters are not all read here ──
  //
  // This used to issue one Firestore GET per consenting member, every pass,
  // to read counters it was about to leave untouched for everyone offline. On
  // a network of two hundred with three people live, that was two hundred
  // round trips to increment three numbers — and Netlify bills the wall clock
  // those round trips take, so the cost of a pass grew with the size of the
  // roster while the work it did stayed the same. That is the shape of a bill
  // that surprises you six months from now.
  //
  // An offline member's counters cannot have changed since we last published
  // them: this module is the only writer of `liveMinutes/{uid}`. So the
  // published roster is carried forward for them, and only members Twitch says
  // are live get an authoritative read. One round trip plus one per live
  // member, instead of one per member.
  const carried = new Map<string, { liveMinutes: number; onAirMinutes: number }>()
  for (const e of published?.entries ?? []) {
    if (!e?.uid) continue
    carried.set(String(e.uid), {
      liveMinutes: Math.max(0, Number(e.liveMinutes) || 0),
      onAirMinutes: Math.max(0, Number(e.onAirMinutes) || 0),
    })
  }

  const liveMembers = members.filter((m) => samples.get(m.login)?.live)
  const counters = new Map<string, { liveMinutes: number; onAirMinutes: number; lastLiveAt?: string; lastOnAirAt?: string }>()
  await Promise.all(liveMembers.map(async (m) => {
    const doc = await getDoc<{ liveMinutes?: number; onAirMinutes?: number; lastLiveAt?: string; lastOnAirAt?: string }>(`liveMinutes/${m.uid}`)
    counters.set(m.uid, {
      liveMinutes: Math.max(0, Number(doc?.liveMinutes) || 0),
      onAirMinutes: Math.max(0, Number(doc?.onAirMinutes) || 0),
      lastLiveAt: doc?.lastLiveAt,
      lastOnAirAt: doc?.lastOnAirAt,
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

    // A live member has an authoritative read; an offline one carries the
    // counters we last published, which cannot have moved since.
    const running: { liveMinutes: number; onAirMinutes: number; lastLiveAt?: string; lastOnAirAt?: string } =
      counters.get(m.uid) ?? carried.get(m.uid) ?? { liveMinutes: 0, onAirMinutes: 0 }
    const onAirNow = sample.live && currentOnAirUid === m.uid
    // Credit the measured gap, never a flat one. See creditMinutes: this is
    // what keeps the counters honest when the cron period changes.
    const liveMinutes = running.liveMinutes + (sample.live ? creditMinutes(running.lastLiveAt, nowMs) : 0)
    const onAirMinutes = running.onAirMinutes + (onAirNow ? creditMinutes(running.lastOnAirAt, nowMs) : 0)

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
