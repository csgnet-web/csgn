import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/useAuth'
import { buildReturnUrl, takeAuthReturn } from '@/lib/authReturn'
import { clearPendingTikTokLink, readPendingTikTokLink } from '@/lib/tiktokLink'
import { tiktokErrorMessage } from '@/hooks/useTikTokLink'
import { CSGNMark } from '@/components/ui/Logo'

/**
 * The landing page for a TikTok SIGN-UP round trip — for two very different
 * browsers, exactly like /auth/twitch/complete.
 *
 * **The browser that started it** holds the signed `linkToken` in its own
 * sessionStorage, so it can claim the custom token, exchange it, and carry on
 * into the app already signed in.
 *
 * **A browser that was merely handed the link** — Safari, opened out of an
 * in-app browser because a webview's cookie jar makes TikTok sign-in hostile or
 * impossible — has no link token, nothing to claim and nowhere to send anybody.
 * Its whole job is to say "done, go back", while the tab still open in the app
 * polls the result and finishes the job itself.
 *
 * Telling the two apart is the question "do we hold a link token for the state
 * in this URL". No user agent sniffing, no guessing.
 */
export default function TikTokComplete() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { signInWithTikTok } = useAuth()
  /** Decided once, on the first render, from the URL and this browser's own
   *  storage — which of the two browsers we are is a fact about how the page was
   *  reached, so it is settled before anything renders. */
  const [route] = useState(() => {
    const state = params.get('state')
    const result = params.get('tiktok')
    const pending = readPendingTikTokLink()
    return {
      origin: pending && state && pending.state === state ? pending : null,
      // 'ready' is success; anything else is the callback naming a failure.
      serverError: result && result !== 'ready' ? result : null,
    }
  })
  // Seeded from the route rather than set inside the effect: a failure named in
  // the callback's own redirect is known before the first paint, and writing it
  // from an effect would render "signing you in" for a frame first.
  const [error, setError] = useState(route.serverError ? tiktokErrorMessage(route.serverError) : '')
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    // Nothing to claim in the handed-off browser: the tab that started the flow
    // is polling for the same result and owns the outcome.
    const pending = route.origin
    if (!pending) return

    // Read-once, before any await: the destination must be consumed even if the
    // claim below fails, or a refresh here would bounce the user again.
    const ret = takeAuthReturn()
    const goBack = (result: Record<string, string>) =>
      navigate(buildReturnUrl(ret, result), { replace: true })

    if (route.serverError) {
      clearPendingTikTokLink()
      return // the message is already on screen — see the seed above
    }

    api.claimTikTokLink(pending.linkToken)
      .then(async (status) => {
        clearPendingTikTokLink()
        if (status.status !== 'ready') {
          setError(tiktokErrorMessage(status.status === 'failed' ? status.error : null))
          return
        }
        // The account already exists — exchanging the token is the whole of
        // "signing up" from here.
        await signInWithTikTok(status.customToken)
        // A brand-new account goes straight to /studio — the screen that pays
        // this door off, because their TikToks are already importable there and
        // the whole promise was "connect TikTok, your clips air". A returning
        // one goes back to whatever page they left.
        if (status.created) navigate('/studio?welcome=tiktok', { replace: true })
        else goBack({ tiktok: 'signed_in' })
      })
      .catch(() => {
        clearPendingTikTokLink()
        setError(tiktokErrorMessage('failed'))
      })
  }, [route, navigate, signInWithTikTok])

  const handedOff = !route.origin
  const ok = handedOff ? !route.serverError : !error

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center space-y-3">
        {handedOff || error ? (
          ok
            ? <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400" aria-hidden />
            : <XCircle className="w-10 h-10 mx-auto text-red-400" aria-hidden />
        ) : (
          <Loader2 className="w-10 h-10 mx-auto text-gray-400 animate-spin" aria-hidden />
        )}

        <h1 className="text-lg font-bold font-display text-white">
          {handedOff
            ? (ok ? "You're in" : 'TikTok sign-in failed')
            : error ? 'TikTok sign-in failed' : 'Signing you in'}
        </h1>

        <p className="text-sm text-gray-400 leading-relaxed">
          {handedOff
            ? (ok
              ? 'Your CSGN account is ready. Go back to the tab you started in — it has already picked this up, and you can close this one.'
              : tiktokErrorMessage(route.serverError))
            : error || 'One moment — setting up your account.'}
        </p>

        <div className="pt-2 flex justify-center opacity-40">
          <CSGNMark className="h-5 w-auto" />
        </div>
      </div>
    </div>
  )
}
