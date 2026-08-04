import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '@/lib/api'
import { storeTwitchProof } from '@/lib/twitchProof'
import { buildReturnUrl, takeAuthReturn } from '@/lib/authReturn'
import { CSGNMark } from '@/components/ui/Logo'

/**
 * The one landing page for the Twitch OAuth round trip.
 *
 * Twitch verification is a full-page redirect, never a popup: Twitch's login
 * offers "Sign in with Apple", and Apple refuses OAuth inside popups and
 * embedded webviews — which is most of our mobile traffic, since a large share
 * of users arrive in Phantom's in-app browser. The price of a redirect is that
 * the browser forgets where the user was, so this page's whole job is to put
 * them back.
 *
 * Every outcome arrives here — the server redirects successes with a one-time
 * `handoffId` and failures with a `twitchError` — and every outcome leaves the
 * same way: back to the exact page the user left from, with the flow's result
 * in the query string. `authReturn` holds that destination, which is why
 * linking Twitch from /account now returns to /account instead of dumping a
 * member on the home page behind a "Join CSGN" modal.
 *
 * Nothing is rendered for longer than it takes to do one function call, and the
 * navigation is `replace`, so this page never lands in the back-button history.
 */
export default function TwitchComplete() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    // Read-once, before any await: the destination must be consumed even if the
    // exchange below fails, or a refresh here would bounce the user again.
    const ret = takeAuthReturn()
    const goBack = (result: Record<string, string>) =>
      navigate(buildReturnUrl(ret, result), { replace: true })

    // The server hands failures back the same way it hands back successes, so
    // the user returns to where they started either way rather than to /.
    const serverError = params.get('twitchError')
    if (serverError) { goBack({ twitchError: serverError }); return }

    const handoffId = params.get('handoffId')
    if (!handoffId) { goBack({ twitchError: 'oauth_failed' }); return }

    api.consumeTwitchOAuthResult(handoffId)
      .then((result) => {
        storeTwitchProof({
          proofToken: result.twitchProofToken,
          twitch: {
            twitchUserId: result.twitchUserId,
            username: result.username,
            displayName: result.displayName,
            profileImageUrl: result.profileImageUrl,
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
        setError('Could not finish Twitch verification.')
        goBack({ twitchError: 'oauth_failed' })
      })
  }, [params, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="flex flex-col items-center gap-4 text-center" role="status" aria-live="polite">
        <CSGNMark className="w-12 h-12 animate-pulse" />
        <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" aria-hidden />
        <p className="text-sm text-gray-400">
          {error ? 'Taking you back…' : 'Finishing Twitch verification…'}
        </p>
      </div>
    </div>
  )
}
