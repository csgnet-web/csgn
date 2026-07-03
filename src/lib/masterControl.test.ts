import { describe, it, expect } from 'vitest'
import {
  reduce,
  INITIAL_STATE,
  BRB_GRACE_MS,
  STARTING_SOON_MAX_MS,
  type MasterState,
  type MasterEvent,
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
