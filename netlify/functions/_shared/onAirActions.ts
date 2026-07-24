// Live "viewer → on-air action" counter. Every time a holder does something that
// can reach the broadcast — casts a token-weighted vote, submits a Right Now
// item, or buys-and-burns a coin spotlight — we bump a world-readable tally at
// public/onAirActions. The OBS ticker polls it and the admin can flash it on air
// ("847 fan actions on the board tonight"). Best-effort: a counter hiccup must
// never fail the primary action, so callers await it inside their own try/catch
// or ignore the returned rejection.
import { incrementDoc } from './firebaseAdmin'

export type OnAirActionKind = 'vote' | 'submission' | 'spotlight' | 'buy'

const FIELD: Record<OnAirActionKind, string> = {
  vote: 'votes',
  submission: 'submissions',
  spotlight: 'spotlights',
  buy: 'buys',
}

/** Bump the on-air action counter by `by` (default 1) for one action kind.
 *  Swallows its own errors — the caller's action always wins. */
export async function bumpOnAirAction(kind: OnAirActionKind, by = 1): Promise<void> {
  const field = FIELD[kind]
  if (!field || !Number.isFinite(by) || by === 0) return
  try {
    await incrementDoc('public/onAirActions', { total: by, [field]: by })
  } catch (e) {
    console.warn('onAirActions bump failed', kind, e)
  }
}
