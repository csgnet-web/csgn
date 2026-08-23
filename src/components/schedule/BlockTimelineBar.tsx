import { useMemo } from 'react'
import { Clapperboard, Crown, Radio, HelpCircle } from 'lucide-react'
import {
  blockTimeline, modeTotals, shortDuration,
  type ModeLogEntry, type ModeSegment, type TimelineMode,
} from '@/lib/modeTimeline'

/**
 * WHAT ACTUALLY WENT OUT ON THIS BLOCK.
 *
 * The grid above says what a block was for. This says what happened on it —
 * clips for the first thirty-seven minutes, a streamer for the rest, back to
 * clips when they dropped — as one proportional bar with a legend under it.
 *
 * Why it earns its space: a channel with no fixed lineup is otherwise
 * unauditable. A visitor can be told "the MP cuts to whoever is worth carrying"
 * and has no way to know whether that ever happens. This is the receipt. A busy
 * bar is the best possible advertisement for the network and an empty one is
 * the truth, so neither is worth hiding.
 *
 * Design rules it follows:
 *   • The bar only draws time that has ALREADY AIRED. A live block stops at
 *     now, with a soft edge, rather than claiming the rest of the hour.
 *   • Unknown is drawn as unknown — hatched and unlabelled — never as clips.
 *     The log does not reach back forever and guessing would put a fact on
 *     screen we do not have.
 *   • No segment is smaller than it can be clicked; slivers are absorbed
 *     upstream in `blockTimeline`.
 */

const TONE: Record<TimelineMode, { bg: string; text: string; label: string; Icon: typeof Radio }> = {
  master: { bg: 'bg-gold', text: 'text-gold', label: 'Master', Icon: Crown },
  stream: { bg: 'bg-live', text: 'text-live', label: 'Stream', Icon: Radio },
  clip: { bg: 'bg-primary-500', text: 'text-primary-300', label: 'Clips', Icon: Clapperboard },
  unknown: { bg: 'bg-white/15', text: 'text-gray-500', label: 'Not recorded', Icon: HelpCircle },
}

const ORDER: TimelineMode[] = ['stream', 'master', 'clip', 'unknown']

function timeET(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit',
  })
}

function segmentTitle(s: ModeSegment): string {
  const who = s.who ? ` — ${s.who}` : ''
  const when = `${timeET(s.startMs)}–${s.open ? 'now' : timeET(s.endMs)} ET`
  return `${TONE[s.mode].label}${who} · ${when} · ${shortDuration(s.seconds)}${s.because ? `\n${s.because}` : ''}`
}

export default function BlockTimelineBar({
  log,
  startMs,
  endMs,
  nowMs,
  compact = false,
}: {
  log: ModeLogEntry[]
  startMs: number
  endMs: number
  /** REQUIRED, and passed in rather than read here. The clock is impure and a
   *  component that reads it during render produces a different bar on every
   *  re-render. The page already ticks one `nowMs` for the whole grid, so every
   *  block on screen is also drawn against the same instant — which is what
   *  stops two adjacent bars disagreeing about where "now" is. */
  nowMs: number
  compact?: boolean
}) {
  const timeline = useMemo(() => blockTimeline(log, startMs, endMs, nowMs), [log, startMs, endMs, nowMs])
  const totals = useMemo(() => modeTotals(timeline), [timeline])

  if (timeline.empty) return null

  // How much of the block has aired, as a share of the whole — so a live block's
  // bar physically stops where the programme has got to.
  const airedFraction = timeline.blockSeconds > 0
    ? Math.min(1, timeline.elapsedSeconds / timeline.blockSeconds)
    : 1

  const legend = ORDER
    .filter((mode) => totals[mode] > 0)
    .map((mode) => ({ mode, seconds: totals[mode] }))

  return (
    <div className={compact ? 'mt-1.5' : 'mt-2'}>
      <div
        className="relative h-2 w-full rounded-full bg-white/[0.05] overflow-hidden"
        role="img"
        aria-label={legend.map((l) => `${TONE[l.mode].label} ${shortDuration(l.seconds)}`).join(', ')}
      >
        <div className="absolute inset-y-0 left-0 flex" style={{ width: `${airedFraction * 100}%` }}>
          {timeline.segments.map((s) => (
            <span
              key={`${s.startMs}-${s.mode}`}
              title={segmentTitle(s)}
              className={`${TONE[s.mode].bg} h-full ${s.mode === 'unknown' ? 'opacity-40' : ''} ${
                s.open ? 'animate-pulse' : ''
              }`}
              style={{ width: `${s.fraction * 100}%` }}
            />
          ))}
        </div>
        {/* The part of the block that has not aired yet reads as unfilled track
            rather than as a mode, because it is not one yet. */}
      </div>

      {!compact && legend.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          {legend.map(({ mode, seconds }) => {
            const { bg, text, label } = TONE[mode]
            return (
              <span key={mode} className="inline-flex items-center gap-1.5 text-[10px]">
                <span className={`w-1.5 h-1.5 rounded-full ${bg} ${mode === 'unknown' ? 'opacity-40' : ''}`} />
                <span className={text}>{label}</span>
                <span className="font-mono text-gray-500">{shortDuration(seconds)}</span>
              </span>
            )
          })}
          {timeline.live && <span className="text-[10px] text-gray-600">· still running</span>}
        </div>
      )}
    </div>
  )
}
