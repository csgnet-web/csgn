import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { CheckCircle2, Clapperboard, Loader2, Share2, TriangleAlert } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/useAuth'
import { useAuthModal } from '@/contexts/useAuthModal'
import { usePageMeta } from '@/hooks/usePageMeta'
import { parseShareSearch } from '@/lib/shareTarget'
import { Button } from '@/components/ui/Button'
import { CsgnLogo } from '@/components/ui/CsgnLogo'

/**
 * THE SHARE SHEET LANDING — where a clip arrives from Instagram, TikTok or X.
 *
 * A member watching their own Reel in Instagram hits Share, picks CSGN from the
 * sheet, and Android navigates here with the link in the query string (see
 * public/manifest.webmanifest → share_target). Meta will not give us an API
 * that can list somebody's posts, so this is the closest thing to import that
 * exists — and for the common case it is genuinely better, because the person
 * is already looking at the post they want to send.
 *
 * ── The design rule for this page ──────────────────────────────────────────
 *
 * It must not become a form. Somebody who came through a share sheet is two
 * taps into a flow they expected to be one; putting a text field, a title box
 * and a submit button in front of them wastes the entire advantage. So the page
 * submits ON ARRIVAL and reports what happened. The only interaction is the
 * one case that genuinely needs it — being signed out.
 *
 * It is also strictly idempotent per visit: a latch guards against React's
 * double-invoked effects in development and against a re-render posting the
 * same clip twice, which would be the worst possible first impression.
 */

/** What the submit is doing. Everything else about this page is DERIVED from
 *  the URL and the auth state rather than stored — see below. */
type Result =
  | { kind: 'sending' }
  | { kind: 'done'; title: string }
  | { kind: 'error'; message: string }

export default function Share() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const { openAuth } = useAuthModal()
  usePageMeta({
    title: 'Add a clip to CSGN',
    description: 'Share a clip straight into the CSGN network from Instagram, TikTok, X or YouTube.',
    path: '/share',
    // Nothing here is worth indexing — it is a machine endpoint with a face on.
    noIndex: true,
  })

  const shared = parseShareSearch(location.search)
  const [result, setResult] = useState<Result | null>(null)
  // A REF, not state: this guards against posting the same clip twice (React's
  // double-invoked effects in development, a re-render, a token refresh landing
  // mid-flight). Storing it in state would mean a setState in the effect body,
  // and it is not something the UI renders — it is a latch.
  const sentRef = useRef(false)

  // Deliberately does NOT reset `result` — the caller does that if it needs to.
  // On the first run there is nothing to reset, and a synchronous setState here
  // would be a state write inside the effect body for no gain.
  const post = useCallback(() => {
    let cancelled = false
    api.submitClip(shared.url, shared.title)
      .then((res) => {
        if (!cancelled) setResult({ kind: 'done', title: res.clip.title || shared.title || 'Your clip' })
      })
      .catch((err: unknown) => {
        if (!cancelled) setResult({ kind: 'error', message: err instanceof Error ? err.message : 'Could not add that link.' })
      })
    return () => { cancelled = true }
  }, [shared.url, shared.title])

  // The whole page is one decision: if we have a link and a signed-in member,
  // POST it. Nothing about the phase is stored — a stored phase and the real
  // one drift the moment auth resolves a beat after the render that read it,
  // and the drift shows up as a spinner that never stops.
  useEffect(() => {
    if (loading || sentRef.current || !shared.url || !user) return
    sentRef.current = true
    return post()
  }, [loading, shared.url, user, post])

  const retry = () => { setResult(null); post() }

  const phase: 'signin' | 'sending' | 'done' | 'error' | 'nolink' =
    result?.kind === 'done' ? 'done'
      : result?.kind === 'error' ? 'error'
        : !shared.url ? 'nolink'
          : !loading && !user ? 'signin'
            : 'sending'

  const error = result?.kind === 'error' ? result.message : ''
  const clipTitle = result?.kind === 'done' ? result.title : ''

  // Once signed in, the queued share goes through without another tap — the
  // effect above re-runs with a user and posts it.
  const signIn = () => openAuth()

  return (
    <main className="min-h-dvh pt-16 pb-[var(--csgn-tabbar)] lg:pb-10 px-4 bg-[#050507]">
      <div className="max-w-md mx-auto pt-8">
        <div className="flex items-center gap-3 mb-6">
          <CsgnLogo className="h-9 w-auto" />
          <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-gray-500">Add a clip</span>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
          {shared.url && (
            <div className="mb-5 rounded-xl border border-white/[0.06] bg-black/40 px-3.5 py-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600 mb-1">Shared link</p>
              <p className="text-[12px] font-mono text-gray-300 break-all leading-snug">{shared.url}</p>
              {shared.title && <p className="mt-1.5 text-[12px] text-gray-500 leading-snug">{shared.title}</p>}
            </div>
          )}

          {phase === 'sending' && (
            <div className="flex items-center gap-3 text-gray-300">
              <Loader2 className="w-4 h-4 animate-spin text-primary-400" />
              <span className="text-sm">Adding it to your reel…</span>
            </div>
          )}

          {phase === 'signin' && (
            <>
              <div className="flex items-start gap-3">
                <Share2 className="w-5 h-5 text-primary-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-white">We've got your link.</p>
                  <p className="mt-1 text-[13px] text-gray-400 leading-relaxed">
                    Sign in and it goes straight onto your reel — nothing else to fill in. It takes about
                    a minute and you don't need a wallet to start.
                  </p>
                </div>
              </div>
              <Button className="mt-4 w-full" onClick={signIn}>Sign in and add it</Button>
            </>
          )}

          {phase === 'done' && (
            <>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-positive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-white">On your reel.</p>
                  <p className="mt-1 text-[13px] text-gray-400 leading-relaxed">
                    “{clipTitle}” is in the queue. Clips are checked before they air — how much of the
                    day yours gets follows the $CSGN you hold.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link to="/studio"><Button variant="secondary" className="w-full">Open My Reel</Button></Link>
                <Link to="/watch"><Button className="w-full">Watch CSGN</Button></Link>
              </div>
            </>
          )}

          {phase === 'error' && (
            <>
              <div className="flex items-start gap-3">
                <TriangleAlert className="w-5 h-5 text-negative shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-white">That one didn't go through.</p>
                  <p className="mt-1 text-[13px] text-gray-400 leading-relaxed">{error}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button variant="secondary" className="w-full" onClick={retry}>Try again</Button>
                <Link to="/studio"><Button className="w-full">Open My Reel</Button></Link>
              </div>
            </>
          )}

          {phase === 'nolink' && (
            <>
              <div className="flex items-start gap-3">
                <Clapperboard className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-white">
                    {shared.hadContent ? "There was no link in that share." : 'Nothing shared yet.'}
                  </p>
                  <p className="mt-1 text-[13px] text-gray-400 leading-relaxed">
                    {shared.hadContent
                      ? 'Some apps share a screenshot or plain text rather than a link. Open the post, choose “Copy link” or share the link itself, and try again.'
                      : 'Install CSGN to your home screen and it shows up in your share sheet — then a clip is one tap from Instagram, TikTok, X or YouTube.'}
                  </p>
                </div>
              </div>
              <Link to="/studio" className="block mt-4">
                <Button variant="secondary" className="w-full">Add it by hand instead</Button>
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => navigate('/watch')}
          className="mt-5 w-full text-center text-[12px] text-gray-600 hover:text-gray-400 transition-colors"
        >
          Not now — take me to the channel
        </button>
      </div>
    </main>
  )
}
