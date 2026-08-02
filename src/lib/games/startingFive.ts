/**
 * CSGN STARTING 5 — daily fantasy, except the athletes are coins.
 *
 * You pick five tickers off the day's slate, name one your captain, and lock in
 * before tip-off. Your score is how those five performed over the session. High
 * score at the buzzer takes the $CSGN purse. It takes about eleven seconds to
 * enter and it gives someone a reason to have CSGN on a second monitor from lock
 * to settle — which is the actual product being sold here. The game is a
 * retention mechanic wearing a jersey.
 *
 * Four design decisions, each load-bearing:
 *
 *   1. ONE PICK PER TIER. Without tiers, every lineup is five microcaps and the
 *      game is a coin flip decided by whoever got the luckiest rug. Forcing one
 *      anchor, one core, one swing, one moonshot and a wildcard means skill has
 *      somewhere to live and no two lineups look alike.
 *
 *   2. A CAPTAIN AT 1.5×. One decision that's worth more than the other four.
 *      It's the pick people argue about on air, which makes it the pick that
 *      writes our content for us.
 *
 *   3. CONTRARIAN LEVERAGE. A pick nobody else made scores more when it hits.
 *      This is the mechanic that stops the leaderboard converging on one
 *      consensus lineup, and it rewards the viewer who was actually watching the
 *      show instead of copying the top entry.
 *
 *   4. NO ENTRY FEE, EVER. Free to play, and how many lineups you may submit is
 *      a function of $CSGN HELD — never spent, never escrowed, never burned. The
 *      token buys you more swings at the same free game, and nothing else.
 *
 * Pure functions only. Prices come in as a snapshot; nothing here fetches, and
 * nothing here reads a clock it wasn't handed.
 */

/* ─── The slate ─── */

/**
 * Tiers by market cap. The boundaries are deliberately wide and few — a slate a
 * viewer can't hold in their head on the first read is a slate they don't enter.
 */
export type Tier = 'anchor' | 'core' | 'swing' | 'moonshot' | 'wildcard'

export const TIER_ORDER: Tier[] = ['anchor', 'core', 'swing', 'moonshot', 'wildcard']

export const TIER_LABELS: Record<Tier, string> = {
  anchor: 'Anchor',
  core: 'Core',
  swing: 'Swing',
  moonshot: 'Moonshot',
  wildcard: 'Wildcard',
}

/** What each tier means, in the words the slate screen uses. */
export const TIER_RULES: Record<Tier, string> = {
  anchor: 'Over $1B market cap. The blue chip that keeps your floor off the floor.',
  core: '$100M–$1B. The majors.',
  swing: '$10M–$100M. Where a good read actually pays.',
  moonshot: 'Under $10M. Ten percent of the lineup, most of the variance.',
  wildcard: 'Anything on the slate, including a second from any tier.',
}

/** Market-cap tier for a coin. Wildcard is a lineup slot, never a coin's tier. */
export function tierForMarketCap(marketCapUsd: number): Exclude<Tier, 'wildcard'> {
  if (marketCapUsd >= 1_000_000_000) return 'anchor'
  if (marketCapUsd >= 100_000_000) return 'core'
  if (marketCapUsd >= 10_000_000) return 'swing'
  return 'moonshot'
}

export interface SlateEntry {
  symbol: string
  name: string
  tier: Exclude<Tier, 'wildcard'>
  /** Price at lock. The denominator of every score in this game. */
  lockPriceUsd: number
  marketCapUsd: number
}

export interface Slate {
  id: string
  /** ET calendar date this slate plays, YYYY-MM-DD. */
  gameDate: string
  /** No lineup is accepted at or after this instant. */
  locksAt: string
  /** Scoring window closes here. */
  settlesAt: string
  entries: SlateEntry[]
  /** $CSGN the treasury has committed to this slate. */
  purseCsgn: number
}

/* ─── A lineup ─── */

export interface LineupPick {
  slot: Tier
  symbol: string
}

export interface Lineup {
  id: string
  wallet: string
  displayName: string
  picks: LineupPick[]
  /** Symbol carrying the 1.5× captain multiplier. Must be one of the picks. */
  captain: string
  submittedAt: string
}

export const CAPTAIN_MULTIPLIER = 1.5

export type LineupRejection =
  | 'slate_locked'
  | 'wrong_slot_count'
  | 'duplicate_symbol'
  | 'unknown_symbol'
  | 'tier_mismatch'
  | 'missing_slot'
  | 'bad_captain'
  | 'entry_limit'

const REJECTION_COPY: Record<LineupRejection, string> = {
  slate_locked: 'This slate is locked — catch the next one.',
  wrong_slot_count: 'A lineup is exactly five picks.',
  duplicate_symbol: 'You can only roster a coin once.',
  unknown_symbol: 'That coin is not on today’s slate.',
  tier_mismatch: 'That coin does not belong in that slot.',
  missing_slot: 'Fill every slot: anchor, core, swing, moonshot, wildcard.',
  bad_captain: 'Your captain has to be one of your five.',
  entry_limit: 'You are at your lineup limit — hold more $CSGN for more entries.',
}

export interface ValidationResult {
  ok: boolean
  reason?: LineupRejection
  message?: string
}

const fail = (reason: LineupRejection): ValidationResult => ({ ok: false, reason, message: REJECTION_COPY[reason] })

/**
 * Is this a legal lineup for this slate?
 *
 * Every rule is checked server-side against the slate document, because the
 * client's copy of the slate is a suggestion and the server's is the truth. The
 * ordering matters for the error message the user sees: structural problems
 * ("five picks") before semantic ones ("wrong tier"), so the first complaint is
 * always the most useful one.
 */
export function validateLineup(
  slate: Slate,
  lineup: Lineup,
  opts: { nowMs: number; entriesAlreadySubmitted: number; entryAllowance: number },
): ValidationResult {
  if (opts.nowMs >= Date.parse(slate.locksAt)) return fail('slate_locked')
  if (opts.entriesAlreadySubmitted >= opts.entryAllowance) return fail('entry_limit')
  if (lineup.picks.length !== TIER_ORDER.length) return fail('wrong_slot_count')

  const symbols = lineup.picks.map((p) => p.symbol.toUpperCase())
  if (new Set(symbols).size !== symbols.length) return fail('duplicate_symbol')

  const slots = lineup.picks.map((p) => p.slot)
  if (new Set(slots).size !== TIER_ORDER.length) return fail('missing_slot')
  if (!TIER_ORDER.every((t) => slots.includes(t))) return fail('missing_slot')

  const bySymbol = new Map(slate.entries.map((e) => [e.symbol.toUpperCase(), e]))
  for (const pick of lineup.picks) {
    const entry = bySymbol.get(pick.symbol.toUpperCase())
    if (!entry) return fail('unknown_symbol')
    // The wildcard slot accepts any tier — that is what makes it the wildcard.
    if (pick.slot !== 'wildcard' && entry.tier !== pick.slot) return fail('tier_mismatch')
  }

  if (!symbols.includes(lineup.captain.toUpperCase())) return fail('bad_captain')
  return { ok: true }
}

/* ─── Entry allowance: holdings, not deposits ─── */

export const FREE_LINEUPS = 1
export const MAX_LINEUPS = 5

/**
 * How many lineups a wallet may enter, from its share of $CSGN supply.
 *
 * Same square-root curve as Squares, and for the same reason: a linear rule
 * hands the leaderboard to whoever can submit the most lineups, which turns a
 * skill game into a shopping contest. Everyone gets one for free — including a
 * wallet holding nothing at all, which is how a viewer becomes a holder.
 */
export function lineupAllowance(csgnHeld: number, circulatingSupply: number): number {
  if (!Number.isFinite(csgnHeld) || csgnHeld <= 0) return FREE_LINEUPS
  if (!Number.isFinite(circulatingSupply) || circulatingSupply <= 0) return FREE_LINEUPS
  const sharePct = (csgnHeld / circulatingSupply) * 100
  const earned = Math.floor(Math.sqrt(Math.min(sharePct, 1)) * (MAX_LINEUPS - FREE_LINEUPS))
  return Math.min(MAX_LINEUPS, FREE_LINEUPS + Math.max(0, earned))
}

/* ─── Scoring ─── */

/** Settle-time price for each symbol on the slate. */
export type PriceSnapshot = Record<string, number>

/**
 * Points for one pick. 1 point per 0.1% move, so a 10% day is 100 points and the
 * leaderboard reads in whole numbers instead of decimals nobody can compare at a
 * glance. Losses score negative — a lineup can finish below zero, and it should,
 * because a game where the worst outcome is "nothing happened" has no stakes.
 */
export function pickPoints(lockPrice: number, settlePrice: number): number {
  if (!Number.isFinite(lockPrice) || lockPrice <= 0) return 0
  if (!Number.isFinite(settlePrice) || settlePrice < 0) return 0
  const pctChange = ((settlePrice - lockPrice) / lockPrice) * 100
  return Math.round(pctChange * 10)
}

/**
 * Contrarian leverage. A pick rostered by almost nobody is worth more when it
 * hits — and, symmetrically, no worse when it misses.
 *
 * The asymmetry is intentional and it is the whole point. If leverage cut both
 * ways it would just be volatility, and the rational play would still be the
 * consensus lineup. Applied only to gains, being early is a free option, which
 * is precisely the behaviour a network that broadcasts coin discovery wants to
 * reward. Capped at 1.5× so a one-entry slate can't mint an absurd number.
 */
export const MAX_LEVERAGE = 1.5

export function leverageFor(ownershipPct: number): number {
  if (!Number.isFinite(ownershipPct)) return 1
  const pct = Math.min(100, Math.max(0, ownershipPct))
  // 0% owned → 1.5×; 50% owned or higher → 1.0×. Linear between.
  return Math.max(1, MAX_LEVERAGE - (pct / 50) * (MAX_LEVERAGE - 1))
}

/** Share of submitted lineups rostering each symbol, as a percentage. */
export function ownershipPercentages(lineups: Lineup[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const lineup of lineups) {
    for (const pick of lineup.picks) {
      const s = pick.symbol.toUpperCase()
      counts[s] = (counts[s] ?? 0) + 1
    }
  }
  const total = lineups.length
  const out: Record<string, number> = {}
  for (const [symbol, count] of Object.entries(counts)) {
    out[symbol] = total > 0 ? (count / total) * 100 : 0
  }
  return out
}

export interface ScoredPick {
  slot: Tier
  symbol: string
  lockPriceUsd: number
  settlePriceUsd: number
  basePoints: number
  isCaptain: boolean
  ownershipPct: number
  leverage: number
  points: number
}

export interface ScoredLineup {
  lineupId: string
  wallet: string
  displayName: string
  picks: ScoredPick[]
  totalPoints: number
  /** Filled in by `rankLineups`. 1 is first. */
  rank: number
}

/**
 * Score one lineup against the settle snapshot.
 *
 * Multiplier order is captain first, then leverage, and both apply to gains
 * only — captaining a coin that dumps costs you the raw loss, not 1.5× of it.
 * Punishing the bold pick 1.5× on the downside would teach everyone to captain
 * the anchor, and a game where the optimal play is the boring play dies quietly.
 */
export function scoreLineup(
  slate: Slate,
  lineup: Lineup,
  prices: PriceSnapshot,
  ownership: Record<string, number> = {},
): ScoredLineup {
  const bySymbol = new Map(slate.entries.map((e) => [e.symbol.toUpperCase(), e]))
  const captain = lineup.captain.toUpperCase()

  const picks: ScoredPick[] = lineup.picks.map((pick) => {
    const symbol = pick.symbol.toUpperCase()
    const entry = bySymbol.get(symbol)
    const lockPriceUsd = entry?.lockPriceUsd ?? 0
    const settlePriceUsd = prices[symbol] ?? lockPriceUsd
    const basePoints = pickPoints(lockPriceUsd, settlePriceUsd)
    const isCaptain = symbol === captain
    const ownershipPct = ownership[symbol] ?? 0
    const leverage = leverageFor(ownershipPct)

    let points = basePoints
    if (points > 0) {
      if (isCaptain) points *= CAPTAIN_MULTIPLIER
      points *= leverage
    } else if (isCaptain) {
      // A captained loser costs its raw loss and no more.
      points = basePoints
    }

    return {
      slot: pick.slot,
      symbol,
      lockPriceUsd,
      settlePriceUsd,
      basePoints,
      isCaptain,
      ownershipPct,
      leverage,
      points: Math.round(points),
    }
  })

  return {
    lineupId: lineup.id,
    wallet: lineup.wallet,
    displayName: lineup.displayName,
    picks,
    totalPoints: picks.reduce((sum, p) => sum + p.points, 0),
    rank: 0,
  }
}

/**
 * Rank every lineup, highest first. Equal scores get EQUAL rank, and standard
 * competition numbering — 1, 2, 2, 4 — so a tie for second consumes the third
 * position rather than pushing everyone down.
 *
 * Tied lineups pool and split (see `splitPurse`) rather than being separated by
 * a tiebreak. There is no tiebreak worth having here: the player controls their
 * picks and nothing else, so breaking a tie on submission time or wallet order
 * would decide real money on something the player couldn't have played for.
 * Submission time is used only to order tied rows for display, earliest first.
 */
export function rankLineups(scored: ScoredLineup[], lineups: Lineup[]): ScoredLineup[] {
  const submittedAt = new Map(lineups.map((l) => [l.id, Date.parse(l.submittedAt) || 0]))
  const sorted = [...scored].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
    return (submittedAt.get(a.lineupId) ?? 0) - (submittedAt.get(b.lineupId) ?? 0)
  })
  return sorted.map((row, i) => {
    // Walk back to the first row sharing this score — that index is the rank.
    let first = i
    while (first > 0 && sorted[first - 1].totalPoints === row.totalPoints) first--
    return { ...row, rank: first + 1 }
  })
}

/* ─── The purse ─── */

/**
 * How the daily purse splits by finishing position, in basis points.
 *
 * Top-heavy enough that winning means something, flat enough at the tail that
 * finishing tenth still pays — because the player who cashes for a small amount
 * is the player who comes back tomorrow, and tomorrow is the only metric this
 * game exists to move.
 */
export const PAYOUT_CURVE_BPS: number[] = [
  3_000, // 1st
  1_800, // 2nd
  1_200, // 3rd
  900,   // 4th
  700,   // 5th
  600,   // 6th
  500,   // 7th
  450,   // 8th
  425,   // 9th
  425,   // 10th
]

export interface LineupPayout {
  rank: number
  wallet: string
  displayName: string
  totalPoints: number
  payoutCsgn: number
}

/**
 * Split the purse across the ranked field.
 *
 * Two rules that only show up in real data:
 *
 *   - TIES SHARE. Everyone on a tied rank pools their positions' shares and
 *     splits evenly. Awarding the whole of 1st to whoever's row sorted higher is
 *     the kind of thing that ends up quoted back at you in a Discord screenshot.
 *
 *   - A SHORT FIELD DOESN'T KEEP THE REST. If eight people entered a ten-place
 *     curve, the unpaid tail is redistributed across the field in proportion, so
 *     the treasury never quietly pockets the difference on a slow day.
 *
 * Everything is integer $CSGN; the remainder goes to first place, and the
 * function's own assertion is that the parts sum to the purse exactly.
 */
export function splitPurse(ranked: ScoredLineup[], purseCsgn: number): LineupPayout[] {
  if (ranked.length === 0 || purseCsgn <= 0) return []

  const places = Math.min(ranked.length, PAYOUT_CURVE_BPS.length)
  const usedBps = PAYOUT_CURVE_BPS.slice(0, places).reduce((s, b) => s + b, 0)

  // Scale the curve up so the paid places always consume the whole purse.
  const scaled = PAYOUT_CURVE_BPS.slice(0, places).map((bps) => (bps / usedBps) * 10_000)

  // Group by rank so ties pool and share. Selected by RANK, not by slice — a
  // tie straddling the last paid place must bring both rows in, so they split
  // that place's share instead of one of them silently taking all of it.
  const groups = new Map<number, ScoredLineup[]>()
  for (const row of ranked.filter((r) => r.rank <= places)) {
    const bucket = groups.get(row.rank) ?? []
    bucket.push(row)
    groups.set(row.rank, bucket)
  }

  const payouts: LineupPayout[] = []
  for (const [rank, rows] of groups) {
    // The positions this tie occupies: rank..rank+size-1, clipped to paid places.
    const shareBps = rows
      .map((_, i) => scaled[rank - 1 + i] ?? 0)
      .reduce((s, b) => s + b, 0) / rows.length

    for (const row of rows) {
      payouts.push({
        rank,
        wallet: row.wallet,
        displayName: row.displayName,
        totalPoints: row.totalPoints,
        payoutCsgn: Math.floor((purseCsgn * shareBps) / 10_000),
      })
    }
  }

  payouts.sort((a, b) => a.rank - b.rank || b.totalPoints - a.totalPoints)

  // Rounding dust to first place, so the books close to the token.
  const paid = payouts.reduce((s, p) => s + p.payoutCsgn, 0)
  if (payouts.length > 0 && paid < purseCsgn) payouts[0].payoutCsgn += purseCsgn - paid

  return payouts
}

/**
 * The whole settlement in one call: score, rank, split. The shape returned is
 * exactly what the payout ledger consumes, so nothing between the buzzer and the
 * wallet has to re-derive who won.
 */
export interface SlateSettlement {
  slateId: string
  gameDate: string
  ranked: ScoredLineup[]
  payouts: LineupPayout[]
  ownership: Record<string, number>
}

export function settleSlate(slate: Slate, lineups: Lineup[], prices: PriceSnapshot): SlateSettlement {
  const ownership = ownershipPercentages(lineups)
  const scored = lineups.map((l) => scoreLineup(slate, l, prices, ownership))
  const ranked = rankLineups(scored, lineups)
  return {
    slateId: slate.id,
    gameDate: slate.gameDate,
    ranked,
    payouts: splitPurse(ranked, slate.purseCsgn),
    ownership,
  }
}
