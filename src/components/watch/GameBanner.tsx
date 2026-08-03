import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { resolveBanner, type GameBannerDoc } from '@/lib/games/schedule'

/**
 * The strip beside LIVE/OFFLINE on /watch.
 *
 * Two shapes, decided by `resolveBanner`:
 *
 *   • a live COUNTDOWN to the next game moment (locks, tip-off, draw)
 *   • the rotating 3D prism of headline lines, when no clock is running
 *
 * Both are driven by `config/gameBanner`, so an operator changes what this says
 * from Broadcast Control instead of shipping a deploy — which is what the four
 * hardcoded strings here used to require.
 *
 * It runs its OWN one-second interval rather than using LiveSlotContext's
 * `nowMs`. That clock ticks every 30 seconds, which is right for slot
 * derivation and useless for a seconds countdown. The interval only exists while
 * a countdown is actually running, so an idle page isn't re-rendering once a
 * second for nothing.
 */
export default function GameBanner({
  banner,
  fallbackLines,
}: {
  banner: GameBannerDoc | null
  fallbackLines: readonly string[]
}) {
  const [nowMs, setNowMs] = useState(() => Date.now())

  const hasClock = Boolean(banner && banner.mode !== 'off' && banner.countdownTo)
  useEffect(() => {
    if (!hasClock) return
    const t = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(t)
  }, [hasClock])

  const resolved = resolveBanner(banner, nowMs, fallbackLines)

  const shell = 'flex-1 min-w-0 sm:min-w-[240px] lg:flex-none lg:w-[520px] lg:ml-auto'

  if (resolved.kind === 'countdown' && resolved.countdown) {
    const { countdown, headline, label } = resolved
    const body = (
      <div className={`flex items-center justify-end gap-2 sm:gap-3 min-w-0 ${shell}`}>
        {/* Headline truncates; the clock never does — a cut-off countdown is
            worse than no countdown at all. */}
        <span className="truncate text-[10px] sm:text-xs font-black uppercase tracking-[0.12em] text-white/85">
          {headline}
        </span>
        <span className="hidden sm:inline shrink-0 text-[10px] uppercase tracking-[0.16em] text-white/50">
          {label}
        </span>
        <span
          className={`shrink-0 font-mono font-black tabular-nums text-sm sm:text-base leading-none ${
            countdown.urgent ? 'text-amber-300' : 'text-white'
          }`}
        >
          {countdown.display}
        </span>
      </div>
    )
    return resolved.href
      ? <Link to={resolved.href} className={`${shell} no-underline`} aria-label={`${headline} — ${label} ${countdown.display}`}>{body}</Link>
      : body
  }

  return (
    <div className={`watch-roll-banner ${shell}`} aria-label="Network updates">
      <div className="watch-roll-banner__inner">
        {(resolved.lines ?? []).map((item, index) => (
          <span
            key={`${item}-${index}`}
            className="watch-roll-banner__face"
            style={{ transform: `rotateX(${index * 90}deg) translateZ(12px)` }}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}
