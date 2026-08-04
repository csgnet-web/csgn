import { useCallback, useEffect, useRef, useState } from 'react'
import IntermissionBoard from './IntermissionBoard'
import { CsgnLogo } from '@/components/ui/CsgnLogo'
import { loadTwitterWidgets } from '@/lib/twitterWidgets'
import { canonicalBroadcastUrl, canonicalPostUrl } from '@/lib/xembed'
import type { DetectedStream } from '@/lib/player'

/** widgets.js has this long to produce a rendered embed before we fall back. */
const EMBED_TIMEOUT_MS = 12_000
/** The rendered X card is measured and scaled to fill this share of the canvas. */
const FILL_RATIO = 0.86
/** Scale bounds. Below 1 we'd shrink an already-small card; above this the
 *  embed's own bitmap assets (avatar, play chrome) visibly soften on a 1080p
 *  encode, which looks worse than a smaller, sharp card. */
const MIN_SCALE = 1
const MAX_SCALE = 2.6

/**
 * The branded stage every X source falls back to — and the ONLY thing a raw
 * broadcast permalink can show (see XStage's header comment for why).
 *
 * It is deliberately a real programming card, not an error state: it bills the
 * streamer and the hour exactly like StatusCard does, so an X hour on the encode
 * reads as scheduled programming with the feed pointed at X, never as a fault.
 */
function XLiveCard({
  streamerName,
  slotLabel,
  watchUrl,
}: {
  streamerName?: string
  slotLabel?: string
  watchUrl: string
}) {
  // Shown as text, never as a link: /player is an encoder surface. Strip the
  // scheme so the 1080p line reads as an instruction to viewers, not a URL.
  const display = watchUrl.replace(/^https?:\/\//, '')
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#050507]">
      <IntermissionBoard dimmed />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-7 px-16 py-14 rounded-3xl bg-black/60 border border-white/[0.1] backdrop-blur-xl">
          <CsgnLogo className="h-14 w-auto opacity-90" />

          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-[#ff2346] animate-live-pulse" />
            <span className="text-2xl font-black tracking-[0.3em] uppercase text-white">Live on X</span>
          </div>

          <p className="text-xl text-gray-300 text-center max-w-[720px]">
            <span className="font-bold text-white">{streamerName || 'This hour'}</span> is broadcasting on X
            {slotLabel ? <span className="font-mono text-primary-300"> · {slotLabel}</span> : null}
          </p>

          <span className="text-white/70 text-lg font-mono tracking-wider break-all text-center max-w-[820px]">
            {display}
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * The X post embed, scaled up to fill the broadcast canvas.
 *
 * widgets.js renders a fixed ~550px-wide card wherever it is dropped, which is
 * a postage stamp on a 1920×1080 encode. So the card is rendered at its natural
 * size, measured, and then transform-scaled to fill the frame — scaling rather
 * than forcing a width because the embed derives its own height from its width
 * and ignores anything we set after the fact.
 *
 * The card is never revealed until widgets.js hands back a real element. Until
 * then (and forever, if it never does) the caller's branded stage holds the
 * frame, so a failed embed can't put a blank box on the encode.
 */
function XPostStage({ postId, onReady, onFailed }: { postId: string; onReady: () => void; onFailed: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const requestIdRef = useRef(0)
  const [scale, setScale] = useState(1)

  // Latest callbacks, readable from the async embed flow without making the
  // effect depend on identities the parent re-creates each render.
  const onReadyRef = useRef(onReady)
  const onFailedRef = useRef(onFailed)
  useEffect(() => { onReadyRef.current = onReady }, [onReady])
  useEffect(() => { onFailedRef.current = onFailed }, [onFailed])

  const fit = useCallback(() => {
    const card = measureRef.current?.firstElementChild as HTMLElement | undefined
    const box = containerRef.current
    if (!card || !box) return
    const w = card.offsetWidth
    const h = card.offsetHeight
    if (!w || !h) return
    const next = Math.min((box.clientWidth * FILL_RATIO) / w, (box.clientHeight * FILL_RATIO) / h)
    setScale(Math.max(MIN_SCALE, Math.min(MAX_SCALE, next)))
  }, [])

  useEffect(() => {
    const requestId = ++requestIdRef.current
    const mount = measureRef.current
    if (!mount) return

    mount.innerHTML = ''
    let settled = false
    const timeout = setTimeout(() => {
      if (settled || requestIdRef.current !== requestId) return
      settled = true
      onFailedRef.current()
    }, EMBED_TIMEOUT_MS)

    loadTwitterWidgets()
      .then((twttr) =>
        twttr.widgets.createTweet(postId, mount, {
          theme: 'dark',
          align: 'center',
          // No reply thread and no card chrome we don't need: on a broadcast
          // canvas every pixel that isn't the live video is wasted.
          conversation: 'none',
          dnt: true,
          width: 550,
        }),
      )
      .then((el) => {
        clearTimeout(timeout)
        if (requestIdRef.current !== requestId || settled) { el?.remove(); return }
        settled = true
        if (!el) { onFailedRef.current(); return }
        fit()
        onReadyRef.current()
      })
      .catch(() => {
        clearTimeout(timeout)
        if (requestIdRef.current !== requestId || settled) return
        settled = true
        onFailedRef.current()
      })

    return () => {
      clearTimeout(timeout)
      mount.innerHTML = ''
    }
  }, [postId, fit])

  // X keeps resizing its card after first paint (media loads, the live player
  // swaps in), and the OBS canvas can be resized under us — re-fit on both so
  // the embed never drifts off the safe area mid-broadcast.
  useEffect(() => {
    const box = containerRef.current
    const mount = measureRef.current
    if (!box || !mount || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(fit)
    observer.observe(box)
    observer.observe(mount)
    return () => observer.disconnect()
  }, [fit])

  return (
    <div ref={containerRef} className="absolute inset-0 flex items-center justify-center overflow-hidden bg-[#050507]">
      <div ref={measureRef} style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }} />
    </div>
  )
}

/**
 * XStage — how /player puts a stream that lives on X onto the network output.
 *
 * X hands out two different links for the same broadcast, and only one of them
 * can be played inside another page:
 *
 *   x.com/{user}/status/{id}   the POST carrying the broadcast. widgets.js
 *                              renders it with a working live player, which is
 *                              the same mechanism /watch already relies on.
 *                              This is the path that puts real video on air.
 *
 *   x.com/i/broadcasts/{id}    the broadcast permalink — what X's own "copy
 *                              link" gives a streamer, so it is what we are
 *                              usually handed. widgets.js cannot embed it (it
 *                              takes a numeric post ID), and X serves the page
 *                              with `frame-ancestors 'self'`, so an iframe of it
 *                              is refused outright.
 *
 * There is deliberately NO iframe attempt for the broadcast shape. A frame
 * refused for framing still fires `load` in Chromium and its error page is
 * origin-opaque exactly like a successful cross-origin load, so there is no
 * reliable way to tell "playing" from "refused" from script — and the cost of
 * guessing wrong is a white error box sitting on a live encode. Instead the
 * broadcast shape gets the branded XLiveCard, which keeps the hour billed and
 * on-air and names where the stream actually is. Paste the post URL instead of
 * the broadcast URL and the same hour plays real video.
 *
 * Audio note for operators: an X embed starts muted and exposes no unmute API to
 * the parent page, so the CSGN encode picks up sound only after a one-time
 * OBS **Interact** click on the embed's own unmute control. See docs/obs-setup.md.
 */
export default function XStage({
  stream,
  url,
  streamerName,
  slotLabel,
}: {
  stream: DetectedStream
  /** The stream URL as configured, used verbatim when it's all we can show. */
  url: string
  streamerName?: string
  slotLabel?: string
}) {
  const isPost = stream.type === 'x_post'
  // A post that failed to embed falls back to the same card the broadcast shape
  // uses, so every X source has exactly one on-air failure mode.
  const [embedFailed, setEmbedFailed] = useState(false)
  const [embedReady, setEmbedReady] = useState(false)

  // A new source is a new attempt — reset during render so the card, not a
  // stale "ready", is what paints on the very next frame.
  const [prevId, setPrevId] = useState(stream.id)
  if (prevId !== stream.id) {
    setPrevId(stream.id)
    setEmbedFailed(false)
    setEmbedReady(false)
  }

  const onReady = useCallback(() => setEmbedReady(true), [])
  const onFailed = useCallback(() => setEmbedFailed(true), [])

  const watchUrl = isPost
    ? (url.trim() || canonicalPostUrl(stream.id))
    : canonicalBroadcastUrl(stream.id)

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#050507]">
      {isPost && !embedFailed && (
        <XPostStage postId={stream.id} onReady={onReady} onFailed={onFailed} />
      )}
      {/* The card holds the frame while the embed is still loading and stays
          forever if it never lands — the encode is never left showing a
          half-built embed or an empty stage. */}
      {(!isPost || embedFailed || !embedReady) && (
        <XLiveCard streamerName={streamerName} slotLabel={slotLabel} watchUrl={watchUrl} />
      )}
    </div>
  )
}
