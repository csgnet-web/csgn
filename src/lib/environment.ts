/**
 * Runtime environment detection for /player.
 *
 * The page renders in two very different browsers:
 *
 *  - A normal desktop/mobile tab (a viewer opening csgn.fun/player). Here the
 *    browser's autoplay policy forbids un-muting media without a user gesture,
 *    so audio can only start after the viewer interacts with the page.
 *
 *  - OBS's embedded Chromium (CEF) Browser Source, the 24/7 encoder. OBS
 *    launches CEF with autoplay-with-sound allowed and there is never a user
 *    gesture, so audio must be forced on programmatically — and the Twitch
 *    embed's ONLINE event is unreliable there, so LIVE must be inferred from
 *    playback instead.
 *
 * OBS injects a `window.obsstudio` object into every Browser Source, which is
 * the documented, reliable way to tell the two apart.
 */

interface ObsStudioBridge {
  pluginVersion?: string
  getControlLevel?: (cb: (level: number) => void) => void
}

declare global {
  interface Window {
    obsstudio?: ObsStudioBridge
  }
}

/** True when running inside an OBS Browser Source (CEF). */
export function isOBS(): boolean {
  return typeof window !== 'undefined' && Boolean(window.obsstudio)
}

/** OBS Browser Source plugin version, or null outside OBS. */
export function obsVersion(): string | null {
  if (typeof window === 'undefined') return null
  return window.obsstudio?.pluginVersion ?? null
}
