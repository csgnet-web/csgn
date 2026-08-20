/**
 * WHY THIS IS WHAT'S ON — the public explanation of the channel's mode.
 *
 * ── The problem ────────────────────────────────────────────────────────────
 *
 * CSGN has no fixed lineup. A viewer who tunes in at 3 PM sees a clip reel and
 * at 4 PM sees somebody live, and nothing on screen or on the site ever told
 * them why. Two visits, two different products, no stated rule: the honest
 * conclusion a stranger draws is that the channel is broken or abandoned.
 *
 * A network is allowed to switch formats — every network does — but only if the
 * switch is legible. "We're in the movie block" and "we cut to breaking news"
 * are both fine BECAUSE the audience knows the rule. So the rule is published
 * here rather than left to be inferred, in the plainest sentence that is true.
 *
 * ── Why the server decides and the client only displays ────────────────────
 *
 * Every surface that could compute this — /watch, /schedule, /player, the OBS
 * ticker, this repo's HTML graphics — would compute it from slightly different
 * inputs and drift. That is the exact bug class this codebase has been bitten
 * by repeatedly: an empty state rendered as a fact, differently on each page.
 * So the verdict is computed ONCE per poll tick, stored at `public/channelMode`
 * with the reason attached, and every surface renders the stored sentence.
 *
 * The functions here are pure so the rules that decide what a viewer is told
 * are pinned by tests rather than discovered live.
 */

/** What the channel is doing. Three modes, no others — if you find yourself
 *  wanting a fourth, it is probably a `because` line, not a mode. */
export type ChannelMode =
  /** A roster member (or an operator-vouched guest) is being carried live. */
  | 'live'
  /** The CSGN Originals block is programmed on this hour. */
  | 'network'
  /** Nobody is live; the member clip reel is carrying the channel. */
  | 'clips'

export interface ModeSlot {
  assignedUid?: string | null
  assignedName?: string | null
  assignedUsername?: string | null
  isGuest?: boolean | null
  sourceType?: string | null
  type?: string | null
  status?: string | null
  startTime?: string | null
  endTime?: string | null
}

export interface ModeInput {
  /** The block covering right now, or null when the schedule has a hole in it. */
  slot: ModeSlot | null
  /** Whether the 7 PM–3 AM owner block is switched on. */
  networkBlockEnabled: boolean
  /** How many roster members the sampler currently sees live. Drives the
   *  "what happens next" line — with nobody live, nothing is about to change. */
  liveCount?: number
}

export interface ModeVerdict {
  mode: ChannelMode
  /** Badge text. Two words, upper-cased by the surface if it wants to. */
  label: string
  /** Who is on, when somebody is. Null in clip mode, always. */
  who: string | null
  /** True when `who` is an operator-vouched guest rather than a member — the
   *  roster only means something if a guest is labelled as one. */
  isGuest: boolean
  /** ONE sentence for a viewer: why is THIS what is on right now. */
  because: string
  /** ONE sentence: what has to happen for the channel to switch. */
  nextSwitch: string
  /** When the current mode started (the slot's start), ISO, or null. */
  since: string | null
}

const GUEST_SOURCE = 'operator_guest'

/** Is this hour the reserved CSGN Originals block? */
function isNetworkHour(slot: ModeSlot | null, networkBlockEnabled: boolean): boolean {
  if (!slot || !networkBlockEnabled) return false
  const t = String(slot.type || '')
  return t === 'network' || t === 'ceo'
}

/** Is somebody actually being carried on this hour? Assignment decides, not
 *  status — the same rule `isOpenHour` uses, for the same reason: status drifts,
 *  an assignment is a decision somebody made. */
function hasOccupant(slot: ModeSlot | null): boolean {
  if (!slot) return false
  if (String(slot.status || '') === 'completed') return false
  return Boolean(slot.assignedUid) || slot.isGuest === true
}

function occupantName(slot: ModeSlot): string {
  return String(slot.assignedName || slot.assignedUsername || '').trim() || 'A member'
}

/**
 * The mode the channel is in, and the reason, in the words a viewer reads.
 *
 * Note what is deliberately NOT a reason: "the operator pressed a button".
 * True, and useless. What a viewer needs is the RULE — somebody from the roster
 * went live, so we cut to them; nobody is live, so the reel plays. The rule is
 * what makes the next switch predictable instead of arbitrary.
 */
export function describeChannelMode(input: ModeInput): ModeVerdict {
  const { slot, networkBlockEnabled } = input
  const liveCount = Math.max(0, Number(input.liveCount) || 0)
  const since = slot?.startTime ? String(slot.startTime) : null

  // An operator putting somebody on air OUTRANKS the block. The network block
  // is a default, not a lock: if the operator cuts a live streamer into a 9 PM
  // hour, the channel is showing that streamer and must say so. Checking the
  // block first made the sign read "CSGN Originals" over somebody else's face.
  const operatorPlaced = slot != null
    && hasOccupant(slot)
    && (String(slot.sourceType || '') === 'operator_live' || String(slot.sourceType || '') === GUEST_SOURCE)

  if (!operatorPlaced && isNetworkHour(slot, networkBlockEnabled)) {
    const name = slot && slot.assignedName ? String(slot.assignedName) : 'CSGN Originals'
    return {
      mode: 'network',
      label: 'CSGN Originals',
      who: name,
      isGuest: false,
      because: 'This hour is part of the CSGN Originals block, 7 PM–3 AM ET — programming the network runs itself.',
      nextSwitch: 'When the block ends the channel goes back to the member reel, and any member who is live can be cut to.',
      since,
    }
  }

  if (slot && hasOccupant(slot)) {
    const guest = slot.isGuest === true || String(slot.sourceType || '') === GUEST_SOURCE
    const name = occupantName(slot)
    return {
      mode: 'live',
      label: 'Live',
      who: name,
      isGuest: guest,
      because: guest
        ? `${name} is a guest of the network — invited on by the operator for this hour rather than picked up from the roster.`
        : `${name} is live on their own channel right now and gave CSGN permission to carry it, so the network cut to them.`,
      nextSwitch: 'When they end the stream — or the hour runs out — the channel returns to the member clip reel.',
      since,
    }
  }

  // CLIP MODE. The baseline, and the thing to say confidently: it is not a
  // fallback for a failure, it is what the token buys and what runs most of the
  // day. Saying "nobody is live" apologetically taught viewers to read the
  // normal state of the channel as an outage.
  return {
    mode: 'clips',
    label: 'Clip Mode',
    who: null,
    isGuest: false,
    because: liveCount > 0
      ? 'The member clip reel is on air. Streams are only cut to when they beat the reel — see the roster for who is live right now.'
      : 'Nobody from the roster is streaming right now, so the member clip reel is carrying the channel — which is what it is for.',
    nextSwitch: liveCount > 0
      ? 'The channel cuts to a live member as soon as one of them clears the audience bar.'
      : 'The moment a connected member goes live, the network can cut to them — usually within a minute or two.',
    since,
  }
}

/* ─── The public switch log ─── */

export interface ModeEvent {
  at: string
  mode: ChannelMode
  who: string | null
  /** The one-sentence reason, frozen at the moment of the switch. */
  because: string
}

/** How many switches the public log keeps. Enough for a visitor to see that the
 *  channel moves on a rule, short enough that the doc stays small and free. */
export const MODE_LOG_LIMIT = 24

/**
 * Append a switch to the log — but only when the mode ACTUALLY changed.
 *
 * The poller calls this every minute. Without the dedupe the log would be a
 * minute-by-minute transcript of nothing happening, which is the fastest way to
 * make a public record worthless (and to make a Firestore doc expensive). A
 * change of occupant inside `live` counts as a switch: cutting from one streamer
 * to another is exactly the thing a viewer noticed and wants explained.
 */
export function appendModeEvent(
  log: ModeEvent[],
  verdict: ModeVerdict,
  at: string,
  limit = MODE_LOG_LIMIT,
): ModeEvent[] {
  const last = log[0]
  if (last && last.mode === verdict.mode && (last.who ?? null) === (verdict.who ?? null)) return log
  const event: ModeEvent = { at, mode: verdict.mode, who: verdict.who, because: verdict.because }
  return [event, ...log].slice(0, Math.max(1, limit))
}
