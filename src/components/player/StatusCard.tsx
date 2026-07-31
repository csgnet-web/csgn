import { useEffect, useState } from 'react'
import IntermissionBoard from './IntermissionBoard'
import { CsgnLogo } from '@/components/ui/CsgnLogo'

/** mm:ss for a whole-second count (120 → "2:00", 9 → "0:09"). */
function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

/**
 * The last-call countdown shown in STARTING_SOON's second phase: a depleting ring
 * with a live mm:ss readout. Self-timed from mount (the card is keyed so it mounts
 * fresh when the countdown phase begins), matching FeedCover's approach so the
 * ring animation and the number stay in step at any OBS frame rate.
 */
function CountdownRing({ seconds }: { seconds: number }) {
  const [remaining, setRemaining] = useState(Math.ceil(seconds))
  useEffect(() => {
    const id = setInterval(() => setRemaining((r) => (r <= 1 ? 0 : r - 1)), 1_000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="relative flex items-center justify-center h-32 w-32">
      <svg viewBox="0 0 100 100" className="h-32 w-32 -rotate-90" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="5" />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="#ff2346"
          strokeWidth="5"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="100"
          style={{ animation: `csgn-countdown-ring ${seconds}s linear forwards` }}
        />
      </svg>
      <span className="absolute text-white text-4xl font-black font-display tabular-nums">
        {formatCountdown(remaining)}
      </span>
    </div>
  )
}

/**
 * Full-screen network status card over a dimmed intermission backdrop.
 * `starting-soon`: a slot streamer hasn't gone live yet. Passing `countdownSeconds`
 * switches it to the last-call phase — go live before the count ends or the hour
 * reverts to open-to-claim intermission (the same current time slot).
 * `brb`: a live feed dropped — held for the BRB grace window while the
 * hidden player listens for the streamer's return.
 */
export default function StatusCard({
  variant,
  streamerName,
  slotLabel,
  countdownSeconds,
}: {
  variant: 'starting-soon' | 'brb'
  streamerName?: string
  slotLabel?: string
  /** When set (and > 0) on `starting-soon`, render the last-call countdown. */
  countdownSeconds?: number
}) {
  const isBrb = variant === 'brb'
  const lastCall = !isBrb && typeof countdownSeconds === 'number' && countdownSeconds > 0
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#050507]">
      <IntermissionBoard dimmed />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-7 px-16 py-14 rounded-3xl bg-black/60 border border-white/[0.1] backdrop-blur-xl">
          <CsgnLogo className="h-14 w-auto opacity-90" />

          <div className="flex items-center gap-3">
            <span className={`w-3 h-3 rounded-full animate-live-pulse ${isBrb ? 'bg-gold' : lastCall ? 'bg-[#ff2346]' : 'bg-primary-500'}`} />
            <span className="text-2xl font-black tracking-[0.3em] uppercase text-white">
              {isBrb ? "We'll be right back" : lastCall ? 'Last call to go live' : 'Starting soon'}
            </span>
          </div>

          {lastCall && <CountdownRing seconds={countdownSeconds ?? 0} />}

          <p className="text-xl text-gray-300 text-center max-w-[720px]">
            {isBrb ? (
              <>
                <span className="font-bold text-white">{streamerName || 'The stream'}</span> is reconnecting —
                hang tight, the feed returns automatically.
              </>
            ) : lastCall ? (
              <>
                <span className="font-bold text-white">{streamerName || 'The next streamer'}</span>, go live now —
                when the countdown ends this stage opens for anyone to claim
                {slotLabel ? <span className="font-mono text-primary-300"> · {slotLabel}</span> : null}
              </>
            ) : (
              <>
                <span className="font-bold text-white">{streamerName || 'The next streamer'}</span> goes live shortly
                {slotLabel ? <span className="font-mono text-primary-300"> · {slotLabel}</span> : null}
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
