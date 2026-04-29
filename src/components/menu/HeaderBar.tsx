import { useEffect, useState } from 'react'
import { networkStats } from '@/data/dummy'

function useClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

export function HeaderBar() {
  const now = useClock()
  const time = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const date = now.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase()

  return (
    <div className="relative flex items-stretch h-14 border-b border-primary-700/40 bg-gradient-to-r from-[#170306] via-black to-[#170306]">
      <div className="flex items-center gap-3 px-5 bg-primary-600 clip-slant-r min-w-[210px]">
        <div className="w-9 h-9 rounded-sm metal-panel-hot flex items-center justify-center font-display font-black text-primary-300">
          C
        </div>
        <div className="leading-tight">
          <div className="font-display font-black text-base tracking-[0.18em] text-white">CSGN</div>
          <div className="font-mono text-[9px] tracking-[0.3em] text-white/70">DYNASTY · S02</div>
        </div>
      </div>

      <div className="flex-1 hidden md:flex items-center justify-center gap-8 px-6 font-mono text-[11px] uppercase tracking-[0.22em]">
        <Stat label="Live Streams" value={String(networkStats.liveStreams)} hot />
        <Stat label="Viewers"      value={fmt(networkStats.liveViewers)} hot />
        <Stat label="Slots Today"  value={String(networkStats.slotsToday)} />
        <Stat label="Rookies"      value={fmt(networkStats.rookiesPending)} />
        <Stat label="Treasury"     value={'$' + fmt(networkStats.treasuryUSD)} />
        <Stat label="Uptime"       value={networkStats.uptimePct + '%'} />
      </div>

      <div className="flex items-center gap-3 px-4 bg-black/70 border-l border-primary-700/30 clip-slant-l min-w-[210px] justify-end">
        <div className="text-right leading-tight">
          <div className="font-mono text-[10px] tracking-[0.25em] text-white/55">{date}</div>
          <div className="scoreboard-digits text-base text-white">{time} ET</div>
        </div>
        <span className="hidden md:inline-flex items-center gap-1 px-2 py-1 border border-[color:var(--color-live)]/40 rounded-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--color-live)] animate-live-pulse" />
          <span className="font-mono text-[10px] tracking-[0.25em] text-[color:var(--color-live)]">ON AIR</span>
        </span>
      </div>
    </div>
  )
}

function Stat({ label, value, hot = false }: { label: string; value: string; hot?: boolean }) {
  return (
    <div className="flex flex-col items-start">
      <span className="text-white/40 text-[9px]">{label}</span>
      <span className={`scoreboard-digits text-sm ${hot ? 'text-primary-400' : 'text-white/90'}`}>{value}</span>
    </div>
  )
}
