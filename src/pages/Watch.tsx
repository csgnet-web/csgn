import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Gamepad2, Grid3X3 } from 'lucide-react'
import { formatESTRange, type Slot } from '@/lib/slots'
import { api } from '@/lib/api'
import { parseXPostId } from '@/lib/xembed'
import { useAuth } from '@/contexts/useAuth'
import { useLiveSlot } from '@/contexts/useLiveSlot'
import XBroadcastEmbed from '@/components/watch/XBroadcastEmbed'
import OfflinePanel from '@/components/watch/OfflinePanel'
import TokenPanel from '@/components/watch/TokenPanel'
import ScheduleStrip from '@/components/watch/ScheduleStrip'
import StreamInfoBar from '@/components/watch/StreamInfoBar'
import { WipeOverlay } from '@/components/ui/WipeOverlay'

const bannerItems = [
  'STARTING 5: COMING SOON',
  'SQUARES COMING SOON',
  "CSGN: Crypto's Entertainment Flagship",
  'Connect Your Twitch and Go Live on CSGN',
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
  const { currentSlot, allSlots, manualOverride } = useLiveSlot()
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

  // The current slot's assigned streamer is the source of truth for the name/
  // title; a manual X-broadcast override only fills in when the slot is unnamed.
  // The billing must always read as programming — the streamer's name or
  // "Open Slot" — so any network self-branding ("CSGN", "csgnet", "CSGN 24/7")
  // that leaks in from a slot default or a manual override is treated as empty.
  const notNetworkBrand = (value?: string | null) => {
    const v = (value ?? '').trim()
    return v && !/^csgn/i.test(v) ? v : ''
  }
  const streamerName = notNetworkBrand(currentSlot?.assignedName) || notNetworkBrand(manualOverride?.streamerName) || 'Open Slot'
  const streamTitle = notNetworkBrand(currentSlot?.streamTitle) || notNetworkBrand(manualOverride?.title) || ''
  const slotLabel = currentSlot ? formatESTRange(currentSlot) : ''

  // Live once the current slot is confirmed or live (or an X broadcast is up),
  // so the OFFLINE→LIVE flip tracks the slot status automatically.
  const slotLive = Boolean(currentSlot && (currentSlot.status === 'confirmed' || currentSlot.status === 'live'))

  const canClaimCurrent =
    Boolean(currentSlot) &&
    currentSlot?.status === 'open' &&
    !currentSlot?.assignedUid

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
        <div className={`shrink-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 ${isLive ? 'bg-red-600' : 'bg-surface-800'}`}>
          <div className="flex items-center gap-2.5">
            <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-white animate-pulse' : 'bg-gray-500'}`} />
            <span className="text-white font-black tracking-[0.25em] text-sm uppercase">{isLive ? 'LIVE' : 'OFFLINE'}</span>
          </div>
          <div className="watch-roll-banner flex-1 min-w-0 sm:min-w-[240px] lg:flex-none lg:w-[520px] lg:ml-auto" aria-label="Live game updates">
            <div className="watch-roll-banner__inner">
              {bannerItems.map((item, index) => (
                <span
                  key={item}
                  className="watch-roll-banner__face"
                  style={{ transform: `rotateX(${index * 90}deg) translateZ(12px)` }}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
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
        />

        {/* Today's schedule — on mobile this sits above the $CSGN panel; on
            desktop the token panel lives in the sidebar so order is moot here. */}
        <ScheduleStrip claiming={claiming} onClaimSlot={(slot) => void handleClaimSlot(slot)} />

        {/* Mobile token panel */}
        <div className="lg:hidden shrink-0 px-5 py-5 border-b border-white/[0.06]">
          <TokenPanel broadcastUrl={broadcastUrl} />
        </div>

        {/* Game buttons */}
        <div className="shrink-0 grid grid-cols-2 gap-3 px-5 py-5">
          <button disabled className="relative overflow-hidden flex flex-col items-center justify-center gap-1.5 py-2.5 sm:py-5 px-3 bg-gray-700/60 rounded-xl font-black font-display text-white/70 text-sm sm:text-base uppercase tracking-wider transition-all shadow-lg cursor-not-allowed">
            <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
            <Gamepad2 className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
            <span className="text-center leading-tight">Starting 5<br /><span className="font-normal text-xs text-white/70">Coming Soon</span></span>
          </button>
          <button disabled className="relative overflow-hidden flex flex-col items-center justify-center gap-1.5 py-2.5 sm:py-5 px-3 bg-gray-700/60 rounded-xl font-black font-display text-white/70 text-sm sm:text-base uppercase tracking-wider transition-all shadow-lg cursor-not-allowed">
            <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
            <Grid3X3 className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
            <span className="text-center leading-tight">Squares<br /><span className="font-normal text-xs text-white/70">Coming Soon</span></span>
          </button>
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
