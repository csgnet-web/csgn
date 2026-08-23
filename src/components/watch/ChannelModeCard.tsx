import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Clapperboard, Radio, Tv } from 'lucide-react'
import { useChannelMode, type ChannelMode, type ModeEvent } from '@/hooks/useChannelMode'

/**
 * "WHY IS THIS WHAT'S ON?" — answered on the page, in one sentence.
 *
 * A 24/7 channel with no fixed lineup switches between a clip reel and a live
 * member several times a day. Every one of those switches is invisible reasoning
 * to a viewer: they see a different product than they saw an hour ago and are
 * given nothing to make sense of it. The most common conclusion is that the
 * channel is broken.
 *
 * Networks switch formats constantly and get away with it because the audience
 * knows the rule. So this states the rule, names what is on, and — expanded —
 * shows the actual recent switches with times, which is the part that turns a
 * claim into something checkable.
 *
 * It renders NOTHING when the server has not published a verdict or the verdict
 * has gone stale. A confident wrong sign is worse than no sign.
 */

const MODE_ICON: Record<ChannelMode, typeof Radio> = {
  stream: Radio,
  master: Tv,
  clip: Clapperboard,
}

const MODE_TONE: Record<ChannelMode, { dot: string; text: string; ring: string }> = {
  stream: { dot: 'bg-live', text: 'text-live', ring: 'border-live/30' },
  master: { dot: 'bg-gold', text: 'text-gold', ring: 'border-gold/30' },
  clip: { dot: 'bg-primary-400', text: 'text-primary-300', ring: 'border-primary-500/25' },
}

function timeET(iso: string): string {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return ''
  return new Date(ms).toLocaleTimeString('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit',
  })
}

function dayET(iso: string): string {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return ''
  return new Date(ms).toLocaleDateString('en-US', {
    timeZone: 'America/New_York', month: 'short', day: 'numeric',
  })
}

function SwitchRow({ event }: { event: ModeEvent }) {
  const tone = MODE_TONE[event.mode] ?? MODE_TONE.clip
  return (
    <li className="flex items-start gap-3 py-2">
      <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${tone.dot}`} />
      <div className="min-w-0">
        <p className="text-[12px] text-white leading-snug">
          <span className="font-mono text-gray-500">{timeET(event.at)} ET</span>{' '}
          <span className={`font-bold ${tone.text}`}>
            {event.mode === 'stream' ? (event.who || 'A member') : event.mode === 'master' ? (event.who || 'Master Mode') : 'Clip reel'}
          </span>
        </p>
        <p className="text-[11px] text-gray-500 leading-snug mt-0.5">{event.because}</p>
      </div>
      <span className="ml-auto shrink-0 text-[10px] text-gray-600 font-mono">{dayET(event.at)}</span>
    </li>
  )
}

export default function ChannelModeCard({ compact = false }: { compact?: boolean }) {
  const { channelMode, stale } = useChannelMode()
  const [open, setOpen] = useState(false)

  if (!channelMode || stale) return null

  const tone = MODE_TONE[channelMode.mode] ?? MODE_TONE.clip
  const Icon = MODE_ICON[channelMode.mode] ?? Clapperboard
  // The first entry of the log is the switch that is currently in force, so the
  // history below it starts at the second — otherwise the card explains the
  // present twice and looks like it is repeating itself.
  const history = channelMode.log.slice(1, 8)

  return (
    <section className={`rounded-2xl border bg-white/[0.02] ${tone.ring} ${compact ? 'px-4 py-3' : 'px-5 py-4'}`}>
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 shrink-0 w-9 h-9 rounded-xl border ${tone.ring} bg-black/40 flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${tone.text}`} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-gray-500">On air now</span>
            <span className={`inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.14em] ${tone.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${tone.dot} ${channelMode.mode !== 'clip' ? 'animate-pulse' : ''}`} />
              {channelMode.label}
            </span>
            {channelMode.who && (
              <span className="text-sm font-bold text-white truncate max-w-[15rem]">
                {channelMode.who}
                {channelMode.isGuest && <span className="ml-1.5 text-[10px] uppercase tracking-wider text-gold">Guest</span>}
              </span>
            )}
            {channelMode.since && (
              <span className="text-[11px] font-mono text-gray-600">since {timeET(channelMode.since)} ET</span>
            )}
          </div>

          <p className="mt-1.5 text-[13px] text-gray-300 leading-relaxed">{channelMode.because}</p>
          {channelMode.nextSwitch && (
            <p className="mt-1 text-[12px] text-gray-500 leading-relaxed">{channelMode.nextSwitch}</p>
          )}

          {history.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500 hover:text-gray-300 transition-colors"
            >
              {open ? 'Hide' : 'Recent switches'}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
          )}

          {open && history.length > 0 && (
            <ul className="mt-1 divide-y divide-white/[0.05] border-t border-white/[0.05]">
              {history.map((e) => <SwitchRow key={`${e.at}-${e.mode}`} event={e} />)}
            </ul>
          )}
        </div>

        {!compact && (
          <Link
            to="/schedule"
            className="hidden sm:inline-flex shrink-0 items-center rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold text-gray-300 hover:text-white hover:border-white/20 transition-colors"
          >
            Who's on
          </Link>
        )}
      </div>
    </section>
  )
}
