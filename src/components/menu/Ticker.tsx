import { tickerItems } from '@/data/dummy'

export function Ticker() {
  // duplicate so the loop reads continuous
  const items = [...tickerItems, ...tickerItems]
  return (
    <div className="relative h-9 overflow-hidden border-y border-primary-700/50 bg-gradient-to-r from-black via-[#170306] to-black">
      <div className="absolute left-0 top-0 bottom-0 z-10 px-3 flex items-center gap-2 bg-primary-600 clip-slant-r">
        <span className="w-2 h-2 rounded-full bg-white animate-live-pulse" />
        <span className="font-display font-black text-xs tracking-[0.2em] text-white">CSGN WIRE</span>
      </div>
      <div className="absolute right-0 top-0 bottom-0 z-10 px-3 flex items-center gap-2 bg-black/80 border-l border-primary-700/40 clip-slant-l">
        <span className="font-mono text-[10px] tracking-[0.25em] text-white/70">LIVE · 24/7</span>
      </div>
      <div className="ticker-track h-full items-center pl-[140px] pr-[120px]">
        {items.map((t, i) => (
          <span
            key={i}
            className="font-mono text-xs tracking-[0.12em] text-white/85 px-6 inline-flex items-center gap-2"
          >
            <span className="text-primary-500">◆</span>
            {t}
          </span>
        ))}
      </div>
    </div>
  )
}
