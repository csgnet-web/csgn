import { useEffect, useRef, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { loadTwitterWidgets } from '@/lib/twitterWidgets'

const EMBED_TIMEOUT_MS = 10_000

type EmbedState = 'loading' | 'ready' | 'failed'

/**
 * Embeds the X post carrying CSGN's live broadcast via widgets.js.
 * X embeds are self-sizing (max-width 550px, height set by content) — the
 * parent "broadcast stage" centers this column instead of forcing 16:9.
 * Failure (ad blocker, deleted post, timeout) falls back to an outbound link.
 */
export default function XBroadcastEmbed({ postId, postUrl }: { postId: string; postUrl: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const requestIdRef = useRef(0)
  const [state, setState] = useState<EmbedState>('loading')

  // Reset to loading when the broadcast post changes — state adjustment during
  // render (not in the effect) so the skeleton shows on the very next paint.
  const [prevPostId, setPrevPostId] = useState(postId)
  if (prevPostId !== postId) {
    setPrevPostId(postId)
    setState('loading')
  }

  useEffect(() => {
    const requestId = ++requestIdRef.current
    const container = containerRef.current
    if (!container) return

    container.innerHTML = ''

    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      if (requestIdRef.current === requestId) setState('failed')
    }, EMBED_TIMEOUT_MS)

    loadTwitterWidgets()
      .then((twttr) =>
        twttr.widgets.createTweet(postId, container, {
          theme: 'dark',
          align: 'center',
          conversation: 'none',
          dnt: true,
          width: 550,
        }),
      )
      .then((el) => {
        clearTimeout(timeout)
        if (requestIdRef.current !== requestId || timedOut) {
          // Stale request (StrictMode remount or URL change mid-load) — discard.
          el?.remove()
          return
        }
        setState(el ? 'ready' : 'failed')
      })
      .catch(() => {
        clearTimeout(timeout)
        if (requestIdRef.current === requestId) setState('failed')
      })

    return () => {
      clearTimeout(timeout)
      container.innerHTML = ''
    }
  }, [postId])

  return (
    <div className="w-full flex flex-col items-center">
      {state === 'loading' && (
        <div className="w-full max-w-[550px] rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
          <div className="h-[310px] animate-shimmer" />
          <div className="px-4 py-3 text-center text-[11px] uppercase tracking-[0.2em] text-gray-500">
            Loading live broadcast…
          </div>
        </div>
      )}

      {state === 'failed' && (
        <div className="w-full max-w-[550px] rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-10 flex flex-col items-center gap-4 text-center">
          <p className="text-sm text-gray-300">
            The embedded player couldn't load — the broadcast is still live on X.
          </p>
          <a
            href={postUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-gray-200 text-black rounded-lg text-sm font-black uppercase tracking-wider transition-colors"
          >
            Watch live on X <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      )}

      {/* Kept laid out (not display:none) while loading so widgets.js can measure width. */}
      <div ref={containerRef} className={`w-full max-w-[550px] ${state === 'ready' ? '' : 'h-0 overflow-hidden'}`} />
    </div>
  )
}
