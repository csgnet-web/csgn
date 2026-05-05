import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Radio, Info } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { subscribeToSlots, type Slot } from '@/lib/slots'
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
  const hourET = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    hour12: false,
  }).format(now))
  const dayOffset = hourET < 1 ? -1 : 0
  const base = new Date(Date.UTC(get('year'), get('month') - 1, get('day') + dayOffset, 12, 0, 0, 0))
  base.setUTCDate(base.getUTCDate() + offset)
  return base
}

export default function Schedule() {
  useAuth()
  const [allSlots, setAllSlots] = useState<Slot[]>([])
  const days = useMemo(() => {
    const labels: string[] = []
    for (let i = 0; i < WEEK_SPAN; i++) {
      const absoluteOffset = i
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
  }, [])

  useEffect(() => {
    const fromDate = etMiddayFromOffset(-1)
    const toDate = etMiddayFromOffset(8)
    const unsub = subscribeToSlots(fromDate, toDate, (slots) => {
      const normalized = slots
        .filter((slot) => toMillis(slot.startTime) > 0 && toMillis(slot.endTime) > 0)
        .sort((a, b) => toMillis(a.startTime) - toMillis(b.startTime))
      setAllSlots(normalized)
    })
    return unsub
  }, [])

  const typeLabel = (slot: Slot) => (slot.status === 'open' && !slot.assignedName ? 'Empty Slot' : (slot.assignedName || 'CEO Creator'))

  const slotsByDay = useMemo(() => days.map((_, i) => {
  const key = etDayKey(etMiddayFromOffset(i))
  return allSlots.filter((slot) => etDayKey(toDate(slot.startTime)) === key).sort((a, b) => toMillis(a.startTime) - toMillis(b.startTime))
}), [allSlots, days])

  return (
    <div className="min-h-screen pt-20 lg:pt-24 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Card hover={false} className="overflow-hidden">
          <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
            <h3 className="font-semibold font-display text-white flex items-center gap-2"><Radio className="w-4 h-4 text-primary-400" /> Schedule</h3>
            <Badge variant="blue">All times ET</Badge>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[980px] grid grid-cols-7 divide-x divide-white/[0.06]">
              {days.map((day, dayIdx) => (
                <div key={day} className="min-h-[420px]">
                  <div className="px-3 py-2 border-b border-white/[0.06] text-xs font-semibold text-gray-300 sticky top-0 bg-[#0b0b18]">{day}</div>
                  <div className="divide-y divide-white/[0.04]">
                    {(slotsByDay[dayIdx] || []).map((slot) => {
                      const displayStatus = getSlotDisplayStatus(slot)
                      const streamerName = typeLabel(slot)
                      const feeSOL = slot.creatorFees?.feeOwedSOL ?? 0
                      return <div key={slot.id} className={`px-3 py-2 text-xs ${displayStatus==='live' ? 'bg-primary-500/8' : ''}`}>
                        <p className="font-mono text-gray-400">{formatTimeET(slot.startTime)} - {formatTimeET(slot.endTime)}</p>
                        <p className="text-white truncate">{streamerName}</p>
                        <p className="text-cyan-300">{feeSOL > 0 ? `${feeSOL.toFixed(4)} SOL` : '—'}</p>
                      </div>
                    })}
                  </div>
                </div>
              ))}
            </div>
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
