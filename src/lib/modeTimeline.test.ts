import { describe, it, expect } from 'vitest'
import { blockTimeline, modeTotals, shortDuration, MIN_SEGMENT_SECONDS, type ModeLogEntry } from './modeTimeline'

/**
 * Every permutation of a block changing hands, because the schedule page draws
 * this and a bar that is subtly wrong is worse than no bar — it is a claim
 * about what went out on television.
 */

const T = Date.parse('2026-08-20T18:00:00.000Z')   // block start
const END = T + 2 * 60 * 60 * 1000                  // two-hour block
const at = (minsFromStart: number) => new Date(T + minsFromStart * 60_000).toISOString()

const ev = (minsFromStart: number, mode: string, who: string | null = null): ModeLogEntry =>
  ({ at: at(minsFromStart), mode, who, because: `${mode} because` })

describe('blockTimeline', () => {
  // THE COMMONEST CASE, and the one a naive implementation gets wrong: a quiet
  // block with no switches inside it is not an empty block.
  it('fills the whole block from a switch that happened before it', () => {
    const t = blockTimeline([ev(-30, 'clip')], T, END, END)
    expect(t.empty).toBe(false)
    expect(t.segments).toHaveLength(1)
    expect(t.segments[0].mode).toBe('clip')
    expect(t.segments[0].seconds).toBe(7200)
    expect(t.segments[0].fraction).toBeCloseTo(1, 10)
  })

  // The example from the brief: clips for 37 minutes, then a streamer.
  it('splits clips then a streamer at the right proportions', () => {
    const t = blockTimeline([ev(-5, 'clip'), ev(37, 'stream', 'roblito')], T, END, END)
    expect(t.segments.map((s) => s.mode)).toEqual(['clip', 'stream'])
    expect(t.segments[0].seconds).toBe(37 * 60)
    expect(t.segments[1].seconds).toBe(83 * 60)
    expect(t.segments[0].fraction).toBeCloseTo(37 / 120, 6)
    expect(t.segments[1].who).toBe('roblito')
  })

  it('handles clips → streamer → clips when they drop off', () => {
    const t = blockTimeline([ev(-1, 'clip'), ev(20, 'stream', 'a'), ev(80, 'clip')], T, END, END)
    expect(t.segments.map((s) => s.mode)).toEqual(['clip', 'stream', 'clip'])
    expect(t.segments.map((s) => s.seconds)).toEqual([20 * 60, 60 * 60, 40 * 60])
  })

  it('handles every mode appearing in one block', () => {
    const t = blockTimeline(
      [ev(-1, 'clip'), ev(15, 'stream', 'a'), ev(45, 'master', 'CSGN'), ev(90, 'clip')],
      T, END, END,
    )
    expect(t.segments.map((s) => s.mode)).toEqual(['clip', 'stream', 'master', 'clip'])
  })

  it('handles one streamer handing over to another', () => {
    const t = blockTimeline([ev(-1, 'stream', 'a'), ev(60, 'stream', 'b')], T, END, END)
    expect(t.segments).toHaveLength(2)
    expect(t.segments.map((s) => s.who)).toEqual(['a', 'b'])
  })

  // A block still running must not claim the part of itself that has not aired.
  it('stops a live block at now, and marks the last segment open', () => {
    const now = T + 45 * 60_000
    const t = blockTimeline([ev(-1, 'clip'), ev(30, 'stream', 'a')], T, END, now)
    expect(t.live).toBe(true)
    expect(t.elapsedSeconds).toBe(45 * 60)
    expect(t.segments[t.segments.length - 1].open).toBe(true)
    expect(t.segments.reduce((n, s) => n + s.seconds, 0)).toBe(45 * 60)
  })

  it('is empty for a block entirely in the future', () => {
    const t = blockTimeline([ev(-60, 'clip')], T, END, T - 30 * 60_000)
    expect(t.empty).toBe(true)
    expect(t.segments).toEqual([])
  })

  // UNKNOWN IS RENDERED AS UNKNOWN. The log does not reach back forever, and
  // guessing "it must have been clips" would put a fact on screen we do not have.
  it('is empty when the log does not reach back to the block at all', () => {
    const t = blockTimeline([ev(500, 'clip')], T, END, END)
    expect(t.empty).toBe(true)
  })

  it('marks the run before the first known switch as unknown, not as clips', () => {
    const t = blockTimeline([ev(40, 'stream', 'a')], T, END, END)
    expect(t.segments[0].mode).toBe('unknown')
    expect(t.segments[1].mode).toBe('stream')
  })

  it('treats an unrecognised mode string as unknown rather than dropping it', () => {
    const t = blockTimeline([ev(-1, 'network')], T, END, END)
    expect(t.segments[0].mode).toBe('unknown')
  })

  it('sorts a log that arrives newest-first', () => {
    const t = blockTimeline([ev(60, 'stream', 'a'), ev(-1, 'clip')], T, END, END)
    expect(t.segments.map((s) => s.mode)).toEqual(['clip', 'stream'])
  })

  it('ignores entries with an unparseable timestamp', () => {
    const t = blockTimeline([{ at: 'nonsense', mode: 'clip' }, ev(-1, 'clip')], T, END, END)
    expect(t.segments).toHaveLength(1)
  })

  it('is empty for an empty log', () => {
    expect(blockTimeline([], T, END, END).empty).toBe(true)
  })

  // A mis-click that lasted eight seconds should not become a legend row and an
  // unclickable sliver on the bar.
  it('absorbs a segment shorter than the minimum into its neighbour', () => {
    const t = blockTimeline(
      [ev(-1, 'clip'), { at: new Date(T + 60 * 60_000).toISOString(), mode: 'stream', who: 'oops' },
        { at: new Date(T + 60 * 60_000 + 8_000).toISOString(), mode: 'clip', who: null }],
      T, END, END,
    )
    expect(t.segments.every((s) => s.seconds >= MIN_SEGMENT_SECONDS)).toBe(true)
    expect(t.segments.map((s) => s.mode)).toEqual(['clip'])
  })

  it('keeps slivers when the whole block is slivers rather than rendering nothing', () => {
    const log = [ev(-1, 'clip'), { at: new Date(T + 5_000).toISOString(), mode: 'stream', who: 'a' }]
    const t = blockTimeline(log, T, T + 10_000, T + 10_000)
    expect(t.segments.length).toBeGreaterThan(0)
  })

  it('merges a run split across the block boundary', () => {
    const t = blockTimeline([ev(-30, 'clip'), ev(0, 'clip')], T, END, END)
    expect(t.segments).toHaveLength(1)
  })

  it('always has fractions summing to one', () => {
    const t = blockTimeline([ev(-1, 'clip'), ev(37, 'stream', 'a'), ev(95, 'master', 'CSGN')], T, END, END)
    expect(t.segments.reduce((n, s) => n + s.fraction, 0)).toBeCloseTo(1, 10)
  })
})

describe('modeTotals', () => {
  it('rolls the block up by mode', () => {
    const t = blockTimeline([ev(-1, 'clip'), ev(30, 'stream', 'a'), ev(90, 'clip')], T, END, END)
    const totals = modeTotals(t)
    expect(totals.clip).toBe(30 * 60 + 30 * 60)
    expect(totals.stream).toBe(60 * 60)
    expect(totals.master).toBe(0)
  })
})

describe('shortDuration', () => {
  it('reads the way a person would say it', () => {
    expect(shortDuration(48)).toBe('48s')
    expect(shortDuration(37 * 60)).toBe('37m')
    expect(shortDuration(60 * 60)).toBe('1h')
    expect(shortDuration(72 * 60)).toBe('1h 12m')
  })
})
