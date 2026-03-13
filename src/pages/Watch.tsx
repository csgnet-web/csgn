import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, Gamepad2, Grid3X3 } from 'lucide-react'
import { onSnapshot, doc } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { subscribeToCurrentSlot, subscribeToSlots, formatESTRange, type Slot } from '@/lib/slots'
import { startFeeTracker } from '@/lib/dexscreener'

const bannerItems = [
  'Starting 5 \u2022 $14.70',
  'Squares Entries: 25',
  'Squares Closing in 04:03:20:55',
  'Starting 5 Closing in 01:02:23',
] as const

/* ── Helpers to parse stream URLs ── */
function parseTwitchChannel(url: string): string | null {
  const m = url.match(/(?:twitch\.tv\/)([a-zA-Z0-9_]+)/i)
  return m ? m[1] : null
}

function parseYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

type StreamType = 'twitch' | 'youtube'

function detectStream(url: string): { type: StreamType; id: string } | null {
  const twitchChannel = parseTwitchChannel(url)
  if (twitchChannel) return { type: 'twitch', id: twitchChannel }
  const ytId = parseYouTubeId(url)
  if (ytId) return { type: 'youtube', id: ytId }
  return null
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

/* ── Schedule card for today's lineup ── */
function TodaySlotCard({ slot, isCurrent }: { slot: Slot; isCurrent: boolean }) {
  const streamer = slot.assignedName || (slot.type === 'auction' ? 'Open Bid' : 'CEO Schedule')
  return (
    <div
      className={`relative rounded-xl overflow-hidden flex flex-col min-h-[89px] sm:min-h-[178px] transition-all duration-300 ${
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

      <div className="flex flex-1 items-end justify-center pt-2 sm:pt-6 pb-0.5 sm:pb-1 px-2 sm:px-3 min-h-[48px] sm:min-h-[100px]">
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

      <div className="px-2 sm:px-3 pb-1.5 sm:pb-3 pt-1 sm:pt-2.5 bg-gradient-to-t from-black/80 to-transparent space-y-0.5 sm:space-y-1">
        <p className="text-white font-black font-display text-[10px] sm:text-sm leading-tight break-words">{streamer}</p>
        <p className="text-white/60 text-[9px] sm:text-[11px] leading-snug break-words">{slot.type === 'auction' ? 'Auction Slot' : 'CEO Schedule'}</p>
        <p className="text-white/60 text-[9px] sm:text-[11px] font-mono leading-none">{formatESTRange(slot)}</p>
      </div>
    </div>
  )
}

/* ── CSGN Player: renders Twitch or YouTube, or NO STREAM ACTIVE ── */
function CSGNPlayer({ streamUrl, hostname }: { streamUrl: string; hostname: string }) {
  if (!streamUrl) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#050507] gap-4">
        <svg viewBox="0 0 120 40" className="h-8 w-auto fill-white/20" xmlns="http://www.w3.org/2000/svg">
          <text x="0" y="32" fontFamily="system-ui, sans-serif" fontWeight="900" fontSize="38" letterSpacing="2">CSGN</text>
        </svg>
        <p className="text-gray-500 font-mono text-sm tracking-widest uppercase">No Stream Active</p>
      </div>
    )
  }

  const stream = detectStream(streamUrl)

  if (stream?.type === 'youtube') {
    const embedSrc = `https://www.youtube-nocookie.com/embed/${stream.id}?autoplay=1&mute=0&rel=0&modestbranding=1&controls=0&iv_load_policy=3&disablekb=1&playsinline=1`
    return (
      <iframe
        src={embedSrc}
        className="w-full h-full"
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        allowFullScreen
        title="Live Stream"
      />
    )
  }

  // Twitch: use parsed channel or treat raw value as channel name
  const channel = stream?.id ?? streamUrl.trim().replace(/^https?:\/\//i, '').replace(/^twitch\.tv\//i, '')
  const twitchSrc = `https://player.twitch.tv/?channel=${encodeURIComponent(channel)}&parent=${encodeURIComponent(hostname)}&autoplay=true&muted=false`
  return (
    <iframe
      src={twitchSrc}
      className="w-full h-full"
      allow="autoplay; fullscreen; encrypted-media"
      allowFullScreen
      title="Live Stream"
    />
  )
}

export default function Watch() {
  const hostname = useMemo(() => (typeof window !== 'undefined' ? window.location.hostname : 'localhost'), [])
  const [isScheduleOpen, setIsScheduleOpen] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)

  // Current live slot from Firestore (auto-detected by time)
  const [currentSlot, setCurrentSlot] = useState<Slot | null>(null)
  // Today's upcoming slots for the schedule sidebar
  const [todaySlots, setTodaySlots] = useState<Slot[]>([])

  // Manual override from admin config/liveStream
  const [manualOverride, setManualOverride] = useState<{ url: string; streamerName: string; title: string } | null>(null)

  // Live fee tracking
  const [liveFeeSOL, setLiveFeeSOL] = useState<number>(0)
  const [liveVolumeSOL, setLiveVolumeSOL] = useState<number>(0)

  // Wipe animation state
  const [showWipe, setShowWipe] = useState(false)
  const prevSlotIdRef = useRef<string | null>(null)
  const wipeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // Subscribe to the current live slot
  useEffect(() => {
    const unsub = subscribeToCurrentSlot((slot) => {
      const newId = slot?.id ?? null

      if (prevSlotIdRef.current !== null && newId !== prevSlotIdRef.current) {
        // Slot has changed — trigger wipe animation
        setShowWipe(true)
        if (wipeTimerRef.current) clearTimeout(wipeTimerRef.current)
        wipeTimerRef.current = setTimeout(() => setShowWipe(false), 1400)
      }

      prevSlotIdRef.current = newId
      setCurrentSlot(slot)
    })
    return () => {
      unsub()
      if (wipeTimerRef.current) clearTimeout(wipeTimerRef.current)
    }
  }, [])

  // Start live fee tracker when a slot is active
  useEffect(() => {
    if (!currentSlot) {
      setLiveFeeSOL(0)
      setLiveVolumeSOL(0)
      return
    }
    const stop = startFeeTracker({
      slotId: currentSlot.id,
      slotEndTime: currentSlot.endTime,
      onUpdate: (feeSOL, volumeSOL) => {
        setLiveFeeSOL(feeSOL)
        setLiveVolumeSOL(volumeSOL)
      },
    })
    return stop
  }, [currentSlot?.id])

  // Subscribe to today's slots for the schedule list
  // Use a wide UTC window and filter client-side by ET date, so the correct
  // slots are shown regardless of the browser's local timezone.
  useEffect(() => {
    const from = new Date(Date.now() - 4 * 60 * 60 * 1000)   // 4h ago (catch current slot)
    const to   = new Date(Date.now() + 28 * 60 * 60 * 1000)  // 28h ahead (full ET day + buffer)

    const unsub = subscribeToSlots(from, to, (slots) => {
      // Keep ET-ordered slots so the Today panel can always render current + next 2
      // (spilling into the next ET day when needed).
      setTodaySlots([...slots].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()))
    })
    return unsub
  }, [])

  // Derive stream URL — manual override takes priority over current slot
  const streamUrl = manualOverride?.url || currentSlot?.streamUrl || ''
  const streamerName = manualOverride?.streamerName || currentSlot?.assignedName || ''
  const streamTitle = manualOverride?.title || currentSlot?.streamTitle || currentSlot?.description || ''
  const slotLabel = currentSlot ? formatESTRange(currentSlot) : ''

  // Determine chat source (only shown when a stream is active)
  const stream = streamUrl ? detectStream(streamUrl) : null
  const isTwitch = !stream || stream.type === 'twitch'
  const chatChannel = stream?.type === 'twitch' ? stream.id : (streamUrl.trim().replace(/^https?:\/\//i, '').replace(/^twitch\.tv\//i, '') || '')
  const chatSrc = `https://www.twitch.tv/embed/${encodeURIComponent(chatChannel)}/chat?parent=${hostname}&darkpopout`

  // Next upcoming slots
  const now = Date.now()
  const upcomingSlots = todaySlots.filter((s) => new Date(s.startTime).getTime() > now)

  // For the schedule grid: current slot (if any) + next 2, otherwise next 3
  const currentTodaySlot = todaySlots.find((s) => {
    const start = new Date(s.startTime).getTime()
    const end = new Date(s.endTime).getTime()
    return now >= start && now < end
  })
  const scheduleGridSlots = currentTodaySlot
    ? [currentTodaySlot, ...upcomingSlots.slice(0, 2)]
    : upcomingSlots.slice(0, 3)

  return (
    <div className="flex h-screen pt-16 bg-[#050507] overflow-hidden">

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col overflow-y-auto min-w-0">

        {/* Status bar */}
        <div className="shrink-0 flex items-center gap-3 bg-red-600 px-4 py-2">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-white font-black tracking-[0.25em] text-sm uppercase">LIVE</span>
          </div>
          <div className="watch-roll-banner flex-1 min-w-0" aria-label="Live game updates">
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
          <div className="relative overflow-hidden rounded-2xl border border-red-500/40 bg-black shadow-[0_0_45px_rgba(255,20,80,0.32)]">
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_15%_20%,rgba(255,0,90,0.28),transparent_42%),radial-gradient(circle_at_85%_10%,rgba(80,0,255,0.26),transparent_35%)]" />
            <div className="w-full relative" style={{ aspectRatio: '16/9' }}>
              <CSGNPlayer streamUrl={streamUrl} hostname={hostname} />
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
          </div>
          <div className="text-right">
            {currentSlot ? (
              <>
                <p className="text-2xl sm:text-3xl font-black font-mono text-yellow-400">
                  {liveFeeSOL > 0 ? `${liveFeeSOL.toFixed(4)} SOL` : '—'}
                </p>
                <p className="text-[11px] text-gray-500 uppercase tracking-wider mt-0.5">
                  {liveVolumeSOL > 0
                    ? `${liveVolumeSOL.toFixed(2)} SOL vol · 0.3%`
                    : 'Live Earnings'}
                </p>
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
                    <p key={s.id} className="text-xs font-display font-bold text-white leading-snug">
                      {s.assignedName || (s.type === 'auction' ? 'Open Bid' : 'CEO')}{' '}
                      <span className="font-normal text-gray-500">{formatESTRange(s)}</span>
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
                  const slotStart = new Date(slot.startTime).getTime()
                  const slotEnd = new Date(slot.endTime).getTime()
                  const isCurrent = now >= slotStart && now < slotEnd
                  return (
                    <TodaySlotCard key={slot.id} slot={slot} isCurrent={isCurrent} />
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
          <button className="relative overflow-hidden flex flex-col items-center justify-center gap-1.5 py-2.5 sm:py-5 px-3 bg-red-600 hover:bg-red-500 active:scale-[0.98] rounded-xl font-black font-display text-white text-sm sm:text-base uppercase tracking-wider transition-all shadow-lg shadow-red-900/40 cursor-pointer">
            <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
            <Grid3X3 className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
            <span className="text-center leading-tight">Play Squares</span>
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
