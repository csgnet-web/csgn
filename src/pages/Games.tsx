import { useState } from 'react'
import { PanelShell } from '@/components/menu/PanelShell'
import { starting5, csgnSquares } from '@/data/dummy'

type Tab = 'starting5' | 'squares'

export default function Games() {
  const [tab, setTab] = useState<Tab>('starting5')

  return (
    <PanelShell
      eyebrow="GAME MODE 06"
      title="Starting 5 / CSGN Squares"
      subtitle="Pickem your network MVPs. Buy your squares. Win the prize pool."
      badge="NEW"
    >
      {/* Tab switch */}
      <div className="flex items-center gap-2 mb-5">
        <TabButton active={tab === 'starting5'} onClick={() => setTab('starting5')} number="01" label="STARTING 5" />
        <TabButton active={tab === 'squares'}   onClick={() => setTab('squares')}   number="02" label="CSGN SQUARES" />
      </div>

      {tab === 'starting5' ? <Starting5View /> : <SquaresView />}
    </PanelShell>
  )
}

function TabButton({ active, onClick, number, label }: { active: boolean; onClick: () => void; number: string; label: string }) {
  return (
    <button
      onClick={onClick}
      className={[
        'group flex items-center gap-2 px-4 py-2 rounded-sm transition-all',
        active ? 'metal-panel-hot' : 'metal-panel hover:border-primary-500/60',
      ].join(' ')}
    >
      <span className="scoreboard-digits text-[10px] text-primary-400">{number}</span>
      <span className="font-display font-black tracking-[0.18em] text-xs text-white">{label}</span>
    </button>
  )
}

function Starting5View() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 metal-panel rounded-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-mono text-[10px] tracking-[0.3em] text-primary-400 uppercase">PICKEM ROSTER</div>
            <div className="font-display font-black text-2xl text-white tracking-[0.04em] uppercase">Build Your Starting 5</div>
          </div>
          <span className="font-mono text-[10px] tracking-[0.25em] text-white/55 uppercase">DRAFT MODE</span>
        </div>
        <div className="space-y-2">
          {starting5.picks.map(p => (
            <div key={p.slot} className="metal-panel rounded-sm p-3 flex items-center gap-4 hover:border-primary-500/60 transition-all">
              <div className="w-10 h-10 rounded-sm bg-black/40 border border-primary-700/40 flex items-center justify-center font-display font-black text-primary-400">{p.slot}</div>
              <div className="flex-1 min-w-0">
                <div className="font-display font-black tracking-[0.06em] text-white text-base uppercase truncate">{p.name}</div>
                <div className="font-mono text-[10px] tracking-[0.22em] text-white/45 uppercase truncate">{p.tag}</div>
              </div>
              <div className="text-right">
                <div className="scoreboard-digits text-lg text-[color:var(--color-gold)]">{p.odds}</div>
                <div className="font-mono text-[9px] tracking-[0.22em] text-white/45 uppercase">ODDS</div>
              </div>
              <button className="px-3 py-1.5 rounded-sm border border-primary-600/50 hover:bg-primary-600/20 transition-colors font-display font-black tracking-[0.18em] text-[10px] text-primary-300">
                LOCK
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="metal-panel-hot rounded-sm p-5 text-center">
          <div className="font-mono text-[10px] tracking-[0.3em] text-white/65 uppercase">PRIZE POOL</div>
          <div className="scoreboard-digits text-4xl text-white mt-1">${starting5.prizePool.toLocaleString()}</div>
          <div className="font-mono text-[10px] tracking-[0.25em] text-primary-300 uppercase mt-2">DRAFT CLOSES IN {starting5.closesIn}</div>
        </div>
        <div className="metal-panel rounded-sm p-5 space-y-3">
          <Row label="ENTRANTS"   value={starting5.entrants.toLocaleString()} />
          <Row label="MY ENTRIES" value={String(starting5.myEntries)} />
          <Row label="BUY-IN"     value="$50 / SLATE" />
          <Row label="PAYOUT"     value="TOP 100" />
        </div>
        <button className="w-full px-4 py-3 rounded-sm bg-primary-600 hover:bg-primary-500 transition-colors font-display font-black tracking-[0.22em] text-xs text-white">
          ▶ ENTER STARTING 5
        </button>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0 last:pb-0">
      <span className="font-mono text-[10px] tracking-[0.22em] text-white/55 uppercase">{label}</span>
      <span className="scoreboard-digits text-base text-white/95">{value}</span>
    </div>
  )
}

function SquaresView() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      <div className="lg:col-span-3 metal-panel rounded-sm p-5 overflow-x-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="font-display font-black tracking-[0.2em] text-white text-sm">SQUARES BOARD #14</div>
          <div className="font-mono text-[10px] tracking-[0.25em] text-primary-400 uppercase">{csgnSquares.filled}/{csgnSquares.total} FILLED</div>
        </div>
        <div className="inline-block min-w-full">
          {/* Header: cols */}
          <div className="grid grid-cols-[60px_repeat(10,minmax(54px,1fr))] gap-px bg-primary-700/30 p-px rounded-sm">
            <div className="bg-black/70 px-2 py-1.5 font-mono text-[10px] tracking-[0.2em] uppercase text-white/40 text-center">×</div>
            {csgnSquares.cols.map(c => (
              <div key={c} className="bg-black/70 px-2 py-1.5 font-display font-black text-[10px] tracking-[0.18em] uppercase text-primary-300 text-center">{c}</div>
            ))}
            {csgnSquares.rows.map((row, r) => (
              <Row10 key={row} label={row} r={r} />
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="metal-panel-hot rounded-sm p-5 text-center">
          <div className="font-mono text-[10px] tracking-[0.3em] text-white/65 uppercase">POT</div>
          <div className="scoreboard-digits text-4xl text-white mt-1">${csgnSquares.pot.toLocaleString()}</div>
          <div className="font-mono text-[10px] tracking-[0.25em] text-primary-300 uppercase mt-2">CLOSES IN {csgnSquares.closesIn}</div>
        </div>
        <div className="metal-panel rounded-sm p-5 space-y-3">
          <Row label="BUY-IN"  value={'$' + csgnSquares.buyIn} />
          <Row label="FILLED"  value={`${csgnSquares.filled}/${csgnSquares.total}`} />
          <Row label="PAYOUT"  value="QUARTERS" />
          <Row label="SCOPE"   value="24H CLOSE" />
        </div>
        <button className="w-full px-4 py-3 rounded-sm bg-primary-600 hover:bg-primary-500 transition-colors font-display font-black tracking-[0.22em] text-xs text-white">
          ▶ BUY SQUARE
        </button>
      </div>
    </div>
  )
}

function Row10({ label, r }: { label: string; r: number }) {
  return (
    <>
      <div className="bg-black/70 px-2 py-1.5 font-display font-black text-[10px] tracking-[0.18em] uppercase text-primary-300 text-center">{label}</div>
      {Array.from({ length: 10 }).map((_, c) => {
        const cell = csgnSquares.cells.find(x => x.r === r && x.c === c)
        const filled = cell?.filled
        return (
          <button
            key={c}
            className={[
              'square-cell relative px-1 py-1.5 text-[9px] font-mono tracking-[0.1em] uppercase text-white/80 min-h-[34px]',
              filled ? 'bg-primary-600/25 text-primary-200' : 'bg-black/60 hover:bg-primary-600/20',
            ].join(' ')}
            title={filled ? cell?.owner ?? '' : 'OPEN'}
          >
            {filled ? cell?.owner?.replace('@', '') : '·'}
          </button>
        )
      })}
    </>
  )
}
