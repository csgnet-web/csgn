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
/** A server Helix sample older than this is ignored — the poller may be down. */
export const SERVER_FRESH_MS = 90_000
/** Only let the server force a LIVE→BRB drop once the channel hasn't been seen
 *  live for this long, so a single transient Helix failure can't false-trigger. */
export const SERVER_OFFLINE_CONFIRM_MS = 150_000

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

/** The server-verified live sample the fee poller writes onto a slot doc. */
export interface StreamActivitySample {
  channel?: string
  lastCheckedAt?: string
  lastLive?: boolean
  lastLiveAt?: string
}

/**
 * Decide what the server's Twitch Helix sample tells us to do, independent of
 * the (flaky) embed events. Pure so every situation is unit-testable.
 *
 *   'GO_LIVE'    leave a pre-live card — the channel is already broadcasting and
 *                the embed's ONLINE event (transition-only) may never fire.
 *   'GO_OFFLINE' backstop drop detection from LIVE when the embed's OFFLINE never
 *                fired, gated so a lone Helix hiccup can't false-trigger a BRB.
 *   null         no action — trust the embed's real-time events.
 *
 * Never rescues *from* BRB: that state is only entered by a real embed drop and
 * a stale server sample would show Twitch's offline screen over our BRB card.
 */
export function serverLiveSignal(
  mode: MasterState['mode'],
  channel: string | null,
  activity: StreamActivitySample | undefined,
  nowMs: number,
): 'GO_LIVE' | 'GO_OFFLINE' | null {
  if (!channel) return null
  if (activity?.channel && activity.channel.toLowerCase() !== channel.toLowerCase()) return null
  const checkedMs = activity?.lastCheckedAt ? new Date(activity.lastCheckedAt).getTime() : 0
  const fresh = checkedMs > 0 && nowMs - checkedMs < SERVER_FRESH_MS
  if (!fresh) return null

  if (activity?.lastLive) {
    return mode === 'STARTING_SOON' || mode === 'INTERMISSION' ? 'GO_LIVE' : null
  }
  if (mode === 'LIVE') {
    const lastLiveMs = activity?.lastLiveAt ? new Date(activity.lastLiveAt).getTime() : 0
    // Require a prior confirmed-live sample so we only drop a stream the server
    // actually watched go offline — never one it simply hasn't sampled yet.
    if (lastLiveMs > 0 && nowMs - lastLiveMs > SERVER_OFFLINE_CONFIRM_MS) return 'GO_OFFLINE'
  }
  return null
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
