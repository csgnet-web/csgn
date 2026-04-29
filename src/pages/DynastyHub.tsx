import { PanelShell } from '@/components/menu/PanelShell'
import { dynastyHub } from '@/data/dummy'

export default function DynastyHub() {
  const { user, stats, recent, nextActions } = dynastyHub
  return (
    <PanelShell
      eyebrow="GAME MODE 03"
      title="Dynasty Hub"
      subtitle="Your stat sheet. Your slot history. Your dynasty."
    >
      {/* Player card */}
      <div className="metal-panel-hot rounded-sm p-5 flex flex-col md:flex-row gap-5 items-start md:items-center">
        <div className="w-16 h-16 md:w-20 md:h-20 rounded-sm metal-panel flex items-center justify-center font-display font-black text-3xl text-primary-400">
          {user.handle.charAt(1).toUpperCase()}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display font-black text-2xl md:text-3xl tracking-[0.04em] text-white uppercase">{user.handle}</span>
            <span className="px-1.5 py-0.5 rounded-sm bg-[color:var(--color-gold)]/15 text-[color:var(--color-gold)] border border-[color:var(--color-gold)]/40 font-mono text-[10px] tracking-[0.22em] uppercase">{user.tier} TIER</span>
          </div>
          <div className="font-mono text-[10px] tracking-[0.25em] text-white/50 uppercase mt-1">{user.tag} · {user.joined}</div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Mini label="EARNED" value={'$' + stats.earningsUSD.toLocaleString()} hot />
          <Mini label="STARS" value={stats.averageRating.toFixed(1)} />
          <Mini label="STREAMS" value={String(stats.streamsCompleted)} />
        </div>
      </div>

      {/* Stats grid */}
      <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="SLOTS BOOKED"      value={stats.slotsBooked} />
        <StatCard label="STREAMS DONE"      value={stats.streamsCompleted} />
        <StatCard label="AVG RATING"        value={stats.averageRating.toFixed(1) + ' ★'} />
        <StatCard label="EARNINGS"          value={'$' + stats.earningsUSD.toLocaleString()} hot />
        <StatCard label="ROOKIES SCOUTED"   value={stats.rookiesScouted} />
        <StatCard label="SQUARES WINS"      value={stats.squaresWins} />
        <StatCard label="STARTING 5 ENTRIES" value={stats.starting5Entries} />
        <StatCard label="DYNASTY TIER"      value={user.tier} hot />
      </div>

      {/* Recent + Actions */}
      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="metal-panel rounded-sm p-5">
          <div className="font-display font-black tracking-[0.2em] text-white text-sm mb-3">RECENT ACTIVITY</div>
          <div className="space-y-2">
            {recent.map((r, i) => (
              <div key={i} className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
                <span className={[
                  'font-mono text-[9px] tracking-[0.22em] uppercase px-1.5 py-0.5 rounded-sm border w-20 text-center shrink-0',
                  r.kind === 'WIN'     ? 'border-[color:var(--color-live)]/40 text-[color:var(--color-live)]' :
                  r.kind === 'BOOKED'  ? 'border-primary-600/50 text-primary-400' :
                  r.kind === 'TRADED'  ? 'border-[color:var(--color-gold)]/40 text-[color:var(--color-gold)]' :
                  r.kind === 'LEVELUP' ? 'border-white/30 text-white' :
                                          'border-white/15 text-white/50',
                ].join(' ')}>{r.kind}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white/90">{r.text}</div>
                  <div className="font-mono text-[10px] tracking-[0.22em] text-white/45 uppercase mt-0.5">{r.when}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="metal-panel rounded-sm p-5">
          <div className="font-display font-black tracking-[0.2em] text-white text-sm mb-3">NEXT ACTIONS</div>
          <div className="space-y-2">
            {nextActions.map((a, i) => (
              <button
                key={i}
                className="w-full text-left metal-panel hover:border-primary-500/60 transition-all rounded-sm p-3 flex items-center justify-between gap-3 group"
              >
                <div className="min-w-0">
                  <div className="font-display font-black tracking-[0.06em] text-white text-sm uppercase truncate">{a.label}</div>
                  <div className="font-mono text-[10px] tracking-[0.18em] text-white/50 uppercase truncate">{a.detail}</div>
                </div>
                <span className="font-mono text-primary-400 group-hover:translate-x-1 transition-transform">▸</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </PanelShell>
  )
}

function Mini({ label, value, hot = false }: { label: string; value: string; hot?: boolean }) {
  return (
    <div>
      <div className="font-mono text-[9px] tracking-[0.25em] text-white/50 uppercase">{label}</div>
      <div className={`scoreboard-digits text-lg ${hot ? 'text-primary-400' : 'text-white/95'}`}>{value}</div>
    </div>
  )
}

function StatCard({ label, value, hot = false }: { label: string; value: string | number; hot?: boolean }) {
  return (
    <div className="metal-panel rounded-sm p-3">
      <div className="font-mono text-[9px] tracking-[0.25em] text-white/45 uppercase mb-1">{label}</div>
      <div className={`scoreboard-digits text-xl ${hot ? 'text-primary-400' : 'text-white/95'}`}>{value}</div>
    </div>
  )
}
