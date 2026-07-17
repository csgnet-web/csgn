import IntermissionBoard from './IntermissionBoard'
import { CsgnLogo } from '@/components/ui/CsgnLogo'

/**
 * Full-screen network status card over a dimmed intermission backdrop.
 * `starting-soon`: a slot streamer hasn't gone live yet.
 * `brb`: a live feed dropped — held for the BRB grace window while the
 * hidden player listens for the streamer's return.
 */
export default function StatusCard({
  variant,
  streamerName,
  slotLabel,
}: {
  variant: 'starting-soon' | 'brb'
  streamerName?: string
  slotLabel?: string
}) {
  const isBrb = variant === 'brb'
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#050507]">
      <IntermissionBoard dimmed />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-7 px-16 py-14 rounded-3xl bg-black/60 border border-white/[0.1] backdrop-blur-xl">
          <CsgnLogo className="h-14 w-auto opacity-90" />

          <div className="flex items-center gap-3">
            <span className={`w-3 h-3 rounded-full animate-live-pulse ${isBrb ? 'bg-gold' : 'bg-primary-500'}`} />
            <span className="text-2xl font-black tracking-[0.3em] uppercase text-white">
              {isBrb ? "We'll be right back" : 'Starting soon'}
            </span>
          </div>

          <p className="text-xl text-gray-300 text-center max-w-[700px]">
            {isBrb ? (
              <>
                <span className="font-bold text-white">{streamerName || 'The stream'}</span> is reconnecting —
                hang tight, the feed returns automatically.
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
