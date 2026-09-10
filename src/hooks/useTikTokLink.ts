import { useCallback, useEffect, useRef, useState } from 'react'
import { api, type TikTokAccount } from '@/lib/api'
import { isEmbeddedBrowser, systemBrowserHref, systemBrowserName } from '@/lib/webview'
import {
  clearPendingTikTokLink,
  storePendingTikTokLink,
  waitForTikTokLink,
  type PendingTikTokLink,
} from '@/lib/tiktokLink'

/**
 * SIGN UP WITH TIKTOK — from wherever the person happens to be standing.
 *
 * ── Why this door exists ───────────────────────────────────────────────────
 *
 * The clip factory's entire pitch is "connect TikTok, your clips air". Until
 * now that was step two: first make an account (a wallet, or a Google/X/email
 * door that is not switched on yet), THEN connect TikTok. So the one thing we
 * are asking a creator to do was behind a thing we were asking them to do
 * first, and the first thing was a crypto wallet.
 *
 * Now TikTok is the credential. One tap, and the account exists AND their clips
 * are importable — the two steps the product actually needs collapse into the
 * one the creator already wanted to take.
 *
 * The wallet is asked for at PAYOUT, because that is the first moment it does
 * anything. Somewhere for money to land is not a prerequisite for making
 * something; it is a prerequisite for being paid.
 *
 * ── Two routes, chosen by the browser ──────────────────────────────────────
 *
 *  • A REAL BROWSER navigates to TikTok and comes back to /auth/tiktok, which
 *    claims the result and signs them in.
 *
 *  • AN EMBEDDED WEBVIEW never navigates. Its cookie jar is its own, so
 *    somebody signed into TikTok on their phone is signed OUT in there and
 *    faces a password prompt inside an app that is not TikTok — which is both
 *    hostile and, for the federated options, impossible (src/lib/webview.ts).
 *    Instead they get a tap target into Safari or Chrome and this tab polls.
 *    They approve elsewhere, switch back, and are already signed in.
 */

export type TikTokLinkPhase = 'idle' | 'starting' | 'redirecting' | 'waiting' | 'done' | 'error'

const ERROR_MESSAGES: Record<string, string> = {
  cancelled: 'TikTok sign-in was cancelled.',
  expired: 'That TikTok link expired. Tap Continue with TikTok to start again.',
  oauth_state_expired: 'That TikTok link expired. Tap Continue with TikTok to start again.',
  handoff_used: 'That TikTok link was already used. Tap Continue with TikTok to start again.',
  failed: 'TikTok could not complete the sign-in. Please try again.',
  tiktok_not_configured: 'TikTok sign-in is not switched on for this site yet.',
}

export function tiktokErrorMessage(code: string | null | undefined): string {
  if (!code) return ERROR_MESSAGES.failed
  return ERROR_MESSAGES[code] || ERROR_MESSAGES.failed
}

export interface UseTikTokLinkOptions {
  /** Called with the account once TikTok comes back, on the polling route only.
   *  The redirect route never reaches this — the page unloads — so /auth/tiktok
   *  handles that half. */
  onAccount: (account: TikTokAccount) => void | Promise<void>
  beforeRedirect?: () => void
}

export interface UseTikTokLinkState {
  phase: TikTokLinkPhase
  error: string
  /** Non-null while waiting: the tap target that escapes to the real browser. */
  handoff: { href: string; rawUrl: string; browserName: string } | null
  start: () => Promise<void>
  cancel: () => void
  reset: () => void
}

export function useTikTokLink({ onAccount, beforeRedirect }: UseTikTokLinkOptions): UseTikTokLinkState {
  const [phase, setPhase] = useState<TikTokLinkPhase>('idle')
  const [error, setError] = useState('')
  const [handoff, setHandoff] = useState<UseTikTokLinkState['handoff']>(null)
  const abortRef = useRef<AbortController | null>(null)
  // Held in a ref so the async poll below always calls the latest callback
  // rather than the one captured when the wait began.
  const onAccountRef = useRef(onAccount)
  const beforeRedirectRef = useRef(beforeRedirect)
  useEffect(() => {
    onAccountRef.current = onAccount
    beforeRedirectRef.current = beforeRedirect
  })

  useEffect(() => () => abortRef.current?.abort(), [])

  const poll = useCallback(async (link: PendingTikTokLink) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const status = await waitForTikTokLink(link, {
      signal: controller.signal,
      claim: (token) => api.claimTikTokLink(token),
    })
    if (controller.signal.aborted) return
    clearPendingTikTokLink()

    if (!status) {
      // Timed out or abandoned. Not worth alarming anyone with, but the panel
      // must stop spinning.
      setPhase('idle')
      setHandoff(null)
      return
    }
    if (status.status !== 'ready') {
      setPhase('error')
      setError(tiktokErrorMessage(status.status === 'failed' ? status.error : null))
      setHandoff(null)
      return
    }
    setPhase('done')
    setHandoff(null)
    await onAccountRef.current(status)
  }, [])

  const start = useCallback(async () => {
    setError('')
    setPhase('starting')
    try {
      const { authUrl, state, linkToken } = await api.startTikTokOAuth()
      if (!linkToken) {
        // The server answered the LINK path, which means a session was sent —
        // so this hook is being used by somebody who is already signed in and
        // should be connecting their account from /studio instead.
        throw new Error('You are already signed in — connect TikTok from your studio.')
      }
      const link: PendingTikTokLink = { state, linkToken, createdAt: Date.now() }
      storePendingTikTokLink(link)

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
      clearPendingTikTokLink()
      setPhase('error')
      setError(err instanceof Error ? err.message : 'Could not open TikTok. Please try again.')
    }
  }, [poll])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    clearPendingTikTokLink()
    setHandoff(null)
    setError('')
    setPhase('idle')
  }, [])

  const reset = useCallback(() => {
    setError('')
    setPhase((p) => (p === 'error' ? 'idle' : p))
  }, [])

  // Deliberately NOT resumed on mount from the stored pending link — the same
  // reasoning as useTwitchLink: the result is single-use, two live hooks would
  // race for it, and the loser would report "already used" on a sign-up that in
  // fact succeeded.

  return { phase, error, handoff, start, cancel, reset }
}
