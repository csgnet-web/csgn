import { describe, it, expect } from 'vitest'
import {
  operatorAlerts, recommendedMode,
  DEFAULT_LIVE_VIEWER_FLOOR, LONG_SHIFT_MINUTES, STRONGER_OPTION_MULTIPLE,
  type AlertInput,
} from '../_shared/operatorAlerts'

const member = (uid: string, live: boolean, viewerCount: number) => ({
  uid, username: uid, displayName: uid.toUpperCase(), live, viewerCount,
})

const input = (over: Partial<AlertInput>): AlertInput => ({
  roster: [], onAirUid: null, onAirMinutes: 0, ...over,
})

describe('operatorAlerts', () => {
  it('says NOTHING when the channel is doing the right thing', () => {
    // The common case, and it has to stay silent — an alert surface that always
    // has something on it is one nobody reads.
    expect(operatorAlerts(input({
      roster: [member('a', true, 50)],
      onAirUid: 'a',
    }))).toEqual([])

    expect(operatorAlerts(input({ roster: [member('a', false, 0)] }))).toEqual([])
  })

  it('raises a CRITICAL when the person on air goes offline', () => {
    const [alert] = operatorAlerts(input({
      roster: [member('a', false, 0)],
      onAirUid: 'a',
    }))
    expect(alert.kind).toBe('on_air_dropped')
    expect(alert.severity).toBe('critical')
    expect(alert.message).toMatch(/nobody else is live/i)
  })

  it('names the replacement in the drop-off message when there is one', () => {
    const [alert] = operatorAlerts(input({
      roster: [member('a', false, 0), member('b', true, 40)],
      onAirUid: 'a',
    }))
    expect(alert.kind).toBe('on_air_dropped')
    expect(alert.message).toContain('B')
    expect(alert.message).toContain('40')
  })

  it('does NOT cry drop-off for a member the roster never sampled', () => {
    // Absent from the roster means Helix did not answer. Treating that as
    // offline would page the operator on every API timeout.
    expect(operatorAlerts(input({ roster: [member('b', true, 40)], onAirUid: 'a' })))
      .not.toContainEqual(expect.objectContaining({ kind: 'on_air_dropped' }))
  })

  it('asks the operator to pick when clips are running and someone qualifies', () => {
    const [alert] = operatorAlerts(input({ roster: [member('a', true, 30)] }))
    expect(alert.kind).toBe('pick_a_streamer')
    expect(alert.severity).toBe('action')
  })

  it('stays quiet when the only live streamer is under the viewer floor', () => {
    // THE WHOLE POINT of the floor: a stream with two viewers is worse
    // television than a curated reel, and interrupting the reel for it costs
    // holders their airtime for nothing.
    const alerts = operatorAlerts(input({ roster: [member('a', true, DEFAULT_LIVE_VIEWER_FLOOR - 1)] }))
    expect(alerts).toEqual([])
  })

  it('suggests clips when the stream on air loses its audience', () => {
    const [alert] = operatorAlerts(input({
      roster: [member('a', true, 0)],
      onAirUid: 'a',
    }))
    expect(alert.kind).toBe('switch_to_clips')
  })

  it('flags a much stronger option, but not a marginally better one', () => {
    const marginal = operatorAlerts(input({
      roster: [member('a', true, 100), member('b', true, 120)],
      onAirUid: 'a',
    }))
    expect(marginal.map((x) => x.kind)).not.toContain('stronger_option')

    const decisive = operatorAlerts(input({
      roster: [member('a', true, 10), member('b', true, 10 * STRONGER_OPTION_MULTIPLE)],
      onAirUid: 'a',
    }))
    expect(decisive.map((x) => x.kind)).toContain('stronger_option')
  })

  it('mentions a long shift', () => {
    const alerts = operatorAlerts(input({
      roster: [member('a', true, 50)],
      onAirUid: 'a',
      onAirMinutes: LONG_SHIFT_MINUTES,
    }))
    expect(alerts.map((x) => x.kind)).toContain('long_shift')
  })

  it('puts the most urgent alert first', () => {
    const alerts = operatorAlerts(input({
      roster: [member('a', false, 0), member('b', true, 90)],
      onAirUid: 'a',
      onAirMinutes: LONG_SHIFT_MINUTES + 10,
    }))
    expect(alerts[0].severity).toBe('critical')
  })

  it('honours a configured viewer floor over the default', () => {
    expect(operatorAlerts(input({ roster: [member('a', true, 20)], viewerFloor: 500 }))).toEqual([])
    expect(operatorAlerts(input({ roster: [member('a', true, 20)], viewerFloor: 5 })).length).toBe(1)
  })
})

describe('recommendedMode', () => {
  it('runs clips when nobody is live', () => {
    const r = recommendedMode(input({ roster: [member('a', false, 0)] }))
    expect(r.mode).toBe('clips')
    expect(r.uid).toBeNull()
  })

  it('runs clips when the only live stream is under the floor, and says why', () => {
    const r = recommendedMode(input({ roster: [member('a', true, 1)], viewerFloor: 10 }))
    expect(r.mode).toBe('clips')
    expect(r.why).toMatch(/clearing 10/)
  })

  it('names the strongest qualifying streamer', () => {
    const r = recommendedMode(input({ roster: [member('a', true, 10), member('b', true, 400)] }))
    expect(r.mode).toBe('streamer')
    expect(r.uid).toBe('b')
  })

  it('recommends no change when the best option is already on air', () => {
    const r = recommendedMode(input({ roster: [member('a', true, 400)], onAirUid: 'a' }))
    expect(r.uid).toBe('a')
    expect(r.why).toMatch(/already on air/i)
  })
})
