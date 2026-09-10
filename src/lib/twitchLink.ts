// The client half of the Twitch round trip: what we remember while the user is
// away, and how we find out they came back.
//
// There are two shapes of "away", and the difference is the whole reason this
// exists:
//
//   • SAME BROWSER (desktop, mobile Safari/Chrome). We navigate the tab to
//     Twitch and Twitch navigates it back. sessionStorage survives that, so the
//     pending link is waiting for us on the landing page.
//
//   • ANOTHER BROWSER (Phantom's in-app browser, and every other webview — see
//     lib/webview.ts for why we must leave). The tab we started in stays open
//     and alive; the OAuth happens somewhere else entirely, in a browser that
//     shares no storage with us. Nothing can be handed back through the URL,
//     because the URL comes back to the wrong browser.
//
// The second case is solved the way device pairing is solved: the server issues
// a signed `linkToken` bound to this attempt's OAuth `state`, we hold it, and we
// poll for the result. Whichever browser finishes the OAuth writes the result
// under that state; only the holder of the linkToken can claim it. The tab the
// user is looking at updates itself, so from their side they tap "Open Safari",
// approve Twitch, switch back, and it's already done.
//
// The mechanism itself now lives in `linkWait.ts`, because TikTok's sign-up door
// needs precisely the same thing and two copies of a five-minute polling
// schedule is two answers to how long we wait. What is left here is Twitch's
// storage key and Twitch's types.

import type { TwitchLinkStatus } from '@/lib/api'
import {
  storePendingLink, readPendingLink, clearPendingLink, waitForLink,
  LINK_TTL_MS, POLL_TIMEOUT_MS, pollDelayMs,
  type PendingLink, type WaitOptions,
} from '@/lib/linkWait'

export const TWITCH_LINK_KEY = 'csgn:twitchLink'

export type PendingTwitchLink = PendingLink
/** Kept as its own name so callers read as Twitch code; one definition. */
export const TWITCH_LINK_TTL_MS = LINK_TTL_MS

export { pollDelayMs, POLL_TIMEOUT_MS }
export type WaitTwitchOptions = WaitOptions<TwitchLinkStatus>

export const storePendingTwitchLink = (link: PendingTwitchLink): void =>
  storePendingLink(TWITCH_LINK_KEY, link)

export const readPendingTwitchLink = (): PendingTwitchLink | null =>
  readPendingLink(TWITCH_LINK_KEY)

export const clearPendingTwitchLink = (): void => clearPendingLink(TWITCH_LINK_KEY)

/**
 * Poll until the Twitch round trip finishes, however it finishes. See
 * `waitForLink` for the semantics — `null` means aborted or out of patience,
 * both of which are "say nothing and let them try again".
 */
export const waitForTwitchLink = (
  link: PendingTwitchLink,
  options: WaitTwitchOptions,
): Promise<TwitchLinkStatus | null> => waitForLink(link, options)
