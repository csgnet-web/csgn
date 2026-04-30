import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Crown, Radio, Info, ChevronLeft, ChevronRight } from 'lucide-react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { LiveIndicator } from '@/components/ui/LiveIndicator'
import { claimOpenSlot, LAUNCH_DATE_UTC, PHASE_2_END_UTC, type Slot } from '@/lib/slots'
import { startFeeTracker } from '@/lib/dexscreener'
import { useAuth } from '@/contexts/AuthContext'
const WEEK_SPAN = 7

function toMillis(value: unknown): number {
  if (typeof value === 'string' || value instanceof Date || typeof value === 'number') {
    const ms = new Date(value).getTime()
    return Number.isFinite(ms) ? ms : 0
  }

  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: unknown }).toDate === 'function') {
    const dt = (value as { toDate: () => Date }).toDate()
    const ms = dt.getTime()
    return Number.isFinite(ms) ? ms : 0
  }

  return 0
}

function toDate(value: unknown): Date {
  return new Date(toMillis(value))
}

function getSlotPhase(slot: Slot): 'phase1' | 'phase2' | 'later' {
  const start = toDate(slot.startTime).toISOString()
  if (start < LAUNCH_DATE_UTC) return 'phase1'
  if (start < PHASE_2_END_UTC) return 'phase2'
  return 'later'
}

function getSlotDisplayStatus(slot: Slot): 'past' | 'live' | 'upcoming' {
  const now = Date.now()
  const start = toMillis(slot.startTime)
  const end = toMillis(slot.endTime)
  if (now >= start && now < end) return 'live'
  if (now >= end) return 'past'
  return 'upcoming'
}

function formatTimeET(value: unknown): string {
  return toDate(value).toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function etDayKey(date: Date): string {
  return date.toLocaleDateString('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function etMiddayFromOffset(offset: number): Date {
  const now = new Date()
  const nyParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now)

  const get = (type: string) => Number(nyParts.find((p) => p.type === type)?.value || '0')
  const base = new Date(Date.UTC(get('year'), get('month') - 1, get('day'), 12, 0, 0, 0))
  base.setUTCDate(base.getUTCDate() + offset)
  return base
}

export default function Schedule() {
  const { user, profile } = useAuth()
  const [selectedDay, setSelectedDay] = useState(0)
  const [weekOffset, setWeekOffset] = useState(0)
  const [allSlots, setAllSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)
  const [liveSlotFeeSOL, setLiveSlotFeeSOL] = useState<Record<string, number>>({})
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [claimError, setClaimError] = useState('')

  const twitchHandle = profile?.twitchUsername || profile?.socialLinks?.twitch || ''

  const handleClaim = async (slot: Slot) => {
    if (!user || !profile || !twitchHandle) return
    setClaimingId(slot.id)
    setClaimError('')
    try {
      await claimOpenSlot(slot.id, {
        uid: user.uid,
        displayName: profile.displayName || twitchHandle,
        twitchUsername: twitchHandle,
      })
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : 'Could not claim slot.')
    } finally {
      setClaimingId(null)
    }
  }
  const days = useMemo(() => {
    const labels: string[] = []
    for (let i = 0; i < WEEK_SPAN; i++) {
      const absoluteOffset = weekOffset * WEEK_SPAN + i
      const d = etMiddayFromOffset(absoluteOffset)
      if (absoluteOffset === 0) {
        labels.push('Today')
        continue
      }
      if (absoluteOffset === 1) {
        labels.push('Tomorrow')
        continue
      }
      labels.push(
        d.toLocaleDateString('en-US', {
          timeZone: 'America/New_York',
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        }),
      )
    }
    return labels
  }, [weekOffset])

  useEffect(() => {
    setLoading(true)
    const slotsQuery = query(collection(db, 'slots'), orderBy('startTime', 'asc'))
    const unsub = onSnapshot(
      slotsQuery,
      (snap) => {
        const from = etMiddayFromOffset(-1).getTime()
        const to = etMiddayFromOffset(8).getTime()
        const normalized = snap.docs
          .map((d) => d.data() as Slot)
          .filter((slot) => toMillis(slot.startTime) > 0 && toMillis(slot.endTime) > 0)
          .filter((slot) => {
            const start = toMillis(slot.startTime)
            return start >= from && start <= to
          })
          .sort((a, b) => toMillis(a.startTime) - toMillis(b.startTime))
        setAllSlots(normalized)
        setLoading(false)
      },
      (err) => {
        console.warn('Failed to subscribe to slots from Firestore:', err)
        setAllSlots([])
        setLoading(false)
      },
    )
    return () => unsub()
  }, [])

  const slots = useMemo(() => {
    const targetMidday = etMiddayFromOffset(weekOffset * WEEK_SPAN + selectedDay)
    const targetKey = etDayKey(targetMidday)
    return allSlots
      .filter((slot) => etDayKey(toDate(slot.startTime)) === targetKey)
      .sort((a, b) => toMillis(a.startTime) - toMillis(b.startTime))
  }, [allSlots, selectedDay, weekOffset])

  const activeLiveSlot = useMemo(
    () => allSlots.find((slot) => getSlotDisplayStatus(slot) === 'live') ?? null,
    [allSlots],
  )

  useEffect(() => {
    if (!activeLiveSlot) return
    const stop = startFeeTracker({
      slotId: activeLiveSlot.id,
      slotStartTime: activeLiveSlot.startTime,
      slotEndTime: activeLiveSlot.endTime,
      onUpdate: (feeSOL) => {
        setLiveSlotFeeSOL((prev) => ({ ...prev, [activeLiveSlot.id]: feeSOL }))
      },
    })
    return stop
  }, [activeLiveSlot?.id])

  useEffect(() => {
    if (loading || selectedDay !== 0) return
    const todayKey = etDayKey(etMiddayFromOffset(0))
    const hasTodaySlots = allSlots.some((slot) => etDayKey(toDate(slot.startTime)) === todayKey)
    if (hasTodaySlots) return

    const firstDayWithSlots = days.findIndex((_, idx) => {
      const dayKey = etDayKey(etMiddayFromOffset(idx))
      return allSlots.some((slot) => etDayKey(toDate(slot.startTime)) === dayKey)
    })
    if (firstDayWithSlots > 0) setSelectedDay(firstDayWithSlots)
  }, [allSlots, days, loading, selectedDay])

  const typeIcon = () => <Crown className="w-4 h-4" />
  const typeLabel = (slot: Slot) => (slot.status === 'open' && !slot.assignedName ? 'Empty Slot' : (slot.assignedName || 'CEO Creator'))

  const emptyLabel = useMemo(() => (selectedDay === 0 ? 'No slots found for today.' : 'No slots scheduled for this day yet.'), [selectedDay])

  return (
    <div className="min-h-screen pt-20 lg:pt-24 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
          <button
            onClick={() => {
              setWeekOffset((prev) => prev - 1)
              setSelectedDay(0)
            }}
            className="px-3 py-2 text-gray-300 hover:text-white border border-white/10 rounded-xl"
            aria-label="Previous week"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          {days.map((day, i) => (
            <button
              key={day}
              onClick={() => setSelectedDay(i)}
              className={`px-4 py-2 text-sm font-medium rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                selectedDay === i
                  ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              {day}
            </button>
          ))}
          <button
            onClick={() => {
              setWeekOffset((prev) => prev + 1)
              setSelectedDay(0)
            }}
            className="px-3 py-2 text-gray-300 hover:text-white border border-white/10 rounded-xl"
            aria-label="Next week"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <Card hover={false} className="overflow-hidden">
          <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
            <h3 className="font-semibold font-display text-white flex items-center gap-2">
              <Radio className="w-4 h-4 text-primary-400" />
              {days[selectedDay]}'s Schedule
            </h3>
            <Badge variant="blue">All times ET</Badge>
          </div>
          {claimError && (
            <div className="px-4 py-2 text-xs text-red-300 bg-red-500/5 border-b border-red-500/20">{claimError}</div>
          )}

          <div className="divide-y divide-white/[0.04]">
            {loading ? (
              <div className="py-16 text-center">
                <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-500">Loading schedule...</p>
              </div>
            ) : slots.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm text-gray-500">{emptyLabel}</p>
                <p className="text-xs text-gray-600 mt-1">Slots follow fixed ET rules and are kept in canonical order.</p>
              </div>
            ) : (
              slots.map((slot, i) => {
                const displayStatus = getSlotDisplayStatus(slot)
                const phase = getSlotPhase(slot)
                const streamerName = typeLabel(slot)
                const isEmptyOpenSlot = slot.status === 'open' && !slot.assignedName && !slot.streamUrl
                const streamerFeeSOL = liveSlotFeeSOL[slot.id] ?? slot.creatorFees?.feeOwedSOL ?? 0
                const feeLabel = streamerFeeSOL > 0 ? `${streamerFeeSOL.toFixed(6)} SOL` : '—'

                const showBidLink = slot.status === 'open' && phase !== 'phase1'

                return (
                  <motion.div
                    key={slot.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className={`flex items-center gap-4 px-4 sm:px-6 py-4 transition-colors ${
                      displayStatus === 'live'
                        ? 'bg-primary-500/5 border-l-2 border-l-primary-500'
                        : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <div className="w-20 sm:w-28 shrink-0">
                      <span className="text-sm font-mono text-gray-400">{formatTimeET(slot.startTime)}</span>
                      <span className="text-xs text-gray-600 block">to {formatTimeET(slot.endTime)}</span>
                    </div>

                    <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 ${isEmptyOpenSlot ? 'text-gray-500' : 'text-gold'}`}>
                      {typeIcon()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium truncate ${isEmptyOpenSlot ? 'text-gray-400' : 'text-white'}`}>{streamerName}</span>
                        {displayStatus === 'live' && <LiveIndicator />}
                      </div>
                      {slot.description && <span className="text-xs text-gray-500 truncate block">{slot.description}</span>}
                      <span className="text-[11px] text-cyan-300 block mt-0.5">Streamer fee: {feeLabel}</span>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {slot.status === 'pending_deposit' && <Badge variant="gold" className="!text-[9px] !px-1.5 !py-0.5">Awaiting Confirm</Badge>}
                      {slot.status === 'confirmed' && <Badge variant="green" className="!text-[9px] !px-1.5 !py-0.5">Confirmed</Badge>}
                      {showBidLink && (
                        <Badge variant="purple" className="!text-[9px] !px-1.5 !py-0.5">Bidding: Coming Soon</Badge>
                      )}
                      <Badge variant={isEmptyOpenSlot ? 'default' : 'gold'} className="!text-[9px] !px-1.5 !py-0.5">
                        {isEmptyOpenSlot ? 'Empty Slot' : 'CEO Creator'}
                      </Badge>
                      {slot.status === 'open' && !slot.assignedUid && displayStatus !== 'past' && user && twitchHandle && (
                        <button
                          type="button"
                          onClick={() => void handleClaim(slot)}
                          disabled={claimingId === slot.id}
                          className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-emerald-200 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                        >
                          {claimingId === slot.id ? 'Claiming…' : 'Take Slot'}
                        </button>
                      )}
                    </div>
                  </motion.div>
                )
              })
            )}
          </div>
        </Card>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-8"
        >
          <Card hover={false} className="p-6 bg-primary-500/5 border-primary-500/20">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center shrink-0">
                <Info className="w-5 h-5 text-primary-400" />
              </div>
              <div>
                <h4 className="font-semibold text-white mb-1">Want to be on the schedule?</h4>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Apply to become a CSGN streamer. All calendar slots are currently CEO Creator type, and bidding UI is marked as coming soon.
                  Streamers earn a performance-based share based on the active fee schedule.
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
