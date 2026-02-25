import { useState } from 'react'
import { motion } from 'framer-motion'
import { Gavel, Ticket, Crown, Radio, Info } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { LiveIndicator } from '@/components/ui/LiveIndicator'

type SlotType = 'auction' | 'lottery' | 'prime'

interface TimeSlot {
  time: string
  endTime: string
  streamer: string
  type: SlotType
  status: 'past' | 'live' | 'upcoming'
  description?: string
}

const scheduleData: TimeSlot[] = [
  { time: '3:00 AM', endTime: '5:00 AM', streamer: 'Open Slot', type: 'auction', status: 'past' },
  { time: '5:00 AM', endTime: '7:00 AM', streamer: 'EarlyCrypto', type: 'auction', status: 'past', description: 'Morning Market Recap' },
  { time: '7:00 AM', endTime: '9:00 AM', streamer: 'BlockBuilder', type: 'auction', status: 'past', description: 'Solana Dev Talk' },
  { time: '9:00 AM', endTime: '11:00 AM', streamer: 'CryptoKing', type: 'auction', status: 'past', description: 'Token Analysis' },
  { time: '11:00 AM', endTime: '1:00 PM', streamer: 'SolanaSteve', type: 'auction', status: 'live', description: 'Live Trading Session' },
  { time: '1:00 PM', endTime: '2:00 PM', streamer: 'MintMaster', type: 'auction', status: 'upcoming', description: 'NFT Showcase' },
  { time: '2:00 PM', endTime: '3:00 PM', streamer: 'TBA (Lottery)', type: 'lottery', status: 'upcoming' },
  { time: '3:00 PM', endTime: '4:00 PM', streamer: 'TBA (Lottery)', type: 'lottery', status: 'upcoming' },
  { time: '4:00 PM', endTime: '5:00 PM', streamer: 'TBA (Lottery)', type: 'lottery', status: 'upcoming' },
  { time: '5:00 PM', endTime: '6:00 PM', streamer: 'TBA (Lottery)', type: 'lottery', status: 'upcoming' },
  { time: '6:00 PM', endTime: '8:00 PM', streamer: 'CEO Show', type: 'prime', status: 'upcoming', description: 'Crypto Drama Roundup' },
  { time: '8:00 PM', endTime: '10:00 PM', streamer: 'GameTime', type: 'prime', status: 'upcoming', description: 'EA College Football 25' },
  { time: '10:00 PM', endTime: '12:00 AM', streamer: 'NightOwl', type: 'prime', status: 'upcoming', description: 'Late Night Crypto Talk' },
  { time: '12:00 AM', endTime: '3:00 AM', streamer: 'CSGN Reruns', type: 'prime', status: 'upcoming', description: 'Best Of Highlights' },
]

const slotInfo: Record<SlotType, { icon: typeof Gavel; color: string; label: string; time: string; desc: string }> = {
  auction: {
    icon: Gavel,
    color: 'text-cyan-400',
    label: 'Auction Slots',
    time: '3 AM – 2 PM',
    desc: 'Highest bidder wins the time slot. Bids close 1 hour before broadcast.',
  },
  lottery: {
    icon: Ticket,
    color: 'text-accent-400',
    label: 'Lottery Slots',
    time: '2 PM – 6 PM',
    desc: 'Random selection from all entries. Enter by 1:00 PM daily for your chance.',
  },
  prime: {
    icon: Crown,
    color: 'text-gold',
    label: 'Prime Time',
    time: '6 PM – 3 AM',
    desc: 'CEO-curated programming. The flagship block where brand-defining content airs.',
  },
}

export default function Schedule() {
  const [selectedDay, setSelectedDay] = useState(0)
  const days = ['Today', 'Tomorrow', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7']

  return (
    <div className="min-h-screen pt-24 lg:pt-32 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="Schedule"
          title="Broadcast"
          highlight="Schedule"
          description="CSGN runs 24/7 with a structured 3-tier time slot system. Every day, every hour—someone is live."
        />

        {/* Slot Types Explanation */}
        <div className="grid md:grid-cols-3 gap-4 mb-12">
          {(Object.entries(slotInfo) as [SlotType, typeof slotInfo[SlotType]][]).map(([type, info]) => (
            <Card key={type} className="p-5" hover={false}>
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0 ${info.color}`}>
                  <info.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm">{info.label}</h3>
                  <p className="text-xs text-primary-400 font-mono mb-1">{info.time}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{info.desc}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

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
            {scheduleData.map((slot, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className={`flex items-center gap-4 px-4 sm:px-6 py-4 transition-colors ${
                  slot.status === 'live'
                    ? 'bg-primary-500/5 border-l-2 border-l-primary-500'
                    : slot.status === 'past'
                    ? 'opacity-50'
                    : 'hover:bg-white/[0.02]'
                }`}
              >
                {/* Time */}
                <div className="w-20 sm:w-28 shrink-0">
                  <span className="text-sm font-mono text-gray-400">{slot.time}</span>
                  <span className="text-xs text-gray-600 block">to {slot.endTime}</span>
                </div>

                {/* Type indicator */}
                <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0 ${
                  slot.type === 'auction' ? 'text-cyan-400' : slot.type === 'lottery' ? 'text-accent-400' : 'text-gold'
                }`}>
                  {slot.type === 'auction' && <Gavel className="w-4 h-4" />}
                  {slot.type === 'lottery' && <Ticket className="w-4 h-4" />}
                  {slot.type === 'prime' && <Crown className="w-4 h-4" />}
                </div>

                {/* Streamer Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">{slot.streamer}</span>
                    {slot.status === 'live' && <LiveIndicator />}
                  </div>
                  {slot.description && (
                    <span className="text-xs text-gray-500 truncate block">{slot.description}</span>
                  )}
                </div>

                {/* Slot Type Badge */}
                <Badge
                  variant={slot.type === 'prime' ? 'gold' : slot.type === 'lottery' ? 'purple' : 'blue'}
                  className="hidden sm:inline-flex"
                >
                  {slot.type === 'auction' ? 'Auction' : slot.type === 'lottery' ? 'Lottery' : 'Prime Time'}
                </Badge>
              </motion.div>
            ))}
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
