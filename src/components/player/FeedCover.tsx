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
 */
export default function FeedCover({
  label = 'CSGN 24/7',
  streamerName,
  slotLabel,
}: {
  label?: string
  streamerName?: string
  slotLabel?: string
}) {
  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #ff2346 0%, #0a0a14 60%)' }}
    >
      <div className="flex flex-col items-center gap-3">
        <svg viewBox="0 0 120 40" className="h-14 w-auto fill-white opacity-95" xmlns="http://www.w3.org/2000/svg">
          <text x="0" y="32" fontFamily="system-ui, sans-serif" fontWeight="900" fontSize="38" letterSpacing="2">CSGN</text>
        </svg>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span className="text-white/80 text-sm font-bold tracking-[0.2em] uppercase">{label}</span>
        </div>
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
