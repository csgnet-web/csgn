import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useLiveSlot } from '@/contexts/useLiveSlot'
import type { Slot } from '@/lib/slots'

function toMillis(value: unknown): number {
  if (typeof value === 'string' || value instanceof Date || typeof value === 'number') {
    const ms = new Date(value as string | Date | number).getTime()
    return Number.isFinite(ms) ? ms : 0
  }
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: unknown }).toDate === 'function') {
    const ms = (value as { toDate: () => Date }).toDate().getTime()
    return Number.isFinite(ms) ? ms : 0
  }
  return 0
}

function etDayKeyFromMillis(ms: number): string {
  return new Date(ms).toLocaleDateString('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

/* ── Compact time range: "3-5A ET", "1-3P ET", "11P-1A ET" ── */
function formatCompactRange(slot: Pick<Slot, 'startTime' | 'endTime'>): string {
  const parse = (value: unknown) => {
    const formatted = new Date(toMillis(value)).toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      hour12: true,
    })
    const [hour, period] = formatted.split(' ')
    return { hour, p: period.charAt(0) }
  }
  const s = parse(slot.startTime)
  const e = parse(slot.endTime)
  return s.p === e.p ? `${s.hour}-${e.hour}${e.p} ET` : `${s.hour}${s.p}-${e.hour}${e.p} ET`
}

/* ── Schedule card for today's lineup ── */
function TodaySlotCard({ slot, isCurrent }: { slot: Slot; isCurrent: boolean }) {
  const streamer = slot.assignedName || (slot.type === 'auction' ? 'Open Bid' : 'CEO Schedule')
  return (
    <div
      className={`relative rounded-xl overflow-hidden flex flex-col min-h-[89px] sm:min-h-[178px] lg:min-h-[88px] lg:h-[88px] transition-all duration-300 ${
        isCurrent
          ? 'ring-2 ring-red-500 shadow-[0_0_24px_rgba(255,35,70,0.5)]'
          : 'ring-1 ring-white/10 hover:ring-white/20'
      }`}
      style={{
        background: isCurrent
          ? 'linear-gradient(160deg, hsl(350,70%,30%) 0%, hsl(350,60%,12%) 100%)'
          : 'linear-gradient(160deg, hsl(220,70%,20%) 0%, hsl(220,60%,8%) 100%)',
      }}
    >
      <div className="absolute top-2 left-2 z-10">
        {isCurrent ? (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-red-600 rounded-full text-[10px] font-bold text-white uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            LIVE
          </span>
        ) : (
          <span className="px-2 py-0.5 bg-black/40 border border-white/20 rounded-full text-[10px] text-white/70 uppercase tracking-wider">
            UP NEXT
          </span>
        )}
      </div>

      <div className="flex flex-1 items-end justify-center pt-2 sm:pt-6 lg:pt-0.5 pb-0.5 sm:pb-1 lg:pb-0 px-2 sm:px-3 min-h-[48px] sm:min-h-[100px] lg:min-h-[42px]">
        <svg viewBox="0 0 120 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <defs>
            <linearGradient id={`ag${slot.id}`} x1="60" y1="0" x2="60" y2="160" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={isCurrent ? 'hsl(350,80%,65%)' : 'hsl(220,80%,65%)'} stopOpacity="0.85" />
              <stop offset="100%" stopColor={isCurrent ? 'hsl(350,60%,25%)' : 'hsl(220,60%,25%)'} stopOpacity="0.4" />
            </linearGradient>
          </defs>
          <ellipse cx="60" cy="52" rx="26" ry="30" fill={`url(#ag${slot.id})`} />
          <path d="M0 160 C0 110 28 88 60 85 C92 88 120 110 120 160 Z" fill={`url(#ag${slot.id})`} />
        </svg>
      </div>

      <div className="px-2 sm:px-3 lg:px-1 pb-1.5 sm:pb-3 lg:pb-0.5 pt-1 sm:pt-2.5 lg:pt-0 bg-gradient-to-t from-black/80 to-transparent space-y-0.5 sm:space-y-1 lg:space-y-0">
        <p className="text-white font-black font-display text-[10px] sm:text-sm lg:text-[8px] leading-tight break-words">{streamer}</p>
        <p className="text-white/60 text-[9px] sm:text-[11px] lg:text-[7px] leading-snug break-words">{slot.type === 'auction' ? 'Auction Slot' : 'CEO Schedule'}</p>
        <p className="text-white/60 text-[8px] sm:text-[10px] lg:text-[7px] font-mono leading-none whitespace-nowrap">{formatCompactRange(slot)}</p>
      </div>
    </div>
  )
}

/**
 * Collapsible "Today's Schedule" strip with claimable slots and up-next list.
 * Claim handling stays in Watch (needs auth + register-modal flow).
 */
export default function ScheduleStrip({
  claiming,
  onClaimSlot,
}: {
  claiming: boolean
  onClaimSlot: (slot: Slot) => void
}) {
  const { allSlots, nowMs } = useLiveSlot()
  const [isScheduleOpen, setIsScheduleOpen] = useState(false)

  const todaySlots = useMemo(() => {
    const todayKey = etDayKeyFromMillis(nowMs)
    return allSlots
      .filter((slot) => etDayKeyFromMillis(toMillis(slot.startTime)) === todayKey)
      .sort((a, b) => toMillis(a.startTime) - toMillis(b.startTime))
  }, [allSlots, nowMs])

  // Next upcoming slots — look across all days so we always have up to 3
  const upcomingSlots = allSlots.filter((s) => toMillis(s.startTime) > nowMs)

  // For the schedule grid: current slot (if any) + next 2, otherwise next 3
  const currentTodaySlot = todaySlots.find((s) => {
    const start = toMillis(s.startTime)
    const end = toMillis(s.endTime)
    return nowMs >= start && nowMs < end
  })
  const scheduleGridSlots = currentTodaySlot
    ? [currentTodaySlot, ...upcomingSlots.slice(0, 2)]
    : upcomingSlots.slice(0, 3)

  return (
    <div className="shrink-0 px-5 py-5 border-b border-white/[0.06]">
      <button
        type="button"
        className="w-full flex items-center justify-between mb-4"
        onClick={() => setIsScheduleOpen((prev) => !prev)}
        aria-expanded={isScheduleOpen}
      >
        <h2 className="text-xs font-black tracking-[0.25em] uppercase text-gray-400">
          Today's Schedule
        </h2>
        <div className="flex items-center gap-4">
          {upcomingSlots.length > 0 && (
            <div className="text-right space-y-0.5">
              <p className="text-[11px] text-gray-500 uppercase tracking-wider leading-none mb-1">Up Next</p>
              {upcomingSlots.slice(0, 3).map((s) => (
                <p key={s.id} className="text-[10px] font-display font-bold text-white leading-snug whitespace-nowrap">
                  {s.assignedName || (s.type === 'auction' ? 'Open Bid' : 'CEO')}{' '}
                  <span className="font-normal text-gray-400">{formatCompactRange(s)}</span>
                </p>
              ))}
            </div>
          )}
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isScheduleOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isScheduleOpen && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {scheduleGridSlots.map((slot) => {
              const slotStart = toMillis(slot.startTime)
              const slotEnd = toMillis(slot.endTime)
              const isCurrent = nowMs >= slotStart && nowMs < slotEnd
              const claimable = slot.status === 'open' && !slot.assignedUid && slotEnd > nowMs
              return (
                <div key={slot.id} className="flex flex-col gap-1.5">
                  <TodaySlotCard slot={slot} isCurrent={isCurrent} />
                  {claimable && (
                    <button
                      type="button"
                      onClick={() => onClaimSlot(slot)}
                      disabled={claiming}
                      className="flex items-center justify-center w-full text-[10px] font-bold uppercase tracking-wider px-2 py-1 lg:py-0.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-emerald-200 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                    >
                      Take Slot
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          <div className="mt-4 text-center">
            <Link
              to="/schedule"
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all font-medium"
            >
              View Full Schedule <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
