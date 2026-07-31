import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { doc, onSnapshot } from 'firebase/firestore'
import { Radio, Crown, Check, Loader2, AlertCircle, CalendarPlus, Twitch } from 'lucide-react'
import { db } from '@/config/firebase'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { isNetworkSlot, isSlotClaimable, toMillis, type Slot } from '@/lib/slots'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/useAuth'
import { useLiveSlot } from '@/contexts/useLiveSlot'

// The schedule IS the claim surface — /queue folded into this page. Slots in the
// CSGN Originals (network) block are programmed by the network; every other slot
// is claimable in one tap by any verified account. Turning the network block off
// (config/scheduleMeta.networkBlockEnabled = false) returns those hours to open.

const WEEK_SPAN = 7

/** Pull the Twitch login out of a stored stream URL (empty for a non-Twitch URL). */
function twitchHandleFromUrl(url?: string): string {
  const m = String(url || '').match(/twitch\.tv\/([^/?#]+)/i)
  return m ? m[1].replace(/^@/, '') : ''
}


const toDate = (value: unknown): Date => new Date(toMillis(value))

function formatTimeET(value: unknown): string {
  return toDate(value).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })
}

function etDayKey(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' })
}

function etMiddayFromOffset(offset: number): Date {
  const now = new Date()
  const nyParts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(now)
  const get = (type: string) => Number(nyParts.find((p) => p.type === type)?.value || '0')
  const hourET = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }).format(now))
  // Before 1 AM ET the "broadcast day" is still yesterday (the 1 AM slot trails it).
  const dayOffset = hourET < 1 ? -1 : 0
  const base = new Date(Date.UTC(get('year'), get('month') - 1, get('day') + dayOffset, 12, 0, 0, 0))
  base.setUTCDate(base.getUTCDate() + offset)
  return base
}

export default function Schedule() {
  const { user, profile } = useAuth()
  // Shared app-wide listener (-3h → +8d): already normalized, sorted, live, and
  // ticking nowMs. A second listener here would double every visitor's reads.
  const { allSlots, nowMs } = useLiveSlot()
  const [networkBlockEnabled, setNetworkBlockEnabled] = useState(true)
  const [selectedDay, setSelectedDay] = useState(0)
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [claimError, setClaimError] = useState('')
  const [claimedId, setClaimedId] = useState<string | null>(null)

  useEffect(() => {
    return onSnapshot(doc(db, 'config', 'scheduleMeta'), (snap) => {
      const d = snap.exists() ? snap.data() : {}
      setNetworkBlockEnabled(d.networkBlockEnabled !== false) // absent = on
    }, () => {})
  }, [])

  const handleClaim = useCallback(async (slot: Slot) => {
    if (!user || !profile) {
      // Bounce through registration, then auto-resume this claim.
      localStorage.setItem('pendingClaimSlotId', slot.id)
      window.dispatchEvent(new Event('csgn:openRegister'))
      return
    }
    setClaimingId(slot.id)
    setClaimError('')
    try {
      await api.claimSlot(slot.id)
      setClaimedId(slot.id) // the live listener refreshes the grid on its own
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : 'Could not claim slot.')
    } finally {
      setClaimingId(null)
    }
  }, [profile, user])

  // Resume a claim that bounced through registration.
  useEffect(() => {
    if (!user || !profile || claimingId) return
    const pending = localStorage.getItem('pendingClaimSlotId')
    if (!pending) return
    const slot = allSlots.find((s) => s.id === pending)
    if (!slot) return
    localStorage.removeItem('pendingClaimSlotId')
    void handleClaim(slot)
  }, [user, profile, allSlots, claimingId, handleClaim])

  const days = useMemo(() => Array.from({ length: WEEK_SPAN }, (_, i) => {
    const d = etMiddayFromOffset(i)
    if (i === 0) return { label: 'Today', sub: d.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' }) }
    if (i === 1) return { label: 'Tomorrow', sub: d.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' }) }
    return {
      label: d.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short' }),
      sub: d.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' }),
    }
  }), [])

  const slotsByDay = useMemo(() => days.map((_, i) => {
    const key = etDayKey(etMiddayFromOffset(i))
    const dayed = allSlots
      .filter((slot) => etDayKey(toDate(slot.startTime)) === key)
      .sort((a, b) => toMillis(a.startTime) - toMillis(b.startTime))
    // Today shows only what's left (live slot on top); past hours just add noise.
    return i === 0 ? dayed.filter((slot) => toMillis(slot.endTime) > nowMs) : dayed
  }), [allSlots, days, nowMs])

  const openCount = useMemo(
    () => allSlots.filter((s) => isSlotClaimable(s, networkBlockEnabled)).length,
    [allSlots, networkBlockEnabled],
  )

  /**
   * One slot card — shared by the desktop grid and the mobile list.
   * Every card is the SAME HEIGHT regardless of type (fixed h-[112px] with the
   * body flexed), so a week of mixed open/network/claimed slots reads as a clean
   * grid instead of a ragged one.
   */
  const SlotRow = ({ slot, compact }: { slot: Slot; compact?: boolean }) => {
    const isLive = nowMs >= toMillis(slot.startTime) && nowMs < toMillis(slot.endTime)
    const network = isNetworkSlot(slot) && networkBlockEnabled
    const claimable = isSlotClaimable(slot, networkBlockEnabled)
    const mine = !!user && slot.assignedUid === user.uid
    const busy = claimingId === slot.id
    const justClaimed = claimedId === slot.id
    const twitch = twitchHandleFromUrl(slot.streamUrl)
    const claimed = !!slot.assignedUid || justClaimed

    return (
      <div
        className={`relative h-[112px] px-3 py-2.5 flex flex-col overflow-hidden transition-colors ${
          isLive ? 'bg-primary-500/10'
            : network ? 'bg-gradient-to-b from-gold/[0.07] to-transparent'
            : claimable ? 'bg-primary-500/[0.03] hover:bg-primary-500/[0.08]'
            : ''
        }`}
      >
        {/* time + live badge */}
        <div className="flex items-center justify-between gap-2 shrink-0">
          <p className="font-mono text-[11px] text-gray-400 whitespace-nowrap">
            {formatTimeET(slot.startTime)} – {formatTimeET(slot.endTime)}
          </p>
          {isLive && (
            <span className="text-[9px] font-bold uppercase tracking-wider text-red-300 bg-red-500/15 border border-red-500/30 rounded-full px-1.5 py-0.5 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-red-400 animate-pulse" />Live
            </span>
          )}
        </div>

        {/* body — grows so the action always sits on the same baseline */}
        <div className="flex-1 min-h-0 flex flex-col justify-center">
          {network ? (
            <>
              <p className={`truncate text-gold font-bold flex items-center gap-1 ${compact ? 'text-sm' : 'text-[13px]'}`}>
                <Crown className="w-3 h-3 shrink-0" />
                {slot.assignedName || 'CSGN Originals'}
              </p>
              {slot.streamTitle && <p className="truncate text-[11px] text-gold/70 mt-0.5">{slot.streamTitle}</p>}
            </>
          ) : claimed ? (
            <>
              <p className={`truncate text-white font-bold ${compact ? 'text-sm' : 'text-[13px]'}`}>
                {slot.assignedName || 'Claimed'}
              </p>
              {twitch && (
                <p className="truncate text-[11px] text-purple-300 font-mono flex items-center gap-1 mt-0.5">
                  <Twitch className="w-3 h-3 shrink-0" />{twitch}
                </p>
              )}
              {slot.streamTitle && <p className="truncate text-[11px] text-gray-400 mt-0.5">{slot.streamTitle}</p>}
            </>
          ) : claimable ? (
            <p className={`font-black uppercase tracking-tight leading-tight ${isLive ? 'text-emerald-300' : 'text-primary-300'} ${compact ? 'text-base' : 'text-sm'}`}>
              {isLive ? <>On air.<br />Take it now.</> : <>Your slot.<br />Take it.</>}
            </p>
          ) : (
            <p className="text-[11px] text-gray-600">—</p>
          )}
        </div>

        {/* action — pinned to the bottom of every card */}
        <div className="shrink-0 mt-1">
          {mine ? (
            <p className="text-[11px] text-emerald-400 flex items-center gap-1 font-semibold"><Check className="w-3 h-3" /> Yours</p>
          ) : justClaimed ? (
            <p className="text-[11px] text-emerald-400 flex items-center gap-1 font-semibold"><Check className="w-3 h-3" /> Claimed</p>
          ) : claimable ? (
            <button
              onClick={() => void handleClaim(slot)}
              disabled={busy}
              className="w-full rounded-lg bg-primary-500 hover:bg-primary-400 text-white text-[11px] font-bold uppercase tracking-wide py-1.5 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1 shadow-lg shadow-primary-500/20 hover:shadow-primary-500/40 active:scale-[0.98]"
            >
              {busy ? <><Loader2 className="w-3 h-3 animate-spin" /> Claiming…</> : <><CalendarPlus className="w-3 h-3" /> {isLive ? 'Go live now' : 'Claim it'}</>}
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pt-20 lg:pt-24 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-white">Schedule</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {openCount > 0
                ? <>· <span className="text-primary-300 font-semibold">{openCount} open slot{openCount !== 1 ? 's' : ''}</span> — claim one and earn 30% of CSGN's trading fees while you stream.</>
                : 'Every slot this week is spoken for — check back soon.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="blue">All times ET</Badge>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 mb-3 text-[11px] text-gray-500">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-primary-500/40 border border-primary-500/50" /> Open — anyone can claim</span>
          {networkBlockEnabled && <span className="flex items-center gap-1.5"><Crown className="w-3 h-3 text-gold" /> CSGN Originals — 7 PM–3 AM ET</span>}
        </div>

        {claimError && (
          <div className="mb-3 flex items-start gap-2 text-sm text-red-300 bg-red-500/[0.07] border border-red-500/25 rounded-xl p-3">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {claimError}
          </div>
        )}

        {/* ── Mobile: day picker + single column ── */}
        <div className="lg:hidden">
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
            {days.map((d, i) => (
              <button
                key={d.label + d.sub}
                onClick={() => setSelectedDay(i)}
                className={`shrink-0 px-3 py-2 rounded-xl border text-left transition-colors cursor-pointer ${
                  selectedDay === i ? 'bg-primary-500/15 border-primary-500/50 text-white' : 'bg-white/[0.03] border-white/10 text-gray-400'
                }`}
              >
                <div className="text-xs font-semibold">{d.label}</div>
                <div className="text-[10px] opacity-70">{d.sub}</div>
              </button>
            ))}
          </div>
          <Card hover={false} className="overflow-hidden mt-2">
            <div className="divide-y divide-white/[0.06]">
              {(slotsByDay[selectedDay] || []).length === 0
                ? <p className="px-3 py-6 text-sm text-gray-500 text-center">Nothing scheduled.</p>
                : (slotsByDay[selectedDay] || []).map((slot) => <SlotRow key={slot.id} slot={slot} compact />)}
            </div>
          </Card>
        </div>

        {/* ── Desktop: 7-day grid ── */}
        <Card hover={false} className="overflow-hidden hidden lg:block">
          <div className="grid grid-cols-7 divide-x divide-white/[0.06]">
            {days.map((d, dayIdx) => (
              <div key={d.label + d.sub} className="min-h-[420px]">
                <div className="px-3 py-2 border-b border-white/[0.06] sticky top-0 bg-[#0b0b18] z-10">
                  <div className="text-xs font-semibold text-gray-200">{d.label}</div>
                  <div className="text-[10px] text-gray-500">{d.sub}</div>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {(slotsByDay[dayIdx] || []).map((slot) => <SlotRow key={slot.id} slot={slot} />)}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Footer CTA — only worth showing to signed-out visitors */}
        {!user && (
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mt-8">
            <Card hover={false} className="p-6 bg-primary-500/5 border-primary-500/20">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center shrink-0">
                  <Radio className="w-5 h-5 text-primary-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-white mb-1">Want to be on the schedule?</h4>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    Connect your Phantom wallet and Twitch account, tap <span className="text-primary-300 font-medium">Claim</span> on any open slot,
                    and earn 30% of CSGN's trading fees for the time you stream. Takes under a minute.
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  )
}
