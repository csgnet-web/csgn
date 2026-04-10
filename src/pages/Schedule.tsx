import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Gavel, Crown, Radio, Info } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { LiveIndicator } from '@/components/ui/LiveIndicator'
import { fetchSlots, getMinimumBid, formatCSGN, LAUNCH_DATE_UTC, PHASE_2_END_UTC, type Slot, type SlotType } from '@/lib/slots'

function getSlotPhase(slot: Slot): 'phase1' | 'phase2' | 'later' {
  const start = slot.startTime
  if (start < LAUNCH_DATE_UTC) return 'phase1'
  if (start < PHASE_2_END_UTC) return 'phase2'
  return 'later'
}

function getSlotDisplayStatus(slot: Slot): 'past' | 'live' | 'upcoming' {
  const now = Date.now()
  const start = new Date(slot.startTime).getTime()
  const end = new Date(slot.endTime).getTime()
  if (now >= start && now < end) return 'live'
  if (now >= end) return 'past'
  return 'upcoming'
}

function formatTimeET(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
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

function sortSlotsForDisplay(slots: Slot[], selectedDay: number): Slot[] {
  const nowMs = Date.now()
  const isToday = selectedDay === 0

  const live = slots.find((slot) => {
    const start = new Date(slot.startTime).getTime()
    const end = new Date(slot.endTime).getTime()
    return nowMs >= start && nowMs < end
  })

  const upcoming = slots
    .filter((slot) => new Date(slot.startTime).getTime() > nowMs)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

  if (isToday) return live ? [live, ...upcoming] : upcoming

  return [...slots].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
}

export default function Schedule() {
  const [selectedDay, setSelectedDay] = useState(0)
  const [allActiveSlots, setAllActiveSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)
  const days = useMemo(() => {
    const labels = ['Today', 'Tomorrow']
    for (let i = 2; i <= 6; i++) {
      const d = etMiddayFromOffset(i)
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
  }, [])

  useEffect(() => {
    const loadSlots = async () => {
      setLoading(true)
      const now = new Date()
      const from = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const to = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000)

      try {
        const data = await fetchSlots(from, to)
        const activeOnly = data
          .filter((slot) => new Date(slot.endTime).getTime() >= Date.now())
          .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
        setAllActiveSlots(activeOnly)
      } catch (err) {
        console.warn('Failed to fetch slots from Firestore:', err)
        setAllActiveSlots([])
      }
      setLoading(false)
    }
    loadSlots()
  }, [])

  const slots = useMemo(() => {
    const targetMidday = etMiddayFromOffset(selectedDay)
    const targetKey = etDayKey(targetMidday)
    const daySlots = allActiveSlots.filter((slot) => etDayKey(new Date(slot.startTime)) === targetKey)
    return sortSlotsForDisplay(daySlots, selectedDay)
  }, [allActiveSlots, selectedDay])

  useEffect(() => {
    if (loading || selectedDay !== 0) return
    const todayKey = etDayKey(etMiddayFromOffset(0))
    const hasTodaySlots = allActiveSlots.some((slot) => etDayKey(new Date(slot.startTime)) === todayKey)
    if (hasTodaySlots) return

    const firstDayWithSlots = days.findIndex((_, idx) => {
      const dayKey = etDayKey(etMiddayFromOffset(idx))
      return allActiveSlots.some((slot) => etDayKey(new Date(slot.startTime)) === dayKey)
    })
    if (firstDayWithSlots > 0) setSelectedDay(firstDayWithSlots)
  }, [allActiveSlots, days, loading, selectedDay])

  const typeIcon = (type: SlotType) => {
    if (type === 'auction') return <Gavel className="w-4 h-4" />
    return <Crown className="w-4 h-4" />
  }

  const typeColor = (type: SlotType) => {
    if (type === 'auction') return 'text-cyan-400'
    return 'text-gold'
  }

  const typeLabel = (type: SlotType, slot: Slot) => {
    if (type === 'auction') return slot.assignedName || 'Open for Bidding'
    return slot.assignedName || 'CEO Schedule'
  }

  const emptyLabel = useMemo(() => (selectedDay === 0 ? 'No remaining slots for today.' : 'No slots scheduled for this day yet.'), [selectedDay])

  return (
    <div className="min-h-screen pt-20 lg:pt-24 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
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
        </div>

        <Card hover={false} className="overflow-hidden">
          <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
            <h3 className="font-semibold font-display text-white flex items-center gap-2">
              <Radio className="w-4 h-4 text-primary-400" />
              {days[selectedDay]}'s Schedule
            </h3>
            <Badge variant="blue">All times ET</Badge>
          </div>

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
                const streamerName = typeLabel(slot.type, slot)

                // Show bid link for open auction slots after the pre-launch phase
                const showBidLink = slot.type === 'auction' && slot.status === 'open' && phase !== 'phase1'

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

                    <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 ${typeColor(slot.type)}`}>
                      {typeIcon(slot.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">{streamerName}</span>
                        {displayStatus === 'live' && <LiveIndicator />}
                      </div>
                      {slot.description && <span className="text-xs text-gray-500 truncate block">{slot.description}</span>}
                    </div>

                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      {slot.status === 'pending_deposit' && <Badge variant="gold" className="!text-[9px] !px-1.5 !py-0.5">Awaiting Confirm</Badge>}
                      {slot.status === 'confirmed' && <Badge variant="green" className="!text-[9px] !px-1.5 !py-0.5">Confirmed</Badge>}
                      {showBidLink && (
                        <Link
                          to="/queue"
                          className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-semibold rounded-full border bg-cyan-500/20 text-cyan-300 border-cyan-500/30 hover:bg-cyan-500/30 transition-colors whitespace-nowrap"
                        >
                          {formatCSGN(getMinimumBid(slot.bids.length))}
                        </Link>
                      )}
                      <Badge variant={slot.type === 'ceo' ? 'gold' : 'blue'} className="!text-[9px] !px-1.5 !py-0.5">
                        {slot.type === 'auction' ? 'Auction' : 'CEO Schedule'}
                      </Badge>
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
                  Apply to become a CSGN streamer. Once approved, you can bid on auction slots (3 AM–7 PM ET) using CSGN tokens,
                  or be selected for the CEO Schedule (7 PM–3 AM ET). Streamers earn 30% of pump.fun creator fees during their time slot.
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
