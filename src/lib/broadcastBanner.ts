/**
 * THE STRIP beside LIVE/OFFLINE on /watch — headline, clock, rotating lines.
 *
 * Driven entirely by `config/broadcastBanner`, which is the point: this used to
 * be four hardcoded strings, so announcing anything on the network required a
 * deploy. An operator now sets the headline and the countdown target from
 * Broadcast Control and the strip follows, the same way `config/ticker` drives
 * the on-air chyron.
 *
 * Pure functions only — the banner, the admin preview and anything that later
 * wants to count down to an airing all read one answer without a round trip.
 */

export type BannerMode = 'auto' | 'manual' | 'off'

export interface BroadcastBannerDoc {
  /**
   * `auto`/`manual` — show the operator's headline, countdown and lines
   * `off`           — fall back to the network's default rotating copy
   */
  mode: BannerMode
  /** Big line, e.g. "TONIGHT — OPEN STAGE". */
  headline: string
  /** What the clock is counting to, e.g. "STARTS IN". Kept short — it sits inline. */
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
  "CSGN: CRYPTO'S ENTERTAINMENT FLAGSHIP",
  'CONNECT YOUR TWITCH AND GO LIVE ON CSGN',
  'EVERY HOUR PAYS 30% OF THE FEES IT GENERATES',
  '24/7 — SOMEBODY IS ALWAYS ON',
] as const

/** The banner is a 3D prism rotating 90° per face, so it is always four faces —
 *  fewer leaves a blank quarter-turn, more never comes back around. */
export const BANNER_FACES = 4

export function normalizeBanner(raw: unknown): BroadcastBannerDoc {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const str = (v: unknown, max = 120): string => String(v ?? '').trim().slice(0, max)
  const mode = d.mode === 'manual' || d.mode === 'off' ? d.mode : 'auto'

  const rawLines = Array.isArray(d.lines) ? d.lines.map((l) => str(l)).filter(Boolean) : []
  // Pad to exactly four faces by cycling what we were given, so a partial edit
  // can never leave a blank quarter of the prism.
  const lines = rawLines.length === 0
    ? [...DEFAULT_BANNER_LINES]
    : Array.from({ length: BANNER_FACES }, (_, i) => rawLines[i % rawLines.length])

  return {
    mode,
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
  banner: BroadcastBannerDoc | null,
  nowMs: number,
  fallbackLines: readonly string[],
): ResolvedBanner {
  const pad4 = (lines: readonly string[]): string[] =>
    lines.length === 0
      ? [...DEFAULT_BANNER_LINES]
      : Array.from({ length: BANNER_FACES }, (_, i) => lines[i % lines.length])

  if (!banner || banner.mode === 'off') {
    return { kind: 'rotating', lines: pad4(fallbackLines) }
  }

  const countdown = banner.countdownTo ? formatCountdown(banner.countdownTo, nowMs) : null
  if (countdown && !countdown.expired) {
    return {
      kind: 'countdown',
      headline: banner.headline || 'UP NEXT',
      label: banner.countdownLabel,
      countdown,
      href: banner.href || undefined,
    }
  }

  return { kind: 'rotating', lines: pad4(banner.lines), href: banner.href || undefined }
}
