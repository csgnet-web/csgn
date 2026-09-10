/**
 * HOW LONG HAS THE PERSON ON AIR BEEN ON AIR?
 *
 * ── The bug this exists to end ─────────────────────────────────────────────
 *
 * Two places asked that question and both answered a different one. They
 * measured from `slot.startTime` — the start of the BLOCK — so a two-hour block
 * beginning at 8 PM with a streamer put on at 8:47 reported **"on air 47m" the
 * instant they went on**.
 *
 * That is not a cosmetic number. It feeds `operatorAlerts`, which uses it to
 * decide when somebody has been carried long enough to think about switching —
 * so the alert fired the moment they started, every time, and an alert that
 * fires immediately is an alert that gets ignored. It was also the only figure
 * on the board telling the MP how long the current cut had been running, on the
 * screen where that is the whole question.
 *
 * ── The fix, and why it is a stamp rather than a calculation ───────────────
 *
 * The moment somebody is put on air is a FACT, known exactly, at the moment it
 * happens, by the code that does it. Nothing later can derive it: a slot's start
 * is the schedule's, and the activity log's first live sample is whenever the
 * poller next happened to look. So `adminLiveNow` writes `onAirAt` when it puts
 * anybody on — a member, a guest, or the MP themselves — and clears it when it
 * takes them off.
 *
 * `startTime` remains the fallback, and only the fallback, for slots written
 * before this field existed. It is wrong in the same way it was always wrong,
 * but it is wrong for a shrinking set of old documents rather than for every
 * hour the channel airs.
 */

export interface OnAirSlot {
  /** Stamped by adminLiveNow the moment an occupant is put on. */
  onAirAt?: string | null
  /** The block's scheduled start. The fallback, never the answer when
   *  `onAirAt` is present. */
  startTime?: string | null
  /** No occupant means no clock, whatever the timestamps say. */
  assignedUid?: string | null
  isGuest?: boolean | null
  status?: string | null
}

const parse = (value: string | null | undefined): number => {
  const t = Date.parse(String(value ?? ''))
  return Number.isFinite(t) && t > 0 ? t : NaN
}

/** Is somebody actually being carried on this hour? Matches `hasOccupant` in
 *  channelMode.ts — assignment decides, not status, because status drifts and an
 *  assignment is a decision somebody made. */
function occupied(slot: OnAirSlot | null | undefined): boolean {
  if (!slot) return false
  if (String(slot.status ?? '') === 'completed') return false
  return Boolean(slot.assignedUid) || slot.isGuest === true
}

/**
 * When the current occupant went on air, in epoch ms — or null when nobody is
 * on, or when neither timestamp can be read.
 *
 * A stamp in the FUTURE is rejected rather than clamped: a clock skew that
 * would otherwise produce a negative duration is a broken observation, and
 * "unknown" is a more honest answer than "zero minutes" on a stream that has
 * been running for an hour.
 */
export function onAirSinceMs(slot: OnAirSlot | null | undefined, nowMs = Date.now()): number | null {
  if (!occupied(slot)) return null
  const stamped = parse(slot?.onAirAt)
  if (Number.isFinite(stamped) && stamped <= nowMs) return stamped
  const scheduled = parse(slot?.startTime)
  if (Number.isFinite(scheduled) && scheduled <= nowMs) return scheduled
  return null
}

/**
 * Whole minutes the current occupant has been on air. Zero when nobody is on,
 * which is what every caller wants for that case — the alerts read it as "no
 * cut is running", and the board renders nothing.
 */
export function onAirMinutes(slot: OnAirSlot | null | undefined, nowMs = Date.now()): number {
  const since = onAirSinceMs(slot, nowMs)
  if (since === null) return 0
  return Math.max(0, Math.floor((nowMs - since) / 60_000))
}

/** Seconds, for the surfaces that tick live rather than once a minute. */
export function onAirSeconds(slot: OnAirSlot | null | undefined, nowMs = Date.now()): number {
  const since = onAirSinceMs(slot, nowMs)
  if (since === null) return 0
  return Math.max(0, Math.floor((nowMs - since) / 1000))
}

/**
 * "1h 04m", "47m", "0m" — a duration a person reads at a glance from across a
 * room, which is the actual viewing condition for the master-control board.
 */
export function formatOnAir(minutes: number): string {
  const m = Math.max(0, Math.floor(minutes))
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
}
