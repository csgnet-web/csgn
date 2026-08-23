/**
 * WHO SHOULD GO ON NEXT — ranked, with a reason for each.
 *
 * ── Why viewer count alone is not the answer ───────────────────────────────
 *
 * "Carry whoever has the most viewers" is the obvious rule and it is wrong in
 * three specific ways that all show up within a week of running the channel:
 *
 *   1. It never changes its mind. The same streamer wins every night, the
 *      other nineteen people on the roster learn that connecting Twitch got
 *      them nothing, and they stop streaming to a channel that never carries
 *      them. The roster dies from the bottom up.
 *
 *   2. It ignores freshness. A stream that started four minutes ago is a
 *      different proposition from one that has been running six hours — the
 *      first has an audience arriving, the second has one leaving.
 *
 *   3. It ignores skin in the game. Somebody holding $CSGN has staked
 *      something on the network working. That is worth a thumb on the scale,
 *      not a veto.
 *
 * So this scores four things and publishes both the score and the sentence
 * behind it. The MP still decides — every row is a suggestion with a button,
 * nothing here puts anybody on air by itself.
 *
 * ── Pure, and tested, because it decides what goes on television ───────────
 */

export interface RankCandidate {
  uid: string
  username: string
  displayName: string
  live: boolean
  viewerCount: number
  /** Minutes since their stream started, from Helix. 0 when unknown. */
  streamMinutes?: number
  /** Minutes they have been carried on CSGN today. Drives rotation fairness. */
  onAirMinutesToday?: number
  /** $CSGN held, for the skin-in-the-game term. */
  balance?: number
  /** What they are streaming. Shown, not scored — see the note below. */
  gameName?: string
  title?: string
}

export interface RankedStreamer {
  uid: string
  name: string
  score: number
  /** 0–100 versions of each term, already weighted, summing to `score`. */
  breakdown: { audience: number; freshness: number; rotation: number; stake: number }
  /** One line the MP can read at a glance. */
  why: string
  viewerCount: number
  gameName: string
  title: string
}

/**
 * The weights.
 *
 * Audience dominates because it is the only signal that correlates with "is
 * this worth watching" without a human in the loop. The other three are
 * corrections to its blind spots, sized so they can reorder near-ties and
 * cannot overturn a genuine gap: somebody with ten times the audience wins on
 * audience alone, which is correct.
 */
export const RANK_WEIGHTS = {
  audience: 0.55,
  freshness: 0.15,
  rotation: 0.20,
  stake: 0.10,
} as const

/** A stream this fresh is at its most interesting — an audience is arriving. */
export const FRESH_PEAK_MINUTES = 45
/** Past this, freshness has decayed to nothing. */
export const FRESH_FLOOR_MINUTES = 300
/** Time on air today past which rotation stops giving any credit. */
export const ROTATION_FULL_MINUTES = 120

/**
 * Square-root-scaled audience, normalised against the biggest room on the list.
 *
 * Concave on purpose: the difference between 5 and 50 watchers matters far more
 * than between 500 and 545, and a linear scale would let one big streamer
 * flatten every comparison below them.
 *
 * It is sqrt rather than log10 because log compresses too hard. Under log, a
 * stream with a HUNDRED TIMES the audience only scored three times as well on
 * this term, which the three correction terms below could then overturn — so a
 * ten-viewer stream could out-rank a thousand-viewer one on freshness and
 * rotation alone. That is not a tie-break, that is a different rule. sqrt keeps
 * the concavity and keeps a genuine gap decisive.
 */
function audienceScore(viewers: number, best: number): number {
  if (best <= 0) return 0
  return Math.sqrt(Math.max(0, viewers)) / Math.sqrt(best)
}

/** Peaks around FRESH_PEAK_MINUTES, decays to zero by FRESH_FLOOR_MINUTES.
 *  A stream that has only just started scores high but not highest — the first
 *  two minutes are usually a title screen. */
function freshnessScore(minutes: number): number {
  const m = Math.max(0, Number(minutes) || 0)
  if (m <= FRESH_PEAK_MINUTES) return 0.6 + 0.4 * (m / FRESH_PEAK_MINUTES)
  if (m >= FRESH_FLOOR_MINUTES) return 0
  return 1 - (m - FRESH_PEAK_MINUTES) / (FRESH_FLOOR_MINUTES - FRESH_PEAK_MINUTES)
}

/** Full credit to somebody who has not been carried today, none once they have
 *  had a full shift. This is the term that keeps the roster alive. */
function rotationScore(onAirMinutesToday: number): number {
  const m = Math.max(0, Number(onAirMinutesToday) || 0)
  return Math.max(0, 1 - m / ROTATION_FULL_MINUTES)
}

/** Holdings against the largest holder in the candidate set, log-scaled so a
 *  whale nudges ahead of a non-holder without buying the top slot outright.
 *  Log is right here — the gap between holding nothing and holding something is
 *  the part that matters, not the gap between two whales. */
function stakeScore(balance: number, best: number): number {
  if (best <= 0) return 0
  return Math.log10(1 + Math.max(0, balance)) / Math.log10(1 + best)
}

function pct(value: number, weight: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * weight * 100)
}

/**
 * Rank everybody worth considering, best first.
 *
 * `floor` is the viewer bar a stream must clear to be worth interrupting the
 * reel for at all — see operatorAlerts. Nobody below it appears here, because
 * a shortlist that includes people you should not put on is a shortlist you
 * stop reading.
 */
export function rankStreamers(candidates: RankCandidate[], floor = 0): RankedStreamer[] {
  const live = (Array.isArray(candidates) ? candidates : [])
    .filter((c) => c && c.live && c.viewerCount >= Math.max(0, floor))
  if (live.length === 0) return []

  const bestViewers = Math.max(...live.map((c) => Math.max(0, c.viewerCount)))
  const bestBalance = Math.max(...live.map((c) => Math.max(0, Number(c.balance) || 0)))

  return live
    .map((c) => {
      const name = c.displayName || c.username || 'Unknown'
      const audience = audienceScore(c.viewerCount, bestViewers)
      const freshness = freshnessScore(c.streamMinutes ?? 0)
      const rotation = rotationScore(c.onAirMinutesToday ?? 0)
      const stake = stakeScore(Number(c.balance) || 0, bestBalance)

      const breakdown = {
        audience: pct(audience, RANK_WEIGHTS.audience),
        freshness: pct(freshness, RANK_WEIGHTS.freshness),
        rotation: pct(rotation, RANK_WEIGHTS.rotation),
        stake: pct(stake, RANK_WEIGHTS.stake),
      }
      const score = breakdown.audience + breakdown.freshness + breakdown.rotation + breakdown.stake

      return {
        uid: c.uid,
        name,
        score,
        breakdown,
        why: reasonFor(c, name),
        viewerCount: Math.max(0, c.viewerCount),
        gameName: String(c.gameName || ''),
        title: String(c.title || ''),
      }
    })
    // Score first; viewers break a tie, because between two equal scores the
    // bigger room is the safer call.
    .sort((a, b) => b.score - a.score || b.viewerCount - a.viewerCount)
}

/**
 * The single most persuasive fact about this candidate, in one clause.
 *
 * Deliberately NOT a summary of all four terms — the MP is glancing at a phone,
 * and four numbers is a table, not a reason. It also cannot be "whichever term
 * scored highest", because audience carries the most weight and would win
 * every time, making the line the same sentence for everybody. So it looks for
 * the most NOTEWORTHY condition in a fixed order, and always states the
 * audience alongside it because that is always relevant.
 */
function reasonFor(c: RankCandidate, name: string): string {
  const viewers = `${c.viewerCount} watching`
  const game = c.gameName ? ` — ${c.gameName}` : ''

  // Rotation first: "hasn't been on today" is the fact most likely to change
  // the MP's mind, because it is the one the viewer numbers cannot tell them.
  if ((c.onAirMinutesToday ?? 0) === 0) return `${viewers} · not on yet today${game}`
  if ((c.streamMinutes ?? 0) <= FRESH_PEAK_MINUTES) return `${viewers} · just went live${game}`
  if ((c.balance ?? 0) > 0) return `${viewers} · holds $CSGN${game}`
  if (c.gameName) return `${viewers} · ${c.gameName}`
  return `${name} — ${viewers}`
}

/**
 * Should the channel switch, and to whom?
 *
 * Returns null when it should be left alone, which is most of the time and the
 * thing a notifier must respect: a channel that pings every minute is a channel
 * whose notifications get turned off in a week.
 */
export function switchRecommendation(
  ranked: RankedStreamer[],
  onAir: { uid: string; score?: number; viewerCount: number; live: boolean } | null,
  strongerMultiple = 3,
): { uid: string; name: string; why: string } | null {
  const best = ranked.find((r) => r.uid !== onAir?.uid)
  if (!best) return null
  // Nothing on air — anybody on the shortlist is an improvement on nothing.
  if (!onAir || !onAir.live) return { uid: best.uid, name: best.name, why: best.why }
  // Somebody is on and doing fine. Only a decisively better option is worth the
  // disruption; a channel that changes hands every few minutes reads as broken.
  if (best.viewerCount >= Math.max(1, onAir.viewerCount * strongerMultiple)) {
    return { uid: best.uid, name: best.name, why: `${best.why} — against ${onAir.viewerCount} on air now` }
  }
  return null
}
