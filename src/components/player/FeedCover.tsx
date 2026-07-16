import { useEffect, useState } from 'react'

/**
 * FeedCover — an opaque, on-brand curtain held over the Twitch player during the
 * vulnerable startup window (the play-button poster, the loading spinner, the
 * preroll ad, and the channel/Follow chrome that flash before the feed settles).
 *
 * The brand wipe (WipeOverlay) only plays on a state *change*, so it does not
 * cover the initial page load or an OBS watchdog reload — the two moments the
 * raw Twitch reveal is most visible on-stream. This static cover fills that gap:
 * /player renders it over the LIVE feed until playback has been confirmed
 * flowing for a short hold, so the transition fully masks the reveal.
 *
 * When the caller knows who is going live, the card also bills the streamer
 * and their slot window, so the transition reads as programming, not a stall.
 *
 * `countdownSeconds` switches the curtain from the indeterminate "Now Live"
 * pulse (standard 33s ad-mask mode, where reveal time depends on FeedGate) to a
 * deterministic broadcast countdown — a depleting ring plus a live seconds
 * readout — used by the no-ads / Turbo fast-reveal path, whose reveal lands on
 * a fixed clock. It gives OBS viewers a clear "we cut to the feed in 3… 2… 1"
 * instead of a static holding card.
 */
export default function FeedCover({
  label = 'CSGN 24/7',
  streamerName,
  slotLabel,
  countdownSeconds,
}: {
  label?: string
  streamerName?: string
  slotLabel?: string
  /** When set (and > 0), render a fixed countdown instead of the pulse dot. */
  countdownSeconds?: number
}) {
  const hasCountdown = typeof countdownSeconds === 'number' && countdownSeconds > 0
  // Initialised from the prop; FeedCover remounts fresh each time the curtain
  // appears, so the initial value is always correct for the new countdown.
  const [remaining, setRemaining] = useState(hasCountdown ? Math.ceil(countdownSeconds as number) : 0)

  // Self-timed from mount: FeedCover is only mounted while the curtain is up, so
  // its lifetime is the countdown window. The ring depletes smoothly via CSS
  // (any OBS frame rate); this interval only ticks the whole-second number down,
  // anchored at the same mount, so the two stay in step.
  useEffect(() => {
    if (!hasCountdown) return
    const id = setInterval(() => setRemaining((r) => (r <= 1 ? 0 : r - 1)), 1_000)
    return () => clearInterval(id)
  }, [hasCountdown])

  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #ff2346 0%, #0a0a14 60%)' }}
    >
      <div className="flex flex-col items-center gap-5">
        <svg viewBox="0 0 120 40" className="h-14 w-auto fill-white opacity-95" xmlns="http://www.w3.org/2000/svg">
          <text x="0" y="32" fontFamily="system-ui, sans-serif" fontWeight="900" fontSize="38" letterSpacing="2">CSGN</text>
        </svg>

        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span className="text-white/80 text-sm font-bold tracking-[0.2em] uppercase">
            {hasCountdown ? 'Going live in' : label}
          </span>
        </div>

        {hasCountdown && (
          <div className="relative flex items-center justify-center my-1">
            <svg viewBox="0 0 100 100" className="h-40 w-40 -rotate-90" xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="5" />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="#ffffff"
                strokeWidth="5"
                strokeLinecap="round"
                pathLength={100}
                strokeDasharray="100"
                style={{ animation: `csgn-countdown-ring ${countdownSeconds}s linear forwards` }}
              />
            </svg>
            <span className="absolute text-white text-6xl font-black font-display tabular-nums">
              {remaining}
            </span>
          </div>
        )}

        {streamerName && (
          <span className="text-white text-3xl font-black font-display tracking-tight text-center max-w-[80vw] truncate">
            {streamerName}
          </span>
        )}
        {slotLabel && (
          <span className="text-white/70 text-sm font-mono tracking-wider">{slotLabel}</span>
        )}
      </div>
    </div>
  )
}
