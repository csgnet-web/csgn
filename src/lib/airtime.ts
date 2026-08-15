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
 * `42/48 min live` — the live meter's caption.
 *
 * Both halves are shown on purpose. A bare "42 min live" invites the question
 * "out of how many?", and the answer is the point: the denominator is how often
 * we checked, not how long the hour was, so a checking gap costs nothing.
 */
export function airtimeLabel(airtime: SlotAirtime | null): string | null {
  if (!airtime || airtime.checkCount <= 0) return null
  return `${airtime.liveCheckCount}/${airtime.checkCount} min live`
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
