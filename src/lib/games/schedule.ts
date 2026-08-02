/**
 * WHEN THE GAMES RUN — and what the banner on /watch says about it.
 *
 * Starting 5 is daily. Squares is weekly. Both need the same three answers on
 * every render: is there a game up, when does the clock hit zero, and what do we
 * call it. This module is those three answers as pure functions, so the banner,
 * the admin preview, and (later) the settlement job all agree without a round
 * trip.
 *
 * The banner itself is admin-driven through `config/gameBanner`. That's the
 * point: the strip on /watch used to be four hardcoded strings, which meant
 * announcing anything required a deploy. Now an operator sets the game, the
 * headline and the countdown target from Broadcast Control, and the strip
 * follows — the same pattern `config/ticker` already uses for the on-air chyron.
 */

export type GameId = 'starting5' | 'squares' | 'none'

export const GAME_LABELS: Record<GameId, string> = {
  starting5: 'Starting 5',
  squares: 'Squares',
  none: '',
}

/* ─── Cadence ─── */

/**
 * Squares runs once a week. Stored as an ET weekday + hour so the board always
 * lands on the same wall-clock slot regardless of daylight saving — the same
 * DST-aware approach `_shared/schedule.ts` already takes for the slot template.
 */
export interface GameCadence {
  /** 0 = Sunday. Squares' entry deadline weekday, ET. */
  squaresDayET: number
  /** ET hour (0-23) Squares entries close and the digits are drawn. */
  squaresHourET: number
  /** ET hour Starting 5 locks each day. */
  startingFiveLockHourET: number
}

export const DEFAULT_CADENCE: GameCadence = {
  squaresDayET: 0,   // Sunday
  squaresHourET: 13, // 1 PM ET — kickoff of the early window
  startingFiveLockHourET: 12,
}

export function normalizeCadence(raw: unknown): GameCadence {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const int = (v: unknown, min: number, max: number, fallback: number): number => {
    const n = Number(v)
    return Number.isInteger(n) && n >= min && n <= max ? n : fallback
  }
  return {
    squaresDayET: int(d.squaresDayET, 0, 6, DEFAULT_CADENCE.squaresDayET),
    squaresHourET: int(d.squaresHourET, 0, 23, DEFAULT_CADENCE.squaresHourET),
    startingFiveLockHourET: int(d.startingFiveLockHourET, 0, 23, DEFAULT_CADENCE.startingFiveLockHourET),
  }
}

/* ─── The banner document ─── */

export type BannerMode = 'auto' | 'manual' | 'off'

export interface GameBannerDoc {
  /**
   * `auto`   — headline and countdown derived from the active game's schedule
   * `manual` — the operator's own headline, countdown and lines
   * `off`    — fall back to the network's default rotating copy
   */
  mode: BannerMode
  game: GameId
  /** Big line, e.g. "STARTING 5 — TONIGHT'S SLATE". */
  headline: string
  /** What the clock is counting to, e.g. "LOCKS IN". Kept short — it sits inline. */
  countdownLabel: string
  /** ISO target. Empty or past → no clock, just the rotating lines. */
  countdownTo: string
  /** Rotating faces when there's no live countdown. Exactly 4 are rendered. */
  lines: string[]
  /** Optional route the banner links to. */
  href: string
  updatedAt?: string
}

export const DEFAULT_BANNER_LINES = [
  'STARTING 5 — 100,000 $CSGN FOR A PERFECT CARD',
  'SQUARES — WEEKLY BOARD, FREE TO ENTER',
  "CSGN: CRYPTO'S ENTERTAINMENT FLAGSHIP",
  'CONNECT YOUR TWITCH AND GO LIVE ON CSGN',
] as const

/** The banner is a 3D prism rotating 90° per face, so it is always four faces —
 *  fewer leaves a blank quarter-turn, more never comes back around. */
export const BANNER_FACES = 4

export function normalizeBanner(raw: unknown): GameBannerDoc {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const str = (v: unknown, max = 120): string => String(v ?? '').trim().slice(0, max)
  const mode = d.mode === 'manual' || d.mode === 'off' ? d.mode : 'auto'
  const game: GameId = d.game === 'starting5' || d.game === 'squares' ? d.game : 'none'

  const rawLines = Array.isArray(d.lines) ? d.lines.map((l) => str(l)).filter(Boolean) : []
  // Pad to exactly four faces by cycling what we were given, so a partial edit
  // can never leave a blank quarter of the prism.
  const lines = rawLines.length === 0
    ? [...DEFAULT_BANNER_LINES]
    : Array.from({ length: BANNER_FACES }, (_, i) => rawLines[i % rawLines.length])

  return {
    mode,
    game,
    headline: str(d.headline),
    countdownLabel: str(d.countdownLabel, 24) || 'STARTS IN',
    countdownTo: str(d.countdownTo, 40),
    lines,
    href: str(d.href, 200),
    updatedAt: typeof d.updatedAt === 'string' ? d.updatedAt : undefined,
  }
}

/* ─── Countdown ─── */

export interface Countdown {
  /** Milliseconds remaining, floored at zero. */
  remainingMs: number
  /** `2d 04:15:00`, `04:15:00`, or `15:00` — the shortest form that's unambiguous. */
  display: string
  /** True once the target has passed. */
  expired: boolean
  /** Under a minute — the banner goes red and the ticks get urgent. */
  urgent: boolean
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * Format a countdown. Drops leading units rather than showing `0d 00:00:45`,
 * because a clock reading zeroes is a clock nobody trusts, and on a 1.5rem strip
 * every character costs legibility.
 */
export function formatCountdown(targetIso: string, nowMs: number): Countdown | null {
  const target = Date.parse(targetIso)
  if (!Number.isFinite(target)) return null

  const remainingMs = Math.max(0, target - nowMs)
  const total = Math.floor(remainingMs / 1000)
  const days = Math.floor(total / 86_400)
  const hours = Math.floor((total % 86_400) / 3_600)
  const minutes = Math.floor((total % 3_600) / 60)
  const seconds = total % 60

  const display = days > 0
    ? `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : hours > 0
      ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
      : `${pad(minutes)}:${pad(seconds)}`

  return { remainingMs, display, expired: remainingMs <= 0, urgent: remainingMs > 0 && remainingMs < 60_000 }
}

/* ─── What the banner should render ─── */

export interface ResolvedBanner {
  kind: 'countdown' | 'rotating'
  /** Present when kind is 'countdown'. */
  headline?: string
  label?: string
  countdown?: Countdown
  /** Present when kind is 'rotating'. Always exactly four faces. */
  lines?: string[]
  href?: string
  game: GameId
}

/**
 * Decide what the strip shows, right now.
 *
 * The precedence exists so the banner degrades safely rather than going blank:
 * an expired countdown falls back to the rotating lines, `off` falls back to the
 * caller's default copy (which is how the open-stage invite keeps priority when
 * nobody's on air), and a missing document behaves exactly like `off`.
 */
export function resolveBanner(
  banner: GameBannerDoc | null,
  nowMs: number,
  fallbackLines: readonly string[],
): ResolvedBanner {
  const pad4 = (lines: readonly string[]): string[] =>
    lines.length === 0
      ? [...DEFAULT_BANNER_LINES]
      : Array.from({ length: BANNER_FACES }, (_, i) => lines[i % lines.length])

  if (!banner || banner.mode === 'off') {
    return { kind: 'rotating', lines: pad4(fallbackLines), game: 'none' }
  }

  const countdown = banner.countdownTo ? formatCountdown(banner.countdownTo, nowMs) : null
  if (countdown && !countdown.expired) {
    return {
      kind: 'countdown',
      headline: banner.headline || `${GAME_LABELS[banner.game]}`.toUpperCase() || 'UP NEXT',
      label: banner.countdownLabel,
      countdown,
      href: banner.href || undefined,
      game: banner.game,
    }
  }

  return { kind: 'rotating', lines: pad4(banner.lines), href: banner.href || undefined, game: banner.game }
}
