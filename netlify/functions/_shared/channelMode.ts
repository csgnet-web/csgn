/**
 * WHAT'S ON, AND WHY — the public explanation of the channel's mode.
 *
 * ── The three factories ────────────────────────────────────────────────────
 *
 * CSGN takes content from exactly three places, and every one of them is a
 * different deal:
 *
 *   CLIP FACTORY    Connect TikTok. Your clips air passively, and the share of
 *                   the day you get is your share of the token — one to one,
 *                   tokens held over the 1,000,000,000 supply. Nothing to book,
 *                   nothing to attend. Clips are the SOURCE OF LAST RESORT:
 *                   they carry the channel whenever nothing better is on, which
 *                   is most of it, and that is the job — not a consolation.
 *
 *   STREAM FACTORY  Connect Twitch and grant forwarding. That puts you on the
 *                   Master Control roster. The Master of Programming decides
 *                   who goes on and when. Being on the roster is not a booking.
 *
 *   MYSELF FACTORY  The MP's own OBS. Pre-empts everything, by definition —
 *                   there is no appeal above the person running the channel.
 *
 * ── The three modes ────────────────────────────────────────────────────────
 *
 *   CLIP MODE    the member reel, ordered by holdings
 *   STREAM MODE  a roster streamer the MP has put on
 *   MASTER MODE  the MP, live from their own encoder
 *
 * ── Why this is published rather than inferred ─────────────────────────────
 *
 * A viewer who tunes in at 3 PM sees a clip reel and at 4 PM sees somebody
 * live, and nothing on screen ever told them why. Two visits, two different
 * products, no stated rule: the honest conclusion a stranger draws is that the
 * channel is broken. Networks switch formats constantly and get away with it
 * BECAUSE the audience knows the rule. So the rule is published here, in the
 * plainest sentence that is true.
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
  /** The MP is live from their own encoder. Pre-empts everything. */
  | 'master'
  /** A roster streamer the MP has put on (or an operator-vouched guest). */
  | 'stream'
  /** Nobody is live; the member clip reel is carrying the channel. */
  | 'clip'

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
const OPERATOR_SOURCE = 'operator_live'
/** The MP going on air themselves. Written by adminLiveNow's `go_master`. */
const MASTER_SOURCE = 'master'

/**
 * Is this hour inside the MP's reserved block (7 PM–3 AM ET)?
 *
 * This is the switch that decides whether the clip reel is dividing a
 * SIXTEEN-hour day or a TWENTY-FOUR-hour one. With the block on, those eight
 * hours are the MP's and clips share the other sixteen; with it off, clips
 * have the whole day. Nothing else changes and no slot doc is rewritten —
 * that is the entire 16/24 lever.
 */
function isMasterBlockHour(slot: ModeSlot | null, networkBlockEnabled: boolean): boolean {
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
 * ── The order of precedence, which IS the product ──────────────────────────
 *
 *   1. The MP is on their own encoder      → MASTER MODE
 *   2. The MP has put a roster streamer on → STREAM MODE
 *   3. The hour is inside the MP's block   → MASTER MODE (scheduled)
 *   4. Anything else                       → CLIP MODE
 *
 * Two and three are in that order deliberately. The 7 PM–3 AM block is the
 * MP's by default, not by lock: if they choose to put a streamer on inside it,
 * the channel is showing that streamer and must say so. Checking the block
 * first made the sign read "Master Mode" over somebody else's face.
 *
 * Note what is deliberately NOT a reason: "the operator pressed a button".
 * True, and useless. What a viewer needs is the RULE — clips carry the channel
 * unless something beats them, and the MP decides what beats them. The rule is
 * what makes the next switch predictable instead of arbitrary.
 */
export function describeChannelMode(input: ModeInput): ModeVerdict {
  const { slot, networkBlockEnabled } = input
  const liveCount = Math.max(0, Number(input.liveCount) || 0)
  const since = slot?.startTime ? String(slot.startTime) : null
  const source = String(slot?.sourceType || '')
  const occupied = slot != null && hasOccupant(slot)

  // 1. THE MP, LIVE FROM THEIR OWN ENCODER. Pre-empts everything by
  //    definition — there is no appeal above the person running the channel.
  if (occupied && source === MASTER_SOURCE) {
    return {
      mode: 'master',
      label: 'Master Mode',
      who: slot ? occupantName(slot) : 'CSGN',
      isGuest: false,
      because: 'The Master of Programming is live on the network right now, straight from the CSGN control room.',
      nextSwitch: 'When they end the broadcast the channel hands back — to a roster streamer if one is worth carrying, otherwise to the member clip reel.',
      since,
    }
  }

  // 2. A ROSTER STREAMER THE MP PUT ON. Outranks the block: it is a default,
  //    not a lock, and a streamer cut into a 9 PM hour is what is on screen.
  if (occupied && (source === OPERATOR_SOURCE || source === GUEST_SOURCE || !isMasterBlockHour(slot, networkBlockEnabled))) {
    const guest = slot!.isGuest === true || source === GUEST_SOURCE
    const name = occupantName(slot!)
    return {
      mode: 'stream',
      label: 'Stream Mode',
      who: name,
      isGuest: guest,
      because: guest
        ? `${name} is a guest of the network — invited on by the Master of Programming for this hour rather than picked up from the roster.`
        : `${name} connected their Twitch to CSGN and gave us permission to carry it. They went live, and the Master of Programming put them on.`,
      nextSwitch: 'When they end the stream — or the MP switches away — the channel returns to the member clip reel.',
      since,
    }
  }

  // 3. THE MP'S SCHEDULED BLOCK, 7 PM–3 AM ET. Also the reason the clip reel is
  //    dividing sixteen hours rather than twenty-four.
  if (isMasterBlockHour(slot, networkBlockEnabled)) {
    const name = slot && slot.assignedName ? String(slot.assignedName) : 'CSGN Originals'
    return {
      mode: 'master',
      label: 'Master Mode',
      who: name,
      isGuest: false,
      because: 'This hour is inside the network block, 7 PM–3 AM ET — programming the Master of Programming runs directly.',
      nextSwitch: 'At 3 AM ET the block ends and the rest of the day belongs to the members: the clip reel, and any streamer the MP cuts to.',
      since,
    }
  }

  // 4. CLIP MODE. The baseline, and the thing to say confidently: it is not a
  //    fallback for a failure, it is what the token buys and what runs most of
  //    the day. Saying "nobody is live" apologetically taught viewers to read
  //    the normal state of the channel as an outage.
  return {
    mode: 'clip',
    label: 'Clip Mode',
    who: null,
    isGuest: false,
    because: liveCount > 0
      ? 'The member clip reel is on air. Streams are only cut to when they beat the reel — see the roster for who is live right now.'
      : 'The member clip reel is carrying the channel. Every clip on it belongs to a holder, and their share of the day is their share of $CSGN.',
    nextSwitch: liveCount > 0
      ? 'The channel cuts to a live member as soon as one of them clears the audience bar and the MP puts them on.'
      : 'The moment a connected member goes live — or the MP goes on themselves — the channel cuts to them.',
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
