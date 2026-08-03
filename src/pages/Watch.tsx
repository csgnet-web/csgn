import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Gamepad2, Grid3X3 } from 'lucide-react'
import { formatESTRange, isSlotClaimable, slotIdentity, type Slot } from '@/lib/slots'
import { api } from '@/lib/api'
import { parseXPostId } from '@/lib/xembed'
import { useAuth } from '@/contexts/useAuth'
import { useLiveSlot } from '@/contexts/useLiveSlot'
import XBroadcastEmbed from '@/components/watch/XBroadcastEmbed'
import OfflinePanel from '@/components/watch/OfflinePanel'
import TokenPanel from '@/components/watch/TokenPanel'
import ScheduleStrip from '@/components/watch/ScheduleStrip'
import StreamInfoBar from '@/components/watch/StreamInfoBar'
import GameBanner from '@/components/watch/GameBanner'
import { WipeOverlay } from '@/components/ui/WipeOverlay'

/** The default strip copy. Whatever an admin sets in config/gameBanner wins;
 *  this is what shows before anything has been configured. */
const bannerItems = [
  'STARTING 5 — 100,000 $CSGN FOR A PERFECT CARD',
  'SQUARES — WEEKLY BOARD, FREE TO ENTER',
  "CSGN: Crypto's Entertainment Flagship",
  'Connect Your Twitch and Go Live on CSGN',
] as const

/** When nobody holds the current slot, the banner sells the empty stage instead.
 *  Kept at four faces because the banner is a 3D prism (rotateX every 90deg). */
const openStageBanner = [
  'STAGE IS OPEN! GO LIVE NOW!',
  'Connect your Twitch/Phantom and earn fees!',
  "CSGN: Crypto's Entertainment Flagship",
  'Claim a slot at csgn.fun/schedule',
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

  const { user, profile } = useAuth()
  const { currentSlot, allSlots, manualOverride, networkBlockEnabled, gameBanner } = useLiveSlot()
  const [claiming, setClaiming] = useState(false)
  const [claimError, setClaimError] = useState('')
  const [showWipe, setShowWipe] = useState(false)
  const prevSlotIdRef = useRef<string | null>(null)
  const wipeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Wipe animation — triggers on slot change
  useEffect(() => {
    const newId = currentSlot?.id ?? null
    if (prevSlotIdRef.current !== null && newId !== prevSlotIdRef.current) {
      setShowWipe(true)
      if (wipeTimerRef.current) clearTimeout(wipeTimerRef.current)
      wipeTimerRef.current = setTimeout(() => setShowWipe(false), 1400)
    }
    prevSlotIdRef.current = newId
    return () => {
      if (wipeTimerRef.current) clearTimeout(wipeTimerRef.current)
    }
  }, [currentSlot?.id])

  // The on-page player embeds CSGN's X broadcast post — the URL the admin
  // pushes to config/liveStream once per OBS session. The slot's raw Twitch
  // URL is intentionally NOT used here; that feed is consumed by /player
  // (OBS capture) and re-broadcast to X as the CSGN output.
  const broadcastPostId = useMemo(() => (manualOverride?.url ? parseXPostId(manualOverride.url) : null), [manualOverride?.url])
  const broadcastUrl = manualOverride?.url && manualOverride.url.trim() ? manualOverride.url.trim() : null

  // One rule for who's on this hour and whether it's a claimable open stage —
  // shared with the schedule strip, the offline board and the server ticker, so
  // a live "CSGN @ NITE" can never headline "THE STAGE IS OPEN" and a claimed
  // hour can never read "Open Slot". The stage is "open" only when the current
  // hour has no programming on it (see slotIdentity).
  const identity = slotIdentity(currentSlot, { networkBlockEnabled, openName: 'Open Slot' })
  const stageOpen = identity.isOpen

  // A manual X-broadcast override can still name the host when the slot itself is
  // unbranded; a bare network self-brand ("csgn…") in the override is ignored so
  // it can't masquerade as a booking and blank out the open-stage invite.
  const notNetworkBrand = (value?: string | null) => {
    const v = (value ?? '').trim()
    return v && !/^csgn/i.test(v) ? v : ''
  }
  const streamerName = stageOpen ? (notNetworkBrand(manualOverride?.streamerName) || 'Open Slot') : identity.name
  const streamTitle = notNetworkBrand(currentSlot?.streamTitle) || notNetworkBrand(manualOverride?.title) || ''
  const slotLabel = currentSlot ? formatESTRange(currentSlot) : ''
  // Nobody on the stage right now → sell the open stage rather than the coming-soons.
  const banner = stageOpen ? openStageBanner : bannerItems

  // Live once the current slot is confirmed or live (or an X broadcast is up),
  // so the OFFLINE→LIVE flip tracks the slot status automatically.
  const slotLive = Boolean(currentSlot && (currentSlot.status === 'confirmed' || currentSlot.status === 'live'))

  // One rule, shared with /schedule and the server. The old hand-rolled check
  // (status === 'open') hid the button on the airing hour the moment its status
  // drifted, and offered it on network hours the server would then reject.
  const canClaimCurrent = !!currentSlot && isSlotClaimable(currentSlot, networkBlockEnabled)

  const handleClaimSlot = useCallback(async (slot: Slot) => {
    if (!user || !profile) {
      localStorage.setItem('pendingClaimSlotId', slot.id)
      window.dispatchEvent(new Event('csgn:openRegister'))
      return
    }
    setClaiming(true)
    setClaimError('')
    try {
      await api.claimSlot(slot.id)
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : 'Could not claim slot.')
    } finally {
      setClaiming(false)
    }
  }, [profile, user])

  const handleClaimCurrent = useCallback(async () => {
    if (!currentSlot) return
    await handleClaimSlot(currentSlot)
  }, [currentSlot, handleClaimSlot])

  useEffect(() => {
    if (!user || !profile || claiming) return
    const pending = localStorage.getItem('pendingClaimSlotId')
    if (!pending) return
    const slot = allSlots.find((item) => item.id === pending)
    if (!slot) return
    localStorage.removeItem('pendingClaimSlotId')
    void handleClaimSlot(slot)
  }, [user, profile, allSlots, claiming, handleClaimSlot])

  const isLive = Boolean(broadcastPostId) || slotLive

  return (
    <div className="flex h-screen pt-16 bg-[#050507] overflow-hidden">

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col overflow-y-auto min-w-0">
        {showSignupNotice && (
          <div className="shrink-0 px-4 sm:px-5 pt-3">
            <div className="max-w-[1280px] mx-auto rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
              Account created. Verified Twitch and Phantom are ready for slot claims.
            </div>
          </div>
        )}

        {/* Status bar */}
        <div className={`shrink-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 border-b ${isLive ? 'bg-gradient-to-r from-red-600 to-red-500 border-red-400/30' : 'bg-surface-800 border-white/[0.06]'}`}>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-white animate-pulse' : 'bg-gray-500'}`} />
            <span className="text-white font-black tracking-[0.25em] text-sm uppercase">{isLive ? 'LIVE' : 'OFFLINE'}</span>
          </div>
          <GameBanner banner={gameBanner} fallbackLines={banner} />
        </div>

        {/* Broadcast stage — X embeds self-size (max 550px wide), so this is a
            centered stage with ambient glow rather than a forced 16:9 frame. */}
        <div className="shrink-0 px-4 sm:px-5 pt-4 sm:pt-5 pb-2">
          <div className="relative overflow-hidden rounded-2xl border border-red-500/40 bg-black shadow-[0_0_45px_rgba(255,20,80,0.32)] max-w-[1280px] mx-auto">
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_15%_20%,rgba(255,0,90,0.28),transparent_42%),radial-gradient(circle_at_85%_10%,rgba(80,0,255,0.26),transparent_35%)]" />
            <div className="relative w-full min-h-[220px] sm:min-h-[280px] flex items-center justify-center px-4 py-4 sm:py-5">
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
          canClaimCurrent={canClaimCurrent}
          claiming={claiming}
          claimError={claimError}
          onClaimCurrent={() => void handleClaimCurrent()}
          stageOpen={stageOpen}
        />

        {/* Today's schedule — on mobile this sits above the $CSGN panel; on
            desktop the token panel lives in the sidebar so order is moot here. */}
        <ScheduleStrip claiming={claiming} onClaimSlot={(slot) => void handleClaimSlot(slot)} />

        {/* Mobile token panel */}
        <div className="lg:hidden shrink-0 px-5 py-5 border-b border-white/[0.06]">
          <TokenPanel broadcastUrl={broadcastUrl} />
        </div>

        {/* Game teasers — on-chain minigames, not open yet. Deliberately plain:
            flat gray, no accent glow, no status pill. The disabled state IS the
            message, and the label wraps rather than truncating so "Daily lineup
            game" reads in full at every width. */}
        <div className="shrink-0 grid grid-cols-2 gap-3 sm:gap-4 px-5 py-5">
          {[
            { Icon: Gamepad2, title: 'Starting 5', sub: 'Daily lineup game' },
            { Icon: Grid3X3, title: 'Squares', sub: 'On-chain grid pool' },
          ].map(({ Icon, title, sub }) => (
            <button
              key={title}
              disabled
              className="flex items-center gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl border border-white/[0.08] bg-white/[0.02] text-left cursor-not-allowed"
            >
              <span className="shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-gray-500">
                <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
              </span>
              <span className="min-w-0">
                <span className="block font-black font-display text-gray-300 text-sm sm:text-lg uppercase tracking-wide leading-tight">{title}</span>
                <span className="block text-[11px] sm:text-xs text-gray-500 mt-1 leading-snug">{sub}</span>
                <span className="block text-[10px] sm:text-[11px] uppercase tracking-[0.16em] text-gray-600 mt-1 leading-snug">Coming Soon</span>
              </span>
            </button>
          ))}
        </div>
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
