import { useEffect, useMemo, useState } from 'react'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { Radio } from 'lucide-react'
import { db } from '@/config/firebase'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { LiveIndicator } from '@/components/ui/LiveIndicator'
import { type Slot } from '@/lib/slots'

function toMillis(value: unknown): number {
  if (typeof value === 'string' || value instanceof Date || typeof value === 'number') {
    const ms = new Date(value).getTime()
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

function formatTimeET(value: unknown): string {
  return new Date(toMillis(value)).toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function getDisplayStatus(slot: Slot): 'past' | 'live' | 'upcoming' {
  const now = Date.now()
  const start = toMillis(slot.startTime)
  const end = toMillis(slot.endTime)
  if (now >= start && now < end) return 'live'
  if (now >= end) return 'past'
  return 'upcoming'
}

export default function Schedule() {
  const [selectedDay, setSelectedDay] = useState(0)
  const [allSlots, setAllSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)

  const dayOptions = useMemo(() => {
    return Array.from({ length: 7 }, (_, offset) => {
      const date = etMiddayFromOffset(offset)
      return {
        offset,
        key: etDayKeyFromMillis(date.getTime()),
        label: offset === 0
          ? 'Today'
          : offset === 1
            ? 'Tomorrow'
            : date.toLocaleDateString('en-US', {
              timeZone: 'America/New_York',
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            }),
      }
    })
  }, [])

  useEffect(() => {
    const slotsQuery = query(collection(db, 'slots'), orderBy('startTime', 'asc'))
    const unsub = onSnapshot(slotsQuery, (snap) => {
      const data = snap.docs
        .map((doc) => doc.data() as Slot)
        .filter((slot) => toMillis(slot.startTime) > 0 && toMillis(slot.endTime) > 0)
        .sort((a, b) => toMillis(a.startTime) - toMillis(b.startTime))
      setAllSlots(data)
      setLoading(false)
    }, () => {
      setAllSlots([])
      setLoading(false)
    })

    return () => unsub()
  }, [])

  const selectedDayKey = dayOptions[selectedDay]?.key
  const slots = useMemo(
    () => allSlots.filter((slot) => etDayKeyFromMillis(toMillis(slot.startTime)) === selectedDayKey),
    [allSlots, selectedDayKey],
  )

  return (
    <div className="min-h-screen pt-20 lg:pt-24 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
          {dayOptions.map((day) => (
            <button
              key={day.key}
              onClick={() => setSelectedDay(day.offset)}
              className={`px-4 py-2 text-sm font-medium rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                selectedDay === day.offset
                  ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              {day.label}
            </button>
          ))}
        </div>

        <Card hover={false} className="overflow-hidden">
          <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
            <h3 className="font-semibold font-display text-white flex items-center gap-2">
              <Radio className="w-4 h-4 text-primary-400" />
              {dayOptions[selectedDay]?.label}'s Schedule
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
                <p className="text-sm text-gray-500">No slots scheduled for this day yet.</p>
              </div>
            ) : (
              slots.map((slot) => {
                const status = getDisplayStatus(slot)
                const displayName = slot.assignedName || 'Unassigned'
                const displayTitle = slot.streamTitle || slot.description || 'Untitled stream'

                return (
                  <div
                    key={slot.id}
                    className={`flex items-center gap-4 px-4 sm:px-6 py-4 transition-colors ${
                      status === 'live'
                        ? 'bg-primary-500/5 border-l-2 border-l-primary-500'
                        : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <div className="w-20 sm:w-28 shrink-0">
                      <span className="text-sm font-mono text-gray-400">{formatTimeET(slot.startTime)}</span>
                      <span className="text-xs text-gray-600 block">to {formatTimeET(slot.endTime)}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">{displayName}</span>
                        {status === 'live' && <LiveIndicator />}
                      </div>
                      <p className="text-xs text-gray-500 truncate">{displayTitle}</p>
                    </div>

                    <Badge variant={slot.type === 'ceo' ? 'gold' : 'blue'} className="!text-[9px] !px-1.5 !py-0.5">
                      {slot.type === 'auction' ? 'Auction' : 'CEO'}
                    </Badge>
                  </div>
                )
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
