import { useCallback, useEffect, useRef, useState } from 'react'
import { api, type TwitchOAuthResult } from '@/lib/api'
import { isEmbeddedBrowser, systemBrowserHref, systemBrowserName } from '@/lib/webview'
import {
  clearPendingTwitchLink,
  storePendingTwitchLink,
  waitForTwitchLink,
  type PendingTwitchLink,
} from '@/lib/twitchLink'

/**
 * Connect Twitch, from wherever the user happens to be standing.
 *
 * One hook, two routes, chosen by the browser rather than by the caller:
 *
 *  • A REAL BROWSER gets the redirect it always got. The tab goes to Twitch and
 *    comes back to /auth/twitch/complete, which claims the proof and returns
 *    the user to the page they left.
 *
 *  • AN EMBEDDED WEBVIEW — Phantom's in-app browser, and the same for X,
 *    Instagram and every other app that opens links in-app — never navigates
 *    at all. Twitch's federated sign-in is impossible there (lib/webview.ts
 *    explains why: Google returns `disallowed_useragent` and Twitch renders
 *    "Something went wrong"), so instead we hand the user a link into Safari or
 *    Chrome and start polling. The tab they are looking at stays exactly where
 *    it is, mid-sign-up, and fills itself in when the OAuth lands.
 *
 * The second route is the one that matters: it is the difference between "your
 * sign-up is broken" and "approve it in Safari and come back".
 */

export type TwitchLinkPhase = 'idle' | 'starting' | 'redirecting' | 'waiting' | 'linked' | 'error'

const ERROR_MESSAGES: Record<string, string> = {
  duplicate_twitch: 'That Twitch account is already connected to another CSGN account.',
  oauth_state_expired: 'That Twitch link expired. Tap Connect Twitch to start again.',
  oauth_exchange_failed: 'Twitch could not complete the sign-in. Please try again.',
  handoff_used: 'That Twitch link was already used. Tap Connect Twitch to start again.',
  oauth_failed: 'Twitch verification did not finish. Please try again.',
}

export function twitchErrorMessage(code: string | null | undefined): string {
  if (!code) return ERROR_MESSAGES.oauth_failed
  return ERROR_MESSAGES[code] || ERROR_MESSAGES.oauth_failed
}

export interface UseTwitchLinkOptions {
  /**
   * Called with the proof once Twitch comes back, on the polling route only.
   * The redirect route never reaches this — the page unloads — so callers must
   * also handle the proof that /auth/twitch/complete leaves behind.
   */
  onLinked: (result: TwitchOAuthResult) => void | Promise<void>
  /** Prepare for a full-page redirect: stash the draft, record where to return. */
  beforeRedirect?: () => void
}

export interface UseTwitchLinkState {
  phase: TwitchLinkPhase
  error: string
  /** Non-null while waiting: the tap target that escapes to the real browser. */
  handoff: { href: string; rawUrl: string; browserName: string } | null
  start: () => Promise<void>
  cancel: () => void
  /** Clears an error without restarting, so the panel can be dismissed. */
  reset: () => void
}

export function useTwitchLink({ onLinked, beforeRedirect }: UseTwitchLinkOptions): UseTwitchLinkState {
  const [phase, setPhase] = useState<TwitchLinkPhase>('idle')
  const [error, setError] = useState('')
  const [handoff, setHandoff] = useState<UseTwitchLinkState['handoff']>(null)
  const abortRef = useRef<AbortController | null>(null)
  // Held in a ref so the async poll below always calls the latest callback
  // rather than the one captured when the wait began — a five-minute closure
  // over stale state is a long time to be wrong.
  const onLinkedRef = useRef(onLinked)
  const beforeRedirectRef = useRef(beforeRedirect)
  useEffect(() => {
    onLinkedRef.current = onLinked
    beforeRedirectRef.current = beforeRedirect
  })

  useEffect(() => () => abortRef.current?.abort(), [])

  const poll = useCallback(async (link: PendingTwitchLink) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const status = await waitForTwitchLink(link, {
      signal: controller.signal,
      claim: (token) => api.claimTwitchLink(token),
    })
    if (controller.signal.aborted) return
    clearPendingTwitchLink()

    if (!status) {
      // Timed out. Not an error message worth alarming anyone with — the link
      // may simply have been abandoned — but the panel must stop spinning.
      setPhase('idle')
      setHandoff(null)
      return
    }
    if (status.status !== 'ready') {
      // `waitForTwitchLink` only ever resolves on a terminal status, so this is
      // the failure branch; the check is written as a narrowing so the proof
      // fields below are typed rather than asserted.
      setPhase('error')
      setError(twitchErrorMessage(status.status === 'failed' ? status.error : null))
      setHandoff(null)
      return
    }
    setPhase('linked')
    setHandoff(null)
    await onLinkedRef.current(status)
  }, [])

  const start = useCallback(async () => {
    setError('')
    setPhase('starting')
    try {
      const { authUrl, state, linkToken } = await api.startTwitchOAuth()
      const link: PendingTwitchLink = { state, linkToken, createdAt: Date.now() }
      storePendingTwitchLink(link)

      if (!isEmbeddedBrowser()) {
        beforeRedirectRef.current?.()
        setPhase('redirecting')
        window.location.href = authUrl
        return
      }

      setHandoff({ href: systemBrowserHref(authUrl), rawUrl: authUrl, browserName: systemBrowserName() })
      setPhase('waiting')
      void poll(link)
    } catch (err) {
      clearPendingTwitchLink()
      setPhase('error')
      setError(err instanceof Error ? err.message : 'Could not open Twitch. Please try again.')
    }
  }, [poll])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    clearPendingTwitchLink()
    setHandoff(null)
    setError('')
    setPhase('idle')
  }, [])

  const reset = useCallback(() => {
    setError('')
    setPhase((p) => (p === 'error' ? 'idle' : p))
  }, [])

  // Deliberately NOT resumed on mount from the stored pending link. Two of
  // these hooks can be alive at once (the auth modal is mounted behind every
  // page, and /account has its own), and the proof is single-use — an automatic
  // resume would have them race, with the loser showing "already used" on a
  // link that in fact succeeded. Switching apps doesn't unmount anything, so
  // the poll started by `start()` survives the trip to Safari on its own.

  return { phase, error, handoff, start, cancel, reset }
}
