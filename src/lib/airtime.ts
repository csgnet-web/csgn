/**
 * Reading a slot's verified airtime — display only.
 *
 * The rule itself lives in exactly one place, `netlify/functions/_shared/
 * feeCalc.ts`, and the server stores its verdict on the slot. Nothing here
 * decides anything: it turns the stored verdict into the words and numbers a
 * member or an admin reads. If you find yourself wanting a threshold in this
 * file, you are about to write the second implementation — put it on the slot
 * instead.
 */

export type AirtimeReason = 'full' | 'prorated' | 'no_show' | 'unverified'

/** `creatorFees.airtime`, exactly as the poller writes it. */
export interface SlotAirtime {
  liveCheckCount: number
  /** Samples taken, live or not — the denominator the fraction came from. */
  checkCount: number
  ratio: number
  fraction: number
  reason: AirtimeReason
}

/** Slots that ran before verified airtime shipped have no verdict at all, and
 *  a half-written one is worse than none — treat it as absent. */
export function readAirtime(airtime: unknown): SlotAirtime | null {
  const a = airtime as Partial<SlotAirtime> | null | undefined
  if (!a || typeof a.fraction !== 'number' || typeof a.checkCount !== 'number') return null
  return {
    liveCheckCount: Number(a.liveCheckCount) || 0,
    checkCount: Number(a.checkCount) || 0,
    ratio: Number(a.ratio) || 0,
    fraction: Number(a.fraction) || 0,
    reason: (a.reason ?? 'unverified') as AirtimeReason,
  }
}

/**
 * `42 of 48 checks live` — the live meter's caption.
 *
 * Both halves are shown on purpose. A bare "42 live" invites the question "out
 * of how many?", and the answer is the point: the denominator is how often we
 * checked, not how long the hour was, so a checking gap costs nothing.
 *
 * IT SAYS "CHECKS", NOT "MIN". It read `42/48 min live` for as long as it
 * existed, which was true only while the poller ran every minute — it runs
 * every two, and backs off to four or ten when the channel is quiet, so the
 * same stream reported anywhere between a half and a twelfth of its real
 * airtime. The ratio was always right and still decides the money; the unit
 * was the lie. For an actual duration, use `liveDuration`.
 */
export function airtimeLabel(airtime: SlotAirtime | null): string | null {
  if (!airtime || airtime.checkCount <= 0) return null
  return `${airtime.liveCheckCount} of ${airtime.checkCount} checks live`
}

/**
 * `1h 47m` — how long the channel was actually observed live, from the real
 * elapsed gaps between samples rather than a count of them.
 *
 * Null when the slot predates the measurement, which is honest: a slot with no
 * `liveSeconds` genuinely does not know its duration, and inferring one from
 * the sample count is the bug this replaced.
 */
export function liveDuration(activity: { liveSeconds?: number } | null | undefined): string | null {
  const seconds = Math.max(0, Math.floor(Number(activity?.liveSeconds) || 0))
  if (!activity || !Number.isFinite(Number(activity.liveSeconds)) || seconds <= 0) return null
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
}

/** One sentence explaining what the verdict did to the amount. */
export function airtimeNote(airtime: SlotAirtime | null): string | null {
  if (!airtime) return null
  switch (airtime.reason) {
    case 'full':
      return 'Verified live for this hour — paid in full.'
    case 'prorated':
      return `Pro-rated to ${Math.round(airtime.fraction * 100)}% — the share of checks that found you live.`
    case 'no_show':
      return 'The channel was offline for this hour, so no fee is owed.'
    case 'unverified':
      return 'Too few checks to verify this hour — paid in full and flagged for review.'
  }
}

/** Tailwind text colour for the caption. `unverified` reads neutral rather than
 *  alarming: it is our telemetry that fell short, and the streamer was paid. */
export function airtimeTone(airtime: SlotAirtime | null): string {
  switch (airtime?.reason) {
    case 'full': return 'text-emerald-400'
    case 'prorated': return 'text-amber-400'
    case 'no_show': return 'text-red-400'
    default: return 'text-gray-500'
  }
}
