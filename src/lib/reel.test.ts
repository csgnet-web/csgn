import { describe, it, expect } from 'vitest'
import {
  pickByClock, parsePlayout, parseBoardBreakMs,
  DEFAULT_BOARD_BREAK_MS, MIN_BOARD_BREAK_MS, MAX_BOARD_BREAK_MS,
} from './reel'

const at = (iso: string) => Date.parse(iso)
const seg = (startsAt: string, endsAt: string) => ({ startsAt, endsAt })

describe('parsePlayout', () => {
  it('is the stretch-to-fill loop unless the URL says otherwise', () => {
    // The default is what the channel already does. A refactor does not get to
    // change what goes out on air.
    expect(parsePlayout('')).toBe('loop')
    expect(parsePlayout('?reel=loop')).toBe('loop')
    expect(parsePlayout('?reel=CLOCK')).toBe('loop')
    expect(parsePlayout('?reel=anything')).toBe('loop')
  })

  it('reads ?reel=clock', () => {
    expect(parsePlayout('?reel=clock')).toBe('clock')
    expect(parsePlayout('?debug=1&reel=clock&noads=1')).toBe('clock')
  })
})

describe('parseBoardBreakMs', () => {
  it('defaults to the minute the channel has always run', () => {
    expect(parseBoardBreakMs('')).toBe(DEFAULT_BOARD_BREAK_MS)
    expect(parseBoardBreakMs('?board=')).toBe(DEFAULT_BOARD_BREAK_MS)
    expect(parseBoardBreakMs('?board=nonsense')).toBe(DEFAULT_BOARD_BREAK_MS)
  })

  it('takes an explicit caller default, for a rehearsal', () => {
    expect(parseBoardBreakMs('', 6_000)).toBe(6_000)
  })

  it('reads seconds and clamps them', () => {
    expect(parseBoardBreakMs('?board=8')).toBe(8_000)
    expect(parseBoardBreakMs('?board=0.2')).toBe(MIN_BOARD_BREAK_MS)
    expect(parseBoardBreakMs('?board=99999')).toBe(MAX_BOARD_BREAK_MS)
    expect(parseBoardBreakMs('?board=-3')).toBe(DEFAULT_BOARD_BREAK_MS)
  })
})

describe('pickByClock', () => {
  const schedule = [
    seg('2026-09-10T14:00:00.000Z', '2026-09-10T14:00:30.000Z'),
    seg('2026-09-10T14:00:30.000Z', '2026-09-10T14:01:15.000Z'),
    seg('2026-09-10T15:00:00.000Z', '2026-09-10T15:00:20.000Z'),
  ]

  it('plays the segment whose window contains now', () => {
    expect(pickByClock(schedule, at('2026-09-10T14:00:10.000Z')).index).toBe(0)
    expect(pickByClock(schedule, at('2026-09-10T14:00:45.000Z')).index).toBe(1)
    expect(pickByClock(schedule, at('2026-09-10T15:00:19.000Z')).index).toBe(2)
  })

  it('holds until the segment ends, so one timer covers it', () => {
    expect(pickByClock(schedule, at('2026-09-10T14:00:10.000Z')).holdMs).toBe(20_000)
    expect(pickByClock(schedule, at('2026-09-10T14:00:30.000Z')).holdMs).toBe(45_000)
  })

  it('shows the board between segments, and sleeps until the next one starts', () => {
    const pick = pickByClock(schedule, at('2026-09-10T14:30:00.000Z'))
    expect(pick.index).toBe(-1)
    expect(pick.holdMs).toBe(30 * 60_000)
  })

  it('sets no timer once the day has nothing left on it', () => {
    const pick = pickByClock(schedule, at('2026-09-10T20:00:00.000Z'))
    expect(pick.index).toBe(-1)
    // Infinity, not zero: a zero would spin a timer for the rest of the night.
    expect(pick.holdMs).toBe(Infinity)
  })

  it('waits before the first segment rather than starting it early', () => {
    const pick = pickByClock(schedule, at('2026-09-10T13:59:50.000Z'))
    expect(pick.index).toBe(-1)
    expect(pick.holdMs).toBe(10_000)
  })

  it('ends a segment exactly on its end stamp', () => {
    // Half-open window: the end belongs to whatever comes next, or to nothing.
    expect(pickByClock([schedule[0]], at('2026-09-10T14:00:30.000Z')).index).toBe(-1)
  })

  it('never picks an item with no place on the clock', () => {
    // The admin VOD playlist has no timestamps. Handing this a mixed list has
    // to be safe, because /player does exactly that.
    const mixed = [{ }, seg('2026-09-10T14:00:00.000Z', '2026-09-10T14:00:30.000Z'), { startsAt: 'nonsense', endsAt: '' }]
    expect(pickByClock(mixed, at('2026-09-10T14:00:05.000Z')).index).toBe(1)
    expect(pickByClock([{}, {}], at('2026-09-10T14:00:05.000Z')).index).toBe(-1)
  })

  it('ignores a segment that ends before it starts', () => {
    expect(pickByClock([seg('2026-09-10T14:00:30.000Z', '2026-09-10T14:00:00.000Z')], at('2026-09-10T14:00:10.000Z')).index).toBe(-1)
  })

  it('takes the earlier one when a bad schedule double-books an instant', () => {
    // Degrade to a stable answer rather than flickering between two segments.
    const overlapping = [
      seg('2026-09-10T14:00:20.000Z', '2026-09-10T14:00:50.000Z'),
      seg('2026-09-10T14:00:00.000Z', '2026-09-10T14:00:40.000Z'),
    ]
    expect(pickByClock(overlapping, at('2026-09-10T14:00:25.000Z')).index).toBe(1)
  })

  it('is empty-safe', () => {
    expect(pickByClock([], Date.now())).toEqual({ index: -1, holdMs: Infinity })
  })
})
