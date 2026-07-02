import { ExternalLink } from 'lucide-react'
import { useLiveSlot } from '@/contexts/useLiveSlot'
import { formatESTRange } from '@/lib/slots'
import { X_HANDLE, X_PROFILE_URL } from '@/lib/social'

function toMillis(value: unknown): number {
  if (typeof value === 'string' || value instanceof Date || typeof value === 'number') {
    const ms = new Date(value as string | Date | number).getTime()
    return Number.isFinite(ms) ? ms : 0
  }
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().getTime()
  }
  return 0
}

/**
 * Branded stage shown when no X broadcast URL is set (stream offline /
 * between OBS sessions). Points viewers at the @CSGNet X profile and
 * surfaces the next scheduled slot.
 */
export default function OfflinePanel() {
  const { allSlots, currentSlot, nowMs } = useLiveSlot()
  const nextSlot = allSlots.find((s) => toMillis(s.startTime) > nowMs) ?? null
  const upNow = currentSlot?.assignedName

  return (
    <div className="w-full max-w-[550px] rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-12 flex flex-col items-center gap-5 text-center">
      <div className="flex flex-col items-center gap-3">
        <svg viewBox="0 0 120 40" className="h-10 w-auto fill-white opacity-90" xmlns="http://www.w3.org/2000/svg">
          <text x="0" y="32" fontFamily="system-ui, sans-serif" fontWeight="900" fontSize="38" letterSpacing="2">CSGN</text>
        </svg>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary-500 animate-live-pulse" />
          <span className="text-white/80 text-sm font-bold tracking-[0.2em] uppercase">Stream starting soon</span>
        </div>
      </div>

      <p className="text-sm text-gray-400 max-w-[380px]">
        The 24/7 broadcast runs on X. Follow{' '}
        <a href={X_PROFILE_URL} target="_blank" rel="noopener noreferrer" className="text-white font-semibold hover:text-primary-300 transition-colors">
          @{X_HANDLE}
        </a>{' '}
        to catch the feed the moment it goes live.
      </p>

      {(upNow || nextSlot) && (
        <div className="text-[11px] uppercase tracking-[0.2em] text-gray-500">
          {upNow ? (
            <>On the schedule now: <span className="text-gray-300 font-bold">{upNow}</span></>
          ) : nextSlot ? (
            <>Up next: <span className="text-gray-300 font-bold">{nextSlot.assignedName || (nextSlot.type === 'auction' ? 'Open Bid' : 'CEO Schedule')}</span>{' '}<span className="font-mono normal-case">{formatESTRange(nextSlot)}</span></>
          ) : null}
        </div>
      )}

      <a
        href={X_PROFILE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-gray-200 text-black rounded-lg text-sm font-black uppercase tracking-wider transition-colors"
      >
        Open @{X_HANDLE} on X <ExternalLink className="w-4 h-4" />
      </a>
    </div>
  )
}
