import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, Gamepad2, Grid3X3 } from 'lucide-react'
import { onSnapshot, doc, collection, query, orderBy } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { formatESTRange, type Slot } from '@/lib/slots'
import { startFeeTracker } from '@/lib/dexscreener'
import { detectStream as _detectStream, buildTwitchSrc, buildYouTubeSrc, PLAYER_ALLOW } from '@/lib/player'
const DEFAULT_TWITCH_STREAM = 'https://www.twitch.tv/csgnet'
const FIXED_CHAT_CHANNEL = 'csgnet'

const bannerItems = [
  'Starting 5 \u2022 $14.70',
  'Squares Entries: 25',
  'Squares Closing in 04:03:20:55',
  'Starting 5 Closing in 01:02:23',
] as const

/* ── Helpers to parse stream URLs (imported from @/lib/player) ── */
// parseTwitchChannel, parseYouTubeId, detectStream, buildYouTubeSrc, buildTwitchSrc

function detectStream(url: string) { return _detectStream(url) }

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
        background: 'linear-gradient(135deg, #0a1628 0%, #ffb300 50%, #050c1e 100%)',
      }}
    >
      {/* Diagonal field-stripe overlay */}
      <div className="absolute inset-0" style={{
        backgroundImage: 'repeating-linear-gradient(-55deg, rgba(255,179,0,0.06) 0px, rgba(255,179,0,0.06) 10px, transparent 10px, transparent 24px)',
      }} />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg
            viewBox="0 0 160 44"
            className="h-14 w-auto"
            xmlns="http://www.w3.org/2000/svg"
          >
            <text
              x="0" y="36"
              fontFamily="'Bebas Neue', Impact, sans-serif"
              fontWeight="400"
              fontSize="48"
              letterSpacing="6"
              fill="#ffb300"
            >CSGN</text>
          </svg>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-field-500 animate-live-pulse" />
            <span
              className="text-gold-300 text-xs font-bold tracking-[0.35em] uppercase"
              style={{ fontFamily: "'Share Tech Mono', monospace" }}
            >
              Now Live
            </span>
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
      className={`relative rounded-xl overflow-hidden flex flex-col min-h-[89px] sm:min-h-[178px] lg:min-h-[44px] transition-all duration-300 ${
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

      <div className="flex flex-1 items-end justify-center pt-2 sm:pt-6 lg:pt-1 pb-0.5 sm:pb-1 lg:pb-0 px-2 sm:px-3 min-h-[48px] sm:min-h-[100px] lg:min-h-[24px]">
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

      <div className="px-2 sm:px-3 lg:px-1 pb-1.5 sm:pb-3 lg:pb-1 pt-1 sm:pt-2.5 lg:pt-0.5 bg-gradient-to-t from-black/80 to-transparent space-y-0.5 sm:space-y-1 lg:space-y-0">
        <p className="text-white font-black font-display text-[10px] sm:text-sm lg:text-[8px] leading-tight break-words">{streamer}</p>
        <p className="text-white/60 text-[9px] sm:text-[11px] lg:text-[7px] leading-snug break-words">{slot.type === 'auction' ? 'Auction Slot' : 'CEO Schedule'}</p>
        <p className="text-white/60 text-[8px] sm:text-[10px] lg:text-[7px] font-mono leading-none whitespace-nowrap">{formatCompactRange(slot)}</p>
      </div>
    </div>
  )
}

/* ── YouTube sub-component: autoplays then unmutes via IFrame API ── */
function YouTubePlayer({ videoId }: { videoId: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const el = iframeRef.current
    if (!el) return

    const sendCmd = (func: string, args: unknown[] | string = '') =>
      el.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func, args }), '*'
      )

    const unmute = () => {
      sendCmd('unMute')
      sendCmd('setVolume', [100])
    }

    // When the iframe HTML loads, subscribe to YouTube player events.
    // YouTube will then reply with "onReady" once its JS player is initialised.
    const subscribe = () =>
      el.contentWindow?.postMessage(
        JSON.stringify({ event: 'listening', id: 1 }), '*'
      )

    const onMessage = (e: MessageEvent) => {
      if (e.source !== el.contentWindow) return
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        // onReady: player is initialised — unmute immediately
        if (data.event === 'onReady') unmute()
        // onStateChange 1 = PLAYING — belt-and-suspenders unmute
        if (data.event === 'onStateChange' && data.info === 1) unmute()
      } catch { /* non-JSON messages from other sources */ }
    }

    // Fallback: retry unmute 1 s and 3 s after load in case onReady is missed
    let t1: ReturnType<typeof setTimeout>
    let t2: ReturnType<typeof setTimeout>
    const onLoad = () => {
      subscribe()
      t1 = setTimeout(unmute, 1000)
      t2 = setTimeout(unmute, 3000)
    }

    window.addEventListener('message', onMessage)
    el.addEventListener('load', onLoad)
    return () => {
      window.removeEventListener('message', onMessage)
      el.removeEventListener('load', onLoad)
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [videoId])

  return (
    <iframe
      ref={iframeRef}
      src={buildYouTubeSrc(videoId)}
      className="w-full h-full"
      allow={PLAYER_ALLOW}
      allowFullScreen
      title="Live Stream"
    />
  )
}

/* ── Twitch sub-component: straightforward iframe embed ── */
function TwitchPlayer({ channel, hostname }: { channel: string; hostname: string }) {
  return (
    <iframe
      src={buildTwitchSrc(channel, hostname)}
      className="w-full h-full"
      allow={PLAYER_ALLOW}
      allowFullScreen
      title="Live Stream"
    />
  )
}

/* ── CSGN Player: renders Twitch or YouTube, or NO STREAM ACTIVE ── */
function CSGNPlayer({ streamUrl, hostname }: { streamUrl: string; hostname: string }) {
  if (!streamUrl) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-navy-950 gap-4">
        {/* Field-line background */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,179,0,0.04) 40px)',
        }} />
        <svg viewBox="0 0 160 44" className="h-10 w-auto relative" xmlns="http://www.w3.org/2000/svg">
          <text
            x="0" y="36"
            fontFamily="'Bebas Neue', Impact, sans-serif"
            fontWeight="400"
            fontSize="48"
            letterSpacing="6"
            fill="rgba(255,179,0,0.18)"
          >CSGN</text>
        </svg>
        <p
          className="text-gray-600 text-xs tracking-[0.4em] uppercase relative"
          style={{ fontFamily: "'Share Tech Mono', monospace" }}
        >
          No Stream Active
        </p>
      </div>
    )
  }

  const stream = detectStream(streamUrl)

  if (stream?.type === 'youtube') {
    return <YouTubePlayer videoId={stream.id} />
  }

  // Twitch: use parsed channel or treat raw value as channel name
  const fallbackChannel = detectStream(DEFAULT_TWITCH_STREAM)?.id || FIXED_CHAT_CHANNEL
  const channel = stream?.id || fallbackChannel
  return <TwitchPlayer channel={channel} hostname={hostname} />
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
  const [liveVolumeSOL, setLiveVolumeSOL] = useState<number>(0)
  const [liveFeeSOL, setLiveFeeSOL] = useState<number>(0)
  const [liveFeeUSD, setLiveFeeUSD] = useState<number>(0)

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
    const slotsQuery = query(collection(db, 'slots'), orderBy('startTime', 'asc'))
    const unsub = onSnapshot(slotsQuery, (snap) => {
      const data = snap.docs
        .map((d) => d.data() as Slot)
        .filter((slot) => toMillis(slot.startTime) > 0 && toMillis(slot.endTime) > 0)
        .sort((a, b) => toMillis(a.startTime) - toMillis(b.startTime))
      setAllSlots(data)
    }, () => setAllSlots([]))
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

  // Start live fee tracker when a slot is active
  useEffect(() => {
    if (!currentSlot) {
      setLiveVolumeSOL(0)
      setLiveFeeSOL(0)
      setLiveFeeUSD(0)
      return
    }
    const stop = startFeeTracker({
      slotId: currentSlot.id,
      slotStartTime: currentSlot.startTime,
      slotEndTime: currentSlot.endTime,
      onUpdate: (feeSOL, volumeSOL, feeUSD) => {
        setLiveFeeSOL(feeSOL)
        setLiveVolumeSOL(volumeSOL)
        setLiveFeeUSD(feeUSD)
      },
    })
    return stop
  }, [currentSlot?.id])

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
  const streamUrl = manualOverride?.url || currentSlot?.streamUrl || DEFAULT_TWITCH_STREAM
  const streamerName = manualOverride?.streamerName || currentSlot?.assignedName || ''
  const streamTitle = manualOverride?.title || currentSlot?.streamTitle || currentSlot?.description || ''
  const slotLabel = currentSlot ? formatESTRange(currentSlot) : ''

  // Chat sidebar: only shown when the CSGN output stream is itself a Twitch channel
  const isTwitch = true
  const chatSrc = `https://www.twitch.tv/embed/${FIXED_CHAT_CHANNEL}/chat?parent=${hostname}&darkpopout`

  // Next upcoming slots
  const upcomingSlots = todaySlots.filter((s) => toMillis(s.startTime) > nowMs)

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
    <div className="flex h-screen pt-16 bg-navy-950 overflow-hidden">

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col overflow-y-auto min-w-0">

        {/* Score bug / broadcast ticker bar */}
        <div className="shrink-0 flex items-center gap-0 bg-navy-900 border-b border-gold-500/25 overflow-hidden">
          {/* Team name / live indicator panel */}
          <div className="flex items-center gap-2.5 bg-navy-800 border-r border-gold-500/30 px-4 py-2 shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-field-500 opacity-80" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-field-500" />
            </span>
            <span
              className="text-gold-400 font-bold tracking-[0.3em] text-xs uppercase"
              style={{ fontFamily: "'Share Tech Mono', monospace" }}
            >
              ON AIR
            </span>
          </div>
          {/* Diagonal gold divider */}
          <div className="w-4 h-full bg-navy-800 shrink-0" style={{
            clipPath: 'polygon(0 0, 100% 0, 60% 100%, 0 100%)',
          }} />
          {/* Rolling ticker */}
          <div
            className="watch-roll-banner flex-1 min-w-0 lg:flex-none lg:w-[460px] lg:ml-auto px-3"
            aria-label="Live game updates"
          >
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
          {/* CSGN brand end cap */}
          <div
            className="hidden lg:flex items-center gap-2 shrink-0 px-4 py-2 border-l border-gold-500/20"
          >
            <span
              className="text-[10px] text-gold-500/60 font-bold tracking-[0.3em] uppercase"
              style={{ fontFamily: "'Bebas Neue', Impact, sans-serif", fontSize: '0.8rem', letterSpacing: '0.2em' }}
            >
              CSGN
            </span>
          </div>
        </div>

        {/* Video player */}
        <div className="shrink-0 px-3 sm:px-4 pt-3 sm:pt-4 pb-2">
          <div
            className="relative overflow-hidden bg-black max-w-[1280px] mx-auto border-2 border-gold-500/20 shadow-[0_0_40px_rgba(255,179,0,0.12)]"
            style={{ borderRadius: '2px' }}
          >
            {/* Corner accent marks */}
            <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-gold-500/60 z-10 pointer-events-none" />
            <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-gold-500/60 z-10 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-gold-500/60 z-10 pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-gold-500/60 z-10 pointer-events-none" />
            <div className="w-full relative" style={{ aspectRatio: '16/9' }}>
              <CSGNPlayer streamUrl={streamUrl} hostname={hostname} />
              <CSGNWipeOverlay visible={showWipe} />
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-navy-950/60 to-transparent" />
          </div>
        </div>

        {/* Streamer info row — broadcast lower-third style */}
        <div className="shrink-0 flex items-start justify-between px-4 py-3 border-b-2 border-gold-500/15 bg-navy-900/60">
          <div>
            {/* Streamer name in Oswald — like a player name on a broadcast chyron */}
            <h1
              className="text-2xl sm:text-3xl font-bold text-white leading-none uppercase tracking-wide"
              style={{ fontFamily: "'Oswald', system-ui, sans-serif", letterSpacing: '0.06em' }}
            >
              {streamerName || <span className="text-gray-600 opacity-40">No Stream</span>}
            </h1>
            {streamTitle && (
              <p
                className="text-sm text-gold-400/80 font-medium mt-0.5 tracking-wide"
                style={{ fontFamily: "'Barlow Condensed', system-ui, sans-serif" }}
              >
                "{streamTitle}"
              </p>
            )}
            <p
              className="text-xs text-gray-500 mt-1 tracking-widest uppercase"
              style={{ fontFamily: "'Share Tech Mono', monospace" }}
            >
              {slotLabel}
            </p>
          </div>
          {/* Earnings — scoreboard number style */}
          <div className="text-right">
            {currentSlot ? (
              <>
                <p
                  className="text-2xl sm:text-3xl font-bold text-gold-400 leading-none"
                  style={{ fontFamily: "'Share Tech Mono', monospace" }}
                >
                  {liveFeeUSD > 0 ? `$${liveFeeUSD.toFixed(2)}` : '—'}
                </p>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-1"
                  style={{ fontFamily: "'Share Tech Mono', monospace" }}>
                  {liveVolumeSOL > 0
                    ? `${liveFeeSOL.toFixed(6)} SOL · ${liveVolumeSOL.toFixed(2)} VOL`
                    : 'Live Earnings'}
                </p>
                {currentSlot.creatorFees?.marketCapTierLabel && (
                  <p className="text-[10px] text-gray-600 mt-0.5 uppercase tracking-wider"
                    style={{ fontFamily: "'Share Tech Mono', monospace" }}>
                    {currentSlot.creatorFees.marketCapTierLabel}
                  </p>
                )}
              </>
            ) : (
              <>
                <p
                  className="text-2xl sm:text-3xl font-bold text-gray-600 leading-none"
                  style={{ fontFamily: "'Share Tech Mono', monospace" }}
                >
                  —
                </p>
                <p className="text-[10px] text-gray-600 uppercase tracking-wider mt-1"
                  style={{ fontFamily: "'Share Tech Mono', monospace" }}>
                  Earnings
                </p>
              </>
            )}
          </div>
        </div>

        {/* TODAY'S SCHEDULE */}
        <div className="shrink-0 px-4 py-4 border-b border-gold-500/10">
          <button
            type="button"
            className="w-full flex items-center justify-between mb-4 cursor-pointer"
            onClick={() => setIsScheduleOpen((prev) => !prev)}
            aria-expanded={isScheduleOpen}
          >
            <div className="flex items-center gap-2">
              <span className="w-1 h-4 bg-gold-500" />
              <h2
                className="text-[11px] font-bold tracking-[0.3em] uppercase text-gold-400"
                style={{ fontFamily: "'Share Tech Mono', monospace" }}
              >
                Today's Lineup
              </h2>
            </div>
            <div className="flex items-center gap-4">
              {upcomingSlots.length > 0 && (
                <div className="text-right space-y-0.5">
                  <p
                    className="text-[10px] text-gold-500/50 uppercase tracking-wider leading-none mb-1"
                    style={{ fontFamily: "'Share Tech Mono', monospace" }}
                  >
                    Up Next
                  </p>
                  {upcomingSlots.slice(0, 3).map((s) => (
                    <p
                      key={s.id}
                      className="text-[10px] font-bold text-white leading-snug whitespace-nowrap uppercase"
                      style={{ fontFamily: "'Oswald', system-ui, sans-serif", letterSpacing: '0.06em' }}
                    >
                      {s.assignedName || (s.type === 'auction' ? 'Open Bid' : 'CEO')}{' '}
                      <span className="font-normal text-gray-500 text-[9px]">{formatCompactRange(s)}</span>
                    </p>
                  ))}
                </div>
              )}
              <ChevronDown className={`w-4 h-4 text-gold-500/60 transition-transform ${isScheduleOpen ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {isScheduleOpen && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {scheduleGridSlots.map((slot) => {
                  const slotStart = toMillis(slot.startTime)
                  const slotEnd   = toMillis(slot.endTime)
                  const isCurrent = nowMs >= slotStart && nowMs < slotEnd
                  return (
                    <TodaySlotCard key={slot.id} slot={slot} isCurrent={isCurrent} />
                  )
                })}
              </div>

              <div className="mt-4 text-center">
                <Link
                  to="/schedule"
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-navy-800 border border-gold-500/25 text-sm text-gold-400 hover:text-gold-300 hover:border-gold-400/50 hover:bg-navy-700 transition-all font-bold tracking-widest uppercase"
                  style={{ fontFamily: "'Oswald', system-ui, sans-serif", borderRadius: '2px' }}
                >
                  Full Schedule <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </>
          )}
        </div>

        {/* Game select buttons — NCAA game menu style */}
        <div className="shrink-0 grid grid-cols-2 gap-2 px-4 py-4">
          <button
            className="relative overflow-hidden flex flex-col items-center justify-center gap-1.5 py-3 sm:py-5 px-3 cursor-pointer active:scale-[0.97] transition-all shadow-lg shadow-gold-900/30"
            style={{
              background: 'linear-gradient(160deg, #e09600 0%, #ffb300 50%, #e09600 100%)',
              borderRadius: '2px',
              border: '1px solid rgba(255,215,64,0.5)',
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
            <Gamepad2 className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 text-navy-900" />
            <span
              className="text-center leading-tight text-navy-900 font-bold uppercase tracking-widest text-sm"
              style={{ fontFamily: "'Oswald', system-ui, sans-serif" }}
            >
              Starting 5<br />
              <span className="font-normal text-xs text-navy-800/80 tracking-wider normal-case">for free!</span>
            </span>
          </button>
          <button
            disabled
            className="relative overflow-hidden flex flex-col items-center justify-center gap-1.5 py-3 sm:py-5 px-3 cursor-not-allowed transition-all"
            style={{
              background: 'linear-gradient(160deg, #0a1628 0%, #0e2040 100%)',
              borderRadius: '2px',
              border: '1px solid rgba(255,179,0,0.15)',
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
            <Grid3X3 className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 text-gold-500/40" />
            <span
              className="text-center leading-tight text-gray-500 font-bold uppercase tracking-widest text-sm"
              style={{ fontFamily: "'Oswald', system-ui, sans-serif" }}
            >
              Squares<br />
              <span className="font-normal text-xs text-gray-600 tracking-wider normal-case">Coming Soon</span>
            </span>
          </button>
        </div>

        {/* Mobile chat */}
        {isTwitch && (
          <div className="lg:hidden shrink-0 px-4 pb-4">
            <div className="overflow-hidden border border-gold-500/20" style={{ borderRadius: '2px' }}>
              <button
                type="button"
                className="w-full bg-navy-900 px-4 py-3 flex items-center justify-between border-b border-gold-500/15 cursor-pointer"
                onClick={() => setIsChatOpen((prev) => !prev)}
                aria-expanded={isChatOpen}
              >
                <div className="flex items-center gap-2">
                  <span className="w-1 h-3.5 bg-gold-500/60" />
                  <span
                    className="text-[11px] font-bold tracking-[0.25em] uppercase text-gold-400/80"
                    style={{ fontFamily: "'Share Tech Mono', monospace" }}
                  >
                    Live Chat
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-gold-500/50 transition-transform ${isChatOpen ? 'rotate-180' : ''}`} />
              </button>
              {isChatOpen && (
                <iframe
                  src={chatSrc}
                  className="w-full"
                  style={{ height: 360, background: '#050c1e' }}
                  title="CSGN Chat"
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Right: Chat sidebar (desktop only) ── */}
      {isTwitch && (
        <aside className="hidden lg:flex w-[340px] shrink-0 flex-col border-l-2 border-gold-500/20 bg-navy-950">
          {/* Sidebar header — score panel style */}
          <button
            type="button"
            className="px-4 py-3 border-b border-gold-500/15 flex items-center justify-between bg-navy-900 cursor-pointer hover:bg-navy-800 transition-colors"
            onClick={() => setIsChatOpen((prev) => !prev)}
            aria-expanded={isChatOpen}
          >
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-field-500 opacity-70" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-field-500" />
              </span>
              <span
                className="text-[11px] font-bold tracking-[0.25em] uppercase text-gold-400/80"
                style={{ fontFamily: "'Share Tech Mono', monospace" }}
              >
                Live Chat
              </span>
            </div>
            <ChevronDown className={`w-4 h-4 text-gold-500/50 transition-transform ${isChatOpen ? 'rotate-180' : ''}`} />
          </button>
          {isChatOpen && (
            <iframe
              src={chatSrc}
              className="flex-1 w-full"
              style={{ background: '#050c1e' }}
              title="CSGN Chat"
            />
          )}
        </aside>
      )}
    </div>
  )
}
