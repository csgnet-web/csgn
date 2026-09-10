import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { formatESTRange, slotIdentity } from '@/lib/slots'
import { parseXPostId } from '@/lib/xembed'
import { useLiveSlot } from '@/contexts/useLiveSlot'
import XBroadcastEmbed from '@/components/watch/XBroadcastEmbed'
import OfflinePanel from '@/components/watch/OfflinePanel'
import TokenPanel from '@/components/watch/TokenPanel'
import ScheduleStrip from '@/components/watch/ScheduleStrip'
import ChannelModeCard from '@/components/watch/ChannelModeCard'
import StreamInfoBar from '@/components/watch/StreamInfoBar'
import BroadcastBanner from '@/components/watch/BroadcastBanner'
import { WipeOverlay } from '@/components/ui/WipeOverlay'

/** The default strip copy. Whatever an admin sets in config/broadcastBanner wins;
 *  this is what shows before anything has been configured. */
const bannerItems = [
  "CSGN: Crypto's Entertainment Flagship",
  'Connect Your Twitch and Go Live on CSGN',
  'EVERY BLOCK PAYS 30% OF THE FEES IT GENERATES',
  'HOLD $CSGN — POST A CLIP — GET ON TELEVISION',
] as const

/** When nobody from the roster is on, the channel is running the member reel —
 *  so the banner sells the two real ways on, not a booking that no longer exists.
 *  Kept at four faces because the banner is a 3D prism (rotateX every 90deg). */
const openStageBanner = [
  'CLIP MODE — THE MEMBER REEL IS ON AIR',
  'Post a clip at csgn.fun — no tokens needed to start',
  "CSGN: Crypto's Entertainment Flagship",
  'Connect Twitch once — we carry you whenever you go live',
] as const

export default function Watch() {
  const location = useLocation()
  const navigate = useNavigate()
  const [showSignupNotice, setShowSignupNotice] = useState(Boolean((location.state as { accountCreated?: boolean } | null)?.accountCreated))

  useEffect(() => {
    if (!showSignupNotice) return
    const t = setTimeout(() => {
      setShowSignupNotice(false)
      navigate(location.pathname, { replace: true })
    }, 3200)
    return () => clearTimeout(t)
  }, [showSignupNotice, navigate, location.pathname])

  const { currentSlot, manualOverride, networkBlockEnabled, broadcastBanner } = useLiveSlot()
  const [showWipe, setShowWipe] = useState(false)
  const wipeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Wipe animation — triggers when the hour changes hands.
  //
  // A RENDER-PHASE ADJUSTMENT, not an effect. Setting state inside an effect
  // that watches the same value causes a second render pass every time the slot
  // changes; comparing against a state variable during render lets React
  // discard the first pass entirely. Same pattern /player uses for its mode
  // flip, and the one the react-hooks lint rule is asking for.
  const [prevSlotId, setPrevSlotId] = useState<string | null>(currentSlot?.id ?? null)
  const currentSlotId = currentSlot?.id ?? null
  if (prevSlotId !== currentSlotId) {
    setPrevSlotId(currentSlotId)
    if (prevSlotId !== null) setShowWipe(true)
  }

  // Clearing the wipe IS a timer, so it stays in an effect.
  useEffect(() => {
    if (!showWipe) return
    wipeTimerRef.current = setTimeout(() => setShowWipe(false), 1400)
    return () => {
      if (wipeTimerRef.current) clearTimeout(wipeTimerRef.current)
    }
  }, [showWipe])

  // The on-page player embeds CSGN's X broadcast post — the URL the admin
  // pushes to config/liveStream once per OBS session. The slot's raw Twitch
  // URL is intentionally NOT used here; that feed is consumed by /player
  // (OBS capture) and re-broadcast to X as the CSGN output.
  const broadcastPostId = useMemo(() => (manualOverride?.url ? parseXPostId(manualOverride.url) : null), [manualOverride])
  const broadcastUrl = manualOverride?.url && manualOverride.url.trim() ? manualOverride.url.trim() : null

  // One rule for who's on this hour, shared with the schedule strip, the
  // offline board and the server ticker, so a live "CSGN @ NITE" can never
  // headline as an empty hour and a booked hour can never read "Member Reel".
  // The hour is "open" only when it has no programming on it (see slotIdentity)
  // — which now means the clip reel has it, not that it is up for grabs.
  const identity = slotIdentity(currentSlot, { networkBlockEnabled, openName: 'Member Reel' })
  const stageOpen = identity.isOpen

  // A manual X-broadcast override can still name the host when the slot itself is
  // unbranded; a bare network self-brand ("csgn…") in the override is ignored so
  // it can't masquerade as a booking and blank out the open-stage invite.
  const notNetworkBrand = (value?: string | null) => {
    const v = (value ?? '').trim()
    return v && !/^csgn/i.test(v) ? v : ''
  }
  const streamerName = stageOpen ? (notNetworkBrand(manualOverride?.streamerName) || 'Member Reel') : identity.name
  const streamTitle = notNetworkBrand(currentSlot?.streamTitle) || notNetworkBrand(manualOverride?.title) || ''
  const slotLabel = currentSlot ? formatESTRange(currentSlot) : ''
  // Nobody on the stage right now → sell the open stage rather than the coming-soons.
  const banner = stageOpen ? openStageBanner : bannerItems

  // Live once the current slot is confirmed or live (or an X broadcast is up),
  // so the OFFLINE→LIVE flip tracks the slot status automatically.
  const slotLive = Boolean(currentSlot && (currentSlot.status === 'confirmed' || currentSlot.status === 'live'))

  // NO CLAIM BUTTON. The channel runs off the roster: members connect Twitch
  // once, grant forwarding, and an operator puts them on when they are live.
  // A "Go live now" button on the stage promised a path that no longer exists
  // — pressing it booked a block nobody would have watched for.

  const isLive = Boolean(broadcastPostId) || slotLive

  return (
    // h-dvh, not h-screen: on mobile Safari `100vh` is the height WITHOUT the
    // browser chrome, so the last ~80px of this shell sat under the URL bar and
    // the tab bar. `dvh` tracks the real visible box as the chrome collapses.
    <div className="flex h-dvh pt-16 bg-[#050507] overflow-hidden pb-[var(--csgn-tabbar)] lg:pb-0">

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col overflow-y-auto min-w-0">
        {showSignupNotice && (
          <div className="shrink-0 px-4 sm:px-5 pt-3">
            <div className="max-w-[1280px] mx-auto rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
              Account created. Post a clip to get on the reel, or connect Twitch and we'll carry you when you go live.
            </div>
          </div>
        )}

        {/* Status bar */}
        <div className={`shrink-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 border-b ${isLive ? 'bg-gradient-to-r from-red-600 to-red-500 border-red-400/30' : 'bg-surface-800 border-white/[0.06]'}`}>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-white animate-pulse' : 'bg-gray-500'}`} />
            <span className="text-white font-black tracking-[0.25em] text-sm uppercase">{isLive ? 'LIVE' : 'OFFLINE'}</span>
          </div>
          <BroadcastBanner banner={broadcastBanner} fallbackLines={banner} />
        </div>

        {/* THE STAGE.
            X embeds self-size (max 550px wide), so this can never be a true
            full-bleed 16:9 frame — that is X's constraint and pretending
            otherwise would letterbox a post into a black void.
            What it CAN stop being is a card. On a phone the rounded border, the
            outer padding and the ambient glow were chrome around a small video
            on a small screen, which is the difference between a channel and a
            web page with a video on it. Edge to edge on mobile; the framed
            stage returns at sm, where there is room for it to read as a frame
            rather than as a border. */}
        <div className="shrink-0 sm:px-5 sm:pt-5 sm:pb-2">
          <div className="relative overflow-hidden border-y border-red-500/30 sm:rounded-2xl sm:border bg-black sm:border-red-500/40 sm:shadow-[0_0_45px_rgba(255,20,80,0.32)] max-w-[1280px] mx-auto">
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_15%_20%,rgba(255,0,90,0.28),transparent_42%),radial-gradient(circle_at_85%_10%,rgba(80,0,255,0.26),transparent_35%)]" />
            <div className="relative w-full min-h-[240px] sm:min-h-[280px] flex items-center justify-center px-3 py-3 sm:px-4 sm:py-5">
              {broadcastPostId && broadcastUrl ? (
                <XBroadcastEmbed postId={broadcastPostId} postUrl={broadcastUrl} />
              ) : (
                <OfflinePanel />
              )}
              <WipeOverlay visible={showWipe} />
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/55 to-transparent" />
          </div>
        </div>

        {/* Streamer info row */}
        <StreamInfoBar
          streamerName={streamerName}
          streamTitle={streamTitle}
          slotLabel={slotLabel}
          currentSlot={currentSlot}
          stageOpen={stageOpen}
        />

        {/* WHY THIS IS WHAT'S ON. Sits directly under the stage because that is
            where the question gets asked — a viewer who just saw a clip reel
            where a live stream was an hour ago reads this before anything else. */}
        <div className="shrink-0 px-4 sm:px-5 py-2.5">
          <div className="max-w-[1280px] mx-auto">
            <ChannelModeCard />
          </div>
        </div>

        {/* Today's schedule — on mobile this sits above the $CSGN panel; on
            desktop the token panel lives in the sidebar so order is moot here. */}
        <ScheduleStrip />

        {/* Mobile token panel */}
        <div className="lg:hidden shrink-0 px-5 py-5 border-b border-white/[0.06]">
          <TokenPanel broadcastUrl={broadcastUrl} />
        </div>

        {/* The page ENDS at the token panel, deliberately.
            What used to sit below here — first two dead "Coming Soon" game
            tiles, then a pitch block with three sign-up cards — was a second
            page bolted under a broadcast. Somebody who came to watch a stream
            was handed a brochure the moment they scrolled past the links, and a
            brochure under a live video reads as a landing page, not a channel.
            The ways in are the tab bar, permanently, one tap away. */}
      </div>

      {/* ── Right: Token panel sidebar (desktop only) ── */}
      <aside className="hidden lg:flex w-[340px] shrink-0 flex-col border-l border-white/[0.06] bg-[#07070f] overflow-y-auto">
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-red-500 animate-pulse' : 'bg-gray-600'}`} />
          <span className="text-xs font-bold tracking-[0.2em] uppercase text-gray-400">$CSGN Live</span>
        </div>
        <div className="p-4">
          <TokenPanel broadcastUrl={broadcastUrl} />
        </div>
      </aside>
    </div>
  )
}
