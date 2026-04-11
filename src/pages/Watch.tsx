import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, Gamepad2, Grid3X3 } from 'lucide-react'
import { onSnapshot, collection, query, orderBy } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { formatESTRange, type Slot } from '@/lib/slots'
import { detectStream as _detectStream, buildYouTubeSrc, PLAYER_ALLOW } from '@/lib/player'

const bannerItems = [
  'Starting 5 • $14.70',
  'Squares Entries: 25',
  'Squares Closing in 04:03:20:55',
  'Starting 5 Closing in 01:02:23',
] as const

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

function CSGNWipeOverlay({ visible }: { visible: boolean }) {
  return (
    <div
      className={`absolute inset-0 z-20 pointer-events-none transition-all duration-700 ease-in-out ${
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-full'
      }`}
      style={{ background: 'linear-gradient(135deg, #ff2346 0%, #0a0a14 60%)' }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
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

function TodaySlotCard({ slot, isCurrent }: { slot: Slot; isCurrent: boolean }) {
  const streamer = slot.assignedName || 'Unassigned'
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
            UPCOMING
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
        <p className="text-white/60 text-[9px] sm:text-[11px] leading-snug break-words">{slot.streamTitle || slot.description || 'Untitled stream'}</p>
        <p className="text-white/60 text-[8px] sm:text-[10px] font-mono leading-none whitespace-nowrap">{formatCompactRange(slot)}</p>
      </div>
    </div>
  )
}

function YouTubePlayer({ videoId }: { videoId: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const el = iframeRef.current
    if (!el) return

    const sendCmd = (func: string, args: unknown[] | string = '') =>
      el.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*')

    const unmute = () => {
      sendCmd('unMute')
      sendCmd('setVolume', [100])
    }

    const subscribe = () =>
      el.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1 }), '*')

    const onMessage = (e: MessageEvent) => {
      if (e.source !== el.contentWindow) return
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        if (data.event === 'onReady') unmute()
        if (data.event === 'onStateChange' && data.info === 1) unmute()
      } catch {
        // ignore non-player messages
      }
    }

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

function TwitchPlayer({ channel, hostname }: { channel: string; hostname: string }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const loadTwitchScript = (): Promise<void> =>
      new Promise((resolve) => {
        if ((window as unknown as Record<string, unknown>).Twitch) { resolve(); return }
        const existing = document.querySelector('script[src="https://embed.twitch.tv/embed/v1.js"]')
        if (existing) {
          existing.addEventListener('load', () => resolve(), { once: true })
          return
        }
        const script = document.createElement('script')
        script.src = 'https://embed.twitch.tv/embed/v1.js'
        script.onload = () => resolve()
        document.head.appendChild(script)
      })

    loadTwitchScript().then(() => {
      if (!containerRef.current) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const TwitchAPI = (window as any).Twitch
      const embed = new TwitchAPI.Embed(containerRef.current, {
        width: '100%',
        height: '100%',
        channel,
        parent: [hostname],
        autoplay: true,
        muted: false,
        layout: 'video',
      })
      embed.addEventListener(TwitchAPI.Embed.VIDEO_READY, () => {
        const player = embed.getPlayer()
        player.setMuted(false)
        player.setVolume(1)
        player.play()
      })
    })

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = ''
    }
  }, [channel, hostname])

  return <div ref={containerRef} className="w-full h-full" />
}

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
  if (stream?.type === 'youtube') return <YouTubePlayer videoId={stream.id} />

  const channel = stream?.id ?? streamUrl.trim().replace(/^https?:\/\//i, '').replace(/^twitch\.tv\//i, '')
  return <TwitchPlayer channel={channel} hostname={hostname} />
}

export default function Watch() {
  const hostname = useMemo(() => (typeof window !== 'undefined' ? window.location.hostname : 'localhost'), [])
  const [isScheduleOpen, setIsScheduleOpen] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [allSlots, setAllSlots] = useState<Slot[]>([])
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [showWipe, setShowWipe] = useState(false)
  const prevSlotIdRef = useRef<string | null>(null)
  const wipeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const slotsQuery = query(collection(db, 'slots'), orderBy('startTime', 'asc'))
    const unsub = onSnapshot(slotsQuery, (snap) => {
      const data = snap.docs
        .map((d) => d.data() as Slot)
        .filter((slot) => toMillis(slot.startTime) > 0 && toMillis(slot.endTime) > 0)
        .sort((a, b) => toMillis(a.startTime) - toMillis(b.startTime))
      setAllSlots(data)
    }, () => setAllSlots([]))

    return () => unsub()
  }, [])

  const currentSlot = useMemo(
    () => allSlots.find((slot) => nowMs >= toMillis(slot.startTime) && nowMs < toMillis(slot.endTime)) ?? null,
    [allSlots, nowMs],
  )

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

  const todayKey = etDayKeyFromMillis(nowMs)
  const todaySlots = useMemo(
    () => allSlots.filter((slot) => etDayKeyFromMillis(toMillis(slot.startTime)) === todayKey),
    [allSlots, todayKey],
  )

  const currentTodaySlot = useMemo(
    () => todaySlots.find((slot) => nowMs >= toMillis(slot.startTime) && nowMs < toMillis(slot.endTime)),
    [todaySlots, nowMs],
  )

  const upcomingSlots = useMemo(
    () => todaySlots.filter((slot) => toMillis(slot.startTime) > nowMs).slice(0, 3),
    [todaySlots, nowMs],
  )

  const scheduleGridSlots = currentTodaySlot
    ? [currentTodaySlot, ...upcomingSlots.slice(0, 2)]
    : upcomingSlots

  const streamUrl = currentSlot?.streamUrl || ''
  const streamerName = currentSlot?.assignedName || 'No Stream'
  const streamTitle = currentSlot?.streamTitle || currentSlot?.description || 'Untitled stream'
  const slotLabel = currentSlot ? formatESTRange(currentSlot) : ''

  const stream = streamUrl ? detectStream(streamUrl) : null
  const isTwitch = !!streamUrl && (!stream || stream.type === 'twitch')
  const chatChannel = stream?.type === 'twitch'
    ? stream.id
    : (streamUrl.trim().replace(/^https?:\/\//i, '').replace(/^twitch\.tv\//i, '') || '')
  const chatSrc = `https://www.twitch.tv/embed/${encodeURIComponent(chatChannel)}/chat?parent=${hostname}&darkpopout`

  return (
    <div className="flex h-screen pt-16 bg-[#050507] overflow-hidden">
      <div className="flex-1 flex flex-col overflow-y-auto min-w-0">
        <div className="shrink-0 flex items-center gap-3 bg-red-600 px-4 py-2">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-white font-black tracking-[0.25em] text-sm uppercase">LIVE</span>
          </div>
          <div className="watch-roll-banner flex-1 min-w-0 lg:flex-none lg:w-[460px] lg:ml-auto" aria-label="Live game updates">
            <div className="watch-roll-banner__inner">
              {bannerItems.map((item, index) => (
                <span key={item} className="watch-roll-banner__face" style={{ transform: `rotateX(${index * 90}deg) translateZ(12px)` }}>
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="shrink-0 px-4 sm:px-5 pt-4 sm:pt-5 pb-2">
          <div className="relative overflow-hidden rounded-2xl border border-red-500/40 bg-black shadow-[0_0_45px_rgba(255,20,80,0.32)] max-w-[1280px] mx-auto">
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_15%_20%,rgba(255,0,90,0.28),transparent_42%),radial-gradient(circle_at_85%_10%,rgba(80,0,255,0.26),transparent_35%)]" />
            <div className="w-full relative" style={{ aspectRatio: '16/9' }}>
              <CSGNPlayer streamUrl={streamUrl} hostname={hostname} />
              <CSGNWipeOverlay visible={showWipe} />
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/55 to-transparent" />
          </div>
        </div>

        <div className="shrink-0 flex items-start justify-between px-5 py-4 border-b border-white/[0.06]">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black font-display text-white tracking-tight leading-none">{streamerName}</h1>
            <p className="text-sm text-primary-300 font-medium mt-0.5 italic">"{streamTitle}"</p>
            <p className="text-sm text-gray-400 mt-1 font-mono">{slotLabel}</p>
          </div>
        </div>

        <div className="shrink-0 px-5 py-5 border-b border-white/[0.06]">
          <button
            type="button"
            className="w-full flex items-center justify-between mb-4"
            onClick={() => setIsScheduleOpen((prev) => !prev)}
            aria-expanded={isScheduleOpen}
          >
            <h2 className="text-xs font-black tracking-[0.25em] uppercase text-gray-400">Today's Schedule</h2>
            <div className="flex items-center gap-4">
              {upcomingSlots.length > 0 && (
                <div className="text-right space-y-0.5">
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider leading-none mb-1">Up Next</p>
                  {upcomingSlots.map((slot) => (
                    <p key={slot.id} className="text-[10px] font-display font-bold text-white leading-snug whitespace-nowrap">
                      {slot.assignedName || 'Unassigned'} <span className="font-normal text-gray-400">{formatCompactRange(slot)}</span>
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
                {scheduleGridSlots.map((slot) => (
                  <TodaySlotCard key={slot.id} slot={slot} isCurrent={slot.id === currentTodaySlot?.id} />
                ))}
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
              {isChatOpen && <iframe src={chatSrc} className="w-full" style={{ height: 360, background: '#0a0a14' }} title="CSGN Chat" />}
            </div>
          </div>
        )}
      </div>

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
          {isChatOpen && <iframe src={chatSrc} className="flex-1 w-full" style={{ background: '#07070f' }} title="CSGN Chat" />}
        </aside>
      )}
    </div>
  )
}
