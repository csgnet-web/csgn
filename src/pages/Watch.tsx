import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight, Gamepad2, Grid3X3, Radio } from 'lucide-react'
import { onSnapshot, doc } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { claimOpenSlot, formatESTRange, subscribeToSlots, type Slot } from '@/lib/slots'
import { useAuth } from '@/contexts/AuthContext'
 
const FIXED_CHAT_CHANNEL = 'csgnet'
const RESTREAM_PLAYER_SRC = 'https://player.restream.io/?token=e533c1e2dff542bf9ed97ecba6b08597'

const bannerItems = [
  'STARTING 5: IMMINENT',
  'SQUARES COMING SOON',
  "CSGN: Crypto's Entertainment Flagship",
  'Connect Your Twitch and Go Live on CSGN',
] as const

function toMillis(value: unknown): number {
  if (typeof value === 'string' || value instanceof Date || typeof value === 'number') {
    const ms = new Date(value).getTime()
    return Number.isFinite(ms) ? ms : 0
  }
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: unknown }).toDate === 'function') {
    const ms = (value as { toDate: () => Date }).toDate().getTime()
    return Number.isFinite(ms) ? ms : 0
  }
  return 0
}

function etDayKeyFromMillis(ms: number): string {
  return new Date(ms).toLocaleDateString('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}


/* ── CSGN Wipe Overlay ── */
function CSGNWipeOverlay({ visible }: { visible: boolean }) {
  return (
    <div
      className={`absolute inset-0 z-20 pointer-events-none transition-all duration-700 ease-in-out ${
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-full'
      }`}
      style={{
        background: 'linear-gradient(135deg, #ff2346 0%, #0a0a14 60%)',
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          {/* CSGN Logo SVG */}
          <svg viewBox="0 0 120 40" className="h-12 w-auto fill-white opacity-90" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="32" fontFamily="system-ui, sans-serif" fontWeight="900" fontSize="38" letterSpacing="2">CSGN</text>
          </svg>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-white/80 text-sm font-bold tracking-[0.2em] uppercase">Now Live</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Compact time range: "3-5A ET", "1-3P ET", "11P-1A ET" ── */
function formatCompactRange(slot: Pick<Slot, 'startTime' | 'endTime'>): string {
  const parse = (value: unknown) => {
    const formatted = new Date(toMillis(value)).toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      hour12: true,
    })
    const [hour, period] = formatted.split(' ')
    return { hour, p: period.charAt(0) }
  }
  const s = parse(slot.startTime)
  const e = parse(slot.endTime)
  return s.p === e.p ? `${s.hour}-${e.hour}${e.p} ET` : `${s.hour}${s.p}-${e.hour}${e.p} ET`
}

/* ── Schedule card for today's lineup ── */
function TodaySlotCard({ slot, isCurrent }: { slot: Slot; isCurrent: boolean }) {
  const streamer = slot.assignedName || (slot.type === 'auction' ? 'Open Bid' : 'CEO Schedule')
  return (
    <div
      className={`relative rounded-xl overflow-hidden flex flex-col min-h-[89px] sm:min-h-[178px] lg:min-h-[88px] lg:h-[88px] transition-all duration-300 ${
        isCurrent
          ? 'ring-2 ring-red-500 shadow-[0_0_24px_rgba(255,35,70,0.5)]'
          : 'ring-1 ring-white/10 hover:ring-white/20'
      }`}
      style={{
        background: isCurrent
          ? 'linear-gradient(160deg, hsl(350,70%,30%) 0%, hsl(350,60%,12%) 100%)'
          : 'linear-gradient(160deg, hsl(220,70%,20%) 0%, hsl(220,60%,8%) 100%)',
      }}
    >
      <div className="absolute top-2 left-2 z-10">
        {isCurrent ? (
          <span className="flex items-center gap-1 px-2 py-0.5 bg-red-600 rounded-full text-[10px] font-bold text-white uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            LIVE
          </span>
        ) : (
          <span className="px-2 py-0.5 bg-black/40 border border-white/20 rounded-full text-[10px] text-white/70 uppercase tracking-wider">
            UP NEXT
          </span>
        )}
      </div>

      <div className="flex flex-1 items-end justify-center pt-2 sm:pt-6 lg:pt-0.5 pb-0.5 sm:pb-1 lg:pb-0 px-2 sm:px-3 min-h-[48px] sm:min-h-[100px] lg:min-h-[42px]">
        <svg viewBox="0 0 120 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <defs>
            <linearGradient id={`ag${slot.id}`} x1="60" y1="0" x2="60" y2="160" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={isCurrent ? 'hsl(350,80%,65%)' : 'hsl(220,80%,65%)'} stopOpacity="0.85" />
              <stop offset="100%" stopColor={isCurrent ? 'hsl(350,60%,25%)' : 'hsl(220,60%,25%)'} stopOpacity="0.4" />
            </linearGradient>
          </defs>
          <ellipse cx="60" cy="52" rx="26" ry="30" fill={`url(#ag${slot.id})`} />
          <path d="M0 160 C0 110 28 88 60 85 C92 88 120 110 120 160 Z" fill={`url(#ag${slot.id})`} />
        </svg>
      </div>

      <div className="px-2 sm:px-3 lg:px-1 pb-1.5 sm:pb-3 lg:pb-0.5 pt-1 sm:pt-2.5 lg:pt-0 bg-gradient-to-t from-black/80 to-transparent space-y-0.5 sm:space-y-1 lg:space-y-0">
        <p className="text-white font-black font-display text-[10px] sm:text-sm lg:text-[8px] leading-tight break-words">{streamer}</p>
        <p className="text-white/60 text-[9px] sm:text-[11px] lg:text-[7px] leading-snug break-words">{slot.type === 'auction' ? 'Auction Slot' : 'CEO Schedule'}</p>
        <p className="text-white/60 text-[8px] sm:text-[10px] lg:text-[7px] font-mono leading-none whitespace-nowrap">{formatCompactRange(slot)}</p>
      </div>
    </div>
  )
}

function CSGNPlayer() {
  const src = useMemo(() => {
    const url = new URL(RESTREAM_PLAYER_SRC)
    url.searchParams.set('autoplay', 'true')
    url.searchParams.set('muted', 'false')
    url.searchParams.set('controls', 'false')
    return url.toString()
  }, [])

  return (
    <div style={{ padding: '56.25% 0 0 0', position: 'relative', width: '100%', height: '100%' }}>
      <iframe
        src={src}
        allow="autoplay"
        frameBorder="0"
        title="CSGN Live Stream"
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
      />
    </div>
  )
}

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

  const hostname = useMemo(() => (typeof window !== 'undefined' ? window.location.hostname : 'localhost'), [])
  const { user, profile } = useAuth()
  const [isScheduleOpen, setIsScheduleOpen] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [claimError, setClaimError] = useState('')

  // Current live slot from Firestore (auto-detected by time)
  const [currentSlot, setCurrentSlot] = useState<Slot | null>(null)
  // Today's upcoming slots for the schedule sidebar
  const [todaySlots, setTodaySlots] = useState<Slot[]>([])

  // Manual override from admin config/liveStream
  const [manualOverride, setManualOverride] = useState<{ url: string; streamerName: string; title: string } | null>(null)

  // Live fee display from shared slot state
  const [pulseFee, setPulseFee] = useState(false)

  // Wipe animation state
  const [showWipe, setShowWipe] = useState(false)
  const prevSlotIdRef = useRef<string | null>(null)
  const wipeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [allSlots, setAllSlots] = useState<Slot[]>([])
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  // Subscribe to admin manual override config
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'liveStream'), (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        if (data.url) {
          setManualOverride({ url: data.url, streamerName: data.streamerName || '', title: data.title || '' })
        } else {
          setManualOverride(null)
        }
      } else {
        setManualOverride(null)
      }
    }, () => setManualOverride(null))
    return unsub
  }, [])

  // Direct subscription to slots table for identical behavior (logged in/out/admin).
  useEffect(() => {
    const from = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const to = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000)
    const unsub = subscribeToSlots(from, to, (slots) => {
      const data = slots
        .filter((slot) => toMillis(slot.startTime) > 0 && toMillis(slot.endTime) > 0)
        .sort((a, b) => toMillis(a.startTime) - toMillis(b.startTime))
      setAllSlots(data)
    })
    return unsub
  }, [])

  // Compute current slot from shared slots list.
  useEffect(() => {
    const slot = allSlots.find((s) => nowMs >= toMillis(s.startTime) && nowMs < toMillis(s.endTime)) ?? null
    const newId = slot?.id ?? null

    if (prevSlotIdRef.current !== null && newId !== prevSlotIdRef.current) {
      setShowWipe(true)
      if (wipeTimerRef.current) clearTimeout(wipeTimerRef.current)
      wipeTimerRef.current = setTimeout(() => setShowWipe(false), 1400)
    }

    prevSlotIdRef.current = newId
    setCurrentSlot(slot)
    return () => {
      if (wipeTimerRef.current) clearTimeout(wipeTimerRef.current)
    }
  }, [allSlots, nowMs])

  const liveFeeSOL = currentSlot?.creatorFees?.feeOwedSOL ?? 0
  const liveFeeUSD = currentSlot?.creatorFees?.feeOwedUSD ?? 0
  const liveVolumeSOL = currentSlot?.creatorFees?.tradingVolumeSOL ?? 0

  useEffect(() => {
    setPulseFee(true)
    const t = setTimeout(() => setPulseFee(false), 550)
    return () => clearTimeout(t)
  }, [currentSlot?.id, liveFeeUSD])

  // Build today's slot list directly from subscribed slots.
  useEffect(() => {
    const todayKey = etDayKeyFromMillis(nowMs)
    setTodaySlots(
      allSlots
        .filter((slot) => etDayKeyFromMillis(toMillis(slot.startTime)) === todayKey)
        .sort((a, b) => toMillis(a.startTime) - toMillis(b.startTime)),
    )
  }, [allSlots, nowMs])

  // Derive stream URL — ONLY from admin manual override (config/liveStream).
  // The slot's raw Twitch/YouTube URL is intentionally NOT used here; that feed
  // is consumed by /player (OBS capture) and then re-broadcast to this page via
  // the CSGN output stream the admin sets in the override.
  const streamerName = manualOverride?.streamerName || currentSlot?.assignedName || ''
  const streamTitle = manualOverride?.title || currentSlot?.streamTitle || currentSlot?.description || ''
  const slotLabel = currentSlot ? formatESTRange(currentSlot) : ''

  // Chat sidebar: only shown when the CSGN output stream is itself a Twitch channel
  const isTwitch = true
  const chatSrc = `https://www.twitch.tv/embed/${FIXED_CHAT_CHANNEL}/chat?parent=${hostname}&darkpopout`

  // Next upcoming slots
  const upcomingSlots = todaySlots.filter((s) => toMillis(s.startTime) > nowMs)

  const twitchHandle = profile?.twitchUsername || profile?.socialLinks?.twitch || ''
  const canClaimCurrent =
    Boolean(user) &&
    Boolean(profile) &&
    Boolean(twitchHandle) &&
    Boolean(currentSlot) &&
    currentSlot?.status === 'open' &&
    !currentSlot?.assignedUid

  const handleClaimCurrent = async () => {
    if (!user || !profile || !currentSlot || !twitchHandle) return
    setClaiming(true)
    setClaimError('')
    try {
      await claimOpenSlot(currentSlot.id, {
        uid: user.uid,
        displayName: profile.displayName || twitchHandle,
        twitchUsername: twitchHandle,
      })
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : 'Could not claim slot.')
    } finally {
      setClaiming(false)
    }
  }

  const handleClaimSlot = async (slot: Slot) => {
    if (!user || !profile || !twitchHandle) return
    setClaiming(true)
    setClaimError('')
    try {
      await claimOpenSlot(slot.id, {
        uid: user.uid,
        displayName: profile.displayName || twitchHandle,
        twitchUsername: twitchHandle,
      })
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : 'Could not claim slot.')
    } finally {
      setClaiming(false)
    }
  }

  // For the schedule grid: current slot (if any) + next 2, otherwise next 3
  const currentTodaySlot = todaySlots.find((s) => {
    const start = toMillis(s.startTime)
    const end = toMillis(s.endTime)
    return nowMs >= start && nowMs < end
  })
  const scheduleGridSlots = currentTodaySlot
    ? [currentTodaySlot, ...upcomingSlots.slice(0, 2)]
    : upcomingSlots.slice(0, 3)
  const liveShareRate = currentSlot?.creatorFees?.streamerShareRate ?? (liveVolumeSOL > 0 ? liveFeeSOL / liveVolumeSOL : 0)

  return (
    <div className="flex h-screen pt-16 bg-[#050507] overflow-hidden">

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col overflow-y-auto min-w-0">
        {showSignupNotice && (
          <div className="shrink-0 px-4 sm:px-5 pt-3">
            <div className="max-w-[1280px] mx-auto rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
              Account created. You can connect Twitch and Phantom later in /account.
            </div>
          </div>
        )}

        {/* Status bar */}
        <div className="shrink-0 flex items-center gap-2 sm:gap-3 bg-red-600 px-3 sm:px-4 py-2">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-white font-black tracking-[0.25em] text-sm uppercase">LIVE</span>
          </div>
          <div className="watch-roll-banner flex-1 min-w-[180px] sm:min-w-[240px] lg:flex-none lg:w-[520px] lg:ml-auto" aria-label="Live game updates">
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

        {/* Video player */}
        <div className="shrink-0 px-4 sm:px-5 pt-4 sm:pt-5 pb-2">
          <div className="relative overflow-hidden rounded-2xl border border-red-500/40 bg-black shadow-[0_0_45px_rgba(255,20,80,0.32)] max-w-[1280px] mx-auto">
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_15%_20%,rgba(255,0,90,0.28),transparent_42%),radial-gradient(circle_at_85%_10%,rgba(80,0,255,0.26),transparent_35%)]" />
            <div className="w-full relative" style={{ aspectRatio: '16/9' }}>
              <CSGNPlayer />
              <CSGNWipeOverlay visible={showWipe} />
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/55 to-transparent" />
          </div>
        </div>

        {/* Streamer info row */}
        <div className="shrink-0 flex items-start justify-between px-5 py-4 border-b border-white/[0.06]">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black font-display text-white tracking-tight leading-none">
              {streamerName || <span className="text-gray-600">No Stream</span>}
            </h1>
            {streamTitle && (
              <p className="text-sm text-primary-300 font-medium mt-0.5 italic">"{streamTitle}"</p>
            )}
            <p className="text-sm text-gray-400 mt-1 font-mono">{slotLabel}</p>
            {canClaimCurrent && (
              <div className="mt-3 flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => void handleClaimCurrent()}
                  disabled={claiming}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 rounded-lg text-xs font-bold text-emerald-200 uppercase tracking-wider transition-colors disabled:opacity-60 disabled:cursor-wait cursor-pointer"
                >
                  <Radio className="w-3.5 h-3.5" />
                  {claiming ? 'Going Live…' : `Take this slot (Go Live as @${twitchHandle})`}
                </button>
                {claimError && <span className="text-[11px] text-red-300">{claimError}</span>}
              </div>
            )}
            {user && !twitchHandle && currentSlot?.status === 'open' && !currentSlot?.assignedUid && (
              <p className="mt-3 text-[11px] text-amber-300">Connect Twitch on your <Link to="/account" className="underline">Account</Link> to take open slots.</p>
            )}
          </div>
          <div className="text-right">
            {currentSlot ? (
              <>
                <p className={`text-2xl sm:text-3xl font-black font-mono text-yellow-400 ${pulseFee ? 'animate-fee-shake' : ''}`}>
                  {liveFeeUSD > 0 ? `$${liveFeeUSD.toFixed(2)}` : '—'}
                </p>
                <p className="text-[11px] text-gray-500 uppercase tracking-wider mt-0.5">
                  {liveVolumeSOL > 0
                    ? `${liveFeeSOL.toFixed(6)} SOL · ${liveVolumeSOL.toFixed(2)} SOL vol · ${(liveShareRate * 100).toFixed(3)}%`
                    : 'Live Earnings'}
                </p>
                {currentSlot.creatorFees?.marketCapTierLabel && (
                  <p className="text-[11px] text-gray-600 mt-0.5">{currentSlot.creatorFees.marketCapTierLabel}</p>
                )}
              </>
            ) : (
              <>
                <p className="text-2xl sm:text-3xl font-black font-mono text-gray-600">—</p>
                <p className="text-[11px] text-gray-500 uppercase tracking-wider mt-0.5">Earnings</p>
              </>
            )}
          </div>
        </div>

        {/* TODAY'S SCHEDULE */}
        <div className="shrink-0 px-5 py-5 border-b border-white/[0.06]">
          <button
            type="button"
            className="w-full flex items-center justify-between mb-4"
            onClick={() => setIsScheduleOpen((prev) => !prev)}
            aria-expanded={isScheduleOpen}
          >
            <h2 className="text-xs font-black tracking-[0.25em] uppercase text-gray-400">
              Today's Schedule
            </h2>
            <div className="flex items-center gap-4">
              {upcomingSlots.length > 0 && (
                <div className="text-right space-y-0.5">
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider leading-none mb-1">Up Next</p>
                  {upcomingSlots.slice(0, 3).map((s) => (
                    <p key={s.id} className="text-[10px] font-display font-bold text-white leading-snug whitespace-nowrap">
                      {s.assignedName || (s.type === 'auction' ? 'Open Bid' : 'CEO')}{' '}
                      <span className="font-normal text-gray-400">{formatCompactRange(s)}</span>
                    </p>
                  ))}
                </div>
              )}
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isScheduleOpen ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {isScheduleOpen && (
            <>
              <div className="grid grid-cols-3 gap-3">
                {scheduleGridSlots.map((slot) => {
                  const slotStart = toMillis(slot.startTime)
                  const slotEnd = toMillis(slot.endTime)
                  const isCurrent = nowMs >= slotStart && nowMs < slotEnd
                  const claimable = Boolean(user && twitchHandle) && slot.status === 'open' && !slot.assignedUid && slotEnd > nowMs
                  return (
                    <div key={slot.id} className="flex flex-col gap-1.5">
                      <TodaySlotCard slot={slot} isCurrent={isCurrent} />
                      {claimable && (
                        <button
                          type="button"
                          onClick={() => void handleClaimSlot(slot)}
                          disabled={claiming}
                          className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 lg:py-0.5 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 text-emerald-200 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait"
                        >
                          Take Slot
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="mt-4 text-center">
                <Link
                  to="/schedule"
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all font-medium"
                >
                  View Full Schedule <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </>
          )}
        </div>

        {/* Game buttons */}
        <div className="shrink-0 grid grid-cols-2 gap-3 px-5 py-5">
          <button className="relative overflow-hidden flex flex-col items-center justify-center gap-1.5 py-2.5 sm:py-5 px-3 bg-red-600 hover:bg-red-500 active:scale-[0.98] rounded-xl font-black font-display text-white text-sm sm:text-base uppercase tracking-wider transition-all shadow-lg shadow-red-900/40 cursor-pointer">
            <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
            <Gamepad2 className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
            <span className="text-center leading-tight">Play Starting 5<br /><span className="font-normal text-xs text-white/80">for free!</span></span>
          </button>
          <button disabled className="relative overflow-hidden flex flex-col items-center justify-center gap-1.5 py-2.5 sm:py-5 px-3 bg-gray-700/60 rounded-xl font-black font-display text-white/70 text-sm sm:text-base uppercase tracking-wider transition-all shadow-lg cursor-not-allowed">
            <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
            <Grid3X3 className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
            <span className="text-center leading-tight">Squares<br /><span className="font-normal text-xs text-white/70">Coming Soon</span></span>
          </button>
        </div>

        {/* Mobile chat */}
        {isTwitch && (
          <div className="lg:hidden shrink-0 px-5 pb-5">
            <div className="rounded-xl overflow-hidden border border-white/10">
              <button
                type="button"
                className="w-full bg-[#0e0e1a] px-4 py-3 flex items-center justify-between"
                onClick={() => setIsChatOpen((prev) => !prev)}
                aria-expanded={isChatOpen}
              >
                <span className="text-xs font-bold tracking-[0.2em] uppercase text-gray-400">Live Chat</span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isChatOpen ? 'rotate-180' : ''}`} />
              </button>
              {isChatOpen && (
                <iframe
                  src={chatSrc}
                  className="w-full"
                  style={{ height: 360, background: '#0a0a14' }}
                  title="CSGN Chat"
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Right: Chat sidebar (desktop only) ── */}
      {isTwitch && (
        <aside className="hidden lg:flex w-[340px] shrink-0 flex-col border-l border-white/[0.06] bg-[#07070f]">
          <button
            type="button"
            className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between"
            onClick={() => setIsChatOpen((prev) => !prev)}
            aria-expanded={isChatOpen}
          >
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-bold tracking-[0.2em] uppercase text-gray-400">Live Chat</span>
            </div>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isChatOpen ? 'rotate-180' : ''}`} />
          </button>
          {isChatOpen && (
            <iframe
              src={chatSrc}
              className="flex-1 w-full"
              style={{ background: '#07070f' }}
              title="CSGN Chat"
            />
          )}
        </aside>
      )}
    </div>
  )
}
