import { useState, useEffect, useCallback, useMemo } from 'react'
import { Clock3, Crown, ChevronLeft, ChevronRight, Radio } from 'lucide-react'
import { useAuth } from '@/contexts/useAuth'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { fetchSlots, isCeoCreator, type Slot } from '@/lib/slots'
import { api } from '@/lib/api'

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


  const loadSlots = useCallback(async () => {
    // Fetch only the displayed week (~90 docs, was a fixed 28-day scan);
    // changing weekOffset re-creates this callback and refetches. `from`
    // never reaches back before now, matching the old future-only behavior.
    setLoading(true)
    const weekStart = etMiddayFromOffset(weekOffset * WEEK_SPAN)
    const windowStart = new Date(weekStart.getTime() - 24 * 60 * 60 * 1000)
    const from = windowStart.getTime() > Date.now() ? windowStart : new Date()
    const to = etMiddayFromOffset(weekOffset * WEEK_SPAN + WEEK_SPAN)
    try {
      const data = await fetchSlots(from, to, 120)
      setSlots(data)
    } catch (err) {
      console.warn('Failed to fetch slots:', err)
    }
    setLoading(false)
  }, [weekOffset])

  const handleClaim = useCallback(async (slot: Slot) => {
    if (!user || !profile) {
      localStorage.setItem('pendingClaimSlotId', slot.id)
      window.dispatchEvent(new Event('csgn:openRegister'))
      return
    }
    setClaimingId(slot.id)
    setClaimError('')
    try {
      await api.claimSlot(slot.id)
      await loadSlots()
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : 'Could not claim slot.')
    } finally {
      setClaimingId(null)
    }
  }, [loadSlots, profile, user])

  useEffect(() => {
    loadSlots()
  }, [loadSlots])

  useEffect(() => {
    if (!user || !profile) return
    const pending = localStorage.getItem('pendingClaimSlotId')
    if (!pending || claimingId) return
    const slot = slots.find((item) => item.id === pending)
    if (!slot) return
    localStorage.removeItem('pendingClaimSlotId')
    void handleClaim(slot)
  }, [user, profile, slots, claimingId, handleClaim])

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
            Open slots can be claimed by verified CSGN accounts. Bidding is not part of v1.
          </p>
          <p className="text-xs text-amber-300 mt-2">
            {user ? 'Verified accounts can claim up to two future/live slots.' : 'Take Slot will open registration and resume your claim after signup.'}
          </p>
          <p className="text-xs text-gray-400 mt-1">Registration requires Firebase email/password, verified Phantom, and verified Twitch.</p>
        </Card>

        {loading ? (
          <div className="py-16 text-center">
            <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Loading available slots...</p>
          </div>
        ) : (
          <Card hover={false} className="p-5 space-y-4">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <Crown className="w-4 h-4 text-yellow-400" /> Open Slots
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
                          {isOpen && !isPast && (
                            <button
                              type="button"
                              onClick={() => void handleClaim(slot)}
                              disabled={claimingId === slot.id}
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-emerald-200 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                            >
                              <Radio className="w-3 h-3" />
                              {claimingId === slot.id ? 'Claiming…' : 'Take Slot'}
                            </button>
                          )}
                          {isOpen ? (
                            <Badge variant="default">Open</Badge>
                          ) : isCeoCreator(slot) ? (
                            <Badge variant="gold">CEO Creator</Badge>
                          ) : (
                            <Badge variant="default">Claimed</Badge>
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
