/**
 * HOW A BLOCK ACTUALLY WENT.
 *
 * The schedule says what a block was FOR. This says what happened on it: clips
 * for the first thirty-seven minutes, then a streamer for the rest, then back
 * to clips when they dropped. That difference is the whole honesty of the page
 * — a schedule that only shows intentions is a plan, and a plan nobody checks
 * against reality is marketing.
 *
 * ── The input ──────────────────────────────────────────────────────────────
 *
 * The public switch log at `public/channelMode.log`: newest first, one entry
 * per actual change of mode, each with the reason frozen at the moment it
 * happened. The server writes it; this only reads it.
 *
 * ── The cases that make this non-trivial ───────────────────────────────────
 *
 * Every one of these is a real permutation and all of them are tested:
 *
 *   • NO EVENTS INSIDE THE BLOCK. The mode was set before the block began and
 *     never changed. The segment is the whole block, and the mode has to be
 *     found by looking BACKWARDS past the block start — the commonest case, and
 *     the one a naive "filter events into this window" implementation renders
 *     as an empty bar.
 *   • THE FIRST EVENT IS AFTER THE BLOCK STARTS. There is a leading segment
 *     carrying whatever was on before it.
 *   • NOTHING BEFORE THE BLOCK AT ALL. The log does not reach back that far.
 *     That is UNKNOWN, and unknown is rendered as unknown — never as clips.
 *   • THE BLOCK IS STILL RUNNING. The last segment ends at `now`, not at the
 *     block end, and is marked `open` so the bar does not claim the future.
 *   • THE BLOCK IS ENTIRELY IN THE FUTURE. No segments at all.
 *   • TWO EVENTS AT THE SAME INSTANT, or events out of order. Collapsed rather
 *     than producing a zero-width segment nobody can see but the legend counts.
 */

export type TimelineMode = 'master' | 'stream' | 'clip' | 'unknown'

export interface ModeLogEntry {
  at: string
  mode: string
  who?: string | null
  because?: string
}

export interface ModeSegment {
  mode: TimelineMode
  who: string | null
  /** Reason frozen at the switch, for a tooltip. */
  because: string
  startMs: number
  endMs: number
  seconds: number
  /** Share of the block, 0–1. What the bar is actually drawn from. */
  fraction: number
  /** True when this segment is still running — the bar stops at `now`. */
  open: boolean
}

export interface BlockTimeline {
  segments: ModeSegment[]
  /** Seconds of the block that have actually happened. */
  elapsedSeconds: number
  blockSeconds: number
  /** True when nothing is known about this block — future, or off the end of
   *  the log. The UI must say so rather than drawing an empty bar. */
  empty: boolean
  /** True when the block has not finished yet. */
  live: boolean
}

const MODES: TimelineMode[] = ['master', 'stream', 'clip']

function normalizeMode(value: unknown): TimelineMode {
  const v = String(value ?? '')
  return (MODES as string[]).includes(v) ? (v as TimelineMode) : 'unknown'
}

/** Shorter than this and it is a mis-click, not a segment. Merged into its
 *  neighbour so the bar has no slivers and the legend has no phantom rows. */
export const MIN_SEGMENT_SECONDS = 20

/**
 * Cut the switch log into the segments that fall inside one block.
 *
 * `log` may be in any order and may contain entries from any time; it is sorted
 * and filtered here so callers can hand over the raw stored array.
 */
export function blockTimeline(
  log: ModeLogEntry[],
  blockStartMs: number,
  blockEndMs: number,
  nowMs = Date.now(),
): BlockTimeline {
  const blockSeconds = Math.max(0, Math.round((blockEndMs - blockStartMs) / 1000))
  // The block only "exists" up to now. Drawing a bar across an hour that has
  // not happened would be inventing programming.
  const visibleEndMs = Math.min(blockEndMs, nowMs)
  const elapsedSeconds = Math.max(0, Math.round((visibleEndMs - blockStartMs) / 1000))
  const live = nowMs < blockEndMs && nowMs >= blockStartMs

  const empty = (): BlockTimeline => ({
    segments: [], elapsedSeconds: Math.max(0, elapsedSeconds), blockSeconds, empty: true, live,
  })

  if (blockSeconds <= 0 || visibleEndMs <= blockStartMs) return empty()

  const events = log
    .filter((e) => e && Number.isFinite(Date.parse(e.at)))
    .map((e) => ({ ...e, ms: Date.parse(e.at), mode: normalizeMode(e.mode) }))
    .sort((a, b) => a.ms - b.ms)

  if (events.length === 0) return empty()

  // WHAT WAS ON WHEN THE BLOCK STARTED. Looking only at events inside the
  // window is the bug that renders a quiet, perfectly normal hour as blank:
  // most blocks contain no switches at all.
  const before = events.filter((e) => e.ms <= blockStartMs)
  const inside = events.filter((e) => e.ms > blockStartMs && e.ms < visibleEndMs)

  const opening = before.length > 0 ? before[before.length - 1] : null
  // Nothing before the block and nothing at its very start → we genuinely do
  // not know what was on. Say so.
  if (!opening && inside.length === 0) return empty()

  const points: Array<{ ms: number; mode: TimelineMode; who: string | null; because: string }> = []
  if (opening) {
    points.push({
      ms: blockStartMs,
      mode: opening.mode,
      who: opening.who ?? null,
      because: opening.because ?? '',
    })
  }
  for (const e of inside) {
    points.push({ ms: e.ms, mode: e.mode, who: e.who ?? null, because: e.because ?? '' })
  }
  // No opening known, but switches happened inside: the run before the first
  // switch is honestly unknown rather than assumed.
  if (!opening && points.length > 0 && points[0].ms > blockStartMs) {
    points.unshift({ ms: blockStartMs, mode: 'unknown', who: null, because: '' })
  }

  const raw: ModeSegment[] = []
  for (let i = 0; i < points.length; i++) {
    const startMs = points[i].ms
    const endMs = i + 1 < points.length ? points[i + 1].ms : visibleEndMs
    const seconds = Math.max(0, Math.round((endMs - startMs) / 1000))
    if (seconds <= 0) continue
    raw.push({
      mode: points[i].mode,
      who: points[i].who,
      because: points[i].because,
      startMs,
      endMs,
      seconds,
      fraction: 0,
      open: endMs >= visibleEndMs && live,
    })
  }

  // Merge, absorb slivers, then merge AGAIN. The second pass is not belt and
  // braces: absorbing an eight-second mis-click out of the middle of a clip run
  // leaves clip|clip either side of the hole, and a legend with the same row
  // twice is exactly the kind of small wrongness that makes a chart untrusted.
  const segments = mergeRuns(absorbSlivers(mergeRuns(raw)))

  const total = segments.reduce((sum, s) => sum + s.seconds, 0) || 1
  for (const s of segments) s.fraction = s.seconds / total

  return { segments, elapsedSeconds, blockSeconds, empty: segments.length === 0, live }
}

/** Collapse adjacent runs of the same mode and the same occupant. */
function mergeRuns(segments: ModeSegment[]): ModeSegment[] {
  const out: ModeSegment[] = []
  for (const seg of segments) {
    const last = out[out.length - 1]
    if (last && last.mode === seg.mode && last.who === seg.who) {
      last.endMs = seg.endMs
      last.seconds += seg.seconds
      last.open = seg.open
    } else {
      out.push({ ...seg })
    }
  }
  return out
}

function absorbSlivers(segments: ModeSegment[]): ModeSegment[] {
  if (segments.length <= 1) return segments
  if (segments.every((s) => s.seconds < MIN_SEGMENT_SECONDS)) return segments

  const out: ModeSegment[] = []
  for (const seg of segments) {
    if (seg.seconds >= MIN_SEGMENT_SECONDS || out.length === 0) {
      out.push({ ...seg })
      continue
    }
    const prev = out[out.length - 1]
    prev.endMs = seg.endMs
    prev.seconds += seg.seconds
    prev.open = seg.open
  }
  // A leading sliver survives the loop above (nothing to fold into yet); fold it
  // forward instead.
  if (out.length > 1 && out[0].seconds < MIN_SEGMENT_SECONDS) {
    const [first, second, ...rest] = out
    return [{ ...second, startMs: first.startMs, seconds: second.seconds + first.seconds }, ...rest]
  }
  return out
}

/** Roll a timeline up into "how much of this block was what". */
export function modeTotals(timeline: BlockTimeline): Record<TimelineMode, number> {
  const totals: Record<TimelineMode, number> = { master: 0, stream: 0, clip: 0, unknown: 0 }
  for (const s of timeline.segments) totals[s.mode] += s.seconds
  return totals
}

/** "37m", "1h 12m", "48s" — compact enough for a legend row. */
export function shortDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  if (s < 60) return `${s}s`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`
}
