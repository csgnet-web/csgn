import { PanelShell } from '@/components/menu/PanelShell'
import { currentStream, upNext } from '@/data/dummy'

export default function WatchLive() {
  return (
    <PanelShell
      eyebrow="GAME MODE 02"
      title="Watch Live"
      subtitle="Active broadcast slot. Real-time stream, live chat, and instant ticker."
      badge="LIVE"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Player frame */}
        <div className="lg:col-span-2 relative metal-panel-hot rounded-sm overflow-hidden">
          <div className="aspect-video w-full relative bg-black">
            <div className="absolute inset-0 field-stripes opacity-40" />
            <div className="stadium-sweep" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="font-display font-black text-7xl md:text-9xl text-white/15 tracking-[0.12em]">CSGN</div>
                <div className="font-mono text-[10px] tracking-[0.4em] text-white/30 uppercase mt-2">SIGNAL · LIVE</div>
              </div>
            </div>

            {/* Top overlay */}
            <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-sm bg-[color:var(--color-live)] text-black font-display font-black text-[10px] tracking-[0.3em]">LIVE</span>
                <span className="font-mono text-[10px] tracking-[0.25em] text-white/85 uppercase">{currentStream.network} · {currentStream.slot}</span>
              </div>
              <div className="flex items-center gap-2 px-2 py-1 rounded-sm bg-black/50 border border-white/10">
                <span className="w-2 h-2 rounded-full bg-primary-500 animate-live-pulse" />
                <span className="scoreboard-digits text-xs text-white">{currentStream.duration}</span>
              </div>
            </div>

            {/* Bottom overlay */}
            <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <div className="font-display font-black text-base md:text-2xl tracking-[0.04em] text-white uppercase truncate">{currentStream.title}</div>
                <div className="font-mono text-[10px] tracking-[0.22em] text-white/65 uppercase truncate">{currentStream.streamer} · {currentStream.category}</div>
              </div>
              <div className="text-right">
                <div className="scoreboard-digits text-base md:text-2xl text-primary-400">{currentStream.viewers.toLocaleString()}</div>
                <div className="font-mono text-[9px] tracking-[0.22em] text-white/45 uppercase">VIEWERS · PEAK {currentStream.peakViewers.toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* Player controls strip */}
          <div className="px-3 py-2 flex items-center gap-3 border-t border-white/10 bg-black/40">
            {['▶','⏸','⏭','⏺','🔊'].map(g => (
              <button key={g} className="ctrl-key !min-w-[28px] !h-7">{g}</button>
            ))}
            <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full w-2/3 bg-primary-500" />
            </div>
            <span className="font-mono text-[10px] tracking-[0.2em] text-white/55">{currentStream.duration}</span>
          </div>
        </div>

        {/* Live chat */}
        <div className="metal-panel rounded-sm flex flex-col h-[420px] lg:h-[520px]">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <div className="font-display font-black tracking-[0.2em] text-white text-sm">LIVE CHAT</div>
            <span className="font-mono text-[10px] tracking-[0.22em] text-primary-400">{currentStream.chatRate}/min</span>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 font-mono text-xs">
            {SAMPLE_CHAT.map((c, i) => (
              <div key={i} className="leading-snug">
                <span className={`mr-2 font-display font-black tracking-[0.04em] ${c.color}`}>{c.user}</span>
                <span className="text-white/85">{c.msg}</span>
              </div>
            ))}
          </div>
          <form className="border-t border-white/10 p-3 flex items-center gap-2" onSubmit={e => e.preventDefault()}>
            <input
              placeholder="Send a chat..."
              className="flex-1 bg-black/40 border border-white/10 focus:border-primary-500/60 px-3 py-2 rounded-sm font-mono text-xs text-white outline-none"
            />
            <button className="px-3 py-2 rounded-sm bg-primary-600 hover:bg-primary-500 font-display font-black tracking-[0.18em] text-[10px] text-white">SEND</button>
          </form>
        </div>
      </div>

      {/* Up next */}
      <div className="mt-5 metal-panel rounded-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="font-display font-black tracking-[0.2em] text-white text-sm">NEXT IN ROTATION</div>
          <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-white/40">AUTO-PLAY</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {upNext.map((s, i) => (
            <div key={i} className="metal-panel rounded-sm p-3">
              <div className="scoreboard-digits text-primary-400 text-sm">{s.time}</div>
              <div className="font-display font-black tracking-[0.06em] text-white text-sm uppercase mt-1 truncate">{s.title}</div>
              <div className="font-mono text-[10px] tracking-[0.18em] text-white/50 uppercase truncate">{s.host} · {s.duration}</div>
            </div>
          ))}
        </div>
      </div>
    </PanelShell>
  )
}

const SAMPLE_CHAT = [
  { user: '@degen_42',     msg: 'GHOSTHAND COOKING 🔥',                color: 'text-primary-400' },
  { user: '@nano_alpha',   msg: 'that liq was cinematic',              color: 'text-[color:var(--color-live)]' },
  { user: '@pixel_warden', msg: 'who scripted this slot??',            color: 'text-[color:var(--color-gold)]' },
  { user: '@solana_sara',  msg: 'tape me in. Im next.',                color: 'text-primary-300' },
  { user: '@board_master', msg: 'squares board #14 closing soon',      color: 'text-white/70' },
  { user: '@quant_kai',    msg: 'check the funding rate. unreal.',     color: 'text-[color:var(--color-live)]' },
  { user: '@sol_reaper',   msg: '03:00 ET — be there or be square',    color: 'text-primary-400' },
  { user: '@meme_mayor',   msg: 'CSGN > all of TV',                    color: 'text-[color:var(--color-gold)]' },
  { user: '@chartlord',    msg: 'TA says we go higher',                color: 'text-white/70' },
  { user: '@gossip_g',     msg: 'breaking — alpha dynasty made a move',color: 'text-primary-300' },
]
