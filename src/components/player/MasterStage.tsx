import IntermissionBoard from './IntermissionBoard'
import { CsgnLogo } from '@/components/ui/CsgnLogo'

/**
 * MASTER MODE — what /player does when the MP has taken the channel.
 *
 * ── The bug this exists to fix ─────────────────────────────────────────────
 *
 * Master Control's "I'm going on" writes a slot with `sourceType: 'master'`
 * and, correctly, **no stream URL**: the MP is going out from their own
 * encoder, so there is no third-party feed for anybody to tune. /player did not
 * know that. It read the slot, saw an assignment, found `streamUrl` empty and
 * fell through to `DEFAULT_STREAM_URL` — so the moment the MP took their own
 * channel, the page armed the house Twitch channel and then, depending on
 * whether it happened to be live, either sat on a "Starting soon" card or
 * dropped into the member reel.
 *
 * Which means the one mode where the operator is definitely watching was the
 * one mode the page got wrong: the MP goes on air and their own network page
 * starts playing somebody's TikTok over the top of them.
 *
 * ── The two shapes, and why the default is the loud one ────────────────────
 *
 * /player is a browser source inside OBS, and in master mode there are exactly
 * two ways an operator has it set up:
 *
 *   • **Composited.** /player is one layer among the MP's own scene — camera,
 *     game capture, graphics. Here the right thing to draw is NOTHING, so the
 *     MP's scene shows through. `?master=clear`.
 *
 *   • **The whole picture.** /player is the only visible source, the way it is
 *     for every other mode. Here drawing nothing is dead air on a live channel.
 *
 * The default is the card, because the two failure modes are not symmetric. A
 * card that covers a scene is visible on the operator's own preview in the
 * first second and fixed by hiding a source. Transparent-by-default fails as a
 * black rectangle going out to an audience while the operator's preview — which
 * is composited over their scene — looks perfect. One of those the operator
 * catches immediately; the other one nobody catches.
 */
export default function MasterStage({
  masterName,
  slotLabel,
  clear = false,
}: {
  /** The name Master Control put on the hour. 'CSGN' when they gave none. */
  masterName?: string
  slotLabel?: string
  /** Draw nothing at all, for an operator compositing /player over their own
   *  scene. Set with `?master=clear` on the browser source URL. */
  clear?: boolean
}) {
  // Deliberately not `null`: OBS caches the last painted frame of a browser
  // source that renders nothing, so returning null can leave the PREVIOUS mode's
  // picture frozen on the layer. An explicit transparent surface guarantees the
  // layer is cleared on the next paint.
  if (clear) return <div className="absolute inset-0 bg-transparent" aria-hidden />

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#050507]">
      <IntermissionBoard dimmed />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-7 px-16 py-14 rounded-3xl bg-black/60 border border-white/[0.1] backdrop-blur-xl">
          <CsgnLogo className="h-14 w-auto opacity-90" />

          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-[#ff2346] animate-live-pulse" />
            <span className="text-2xl font-black tracking-[0.3em] uppercase text-white">Master Mode</span>
          </div>

          <p className="text-xl text-gray-300 text-center max-w-[720px]">
            <span className="font-bold text-white">{masterName || 'CSGN'}</span> has the channel — live from the
            studio encoder
            {slotLabel ? <span className="font-mono text-primary-300"> · {slotLabel}</span> : null}
          </p>

          {/* The rule, published on the picture, exactly as /watch publishes it.
              A viewer who arrives mid-takeover should not have to guess why the
              reel stopped. */}
          <p className="text-sm text-gray-500 text-center max-w-[640px]">
            The member reel is pre-empted, not deducted — it picks up where it left off.
          </p>
        </div>
      </div>
    </div>
  )
}
