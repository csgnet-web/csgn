import { describe, it, expect } from 'vitest'
import {
  describeChannelMode, appendModeEvent, MODE_LOG_LIMIT,
  type ModeEvent, type ModeSlot,
} from '../_shared/channelMode'

const slot = (over: Partial<ModeSlot> = {}): ModeSlot => ({
  type: 'open',
  status: 'open',
  startTime: '2026-08-20T18:00:00.000Z',
  endTime: '2026-08-20T20:00:00.000Z',
  ...over,
})

describe('describeChannelMode', () => {
  it('is CLIP MODE when nothing is programmed on the hour', () => {
    const v = describeChannelMode({ slot: slot(), networkBlockEnabled: true })
    expect(v.mode).toBe('clip')
    expect(v.who).toBeNull()
    expect(v.label).toBe('Clip Mode')
  })

  it('is CLIP MODE when there is no slot at all', () => {
    const v = describeChannelMode({ slot: null, networkBlockEnabled: true })
    expect(v.mode).toBe('clip')
    expect(v.since).toBeNull()
  })

  it('is STREAM MODE when a member is assigned, and names them', () => {
    const v = describeChannelMode({ slot: slot({ assignedUid: 'u1', assignedName: 'roblito' }), networkBlockEnabled: true })
    expect(v.mode).toBe('stream')
    expect(v.who).toBe('roblito')
    expect(v.isGuest).toBe(false)
    expect(v.because).toContain('gave us permission')
  })

  // A guest that reads identically to a member makes the roster meaningless —
  // the same reason adminLiveNow stamps sourceType.
  it('marks an operator guest as a guest', () => {
    const v = describeChannelMode({
      slot: slot({ isGuest: true, assignedName: 'ansem', sourceType: 'operator_guest' }),
      networkBlockEnabled: true,
    })
    expect(v.mode).toBe('stream')
    expect(v.isGuest).toBe(true)
    expect(v.because).toContain('guest of the network')
  })

  it('is MASTER MODE inside the 7 PM-3 AM block', () => {
    const v = describeChannelMode({ slot: slot({ type: 'network' }), networkBlockEnabled: true })
    expect(v.mode).toBe('master')
    expect(v.label).toBe('Master Mode')
  })

  // Switching the block off hands those hours back with no data migration —
  // the mode has to follow, or /watch says "CSGN Originals" over a clip reel.
  it('a block hour with the block switched off is an ordinary clip hour', () => {
    const v = describeChannelMode({ slot: slot({ type: 'network' }), networkBlockEnabled: false })
    expect(v.mode).toBe('clip')
  })

  // The block is a default, not a lock: an operator cutting a live streamer
  // into a 9 PM hour must not leave the sign reading "CSGN Originals".
  it('an operator placement outranks the MP block', () => {
    const v = describeChannelMode({
      slot: slot({ type: 'network', assignedUid: 'u1', assignedName: 'roblito', sourceType: 'operator_live' }),
      networkBlockEnabled: true,
    })
    expect(v.mode).toBe('stream')
    expect(v.who).toBe('roblito')
  })

  // A named CSGN Originals show is still the network, not a "live member".
  it('a named block show stays MASTER MODE', () => {
    const v = describeChannelMode({
      slot: slot({ type: 'network', assignedName: 'CSGN @ NITE' }),
      networkBlockEnabled: true,
    })
    expect(v.mode).toBe('master')
    expect(v.who).toBe('CSGN @ NITE')
  })

  // MYSELF FACTORY. The MP on their own encoder pre-empts everything — there
  // is no appeal above the person running the channel.
  it('is MASTER MODE when the MP is on their own encoder', () => {
    const v = describeChannelMode({
      slot: slot({ assignedName: 'CSGN', sourceType: 'master', assignedUid: 'mp' }),
      networkBlockEnabled: false,
    })
    expect(v.mode).toBe('master')
    expect(v.because).toContain('Master of Programming')
  })

  it('the MP outranks a roster streamer and the block alike', () => {
    const overStreamer = describeChannelMode({
      slot: slot({ assignedName: 'CSGN', sourceType: 'master', assignedUid: 'mp', type: 'network' }),
      networkBlockEnabled: true,
    })
    expect(overStreamer.mode).toBe('master')
    expect(overStreamer.who).toBe('CSGN')
  })

  it('a completed hour is not treated as occupied', () => {
    const v = describeChannelMode({
      slot: slot({ assignedUid: 'u1', assignedName: 'roblito', status: 'completed' }),
      networkBlockEnabled: true,
    })
    expect(v.mode).toBe('clip')
  })

  // Different sentence when somebody IS live but we are still on clips: the
  // viewer can go look at the roster and see we are not lying about it.
  it('says something different when members are live but not carried', () => {
    const idle = describeChannelMode({ slot: slot(), networkBlockEnabled: true, liveCount: 0 })
    const some = describeChannelMode({ slot: slot(), networkBlockEnabled: true, liveCount: 4 })
    expect(some.because).not.toBe(idle.because)
    expect(some.nextSwitch).toContain('audience bar')
  })

  it('always carries a reason and a next-switch sentence', () => {
    for (const v of [
      describeChannelMode({ slot: null, networkBlockEnabled: true }),
      describeChannelMode({ slot: slot({ type: 'network' }), networkBlockEnabled: true }),
      describeChannelMode({ slot: slot({ assignedUid: 'u1' }), networkBlockEnabled: true }),
    ]) {
      expect(v.because.length).toBeGreaterThan(20)
      expect(v.nextSwitch.length).toBeGreaterThan(20)
    }
  })
})

/**
 * `encoder` — the flag that decides whether /player draws anything.
 *
 * Both master cases publish `mode: 'master'`, and for a badge that is the whole
 * story. For the encoder it is the opposite instruction in each case, so this
 * is the one distinction the verdict has to carry explicitly.
 */
describe('describeChannelMode — encoder', () => {
  it('is true ONLY while the MP is on their own encoder', () => {
    const v = describeChannelMode({
      slot: slot({ assignedUid: 'admin', assignedName: 'CSGN', sourceType: 'master' }),
      networkBlockEnabled: true,
    })
    expect(v.mode).toBe('master')
    expect(v.encoder).toBe(true)
  })

  it('is FALSE for the scheduled block, which is master mode with nothing encoding', () => {
    // The sign says the hour belongs to the MP; no picture is being sent, so
    // the reel must keep the channel alive. Getting this wrong the other way
    // blanks the network for eight hours a night.
    const v = describeChannelMode({ slot: slot({ type: 'network' }), networkBlockEnabled: true })
    expect(v.mode).toBe('master')
    expect(v.encoder).toBe(false)
  })

  it('is false in stream mode and in clip mode', () => {
    expect(describeChannelMode({
      slot: slot({ assignedUid: 'u1', assignedName: 'roblito' }),
      networkBlockEnabled: true,
    }).encoder).toBe(false)
    expect(describeChannelMode({ slot: null, networkBlockEnabled: true }).encoder).toBe(false)
  })

  it('is false once the master hour is completed', () => {
    // A finished takeover is not an encoder still sending.
    const v = describeChannelMode({
      slot: slot({ assignedUid: 'admin', assignedName: 'CSGN', sourceType: 'master', status: 'completed' }),
      networkBlockEnabled: true,
    })
    expect(v.encoder).toBe(false)
  })
})

describe('appendModeEvent', () => {
  const clips = describeChannelMode({ slot: slot(), networkBlockEnabled: true })
  const live = describeChannelMode({ slot: slot({ assignedUid: 'u1', assignedName: 'roblito' }), networkBlockEnabled: true })
  const live2 = describeChannelMode({ slot: slot({ assignedUid: 'u2', assignedName: 'someone' }), networkBlockEnabled: true })

  it('records the first event', () => {
    expect(appendModeEvent([], clips, 'T0')).toHaveLength(1)
  })

  // The poller calls this every minute. Without the dedupe the public log is a
  // transcript of nothing happening, and a Firestore doc that grows all day.
  it('does not record the same mode twice', () => {
    const one = appendModeEvent([], clips, 'T0')
    expect(appendModeEvent(one, clips, 'T1')).toBe(one)
  })

  it('records a switch', () => {
    const log = appendModeEvent(appendModeEvent([], clips, 'T0'), live, 'T1')
    expect(log).toHaveLength(2)
    expect(log[0]).toMatchObject({ mode: 'stream', who: 'roblito', at: 'T1' })
  })

  // Cutting from one streamer to another is the switch a viewer most notices.
  it('records a change of occupant inside live mode', () => {
    const log = appendModeEvent(appendModeEvent([], live, 'T0'), live2, 'T1')
    expect(log).toHaveLength(2)
    expect(log[0].who).toBe('someone')
  })

  it('caps the log', () => {
    let log: ModeEvent[] = []
    for (let i = 0; i < MODE_LOG_LIMIT + 10; i++) {
      log = appendModeEvent(log, i % 2 ? live : clips, `T${i}`)
    }
    expect(log).toHaveLength(MODE_LOG_LIMIT)
    expect(log[0].at).toBe(`T${MODE_LOG_LIMIT + 9}`)
  })

  it('freezes the reason at the moment of the switch', () => {
    const log = appendModeEvent([], live, 'T0')
    expect(log[0].because).toBe(live.because)
  })
})
