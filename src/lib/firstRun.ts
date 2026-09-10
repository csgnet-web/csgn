/**
 * HAS THIS PERSON BEEN TOLD WHAT THIS IS?
 *
 * ── The problem ────────────────────────────────────────────────────────────
 *
 * A stranger arrives on a live video with a ticker under it and four tabs at
 * the bottom. Nothing on the page says what the channel is, who is on it, or
 * what they could do here — and the honest thing a stranger concludes from a
 * broadcast they cannot place is that they are in the wrong place.
 *
 * Every page had paragraphs explaining the product, which is the other failure:
 * a brochure under a live video reads as a landing page, not a channel. The
 * answer is not more copy on more pages, it is twenty words, once, on arrival,
 * that go away and never come back.
 *
 * ── Where it must NEVER appear ─────────────────────────────────────────────
 *
 * `/player` and `/oldplayer` are OBS capture surfaces. A sheet over those goes
 * out on television. That is not a styling problem, it is a broadcast incident,
 * so the check is a hard path test rather than a prop somebody could forget to
 * pass — see `introAllowedOn`.
 */

export const FIRST_RUN_KEY = 'csgn:seenIntro'

/**
 * Routes the intro may cover.
 *
 * An allowlist would be wrong here: a route added later would silently lose the
 * intro, and the failure of missing it is small. A DENYLIST is right, because
 * the failure of showing it in the wrong place is a full-frame sheet on a live
 * broadcast, and the four surfaces where that matters are known and finite.
 */
const NEVER = [
  '/player',      // OBS browser source. The broadcast itself.
  '/oldplayer',   // the revert path — the same surface, same stakes.
  '/share',       // arrived from a phone's share sheet mid-action; not a moment to explain the product.
  '/auth',        // mid sign-in round trip, with a redirect already in flight.
  '/admin',       // an operator knows what this is.
]

export function introAllowedOn(pathname: string): boolean {
  const path = String(pathname ?? '').toLowerCase()
  return !NEVER.some((deny) => path === deny || path.startsWith(`${deny}/`))
}

/**
 * Have they seen it? A read that throws — private mode, storage disabled — is
 * treated as "yes, seen", not "no".
 *
 * That direction is deliberate. Getting it wrong toward showing means a sheet
 * over the channel on every single page load for somebody whose browser cannot
 * remember the dismissal, which is worse than never explaining the product to
 * them at all.
 */
export function hasSeenIntro(): boolean {
  try {
    return localStorage.getItem(FIRST_RUN_KEY) === '1'
  } catch {
    return true
  }
}

export function markIntroSeen(): void {
  try {
    localStorage.setItem(FIRST_RUN_KEY, '1')
  } catch {
    /* private mode — they will see it again, which is the acceptable direction */
  }
}

/** For the operator, and for anybody who wants to look at it again. */
export function resetIntro(): void {
  try {
    localStorage.removeItem(FIRST_RUN_KEY)
  } catch {
    /* nothing to reset if nothing could be stored */
  }
}

/**
 * Should the intro show right now?
 *
 * `signedIn` is a member: they have already been told, by having done it. The
 * `?intro=1` escape hatch re-opens it on demand — for the operator checking a
 * copy change without clearing site data, and because a person who dismissed it
 * by accident has no other way back.
 */
export function shouldShowIntro(
  { pathname, search, signedIn }: { pathname: string; search: string; signedIn: boolean },
): boolean {
  if (!introAllowedOn(pathname)) return false
  if (new URLSearchParams(search).get('intro') === '1') return true
  if (signedIn) return false
  return !hasSeenIntro()
}
