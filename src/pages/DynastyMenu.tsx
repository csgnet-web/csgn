import { Link } from 'react-router-dom'
import { PanelShell } from '@/components/menu/PanelShell'
import { GAME_MODES, currentStream, networkStats, upNext } from '@/data/dummy'

export default function DynastyMenu() {
  const featured = GAME_MODES.filter(m => m.id !== 'dynasty-menu').slice(0, 4)

  return (
    <PanelShell
      eyebrow="MAIN MENU"
      title="Dynasty Mode"
      subtitle="The 24/7 sports/crypto streaming network. Pick a mode to play, watch, build, or own."
      badge="ON AIR"
    >
      {/* Hero broadcast preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 relative metal-panel-hot rounded-sm overflow-hidden h-[260px] md:h-[320px]">
          <div className="absolute inset-0 field-stripes opacity-50" />
          <div className="absolute inset-0 bg-gradient-to-tr from-black via-transparent to-black/60" />
          <div className="stadium-sweep" />

          <div className="relative h-full flex flex-col justify-between p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-sm bg-[color:var(--color-live)] text-black font-display font-black text-[10px] tracking-[0.3em]">LIVE</span>
                <span className="font-mono text-[10px] tracking-[0.25em] text-white/65 uppercase">{currentStream.network} · {currentStream.slot}</span>
              </div>
              <div className="text-right">
                <div className="scoreboard-digits text-2xl text-white">{currentStream.viewers.toLocaleString()}</div>
                <div className="font-mono text-[9px] tracking-[0.2em] text-white/55 uppercase">VIEWERS</div>
              </div>
            </div>

            <div>
              <div className="font-mono text-[10px] tracking-[0.3em] text-primary-300 uppercase mb-1">{currentStream.streamer} · {currentStream.category}</div>
              <h2 className="font-display font-black text-2xl md:text-4xl tracking-[0.02em] text-white leading-tight">
                {currentStream.title}
              </h2>
              <div className="flex items-center gap-2 mt-3">
                {currentStream.tags.map(t => (
                  <span key={t} className="font-mono text-[9px] tracking-[0.2em] uppercase px-1.5 py-0.5 rounded-sm border border-primary-500/40 text-primary-300 bg-black/30">{t}</span>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/10">
              <div className="flex items-center gap-3">
                <Link
                  to="/watch"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-sm bg-primary-600 hover:bg-primary-500 transition-colors font-display font-black tracking-[0.18em] text-xs text-white"
                >
                  ▶ WATCH LIVE
                </Link>
                <Link
                  to="/apply"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-sm border border-white/20 hover:border-white/50 transition-colors font-display font-black tracking-[0.18em] text-xs text-white/85"
                >
                  RACE FOR A SLOT
                </Link>
              </div>
              <div className="hidden md:block scoreboard-digits text-sm text-white/65">{currentStream.duration}</div>
            </div>
          </div>
        </div>

        {/* Right: stat block */}
        <div className="metal-panel rounded-sm p-5 flex flex-col gap-4">
          <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-white/45">Network · Live</div>
          <Stat label="Live Viewers"   value={networkStats.liveViewers.toLocaleString()} hot />
          <Stat label="Active Streams" value={String(networkStats.liveStreams)} />
          <Stat label="Slots Today"    value={String(networkStats.slotsToday)} />
          <Stat label="Rookies in Combine" value={networkStats.rookiesPending.toLocaleString()} />
          <Stat label="Treasury"       value={'$' + networkStats.treasuryUSD.toLocaleString()} hot />
          <Stat label="Uptime"         value={networkStats.uptimePct + '%'} />
        </div>
      </div>

      {/* Up next */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="metal-panel rounded-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="font-display font-black tracking-[0.2em] text-white text-sm">UP NEXT</div>
            <Link to="/schedule" className="font-mono text-[10px] tracking-[0.25em] uppercase text-primary-400 hover:text-primary-300">FULL SCHEDULE ▸</Link>
          </div>
          <div className="space-y-2">
            {upNext.map((s, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                <span className="scoreboard-digits text-sm text-primary-400 w-20">{s.time}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-black tracking-[0.06em] text-white text-sm uppercase truncate">{s.title}</div>
                  <div className="font-mono text-[10px] tracking-[0.18em] text-white/50 uppercase truncate">{s.host}</div>
                </div>
                <span className="font-mono text-[10px] tracking-[0.18em] text-white/45">{s.duration}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="metal-panel rounded-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="font-display font-black tracking-[0.2em] text-white text-sm">QUICK MODES</div>
            <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-white/40">SELECT</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {featured.map(m => (
              <Link
                key={m.id}
                to={m.route}
                className="metal-panel hover:border-primary-500/60 transition-all p-3 rounded-sm group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="scoreboard-digits text-[10px] text-primary-400">{m.number}</span>
                  {m.badge && (
                    <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-white/55">{m.badge}</span>
                  )}
                </div>
                <div className="font-display font-black tracking-[0.06em] text-white text-sm uppercase truncate">{m.label}</div>
                <div className="font-mono text-[10px] tracking-[0.18em] text-white/45 uppercase truncate">{m.sublabel}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </PanelShell>
  )
}

function Stat({ label, value, hot = false }: { label: string; value: string; hot?: boolean }) {
  return (
    <div className="flex items-end justify-between gap-3 border-b border-white/5 pb-3 last:border-0 last:pb-0">
      <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-white/55">{label}</span>
      <span className={`scoreboard-digits text-lg ${hot ? 'text-primary-400' : 'text-white/95'}`}>{value}</span>
    </div>
  )
}
