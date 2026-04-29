import { useState } from 'react'
import { PanelShell } from '@/components/menu/PanelShell'
import { rookies } from '@/data/dummy'

const STATUS_STYLE: Record<string, string> = {
  COMBINE:  'border-white/20 text-white/75',
  CALLBACK: 'border-[color:var(--color-gold)]/40 text-[color:var(--color-gold)]',
  SIGNED:   'border-[color:var(--color-live)]/40 text-[color:var(--color-live)]',
}

export default function RookieWatch() {
  const [filter, setFilter] = useState<'ALL' | 'COMBINE' | 'CALLBACK' | 'SIGNED'>('ALL')
  const list = rookies.filter(r => filter === 'ALL' || r.status === filter)

  return (
    <PanelShell
      eyebrow="GAME MODE 07"
      title="Rookie Watch"
      subtitle="The creator combine. Scout, draft, and sign the next generation of CSGN talent."
    >
      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {(['ALL','COMBINE','CALLBACK','SIGNED'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={[
              'px-3 py-1.5 rounded-sm font-display font-black tracking-[0.18em] text-[10px]',
              filter === f ? 'metal-panel-hot text-white' : 'metal-panel text-white/65 hover:text-white',
            ].join(' ')}
          >
            {f}
          </button>
        ))}
        <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-white/40 ml-auto">
          {list.length} OF {rookies.length} ROOKIES
        </span>
      </div>

      {/* Featured card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <div className="lg:col-span-2 metal-panel-hot rounded-sm p-5 relative overflow-hidden">
          <div className="stadium-sweep" />
          <div className="relative flex items-start gap-5">
            <div className="w-20 h-20 rounded-sm metal-panel flex items-center justify-center font-display font-black text-3xl text-primary-400 shrink-0">
              {list[0]?.handle.charAt(1).toUpperCase() ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-mono text-[10px] tracking-[0.3em] text-primary-300 uppercase">ROOKIE OF THE WEEK</div>
              <div className="font-display font-black text-3xl tracking-[0.04em] text-white uppercase">{list[0]?.name}</div>
              <div className="font-mono text-[11px] tracking-[0.25em] text-white/55 uppercase mt-1">{list[0]?.handle} · {list[0]?.tag}</div>
              <div className="flex items-center gap-3 mt-3">
                <Stars value={list[0]?.stars ?? 0} />
                <span className="font-mono text-[10px] tracking-[0.22em] text-white/55 uppercase">{(list[0]?.follower ?? 0).toLocaleString()} FOLLOWERS</span>
              </div>
            </div>
          </div>
          <div className="relative flex items-center gap-2 mt-5 pt-4 border-t border-white/10">
            <button className="px-4 py-2 rounded-sm bg-primary-600 hover:bg-primary-500 transition-colors font-display font-black tracking-[0.2em] text-[10px] text-white">▶ SCOUT TAPE</button>
            <button className="px-4 py-2 rounded-sm border border-white/20 hover:border-white/50 transition-colors font-display font-black tracking-[0.2em] text-[10px] text-white/85">SEND CALLBACK</button>
            <button className="px-4 py-2 rounded-sm border border-[color:var(--color-gold)]/40 hover:border-[color:var(--color-gold)] transition-colors font-display font-black tracking-[0.2em] text-[10px] text-[color:var(--color-gold)]">DRAFT</button>
          </div>
        </div>

        <div className="metal-panel rounded-sm p-5 space-y-3">
          <Stat label="ROOKIES IN COMBINE" value={String(rookies.filter(r => r.status === 'COMBINE').length)} />
          <Stat label="CALLBACKS"          value={String(rookies.filter(r => r.status === 'CALLBACK').length)} />
          <Stat label="SIGNED THIS WEEK"   value={String(rookies.filter(r => r.status === 'SIGNED').length)} hot />
          <Stat label="AVG STAR RATING"    value={(rookies.reduce((s, r) => s + r.stars, 0) / rookies.length).toFixed(2) + ' ★'} />
        </div>
      </div>

      {/* Rookies grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {list.map(r => (
          <div key={r.handle} className="metal-panel rounded-sm p-4 hover:border-primary-500/60 transition-all">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-sm metal-panel flex items-center justify-center font-display font-black text-primary-400">
                  {r.handle.charAt(1).toUpperCase()}
                </div>
                <div>
                  <div className="font-display font-black tracking-[0.04em] text-white text-sm uppercase">{r.name}</div>
                  <div className="font-mono text-[10px] tracking-[0.22em] text-white/45 uppercase">{r.handle}</div>
                </div>
              </div>
              <span className={`font-mono text-[9px] tracking-[0.22em] uppercase px-1.5 py-0.5 rounded-sm border ${STATUS_STYLE[r.status]}`}>
                {r.status}
              </span>
            </div>
            <div className="flex items-center justify-between mt-3">
              <Stars value={r.stars} />
              <span className="font-mono text-[10px] tracking-[0.22em] text-white/55">{r.follower.toLocaleString()}</span>
            </div>
            <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
              <span className="font-mono text-[10px] tracking-[0.22em] text-white/50 uppercase">{r.tag}</span>
              <span className="font-mono text-[10px] tracking-[0.22em] text-primary-400 uppercase">SCOUT ▸</span>
            </div>
          </div>
        ))}
      </div>
    </PanelShell>
  )
}

function Stars({ value }: { value: number }) {
  const filled = Math.round(value)
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={i <= filled ? 'text-[color:var(--color-gold)]' : 'text-white/20'}>★</span>
      ))}
      <span className="ml-1 font-mono text-[10px] tracking-[0.18em] text-white/55">{value.toFixed(1)}</span>
    </div>
  )
}

function Stat({ label, value, hot = false }: { label: string; value: string; hot?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 pb-3 last:border-0 last:pb-0">
      <span className="font-mono text-[10px] tracking-[0.22em] text-white/55 uppercase">{label}</span>
      <span className={`scoreboard-digits text-lg ${hot ? 'text-primary-400' : 'text-white/95'}`}>{value}</span>
    </div>
  )
}
