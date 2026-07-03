import { describe, it, expect } from 'vitest'
import {
  reduce,
  serverLiveSignal,
  INITIAL_STATE,
  BRB_GRACE_MS,
  STARTING_SOON_MAX_MS,
  SERVER_FRESH_MS,
  SERVER_OFFLINE_CONFIRM_MS,
  type MasterState,
  type MasterEvent,
  type StreamActivitySample,
} from './masterControl'

const T0 = 1_000_000

function slotBroadcast(channel = 'streamer_one'): MasterEvent {
  return {
    type: 'BROADCAST_CHANGED',
    broadcast: { streamUrl: `https://www.twitch.tv/${channel}`, source: 'slot', slotId: 'slot-1' },
    nowMs: T0,
  }
}

describe('masterControl reducer', () => {
  it('starts in channel-less INTERMISSION', () => {
    expect(INITIAL_STATE).toEqual({ mode: 'INTERMISSION', channel: null })
  })

  it('claimed slot → STARTING_SOON with a 10-minute deadline', () => {
    const s = reduce(INITIAL_STATE, slotBroadcast())
    expect(s).toEqual({ mode: 'STARTING_SOON', channel: 'streamer_one', deadlineMs: T0 + STARTING_SOON_MAX_MS })
  })

  it('default/fallback channel → INTERMISSION with the channel armed', () => {
    const s = reduce(INITIAL_STATE, {
      type: 'BROADCAST_CHANGED',
      broadcast: { streamUrl: 'https://www.twitch.tv/csgnet', source: 'default' },
      nowMs: T0,
    })
    expect(s).toEqual({ mode: 'INTERMISSION', channel: 'csgnet' })
  })

  it('no/unparseable URL → channel-less INTERMISSION', () => {
    expect(reduce(INITIAL_STATE, { type: 'BROADCAST_CHANGED', broadcast: null, nowMs: T0 }))
      .toEqual({ mode: 'INTERMISSION', channel: null })
    expect(reduce(INITIAL_STATE, { type: 'BROADCAST_CHANGED', broadcast: { streamUrl: 'not a url' }, nowMs: T0 }))
      .toEqual({ mode: 'INTERMISSION', channel: null })
  })

  it('YouTube emergency override → OVERRIDE', () => {
    const s = reduce(INITIAL_STATE, {
      type: 'BROADCAST_CHANGED',
      broadcast: { streamUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', source: 'emergency_override' },
      nowMs: T0,
    })
    expect(s).toEqual({ mode: 'OVERRIDE', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
  })

  it('ONLINE from STARTING_SOON or INTERMISSION-with-channel → LIVE', () => {
    const starting = reduce(INITIAL_STATE, slotBroadcast())
    expect(reduce(starting, { type: 'PLAYER_ONLINE' })).toEqual({ mode: 'LIVE', channel: 'streamer_one' })

    const idleWithChannel: MasterState = { mode: 'INTERMISSION', channel: 'csgnet' }
    expect(reduce(idleWithChannel, { type: 'PLAYER_ONLINE' })).toEqual({ mode: 'LIVE', channel: 'csgnet' })
  })

  it('ONLINE with no channel armed is ignored', () => {
    expect(reduce(INITIAL_STATE, { type: 'PLAYER_ONLINE' })).toBe(INITIAL_STATE)
  })

  it('the money path: drop mid-slot → BRB → grace expires → INTERMISSION → return → LIVE', () => {
    let s = reduce(INITIAL_STATE, slotBroadcast())
    s = reduce(s, { type: 'PLAYER_ONLINE' })
    expect(s.mode).toBe('LIVE')

    s = reduce(s, { type: 'PLAYER_OFFLINE', nowMs: T0 + 60_000 })
    expect(s).toEqual({ mode: 'BRB', channel: 'streamer_one', deadlineMs: T0 + 60_000 + BRB_GRACE_MS })

    // Ticks inside the grace window hold the BRB card
    s = reduce(s, { type: 'TICK', nowMs: T0 + 60_000 + BRB_GRACE_MS - 1 })
    expect(s.mode).toBe('BRB')

    // Grace expires → intermission, channel stays armed
    s = reduce(s, { type: 'TICK', nowMs: T0 + 60_000 + BRB_GRACE_MS })
    expect(s).toEqual({ mode: 'INTERMISSION', channel: 'streamer_one' })

    // Streamer comes back → straight to LIVE
    s = reduce(s, { type: 'PLAYER_ONLINE' })
    expect(s).toEqual({ mode: 'LIVE', channel: 'streamer_one' })
  })

  it('reconnect within grace → back to LIVE, no intermission', () => {
    let s: MasterState = { mode: 'BRB', channel: 'streamer_one', deadlineMs: T0 + BRB_GRACE_MS }
    s = reduce(s, { type: 'PLAYER_ONLINE' })
    expect(s).toEqual({ mode: 'LIVE', channel: 'streamer_one' })
  })

  it('never-online slot → STARTING_SOON times out to INTERMISSION', () => {
    let s = reduce(INITIAL_STATE, slotBroadcast())
    s = reduce(s, { type: 'TICK', nowMs: T0 + STARTING_SOON_MAX_MS })
    expect(s).toEqual({ mode: 'INTERMISSION', channel: 'streamer_one' })
  })

  it('OFFLINE during STARTING_SOON is expected and ignored', () => {
    const s = reduce(INITIAL_STATE, slotBroadcast())
    expect(reduce(s, { type: 'PLAYER_OFFLINE', nowMs: T0 + 5_000 })).toBe(s)
  })

  it('broadcast doc rewrite with the same channel keeps playback state', () => {
    const live: MasterState = { mode: 'LIVE', channel: 'streamer_one' }
    expect(reduce(live, slotBroadcast('streamer_one'))).toBe(live)
    expect(reduce(live, slotBroadcast('STREAMER_ONE'))).toBe(live)
  })

  it('slot handoff to a different channel resets to STARTING_SOON', () => {
    const live: MasterState = { mode: 'LIVE', channel: 'streamer_one' }
    const s = reduce(live, slotBroadcast('streamer_two'))
    expect(s).toEqual({ mode: 'STARTING_SOON', channel: 'streamer_two', deadlineMs: T0 + STARTING_SOON_MAX_MS })
  })
})

describe('serverLiveSignal (Helix ground truth)', () => {
  const NOW = 2_000_000
  const fresh = new Date(NOW - 10_000).toISOString() // checked 10s ago
  const live = (over: Partial<StreamActivitySample> = {}): StreamActivitySample => ({
    channel: 'streamer_one',
    lastCheckedAt: fresh,
    lastLive: true,
    lastLiveAt: fresh,
    ...over,
  })

  it('rescues an already-live channel out of STARTING_SOON (the ONLINE-never-fires case)', () => {
    expect(serverLiveSignal('STARTING_SOON', 'streamer_one', live(), NOW)).toBe('GO_LIVE')
  })

  it('rescues an armed INTERMISSION channel to LIVE', () => {
    expect(serverLiveSignal('INTERMISSION', 'streamer_one', live(), NOW)).toBe('GO_LIVE')
  })

  it('does nothing when already LIVE and still live', () => {
    expect(serverLiveSignal('LIVE', 'streamer_one', live(), NOW)).toBeNull()
  })

  it('never rescues from BRB — that is the embed’s real-time job', () => {
    expect(serverLiveSignal('BRB', 'streamer_one', live(), NOW)).toBeNull()
  })

  it('ignores a stale sample (poller down) so it cannot act on old data', () => {
    const stale = new Date(NOW - (SERVER_FRESH_MS + 1)).toISOString()
    expect(serverLiveSignal('STARTING_SOON', 'streamer_one', live({ lastCheckedAt: stale }), NOW)).toBeNull()
  })

  it('ignores a sample for a different channel', () => {
    expect(serverLiveSignal('STARTING_SOON', 'streamer_one', live({ channel: 'someone_else' }), NOW)).toBeNull()
  })

  it('drops LIVE→BRB only after a sustained server-confirmed offline', () => {
    const activity = live({
      lastLive: false,
      lastLiveAt: new Date(NOW - (SERVER_OFFLINE_CONFIRM_MS + 1)).toISOString(),
    })
    expect(serverLiveSignal('LIVE', 'streamer_one', activity, NOW)).toBe('GO_OFFLINE')
  })

  it('does NOT drop LIVE on a single fresh offline blip (recently seen live)', () => {
    const activity = live({ lastLive: false, lastLiveAt: new Date(NOW - 20_000).toISOString() })
    expect(serverLiveSignal('LIVE', 'streamer_one', activity, NOW)).toBeNull()
  })

  it('does NOT drop LIVE the server has never seen live (no lastLiveAt)', () => {
    const activity = live({ lastLive: false, lastLiveAt: undefined })
    expect(serverLiveSignal('LIVE', 'streamer_one', activity, NOW)).toBeNull()
  })

  it('does nothing without a channel or activity', () => {
    expect(serverLiveSignal('STARTING_SOON', null, live(), NOW)).toBeNull()
    expect(serverLiveSignal('STARTING_SOON', 'streamer_one', undefined, NOW)).toBeNull()
  })
})
