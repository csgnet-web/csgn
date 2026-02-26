import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Gavel, Ticket, Crown, Radio, Info } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { LiveIndicator } from '@/components/ui/LiveIndicator'
import { fetchSlots, type Slot, type SlotType } from '@/lib/slots'

function getSlotDisplayStatus(slot: Slot): 'past' | 'live' | 'upcoming' {
  const now = Date.now()
  const start = new Date(slot.startTime).getTime()
  const end = new Date(slot.endTime).getTime()
  if (now >= start && now < end) return 'live'
  if (now >= end) return 'past'
  return 'upcoming'
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export default function Schedule() {
  const [selectedDay, setSelectedDay] = useState(0)
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)
  const days = ['Today', 'Tomorrow', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7']

  useEffect(() => {
    const loadSlots = async () => {
      setLoading(true)
      const from = new Date()
      from.setHours(0, 0, 0, 0)
      from.setDate(from.getDate() + selectedDay)

      const to = new Date(from)
      to.setDate(to.getDate() + 1)
      to.setHours(23, 59, 59, 999)

      try {
        const data = await fetchSlots(from, to)
        setSlots(data)
      } catch (err) {
        console.warn('Failed to fetch slots from Firestore:', err)
        setSlots([])
      }
      setLoading(false)
    }
    loadSlots()
  }, [selectedDay])

  const typeIcon = (type: SlotType) => {
    if (type === 'auction') return <Gavel className="w-4 h-4" />
    if (type === 'lottery') return <Ticket className="w-4 h-4" />
    return <Crown className="w-4 h-4" />
  }

  const typeColor = (type: SlotType) => {
    if (type === 'auction') return 'text-cyan-400'
    if (type === 'lottery') return 'text-accent-400'
    return 'text-gold'
  }

  return (
    <div className="min-h-screen pt-24 lg:pt-32 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="Schedule"
          title="Broadcast"
          highlight="Schedule"
          description="CSGN runs 24/7 with a structured 3-tier time slot system. Every day, every hour — someone is live."
        />

        {/* Day Selector */}
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

        {/* Schedule Grid */}
        <Card hover={false} className="overflow-hidden">
          <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
            <h3 className="font-semibold font-display text-white flex items-center gap-2">
              <Radio className="w-4 h-4 text-primary-400" />
              {days[selectedDay]}'s Schedule
            </h3>
            <Badge variant="blue">All times EST</Badge>
          </div>

          <div className="divide-y divide-white/[0.04]">
            {loading ? (
              <div className="py-16 text-center">
                <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-500">Loading schedule...</p>
              </div>
            ) : slots.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm text-gray-500">No slots scheduled for this day yet.</p>
                <p className="text-xs text-gray-600 mt-1">Slots are generated 24 hours ahead of time by the admin.</p>
              </div>
            ) : (
              slots.map((slot, i) => {
                const displayStatus = getSlotDisplayStatus(slot)
                const streamerName = slot.assignedName || (slot.type === 'lottery' ? 'TBA (Lottery)' : slot.type === 'auction' ? 'Open for Bidding' : 'TBA')

                return (
                  <motion.div
                    key={slot.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className={`flex items-center gap-4 px-4 sm:px-6 py-4 transition-colors ${
                      displayStatus === 'live'
                        ? 'bg-primary-500/5 border-l-2 border-l-primary-500'
                        : displayStatus === 'past'
                        ? 'opacity-50'
                        : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    {/* Time */}
                    <div className="w-20 sm:w-28 shrink-0">
                      <span className="text-sm font-mono text-gray-400">{formatTime(slot.startTime)}</span>
                      <span className="text-xs text-gray-600 block">to {formatTime(slot.endTime)}</span>
                    </div>

                    {/* Type indicator */}
                    <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 ${typeColor(slot.type)}`}>
                      {typeIcon(slot.type)}
                    </div>

                    {/* Streamer Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">{streamerName}</span>
                        {displayStatus === 'live' && <LiveIndicator />}
                      </div>
                      {slot.description && (
                        <span className="text-xs text-gray-500 truncate block">{slot.description}</span>
                      )}
                      {slot.type === 'auction' && slot.bids.length > 0 && displayStatus === 'upcoming' && (
                        <span className="text-xs text-cyan-400/70">{slot.bids.length} bid{slot.bids.length !== 1 ? 's' : ''}</span>
                      )}
                      {slot.type === 'lottery' && slot.lotteryEntrants.length > 0 && displayStatus === 'upcoming' && (
                        <span className="text-xs text-accent-400/70">{slot.lotteryEntrants.length} entr{slot.lotteryEntrants.length !== 1 ? 'ies' : 'y'}</span>
                      )}
                    </div>

                    {/* Status / Type Badge */}
                    <div className="flex items-center gap-2">
                      {slot.status === 'pending_deposit' && <Badge variant="gold">Awaiting Deposit</Badge>}
                      {slot.status === 'confirmed' && <Badge variant="green">Confirmed</Badge>}
                      <Badge
                        variant={slot.type === 'prime' ? 'gold' : slot.type === 'lottery' ? 'purple' : 'blue'}
                        className="hidden sm:inline-flex"
                      >
                        {slot.type === 'auction' ? 'Auction' : slot.type === 'lottery' ? 'Lottery' : 'Prime Time'}
                      </Badge>
                    </div>
                  </motion.div>
                )
              })
            )}
          </div>
        </Card>

        {/* Info Banner */}
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
                  Apply to become a CSGN streamer. Once approved, you can bid on auction slots, enter the daily lottery,
                  or be selected for prime time. Streamers earn 50% of all token trading fees during their time slot.
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
