import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, Gamepad2, Grid3X3 } from 'lucide-react'

/* ── Twitch channel ── */
const CHANNEL = 'caborgg'

/* ── Schedule data ── */
const todaySchedule = [
  {
    handle: 'TRAPKINGZ',
    specialty: 'NBA Picks',
    time: '6:00–8:00PM',
    status: 'live' as const,
    avatarHue: 220,
  },
  {
    handle: 'SolanaSteve',
    specialty: 'Crypto Markets',
    time: '8:00–10:00PM',
    status: 'upcoming' as const,
    avatarHue: 260,
  },
  {
    handle: 'CEO Show',
    specialty: 'Prime Time',
    time: '10:00PM–12AM',
    status: 'upcoming' as const,
    avatarHue: 200,
  },
]

/* ── Streamer silhouette (shown inside blue cards) ── */
function AvatarSilhouette({ hue }: { hue: number }) {
  return (
    <svg viewBox="0 0 120 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <linearGradient id={`ag${hue}`} x1="60" y1="0" x2="60" y2="160" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={`hsl(${hue},80%,65%)`} stopOpacity="0.85" />
          <stop offset="100%" stopColor={`hsl(${hue},60%,25%)`} stopOpacity="0.4" />
        </linearGradient>
      </defs>
      {/* Head */}
      <ellipse cx="60" cy="52" rx="26" ry="30" fill={`url(#ag${hue})`} />
      {/* Shoulders/body */}
      <path d="M0 160 C0 110 28 88 60 85 C92 88 120 110 120 160 Z" fill={`url(#ag${hue})`} />
    </svg>
  )
}

/* ── Schedule card (the "blue squares") ── */
function ScheduleCard({ slot }: { slot: typeof todaySchedule[0] }) {
  const isLive = slot.status === 'live'

  return (
    <div
      className={`relative rounded-xl overflow-hidden flex flex-col min-h-[89px] sm:min-h-[178px] transition-all duration-300 ${
        isLive
          ? 'ring-2 ring-red-500 shadow-[0_0_24px_rgba(255,35,70,0.5)]'
          : 'ring-1 ring-white/10 hover:ring-white/20'
      }`}
      style={{
        background: `linear-gradient(160deg, hsl(${slot.avatarHue},70%,30%) 0%, hsl(${slot.avatarHue},60%,12%) 100%)`,
      }}
    >
      {/* Status badge */}
      <div className="absolute top-2 left-2 z-10">
        {isLive ? (
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

      {/* Avatar area */}
      <div className="flex flex-1 items-end justify-center pt-2 sm:pt-6 pb-0.5 sm:pb-1 px-2 sm:px-3 min-h-[48px] sm:min-h-[100px]">
        <AvatarSilhouette hue={slot.avatarHue} />
      </div>

      {/* Info */}
      <div className="px-2 sm:px-3 pb-1.5 sm:pb-3 pt-1 sm:pt-2.5 bg-gradient-to-t from-black/80 to-transparent space-y-0.5 sm:space-y-1">
        <p className="text-white font-black font-display text-[10px] sm:text-sm leading-tight break-words">{slot.handle}</p>
        <p className="text-white/60 text-[9px] sm:text-[11px] leading-snug break-words">{slot.specialty}</p>
        <p className="text-white/60 text-[9px] sm:text-[11px] font-mono leading-none">{slot.time} EST</p>
      </div>
    </div>
  )
}

export default function Watch() {
  const hostname = useMemo(() => (typeof window !== 'undefined' ? window.location.hostname : 'localhost'), [])
  const [isScheduleOpen, setIsScheduleOpen] = useState(true)
  const [isChatOpen, setIsChatOpen] = useState(false)

  const playerSrc = `https://player.twitch.tv/?channel=shrood&parent=${hostname}&autoplay=true&muted=false`
  const chatSrc   = `https://www.twitch.tv/embed/${CHANNEL}/chat?parent=${hostname}&darkpopout`

  return (
    <div className="flex h-screen pt-16 bg-[#050507] overflow-hidden">

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col overflow-y-auto min-w-0">

        {/* Status bar */}
        <div className="shrink-0 flex items-center justify-between bg-red-600 px-4 py-2">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-white font-black tracking-[0.25em] text-sm uppercase">LIVE</span>
          </div>
          <span className="text-white/90 text-xs font-mono tracking-wider uppercase">
            STARTING 5 &nbsp;·&nbsp; POT: $14.70
          </span>
        </div>

        {/* Video player */}
        <div className="shrink-0 px-4 sm:px-5 pt-4 sm:pt-5 pb-2">
          <div className="relative overflow-hidden rounded-2xl border border-red-500/40 bg-black shadow-[0_0_45px_rgba(255,20,80,0.32)]">
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_15%_20%,rgba(255,0,90,0.28),transparent_42%),radial-gradient(circle_at_85%_10%,rgba(80,0,255,0.26),transparent_35%)]" />
            <div className="relative flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-black/75 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] sm:text-xs tracking-[0.3em] font-black uppercase text-white/80">CSGN PRIME FEED</span>
              </div>
              <span className="text-[10px] sm:text-xs font-mono text-red-300">UNMUTED · LIVE</span>
            </div>

            <div className="w-full" style={{ aspectRatio: '16/9' }}>
              <iframe
                src={playerSrc}
                className="w-full h-full"
                allow="autoplay; fullscreen"
                allowFullScreen
                title="CSGN Live"
              />
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/55 to-transparent" />
          </div>
        </div>

        {/* Streamer info row */}
        <div className="shrink-0 flex items-start justify-between px-5 py-4 border-b border-white/[0.06]">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black font-display text-white tracking-tight leading-none">
              TRAPKINGZ
            </h1>
            <p className="text-sm text-gray-400 mt-1 font-mono">8:00 – 10:00 PM EST</p>
          </div>
          <div className="text-right">
            <p className="text-2xl sm:text-3xl font-black font-mono text-yellow-400">$123.69</p>
            <p className="text-[11px] text-gray-500 uppercase tracking-wider mt-0.5">Earnings</p>
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
              <div className="text-right">
                <p className="text-[11px] text-gray-500 uppercase tracking-wider leading-none">In the Hole</p>
                <p className="text-sm font-display font-bold text-white mt-0.5">SolanaSteve</p>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isScheduleOpen ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {isScheduleOpen && (
            <>
              {/* Blue schedule cards — the "blue squares" */}
              <div className="grid grid-cols-3 gap-3">
                {todaySchedule.map((slot) => (
                  <ScheduleCard key={slot.handle} slot={slot} />
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

        {/* Mobile chat (shown below game buttons on small screens) */}
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
      </div>

      {/* ── Right: Chat sidebar (desktop only) ── */}
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
    </div>
  )
}
