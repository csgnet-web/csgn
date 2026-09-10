/**
 * THE CROSS-BROWSER OAUTH WAIT, with no provider in it.
 *
 * Twitch needed this first and the whole argument is written up in
 * `src/lib/twitchLink.ts`: a user who starts inside Phantom's in-app browser
 * cannot complete a federated sign-in there, so they finish it in Safari — a
 * browser that shares no storage with the tab they left. Nothing can be handed
 * back through the URL, because the URL comes back to the wrong browser. The
 * fix is the way device pairing works: the server signs a `linkToken` bound to
 * this attempt's OAuth state, the originating tab holds it and polls, and
 * whichever browser finishes the OAuth writes the result under that state.
 *
 * TikTok has exactly the same problem for exactly the same reason, and the
 * moment there were two of them the scheduling and the storage had to stop
 * being Twitch's. This module is that part — the pure half, with no provider
 * name, no API client and no Firebase in it. `twitchLink.ts` and
 * `tiktokLink.ts` are thin, differing only in a storage key.
 */

export interface PendingLink {
  /** The OAuth state — also the key the result is written under. */
  state: string
  /** Signed, short-lived bearer for claiming that result. Never leaves us. */
  linkToken: string
  createdAt: number
}

/** Server-side the link token lives 15 minutes; stop trusting it before then. */
export const LINK_TTL_MS = 14 * 60 * 1000

export function storePendingLink(key: string, link: PendingLink): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(link))
  } catch {
    /* sessionStorage unavailable — the same-tab redirect path still works */
  }
}

export function readPendingLink(key: string): PendingLink | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PendingLink>
    if (typeof parsed.state !== 'string' || typeof parsed.linkToken !== 'string') return null
    if (!parsed.state || !parsed.linkToken) return null
    const createdAt = typeof parsed.createdAt === 'number' ? parsed.createdAt : 0
    if (Date.now() - createdAt > LINK_TTL_MS) {
      clearPendingLink(key)
      return null
    }
    return { state: parsed.state, linkToken: parsed.linkToken, createdAt }
  } catch {
    clearPendingLink(key)
    return null
  }
}

export function clearPendingLink(key: string): void {
  try {
    sessionStorage.removeItem(key)
  } catch {
    /* sessionStorage unavailable — ignore */
  }
}

/**
 * How long to wait between polls, by how long we've been waiting.
 *
 * Fast at the start because the common case is a user who was already signed
 * into the provider in Safari and comes back in four seconds; slower after that
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

export interface WaitOptions<TStatus> {
  /**
   * One poll. Passed in rather than imported so this module stays free of the
   * Firebase-bearing api client — it is pure scheduling logic, and it is tested
   * as such.
   */
  claim: (linkToken: string) => Promise<TStatus>
  /** Abort the wait (component unmounted, user cancelled). */
  signal?: AbortSignal
  timeoutMs?: number
  /** Injected in tests. */
  now?: () => number
  sleep?: (ms: number) => Promise<void>
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Poll until the round trip finishes, however it finishes.
 *
 * Resolves with the server's terminal status — anything that is not `pending`.
 * Returns `null` when the caller aborted or we ran out of patience, which are
 * both "say nothing and let the user try again", not errors to show.
 *
 * A transport failure mid-poll is swallowed on purpose: phones lose signal when
 * they switch apps, and one dropped request is not a reason to tell someone
 * their sign-in failed when it may already have succeeded.
 */
export async function waitForLink<TStatus extends { status: string }>(
  link: PendingLink,
  options: WaitOptions<TStatus>,
): Promise<TStatus | null> {
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
