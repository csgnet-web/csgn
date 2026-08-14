import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, XCircle } from 'lucide-react'
import { api } from '@/lib/api'
import { storeTwitchProof } from '@/lib/twitchProof'
import { buildReturnUrl, takeAuthReturn } from '@/lib/authReturn'
import { clearPendingTwitchLink, readPendingTwitchLink } from '@/lib/twitchLink'
import { twitchErrorMessage } from '@/hooks/useTwitchLink'
import { CSGNMark } from '@/components/ui/Logo'

/**
 * The one landing page for the Twitch OAuth round trip — for two very different
 * browsers.
 *
 * **The browser that started the sign-up.** It holds the signed `linkToken` in
 * its own sessionStorage, so it can claim the proof and carry on. This is the
 * desktop and mobile-Safari case, and this page behaves as it always has: claim,
 * stash the proof, return to the page the user left, render nothing for longer
 * than one function call.
 *
 * **A browser that was handed the link.** Most of our users start inside
 * Phantom's in-app browser, where Twitch's federated sign-in cannot work at all
 * (src/lib/webview.ts), so they finish the OAuth in Safari — a browser with no
 * sessionStorage of ours, no link token, and no sign-up in progress. There is
 * nothing for it to claim and nowhere to send it. Its whole job is to say
 * "done, go back", while the tab still open in Phantom polls the result and
 * finishes the job itself.
 *
 * Telling the two apart is exactly the question "do we hold a link token for
 * the state in this URL" — no user agent sniffing, no guessing.
 */
export default function TwitchComplete() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  /**
   * Decided once, on the first render, from the URL and this browser's own
   * storage — never from state set inside an effect. Which of the two browsers
   * we are is a fact about how the page was reached, so it is settled before
   * anything renders and cannot flip underneath the user.
   */
  const [route] = useState(() => {
    const state = params.get('state')
    const serverError = params.get('twitchError')
    const pending = readPendingTwitchLink()
    return {
      origin: pending && state && pending.state === state ? pending : null,
      serverError,
    }
  })
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    // Nothing to claim in the handed-off browser: the tab that started the flow
    // is polling for the same result and owns the outcome. This page just says
    // so and stops.
    const pending = route.origin
    if (!pending) return

    // Read-once, before any await: the destination must be consumed even if the
    // claim below fails, or a refresh here would bounce the user again.
    const ret = takeAuthReturn()
    const goBack = (result: Record<string, string>) =>
      navigate(buildReturnUrl(ret, result), { replace: true })

    if (route.serverError) {
      clearPendingTwitchLink()
      goBack({ twitchError: route.serverError })
      return
    }

    api.claimTwitchLink(pending.linkToken)
      .then((status) => {
        clearPendingTwitchLink()
        if (status.status !== 'ready') {
          goBack({ twitchError: status.status === 'failed' ? status.error : 'oauth_failed' })
          return
        }
        storeTwitchProof({
          proofToken: status.twitchProofToken,
          twitch: {
            twitchUserId: status.twitchUserId,
            username: status.username,
            displayName: status.displayName,
            profileImageUrl: status.profileImageUrl,
          },
          // The proof token is minted with a 15-minute TTL server-side.
          expiresAt: Date.now() + 15 * 60 * 1000,
        })
        goBack({ twitch: 'connected' })
      })
      .catch(() => {
        // No dead end and no message the user has to read to continue: the page
        // they came from owns the error copy (the sign-up modal and /account
        // both render it in context), so hand it back and let them carry on.
        clearPendingTwitchLink()
        goBack({ twitchError: 'oauth_failed' })
      })
  }, [route, navigate])

  if (!route.origin) {
    const ok = !route.serverError
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center space-y-3">
          {ok
            ? <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400" aria-hidden />
            : <XCircle className="w-10 h-10 mx-auto text-red-400" aria-hidden />}
          <h1 className="text-lg font-bold font-display text-white">
            {ok ? "You're verified" : 'Twitch verification failed'}
          </h1>
          <p className="text-sm text-gray-400 leading-relaxed">
            {ok
              ? 'Twitch is connected. Go back to CSGN — it has already picked this up. You can close this tab.'
              : twitchErrorMessage(route.serverError)}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="flex flex-col items-center gap-4 text-center" role="status" aria-live="polite">
        <CSGNMark className="w-12 h-12 animate-pulse" />
        <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" aria-hidden />
        <p className="text-sm text-gray-400">Finishing Twitch verification…</p>
      </div>
    </div>
  )
}
