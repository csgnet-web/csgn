import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Loader2, Music2, RefreshCw } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/Button'

/**
 * IMPORT FROM A CONNECTED TIKTOK.
 *
 * The point of this panel is to change the UNIT OF THE ASK. Posting a clip
 * today means: go to TikTok, find the post, copy the link, come back, paste.
 * With an account connected it means: tick three of these. Choosing from what
 * you already made is an order of magnitude easier than fetching, which is why
 * this is the biggest single lever on posting conversion in the product.
 *
 * It also fixes something quietly: a TikTok pasted by hand has no readable
 * runtime, so every one of them is scheduled against a 45-second guess. The
 * Display API gives us the real duration, so imported clips are exact.
 *
 * ── Three states this panel must never confuse ─────────────────────────────
 *
 *   1. Not connected           → offer the button.
 *   2. Connected, no videos    → say so, plainly.
 *   3. Connected, unreadable   → say THAT, and offer a reconnect.
 *
 * Collapsing 3 into 2 — rendering "you have no videos" when the truth is "we
 * could not read them" — is the failure this codebase has shipped more than any
 * other, so the endpoint returns them as separate facts and so does this.
 */

interface Video {
  id: string
  title: string
  seconds: number
  coverImageUrl: string
  shareUrl: string
  createdAt: string
  alreadyOnReel: boolean
}

type Load =
  | { kind: 'loading' }
  | { kind: 'disconnected' }
  | { kind: 'unreadable' }
  | { kind: 'ready'; videos: Video[]; slotsLeft: number; maxPerImport: number; hasMore: boolean; cursor: number | null }

function clipLength(seconds: number): string {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`
}

export default function TikTokImport({ onImported }: { onImported: () => void | Promise<void> }) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const liveRef = useRef(true)

  useEffect(() => () => { liveRef.current = false }, [])

  const refresh = useCallback(async () => {
    try {
      const res = await api.tiktokVideos()
      if (!liveRef.current) return
      if (!res.connected) { setLoad({ kind: 'disconnected' }); return }
      if (res.unreadable) { setLoad({ kind: 'unreadable' }); return }
      setLoad({
        kind: 'ready',
        videos: res.videos,
        slotsLeft: res.slotsLeft,
        maxPerImport: res.maxPerImport ?? 10,
        hasMore: res.hasMore,
        cursor: res.cursor,
      })
    } catch {
      // A failed call is NOT "not connected" — it is unreadable, and the two
      // get different words and different buttons.
      if (liveRef.current) setLoad({ kind: 'unreadable' })
    }
  }, [])

  useEffect(() => {
    ;(async () => { await refresh() })()
  }, [refresh])

  const connect = async () => {
    setConnecting(true)
    setError('')
    try {
      const { authUrl } = await api.startTikTokOAuth()
      window.location.href = authUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the TikTok connection.')
      setConnecting(false)
    }
  }

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const importPicked = async () => {
    if (picked.size === 0) return
    setBusy(true); setError(''); setMessage('')
    try {
      const res = await api.importTikToks([...picked])
      const n = res.imported.length
      const failed = res.skipped.length
      setMessage(
        n === 0
          ? 'None of those went through.'
          : `${n} ${n === 1 ? 'clip' : 'clips'} added${failed > 0 ? `, ${failed} skipped` : ''}. They air once they're checked.`,
      )
      setPicked(new Set())
      await refresh()
      await onImported()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import those.')
    }
    setBusy(false)
  }

  const loadMore = async () => {
    if (load.kind !== 'ready' || !load.cursor) return
    setBusy(true)
    try {
      const res = await api.tiktokVideos(load.cursor)
      if (res.connected && !res.unreadable && load.kind === 'ready') {
        setLoad({
          kind: 'ready',
          videos: [...load.videos, ...res.videos],
          slotsLeft: res.slotsLeft,
          maxPerImport: res.maxPerImport ?? load.maxPerImport,
          hasMore: res.hasMore,
          cursor: res.cursor,
        })
      }
    } catch {
      setError('Could not load more.')
    }
    setBusy(false)
  }

  // Nothing at all while we find out — a "Connect TikTok" button that flashes
  // up and then vanishes for somebody who is already connected is worse than a
  // beat of nothing.
  if (load.kind === 'loading') return null

  const cap = load.kind === 'ready' ? Math.min(load.maxPerImport, load.slotsLeft) : 0
  const overPick = load.kind === 'ready' && picked.size > cap

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Music2 className="w-4 h-4 text-primary-400" />
        <h2 className="text-sm font-bold text-white">From your TikTok</h2>
        {load.kind === 'ready' && (
          <span className="ml-auto text-[10px] uppercase tracking-wider text-gray-600">
            {load.slotsLeft} {load.slotsLeft === 1 ? 'slot' : 'slots'} left
          </span>
        )}
      </div>

      {load.kind === 'disconnected' && (
        <>
          <p className="text-[13px] text-gray-400">
            Your videos show up here to tick — no copying links, and we learn their real length.
          </p>
          <Button variant="secondary" className="w-full" isLoading={connecting} onClick={() => void connect()}>
            Connect TikTok
          </Button>
        </>
      )}

      {load.kind === 'unreadable' && (
        <>
          <p className="text-[13px] text-gray-400 leading-relaxed">
            We couldn't read your TikTok videos just now. If this keeps happening, reconnecting
            usually fixes it — TikTok connections expire.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => void refresh()}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Try again
            </Button>
            <Button isLoading={connecting} onClick={() => void connect()}>Reconnect</Button>
          </div>
        </>
      )}

      {load.kind === 'ready' && load.videos.length === 0 && (
        <p className="text-[13px] text-gray-400 leading-relaxed">
          TikTok isn't showing any public videos on this account. Private and friends-only posts
          aren't visible to us — you can still paste a link below for anything else.
        </p>
      )}

      {load.kind === 'ready' && load.videos.length > 0 && (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {load.videos.map((v) => {
              const on = picked.has(v.id)
              return (
                <button
                  key={v.id}
                  type="button"
                  disabled={v.alreadyOnReel}
                  onClick={() => toggle(v.id)}
                  className={`group relative aspect-[9/16] rounded-lg overflow-hidden border text-left transition-all ${
                    v.alreadyOnReel
                      ? 'border-white/[0.06] opacity-40 cursor-default'
                      : on
                        ? 'border-primary-400 ring-2 ring-primary-500/40'
                        : 'border-white/10 hover:border-white/25'
                  }`}
                >
                  {v.coverImageUrl
                    ? <img src={v.coverImageUrl} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                    : <span className="absolute inset-0 bg-white/[0.04]" />}
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-1.5 pt-4 pb-1.5">
                    <span className="block text-[10px] text-white leading-tight line-clamp-2">{v.title}</span>
                    <span className="block text-[10px] font-mono text-gray-400 mt-0.5">{clipLength(v.seconds)}</span>
                  </span>
                  {v.alreadyOnReel && (
                    <span className="absolute top-1 right-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-gray-300">
                      On reel
                    </span>
                  )}
                  {on && (
                    <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {load.hasMore && (
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={busy}
              className="w-full text-[11px] uppercase tracking-[0.14em] text-gray-500 hover:text-gray-300 py-1.5 transition-colors"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : 'Load more'}
            </button>
          )}

          {/* The ceiling, said BEFORE they pick twenty and get ten refused. */}
          {overPick && (
            <p className="text-xs text-gold">
              Pick at most {cap} — that's what will fit right now.
            </p>
          )}
          {error && <p className="text-xs text-primary-400">{error}</p>}
          {message && <p className="text-xs text-live">{message}</p>}

          <Button
            className="w-full"
            disabled={picked.size === 0 || overPick || load.slotsLeft === 0}
            isLoading={busy}
            onClick={() => void importPicked()}
          >
            {picked.size === 0 ? 'Pick some videos' : `Add ${picked.size} to my reel`}
          </Button>
        </>
      )}
    </section>
  )
}
