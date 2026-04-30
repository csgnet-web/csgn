import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Clock3, Crown, ChevronLeft, ChevronRight, Radio } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { claimOpenSlot, fetchSlots, type Slot } from '@/lib/slots'

const WEEK_SPAN = 7

function formatDate(date: Date) {
  return date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }) + ' ET'
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
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || '0')
  const base = new Date(Date.UTC(get('year'), get('month') - 1, get('day'), 12, 0, 0, 0))
  base.setUTCDate(base.getUTCDate() + offset)
  return base
}

export default function Queue() {
  const { user, profile } = useAuth()
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedDay, setSelectedDay] = useState(0)
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [claimError, setClaimError] = useState('')

  const twitchHandle = profile?.twitchUsername || profile?.socialLinks?.twitch || ''

  const loadSlots = useCallback(async () => {
    const now = new Date()
    const future = new Date(now.getTime() + 370 * 24 * 60 * 60 * 1000)
    try {
      const data = await fetchSlots(now, future)
      setSlots(data)
    } catch (err) {
      console.warn('Failed to fetch slots:', err)
    }
    setLoading(false)
  }, [])

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
      await loadSlots()
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : 'Could not claim slot.')
    } finally {
      setClaimingId(null)
    }
  }

  useEffect(() => {
    loadSlots()
  }, [loadSlots])

  const dayLabels = useMemo(() => {
    const labels: string[] = []
    for (let i = 0; i < WEEK_SPAN; i++) {
      const absoluteOffset = weekOffset * WEEK_SPAN + i
      const d = etMiddayFromOffset(absoluteOffset)
      if (absoluteOffset === 0) {
        labels.push('Today')
      } else if (absoluteOffset === 1) {
        labels.push('Tomorrow')
      } else {
        labels.push(
          d.toLocaleDateString('en-US', {
            timeZone: 'America/New_York',
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          }),
        )
      }
    }
    return labels
  }, [weekOffset])

  const selectedAbsoluteOffset = weekOffset * WEEK_SPAN + selectedDay
  const selectedDayKey = etDayKey(etMiddayFromOffset(selectedAbsoluteOffset))
  const selectedDaySlots = slots
    .filter((s) => etDayKey(new Date(s.startTime)) === selectedDayKey)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

  return (
    <div className="min-h-screen pt-20 lg:pt-24 pb-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">

        <div className="flex items-center gap-2 overflow-x-auto pb-2">
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
          {dayLabels.map((day, i) => (
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

        <Card hover={false} className="p-5 bg-white/5 border-red-500/20">
          <h1 className="text-3xl font-display font-bold text-white">Queue</h1>
          <p className="text-sm text-gray-400 mt-1">
            All slots are currently CEO Creator type. Bidding is visible but temporarily disabled.
          </p>
          <p className="text-xs text-amber-300 mt-2">
            {user ? 'Bidding: Coming Soon.' : 'Sign in for account features. Bidding: Coming Soon.'}
          </p>
          {profile?.role === 'streamer' ? (
            <p className="text-xs text-cyan-300 mt-1">Streamer account detected: you can apply/request slots here as this feature rolls out.</p>
          ) : (
            <p className="text-xs text-gray-400 mt-1">Want to stream? <Link to="/apply" className="text-primary-400 hover:text-primary-300">Apply for streamer access</Link>.</p>
          )}
        </Card>

        {loading ? (
          <div className="py-16 text-center">
            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Loading available slots...</p>
          </div>
        ) : (
          <Card hover={false} className="p-5 space-y-4">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <Crown className="w-4 h-4 text-yellow-400" /> CEO Creator Slots
              <span className="text-xs text-gray-500 font-normal">12 per day</span>
            </h2>
            {selectedDaySlots.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">No slots found for this day yet.</p>
            ) : (
              <div className="space-y-3">
                {claimError && (
                  <div className="text-xs text-red-300 bg-red-500/5 border border-red-500/20 rounded-lg p-2">{claimError}</div>
                )}
                {selectedDaySlots.map((slot) => {
                  const isOpen = slot.status === 'open' && !slot.assignedUid
                  const isPast = new Date(slot.endTime).getTime() <= Date.now()
                  return (
                    <div key={slot.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-white font-medium">{slot.assignedName ? `${slot.assignedName} · ${slot.label}` : slot.label}</p>
                          <p className="text-xs text-gray-500">
                            <Clock3 className="w-3 h-3 inline mr-1" />
                            Airs {formatDate(new Date(slot.startTime))}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {isOpen && !isPast && user && twitchHandle && (
                            <button
                              type="button"
                              onClick={() => void handleClaim(slot)}
                              disabled={claimingId === slot.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-emerald-200 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                            >
                              <Radio className="w-3 h-3" />
                              {claimingId === slot.id ? 'Claiming…' : 'Take Slot'}
                            </button>
                          )}
                          {isOpen ? (
                            <Badge variant="default">Open</Badge>
                          ) : (
                            <Badge variant="gold">CEO Creator</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}
