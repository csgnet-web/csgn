import IntermissionBoard from './IntermissionBoard'
import { CsgnLogo } from '@/components/ui/CsgnLogo'
import { canonicalBroadcastUrl, canonicalPostUrl } from '@/lib/xembed'
import type { DetectedStream } from '@/lib/player'

/**
 * XStage — what `/player` shows when an hour's source is a link on X.
 *
 * **The network does not carry video from X, on purpose.** Both of X's link
 * shapes fail, for different reasons:
 *
 *   x.com/i/broadcasts/{id}   the permalink X's own "copy link" produces.
 *                             widgets.js can't embed it (it takes a numeric
 *                             post ID), and X serves the page with
 *                             `frame-ancestors 'self'`, so an iframe is refused.
 *
 *   x.com/{user}/status/{id}  the post carrying the broadcast. widgets.js CAN
 *                             render this one with a working player — but an X
 *                             embed starts muted and exposes no unmute API to
 *                             the parent page, so the only way to get sound
 *                             onto the encode is a manual OBS *Interact* click,
 *                             once per session, by a human who remembered.
 *
 * A 24/7 network that goes silent whenever nobody is watching the operator
 * console is worse than one that doesn't try. So the embed was removed rather
 * than shipped: **take the feed from the streamer's original source** — their
 * Twitch, Kick or YouTube channel — which `/player` carries with audio,
 * live-detection and the whole reveal pipeline behind it.
 *
 * What remains is the safety net. An X link can still reach `/player` through a
 * legacy slot, a hand-edited stream URL or an emergency override, and when it
 * does the network shows this: a branded card that bills the streamer and the
 * hour and names where the stream actually is. That beats the alternative it
 * replaced — an unrecognised URL silently falling through to the intermission
 * board, with a booked streamer simply never appearing.
 */
export default function XStage({
  stream,
  url,
  streamerName,
  slotLabel,
}: {
  stream: DetectedStream
  /** The stream URL as configured, used verbatim when it parses as one. */
  url: string
  streamerName?: string
  slotLabel?: string
}) {
  const watchUrl = url.trim() || (stream.type === 'x_post'
    ? canonicalPostUrl(stream.id)
    : canonicalBroadcastUrl(stream.id))
  // Shown as text, never as a link: /player is an encoder surface, nothing on
  // it is clickable. Stripping the scheme keeps the 1080p line reading as an
  // instruction to viewers rather than as a URL.
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
