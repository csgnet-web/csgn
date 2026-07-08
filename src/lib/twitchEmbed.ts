/**
 * Singleton loader for Twitch's embed player JS API (embed.twitch.tv).
 * Unlike the bare player.twitch.tv iframe, the JS API fires real-time
 * ONLINE / OFFLINE / ENDED events — the signal Master Control uses to know
 * a streamer dropped or came back. Loaded once; concurrent callers share
 * one promise; rejects on script failure so callers can fall back.
 */

/** One entry from Twitch's quality list. `group` is the stable id passed to
 *  setQuality ('chunked' = source/highest); `name` is the human label. */
export interface TwitchQuality {
  group: string
  name?: string
}

export interface TwitchPlayer {
  addEventListener: (event: string, cb: () => void) => void
  removeEventListener: (event: string, cb: () => void) => void
  setChannel: (channel: string) => void
  getChannel: () => string
  setMuted: (muted: boolean) => void
  getMuted: () => boolean
  setVolume: (volume: number) => void
  getVolume: () => number
  play: () => void
  pause: () => void
  /** Pin the stream to a fixed quality. 'chunked' is Twitch's source feed. */
  setQuality: (group: string) => void
  /** Best→worst list; empty until playback has started. */
  getQualities?: () => TwitchQuality[]
  getQuality?: () => string
  /** Seconds of playback position. For live channels this tracks the video
   *  element, so it advancing is proof that frames are actually rendering —
   *  the ground-truth signal FeedGate uses to tell a playing feed from a
   *  wedged one (Twitch's events keep reporting "playing" on a frozen feed). */
  getCurrentTime?: () => number
}

export interface TwitchPlayerCtor {
  new (el: string | HTMLElement, options: Record<string, unknown>): TwitchPlayer
  READY: string
  ONLINE: string
  OFFLINE: string
  ENDED: string
  /** Playback actually started — a reliable "the channel is live" proxy for
   *  environments (notably OBS's CEF) where ONLINE fires late or not at all. */
  PLAYING: string
  /** Autoplay-with-sound was blocked by the browser — retry muted, unmute on
   *  the next user gesture. */
  PLAYBACK_BLOCKED: string
}

declare global {
  interface Window {
    Twitch?: { Player: TwitchPlayerCtor }
  }
}

const EMBED_SRC = 'https://embed.twitch.tv/embed/v1.js'

let loaderPromise: Promise<TwitchPlayerCtor> | null = null

export function loadTwitchPlayer(): Promise<TwitchPlayerCtor> {
  if (loaderPromise) return loaderPromise

  loaderPromise = new Promise<TwitchPlayerCtor>((resolve, reject) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      reject(new Error('twitch embed: no DOM'))
      return
    }
    if (window.Twitch?.Player) {
      resolve(window.Twitch.Player)
      return
    }

    const script = document.createElement('script')
    script.src = EMBED_SRC
    script.async = true
    script.onload = () => {
      if (window.Twitch?.Player) resolve(window.Twitch.Player)
      else reject(new Error('twitch embed: script loaded but Twitch.Player missing'))
    }
    script.onerror = () => {
      loaderPromise = null // allow retry on a later mount
      reject(new Error('twitch embed: script failed to load'))
    }
    document.head.appendChild(script)
  })

  return loaderPromise
}
