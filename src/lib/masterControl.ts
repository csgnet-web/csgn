/**
 * CSGN Master Control — the 24/7 network state machine driven by /player.
 *
 * OBS is a dumb encoder (one scene, one browser source, always streaming).
 * ALL network logic lives here: live detection, BRB grace, intermission
 * programming, and when to cut back to a returning streamer. Pure reducer —
 * no timers, no DOM — so every transition is unit-testable. The component
 * wires in real inputs (Firestore broadcast doc, Twitch player events, a
 * clock tick) and renders per state.
 */

import { detectStream } from '@/lib/player'

/** BRB card holds this long after a live feed drops, then intermission. */
export const BRB_GRACE_MS = 120_000
/** A slot streamer who never goes live gets this long before intermission. */
export const STARTING_SOON_MAX_MS = 600_000
/** No ONLINE event this long after (re)mount ⇒ treat channel as offline. */
export const MOUNT_TIMEOUT_MS = 15_000

export type MasterState =
  /** Twitch channel is online — fullscreen feed, audio on. */
  | { mode: 'LIVE'; channel: string }
  /** Slot streamer hasn't gone live yet — branded card until deadline. */
  | { mode: 'STARTING_SOON'; channel: string; deadlineMs: number }
  /** Feed was live and dropped — hold the BRB card until deadline. */
  | { mode: 'BRB'; channel: string; deadlineMs: number }
  /** Network programming: VOD rotation / animated board. `channel` (if any)
   *  stays mounted+muted so an ONLINE event can cut straight back to LIVE. */
  | { mode: 'INTERMISSION'; channel: string | null }
  /** Emergency-override URL that isn't a Twitch channel (e.g. YouTube). */
  | { mode: 'OVERRIDE'; url: string }

export interface BroadcastDoc {
  streamUrl?: string
  source?: string
  slotId?: string | null
}

export type MasterEvent =
  | { type: 'BROADCAST_CHANGED'; broadcast: BroadcastDoc | null; nowMs: number }
  | { type: 'PLAYER_ONLINE' }
  | { type: 'PLAYER_OFFLINE'; nowMs: number } // twitch offline/ended, or mount timeout
  | { type: 'TICK'; nowMs: number }

export const INITIAL_STATE: MasterState = { mode: 'INTERMISSION', channel: null }

function channelOf(state: MasterState): string | null {
  return 'channel' in state ? state.channel : null
}

export function reduce(state: MasterState, event: MasterEvent): MasterState {
  switch (event.type) {
    case 'BROADCAST_CHANGED': {
      const url = event.broadcast?.streamUrl ?? ''
      const detected = url ? detectStream(url) : null

      if (!detected) return { mode: 'INTERMISSION', channel: null }
      if (detected.type !== 'twitch') return { mode: 'OVERRIDE', url }

      const channel = detected.id.toLowerCase()
      // Same channel (doc rewrites, slot handoff to the same streamer):
      // keep the current playback state untouched.
      if (channelOf(state)?.toLowerCase() === channel) return state

      // A claimed slot or an explicit override gets the "starting soon"
      // courtesy window; the default/fallback network channel goes straight
      // to intermission and cuts in only when it actually comes online.
      const expected = event.broadcast?.source === 'slot' || event.broadcast?.source === 'emergency_override'
      return expected
        ? { mode: 'STARTING_SOON', channel, deadlineMs: event.nowMs + STARTING_SOON_MAX_MS }
        : { mode: 'INTERMISSION', channel }
    }

    case 'PLAYER_ONLINE': {
      const channel = channelOf(state)
      return channel ? { mode: 'LIVE', channel } : state
    }

    case 'PLAYER_OFFLINE': {
      if (state.mode === 'LIVE') {
        return { mode: 'BRB', channel: state.channel, deadlineMs: event.nowMs + BRB_GRACE_MS }
      }
      return state // STARTING_SOON / INTERMISSION already expect an offline channel
    }

    case 'TICK': {
      if ((state.mode === 'BRB' || state.mode === 'STARTING_SOON') && event.nowMs >= state.deadlineMs) {
        return { mode: 'INTERMISSION', channel: state.channel }
      }
      return state
    }
  }
}
