/**
 * WHAT THE OPERATOR NEEDS TO KNOW, RIGHT NOW.
 *
 * ── The problem ────────────────────────────────────────────────────────────
 *
 * The network can now put any consenting member on air in one click, which
 * turns running the channel into a job of *noticing*: somebody dropped off and
 * we are broadcasting a dead channel; three people are live and we are playing
 * clips; the person on air has been on for four hours. None of that is visible
 * unless you are staring at the board, and a channel that only works while
 * somebody stares at a board does not run 24 hours.
 *
 * So the decisions are computed here, as a pure function of the roster and the
 * current slot, and published for the operator UI to raise. Pure and separate
 * because these are the rules that decide what goes on television, and rules
 * that decide what goes on television should be pinned by tests rather than
 * discovered live.
 *
 * ── The one real design question ───────────────────────────────────────────
 *
 * "Switch to streamer mode when someone is live" is the obvious rule and it is
 * not sufficient, because it makes the channel worse the moment the network has
 * more than a handful of streamers: at any given time SOMEBODY is live, so the
 * channel would never play clips again, and the clip reel is the thing holders
 * are paying for with their bag.
 *
 * The differentiator is AUDIENCE, not availability. A live stream earns the
 * channel when it brings more than the reel does — measured by viewers, because
 * that is the only number available that correlates with "is this worth
 * watching". Below the floor, a live stream with four viewers is worse
 * television than a curated reel, and putting it on costs the network the
 * holders' airtime for nothing.
 *
 * That gives a rule that keeps working as the network grows: clips are the
 * BASELINE, and a streamer earns an interruption. See docs/analysis-clip-vs-
 * streamer-mode.md for the full argument and the numbers behind the thresholds.
 */

export type AlertKind =
  /** Somebody we are broadcasting has gone offline. The channel is dead air. */
  | 'on_air_dropped'
  /** Nobody is on air and at least one qualifying streamer is live. */
  | 'pick_a_streamer'
  /** We are carrying a stream that no longer clears the bar; the reel is better. */
  | 'switch_to_clips'
  /** The person on air has been on a very long time. */
  | 'long_shift'
  /** A better option than the one currently on air is live. */
  | 'stronger_option'

export type AlertSeverity = 'critical' | 'action' | 'info'

export interface OperatorAlert {
  kind: AlertKind
  severity: AlertSeverity
  /** One sentence, written for somebody glancing at a phone. */
  message: string
  /** Who it is about, when it is about somebody. */
  uid?: string
  username?: string
}

/**
 * Viewer floor a live stream must clear to be worth interrupting the reel.
 *
 * Deliberately low for now — the network is small and almost any live human
 * beats a clip rotation early on. It is a `config/scheduleMeta.liveViewerFloor`
 * override precisely because the right number changes as the audience grows,
 * and it is the single knob that tunes how much of the day is live.
 */
export const DEFAULT_LIVE_VIEWER_FLOOR = 3

/** A shift longer than this is worth a nudge — nobody is good on hour five, and
 *  a channel that never changes hands stops looking like a network. */
export const LONG_SHIFT_MINUTES = 240

/** How much better a challenger must be before we suggest a switch. Well above
 *  1 so the channel is not thrashing between two streamers with similar
 *  audiences, which reads as instability to everybody watching. */
export const STRONGER_OPTION_MULTIPLE = 3

export interface AlertInput {
  /** Everyone consenting, as the roster last sampled them. */
  roster: Array<{ uid: string; username: string; displayName: string; live: boolean; viewerCount: number }>
  /** Who the channel is currently carrying, or null in clip mode. */
  onAirUid: string | null
  /** How long the current occupant has been on air, in minutes. */
  onAirMinutes: number
  /** Overridable floor — see DEFAULT_LIVE_VIEWER_FLOOR. */
  viewerFloor?: number
}

/**
 * Decide what the operator should be told, most urgent first.
 *
 * Returns an empty list when the channel is doing the right thing, which is the
 * common case and must stay silent — an alert surface that always has something
 * on it is one nobody reads.
 */
export function operatorAlerts(input: AlertInput): OperatorAlert[] {
  const floor = Math.max(0, Number(input.viewerFloor ?? DEFAULT_LIVE_VIEWER_FLOOR) || 0)
  const roster = Array.isArray(input.roster) ? input.roster : []
  const onAir = input.onAirUid ? roster.find((r) => r.uid === input.onAirUid) ?? null : null

  // Candidates are live AND clear the floor. Someone live with two viewers is
  // not a candidate — that is the whole point of the floor.
  const candidates = roster
    .filter((r) => r.live && r.viewerCount >= floor && r.uid !== input.onAirUid)
    .sort((a, b) => b.viewerCount - a.viewerCount)

  const alerts: OperatorAlert[] = []

  // ── CRITICAL: we are broadcasting somebody who is not there ──
  //
  // Only when the roster actually SAW them offline. A member missing from the
  // roster was not sampled — Helix did not answer — and calling that a drop-off
  // would page the operator every time an API request timed out.
  if (input.onAirUid && onAir && !onAir.live) {
    alerts.push({
      kind: 'on_air_dropped',
      severity: 'critical',
      uid: onAir.uid,
      username: onAir.displayName || onAir.username,
      message: candidates.length > 0
        ? `${onAir.displayName || onAir.username} went offline. ${candidates[0].displayName || candidates[0].username} is live with ${candidates[0].viewerCount} watching.`
        : `${onAir.displayName || onAir.username} went offline and nobody else is live. Switch to clips.`,
    })
  }

  // ── ACTION: clip mode while somebody worth carrying is live ──
  if (!input.onAirUid && candidates.length > 0) {
    const best = candidates[0]
    alerts.push({
      kind: 'pick_a_streamer',
      severity: 'action',
      uid: best.uid,
      username: best.displayName || best.username,
      message: candidates.length === 1
        ? `${best.displayName || best.username} is live with ${best.viewerCount} watching. The channel is on clips.`
        : `${candidates.length} streamers are live — ${best.displayName || best.username} leads with ${best.viewerCount} watching. The channel is on clips.`,
    })
  }

  // ── ACTION: carrying somebody who no longer clears the bar ──
  //
  // Distinct from a drop-off: they are still live, their audience has just gone.
  // The reel is better television than an empty room.
  if (onAir && onAir.live && onAir.viewerCount < floor) {
    alerts.push({
      kind: 'switch_to_clips',
      severity: 'action',
      uid: onAir.uid,
      username: onAir.displayName || onAir.username,
      message: `${onAir.displayName || onAir.username} is down to ${onAir.viewerCount} watching. The clip reel is the stronger option.`,
    })
  }

  // ── INFO: somebody much bigger is live ──
  if (onAir && onAir.live && candidates.length > 0) {
    const best = candidates[0]
    if (best.viewerCount >= Math.max(floor, onAir.viewerCount * STRONGER_OPTION_MULTIPLE)) {
      alerts.push({
        kind: 'stronger_option',
        severity: 'info',
        uid: best.uid,
        username: best.displayName || best.username,
        message: `${best.displayName || best.username} is live with ${best.viewerCount} watching, against ${onAir.viewerCount} on air now.`,
      })
    }
  }

  // ── INFO: a very long shift ──
  if (onAir && onAir.live && input.onAirMinutes >= LONG_SHIFT_MINUTES) {
    alerts.push({
      kind: 'long_shift',
      severity: 'info',
      uid: onAir.uid,
      username: onAir.displayName || onAir.username,
      message: `${onAir.displayName || onAir.username} has been on for ${Math.floor(input.onAirMinutes / 60)} hours.`,
    })
  }

  const order: Record<AlertSeverity, number> = { critical: 0, action: 1, info: 2 }
  return alerts.sort((a, b) => order[a.severity] - order[b.severity])
}

/**
 * What the channel SHOULD be running right now.
 *
 * The same rule the alerts are built from, stated once as an answer rather than
 * as a list of complaints — so the UI can show the recommendation next to the
 * button that acts on it.
 */
export function recommendedMode(input: AlertInput): { mode: 'streamer' | 'clips'; uid: string | null; why: string } {
  const floor = Math.max(0, Number(input.viewerFloor ?? DEFAULT_LIVE_VIEWER_FLOOR) || 0)
  const roster = Array.isArray(input.roster) ? input.roster : []
  const qualifying = roster
    .filter((r) => r.live && r.viewerCount >= floor)
    .sort((a, b) => b.viewerCount - a.viewerCount)

  if (qualifying.length === 0) {
    return {
      mode: 'clips',
      uid: null,
      why: roster.some((r) => r.live)
        ? `Nobody live is clearing ${floor} viewers, so the reel is the stronger option.`
        : 'Nobody is live. The reel carries the channel.',
    }
  }

  const best = qualifying[0]
  // Already carrying the best option — no change recommended.
  if (input.onAirUid === best.uid) {
    return { mode: 'streamer', uid: best.uid, why: 'The strongest live option is already on air.' }
  }
  return {
    mode: 'streamer',
    uid: best.uid,
    why: `${best.displayName || best.username} is the strongest live option at ${best.viewerCount} watching.`,
  }
}
