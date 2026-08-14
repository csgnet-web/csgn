// The client half of the Twitch round trip: what we remember while the user is
// away, and how we find out they came back.
//
// There are two shapes of "away", and the difference is the whole reason this
// file exists:
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

import type { TwitchLinkStatus } from '@/lib/api'

export const TWITCH_LINK_KEY = 'csgn:twitchLink'

export interface PendingTwitchLink {
  /** The OAuth state — also the key the result is written under. */
  state: string
  /** Signed, short-lived bearer for claiming that result. Never leaves us. */
  linkToken: string
  createdAt: number
}

/** Server-side the link token lives 15 minutes; stop trusting it before then. */
export const TWITCH_LINK_TTL_MS = 14 * 60 * 1000

export function storePendingTwitchLink(link: PendingTwitchLink): void {
  try {
    sessionStorage.setItem(TWITCH_LINK_KEY, JSON.stringify(link))
  } catch {
    /* sessionStorage unavailable — the same-tab redirect path still works */
  }
}

export function readPendingTwitchLink(): PendingTwitchLink | null {
  try {
    const raw = sessionStorage.getItem(TWITCH_LINK_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PendingTwitchLink>
    if (typeof parsed.state !== 'string' || typeof parsed.linkToken !== 'string') return null
    if (!parsed.state || !parsed.linkToken) return null
    const createdAt = typeof parsed.createdAt === 'number' ? parsed.createdAt : 0
    if (Date.now() - createdAt > TWITCH_LINK_TTL_MS) {
      clearPendingTwitchLink()
      return null
    }
    return { state: parsed.state, linkToken: parsed.linkToken, createdAt }
  } catch {
    clearPendingTwitchLink()
    return null
  }
}

export function clearPendingTwitchLink(): void {
  try {
    sessionStorage.removeItem(TWITCH_LINK_KEY)
  } catch {
    /* sessionStorage unavailable — ignore */
  }
}

/**
 * How long to wait between polls, by how long we've been waiting.
 *
 * Fast at the start because the common case is a user who was already signed
 * into Twitch in Safari and comes back in four seconds; slower after that
 * because the remaining cases are someone typing a password or fetching a 2FA
 * code, and every poll is a billed Firestore read. Roughly 70 requests over the
 * full five minutes, front-loaded where they matter.
 */
export function pollDelayMs(elapsedMs: number): number {
  if (elapsedMs < 20_000) return 2_000
  if (elapsedMs < 60_000) return 3_000
  return 5_000
}

/** Give up waiting after this long; the server-side result expires at 10 min. */
export const POLL_TIMEOUT_MS = 5 * 60 * 1000

export interface WaitOptions {
  /**
   * One poll. Passed in rather than imported so this module stays free of the
   * Firebase-bearing api client — it is pure scheduling logic, and it is tested
   * as such.
   */
  claim: (linkToken: string) => Promise<TwitchLinkStatus>
  /** Abort the wait (component unmounted, user cancelled). */
  signal?: AbortSignal
  timeoutMs?: number
  /** Injected in tests. */
  now?: () => number
  sleep?: (ms: number) => Promise<void>
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Poll until the Twitch round trip finishes, however it finishes.
 *
 * Resolves with the server's terminal status — `ready` with the proof, or
 * `failed` with a reason. Returns `null` when the caller aborted or we ran out
 * of patience, which are both "say nothing and let the user try again", not
 * errors to show.
 *
 * A transport failure mid-poll is swallowed on purpose: phones lose signal when
 * they switch apps, and one dropped request is not a reason to tell someone
 * their Twitch link failed when it may already have succeeded.
 */
export async function waitForTwitchLink(
  link: PendingTwitchLink,
  options: WaitOptions,
): Promise<TwitchLinkStatus | null> {
  const now = options.now ?? (() => Date.now())
  const sleep = options.sleep ?? defaultSleep
  const claim = options.claim
  const timeoutMs = options.timeoutMs ?? POLL_TIMEOUT_MS
  const startedAt = now()

  for (;;) {
    if (options.signal?.aborted) return null
    const elapsed = now() - startedAt
    if (elapsed >= timeoutMs) return null

    await sleep(pollDelayMs(elapsed))
    if (options.signal?.aborted) return null

    try {
      const status = await claim(link.linkToken)
      if (status.status !== 'pending') return status
    } catch {
      /* offline, rate limited, or app-switched mid-request — keep waiting */
    }
  }
}
