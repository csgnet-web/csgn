import { PanelShell } from '@/components/menu/PanelShell'
import { treasuryStats } from '@/data/dummy'

export default function Treasury() {
  const max = Math.max(...treasuryStats.spark)
  const min = Math.min(...treasuryStats.spark)
  const range = Math.max(1, max - min)

  return (
    <PanelShell
      eyebrow="GAME MODE 08"
      title="Treasury Center"
      subtitle="Network tokenomics. Inflows, payouts, buyback, and dynasty fund."
    >
      {/* Hero */}
      <div className="metal-panel-hot rounded-sm p-6 relative overflow-hidden">
        <div className="stadium-sweep" />
        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div className="md:col-span-1">
            <div className="font-mono text-[10px] tracking-[0.3em] text-primary-300 uppercase">TREASURY · TOTAL</div>
            <div className="scoreboard-digits text-5xl md:text-6xl text-white mt-1">${treasuryStats.totalUSD.toLocaleString()}</div>
            <div className="flex items-center gap-3 mt-3">
              <span className="font-mono text-[11px] tracking-[0.22em] text-[color:var(--color-live)] uppercase">+{treasuryStats.delta7d}% 7D</span>
              <span className="font-mono text-[11px] tracking-[0.22em] text-[color:var(--color-live)] uppercase">+{treasuryStats.delta30d}% 30D</span>
            </div>
          </div>

          {/* Sparkline */}
          <div className="md:col-span-2">
            <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-white/55 mb-2">20-DAY TREND · NORMALIZED</div>
            <div className="h-28 flex items-end gap-1">
              {treasuryStats.spark.map((v, i) => {
                const h = ((v - min) / range) * 100
                return (
                  <div key={i} className="flex-1 flex items-end">
                    <div
                      className="w-full bg-gradient-to-t from-primary-700 to-primary-400 rounded-t-sm"
                      style={{ height: `${Math.max(8, h)}%` }}
                    />
                  </div>
                )
              })}
            </div>
            <div className="font-mono text-[10px] tracking-[0.2em] text-white/40 uppercase mt-1 flex justify-between">
              <span>D-20</span>
              <span>TODAY</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
        <Stat label="$CSGN PRICE"     value={'$' + treasuryStats.tokenPrice.toFixed(4)} hot />
        <Stat label="MARKET CAP"      value={'$' + (treasuryStats.marketCap / 1_000_000).toFixed(2) + 'M'} />
        <Stat label="CIRCULATING"     value={treasuryStats.circulatingPct + '%'} />
        <Stat label="BURNED"          value={treasuryStats.burnedM + 'M'} hot />
      </div>

      {/* Inflows / Payouts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
        <div className="metal-panel rounded-sm p-5">
          <div className="font-display font-black tracking-[0.2em] text-white text-sm mb-4">INFLOWS · 7D</div>
          <div className="space-y-3">
            {treasuryStats.inflows7d.map(i => (
              <div key={i.source}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-white/85">{i.source}</span>
                  <span className="scoreboard-digits text-sm text-[color:var(--color-live)]">${i.usd.toLocaleString()}</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary-700 to-primary-400" style={{ width: `${i.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="metal-panel rounded-sm p-5">
          <div className="font-display font-black tracking-[0.2em] text-white text-sm mb-4">PAYOUTS · 7D</div>
          <div className="space-y-2">
            {treasuryStats.payouts7d.map(p => (
              <div key={p.dest} className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0">
                <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-white/85">{p.dest}</span>
                <span className="scoreboard-digits text-sm text-primary-400">${p.usd.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-[0.25em] uppercase text-white/55">7D NET</span>
            <span className="scoreboard-digits text-lg text-[color:var(--color-live)]">
              +${(treasuryStats.inflows7d.reduce((s, x) => s + x.usd, 0) - treasuryStats.payouts7d.reduce((s, x) => s + x.usd, 0)).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </PanelShell>
  )
}

function Stat({ label, value, hot = false }: { label: string; value: string; hot?: boolean }) {
  return (
    <div className="metal-panel rounded-sm p-3">
      <div className="font-mono text-[9px] tracking-[0.25em] text-white/45 uppercase mb-1">{label}</div>
      <div className={`scoreboard-digits text-xl ${hot ? 'text-primary-400' : 'text-white/95'}`}>{value}</div>
    </div>
  )
}
