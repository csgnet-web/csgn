/**
 * CSGN brand wipe — the network's transition stinger. Shared by /watch
 * (slot changes) and /player (master-control state changes).
 *
 * One continuous sweep: in from the left, hold center, out to the RIGHT
 * (the `csgn-wipe` keyframes, 1.4s — matching the callers' hide timeout).
 * It mounts fresh per wipe so the animation always starts from the top; the
 * old approach transitioned back out the way it came in, which read as the
 * stinger stuttering or running twice on-stream.
 */
export function WipeOverlay({ visible, label = 'Now Live' }: { visible: boolean; label?: string }) {
  if (!visible) return null
  return (
    <div
      className="csgn-wipe absolute inset-0 z-20 pointer-events-none"
      style={{
        background: 'linear-gradient(135deg, #ff2346 0%, #0a0a14 60%)',
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          {/* CSGN Logo SVG */}
          <svg viewBox="0 0 120 40" className="h-12 w-auto fill-white opacity-90" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="32" fontFamily="system-ui, sans-serif" fontWeight="900" fontSize="38" letterSpacing="2">CSGN</text>
          </svg>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-white/80 text-sm font-bold tracking-[0.2em] uppercase">{label}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
