import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { doc, onSnapshot } from 'firebase/firestore'
import { Radio, Crown, Twitch } from 'lucide-react'
import { db } from '@/config/firebase'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatTimeET, isNetworkSlot, toMillis, type Slot } from '@/lib/slots'
import { Link } from 'react-router-dom'
import RosterStrip from '@/components/schedule/RosterStrip'
import ChannelModeCard from '@/components/watch/ChannelModeCard'
import BlockTimelineBar from '@/components/schedule/BlockTimelineBar'
import { useChannelMode } from '@/hooks/useChannelMode'
import { useLiveSlot } from '@/contexts/useLiveSlot'
import { usePageMeta } from '@/hooks/usePageMeta'

// The schedule is a RECORD, not a booking sheet. Slots in the CSGN Originals
// (network) block are programmed by the network; every other hour either has a
// roster streamer the operator put on, or it runs the member clip reel. Turning
// the network block off (config/scheduleMeta.networkBlockEnabled = false) hands
// those hours to the reel as well.

const WEEK_SPAN = 7

/** Pull the Twitch login out of a stored stream URL (empty for a non-Twitch URL). */
function twitchHandleFromUrl(url?: string): string {
  const m = String(url || '').match(/twitch\.tv\/([^/?#]+)/i)
  return m ? m[1].replace(/^@/, '') : ''
}


const toDate = (value: unknown): Date => new Date(toMillis(value))

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
  usePageMeta({
    title: "Schedule — Who's On CSGN Right Now",
    description: "Who from the CSGN network is live right now, who was on earlier, and what is scheduled. Connected streamers are carried automatically whenever they go live — there is nothing to book.",
    path: '/schedule',
  })

  // Shared app-wide listener (-3h → +8d): already normalized, sorted, live, and
  // ticking nowMs. A second listener here would double every visitor's reads.
  const { allSlots, nowMs } = useLiveSlot()
  // THE RECEIPT. The same published switch log the mode card reads, cut into
  // per-block segments below — what actually went out, against what the grid
  // said was planned.
  const { channelMode } = useChannelMode()
  const modeLog = channelMode?.log ?? []
  const [networkBlockEnabled, setNetworkBlockEnabled] = useState(true)
  // Whether the 7 PM–3 AM owner block is running. Decides how hours are typed
  // on the grid and whether the legend mentions CSGN Originals at all.
  useEffect(() => onSnapshot(
    doc(db, 'config', 'scheduleMeta'),
    (snap) => setNetworkBlockEnabled(snap.exists() ? snap.data()?.networkBlockEnabled !== false : true),
    () => setNetworkBlockEnabled(true),
  ), [])
  const [selectedDay, setSelectedDay] = useState(0)
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
    // TODAY KEEPS ITS PAST. It used to filter finished hours out, which made
    // the schedule a booking sheet — a list of things you could still buy.
    // Since claiming is no longer how most people get on air, the more useful
    // thing this page can be is a RECORD: who was on at 2pm, who is on now,
    // what is open later. A finished hour with a name on it is evidence the
    // channel runs; hiding it makes a busy day look empty.
    return dayed
  }), [allSlots, days])

  // NO "OPEN BLOCKS" COUNT. It used to say how much of the week was
  // unscheduled, which framed the reel's hours as gaps. They are not gaps —
  // clips run 24/7 and an hour with nobody booked on it is the reel doing its
  // job. Counting them was the last of the booking-sheet language.

  /**
   * One slot card — shared by the desktop grid and the mobile list.
   * Every card is the SAME HEIGHT regardless of type (fixed h-[112px] with the
   * body flexed), so a week of mixed open/network/claimed slots reads as a clean
   * grid instead of a ragged one.
   */
  const SlotRow = ({ slot, compact }: { slot: Slot; compact?: boolean }) => {
    const isLive = nowMs >= toMillis(slot.startTime) && nowMs < toMillis(slot.endTime)
    const isPast = toMillis(slot.endTime) <= nowMs
    const network = isNetworkSlot(slot) && networkBlockEnabled
    const twitch = twitchHandleFromUrl(slot.streamUrl)
    // A guest occupies the block with no assignedUid — they are not a member —
    // so the cell has to check the name too or an aired guest reads as "Open".
    const claimed = !!slot.assignedUid || !!slot.isGuest
    // An hour with nobody on it is not "available" — it is the clip reel's.
    const reel = !claimed && !network

    return (
      <div
        className={`relative h-[112px] px-3 py-2.5 flex flex-col overflow-hidden transition-colors ${
          isLive ? 'bg-primary-500/10'
            : isPast ? 'bg-transparent opacity-55'
            : network ? 'bg-gradient-to-b from-gold/[0.07] to-transparent'
            : reel ? 'bg-white/[0.015]'
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
                {slot.assignedName || 'On Air'}
              </p>
              {/* A guest is the network vouching for somebody, not a member who
                  went live. Saying so is what keeps the roster meaningful. */}
              {slot.isGuest && (
                <p className="truncate text-[10px] uppercase tracking-wider text-gold mt-0.5">Guest</p>
              )}
              {twitch && (
                <p className="truncate text-[11px] text-purple-300 font-mono flex items-center gap-1 mt-0.5">
                  <Twitch className="w-3 h-3 shrink-0" />{twitch}
                </p>
              )}
              {slot.streamTitle && <p className="truncate text-[11px] text-gray-400 mt-0.5">{slot.streamTitle}</p>}
            </>
          ) : isPast ? (
            /* A finished hour nobody was booked on. The timeline below says what
               actually ran on it, which is usually more interesting than this. */
            <p className="text-[11px] text-gray-600">Member clips</p>
          ) : reel ? (
            /* An hour with nobody scheduled is the CLIP REEL's hour, and saying
               so is the point. "Open" implied something was missing; the reel
               running is the product working. */
            <p className={`font-semibold leading-tight text-gray-400 ${compact ? 'text-sm' : 'text-[13px]'}`}>
              {isLive ? 'Clips on air' : 'Member clips'}
            </p>
          ) : (
            <p className="text-[11px] text-gray-600">—</p>
          )}
        </div>

        {/* HOW THE BLOCK ACTUALLY WENT. Clips for the first thirty-seven
            minutes, a streamer for the rest, back to clips when they dropped —
            drawn from the published switch log, not from what was planned.
            Renders nothing at all for a block it has no record of, which is
            every future block and anything past the end of the log. */}
        <BlockTimelineBar
          log={modeLog}
          startMs={toMillis(slot.startTime)}
          endMs={toMillis(slot.endTime)}
          nowMs={nowMs}
          compact={compact}
        />
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
            {/* WHAT THIS PAGE IS. Not a booking sheet and not an offer — a
                plan on top and a RECEIPT underneath. Nobody reserves anything;
                the blocks are how the day is organised in advance, and the bar
                on each one is what actually went out on it. */}
            <p className="text-sm text-gray-400 mt-0.5 max-w-2xl">
              The plan, and what actually went out.{' '}
              <Link to="/account" className="text-primary-300 font-semibold hover:text-primary-200 underline underline-offset-2">Connect Twitch</Link>{' '}
              to get on the roster.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="blue">All times ET</Badge>
          </div>
        </div>

        {/* THE RULE, THEN THE ROSTER, THEN THE RECORD.
            The mode card says what is on and why — and expands into the actual
            log of switches, which is what makes the rule checkable rather than
            a claim. Everything below is the evidence for it. */}
        <div className="mb-5">
          <ChannelModeCard />
        </div>

        {/* WHO IS ON. See RosterStrip. */}
        <RosterStrip />

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 mb-3 text-[11px] text-gray-500">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-primary-500/40 border border-primary-500/50" /> Open — member clips carry it</span>
          {networkBlockEnabled && <span className="flex items-center gap-1.5"><Crown className="w-3 h-3 text-gold" /> CSGN Originals — 7 PM–3 AM ET</span>}
        </div>

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

        {/* Footer CTA */}
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mt-8">
            <Card hover={false} className="p-6 bg-primary-500/5 border-primary-500/20">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center shrink-0">
                  <Radio className="w-5 h-5 text-primary-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-white mb-1">Want to be on the schedule?</h4>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    There is nothing to book.{' '}
                    <Link to="/account" className="text-primary-300 font-medium hover:text-primary-200 underline underline-offset-2">
                      Connect your Twitch
                    </Link>{' '}
                    once and turn on forwarding — when you go live, you show up on our board and we
                    can put you on the channel. You earn a share of $CSGN's trading fees for the
                    minutes you were actually carried.
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
      </div>
    </div>
  )
}
