import { PanelShell } from '@/components/menu/PanelShell'
import { scheduleSlots } from '@/data/dummy'

const STATUS_STYLE: Record<string, string> = {
  LIVE:     'bg-[color:var(--color-live)] text-black',
  BOOKED:   'bg-primary-600/15 text-primary-300 border border-primary-600/40',
  OPEN:     'bg-[color:var(--color-gold)]/15 text-[color:var(--color-gold)] border border-[color:var(--color-gold)]/40',
}

export default function SlotSchedule() {
  return (
    <PanelShell
      eyebrow="GAME MODE 05"
      title="Slot Schedule"
      subtitle="The 24-hour broadcast clock. Booked, open, and live slots."
    >
      {/* Legend */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {['LIVE','BOOKED','OPEN'].map(s => (
          <span key={s} className={`font-mono text-[10px] tracking-[0.22em] uppercase px-2 py-1 rounded-sm ${STATUS_STYLE[s]}`}>{s}</span>
        ))}
        <span className="font-mono text-[10px] tracking-[0.22em] uppercase text-white/40">24 SLOTS · ALL TIMES ET</span>
      </div>

      {/* Game-clock grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {scheduleSlots.map((s) => {
          const status = STATUS_STYLE[s.status] ?? STATUS_STYLE.BOOKED
          const isLive = s.status === 'LIVE'
          return (
            <div
              key={s.time}
              className={`relative rounded-sm p-3 ${isLive ? 'metal-panel-hot' : 'metal-panel'} hover:border-primary-500/60 transition-all`}
            >
              {isLive && <div className="stadium-sweep" />}
              <div className="relative flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="scoreboard-digits text-lg text-primary-400">{s.time}</span>
                  <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-white/45">ET</span>
                </div>
                <span className={`font-mono text-[9px] tracking-[0.22em] uppercase px-1.5 py-0.5 rounded-sm ${status}`}>
                  {isLive && <span className="inline-block w-1.5 h-1.5 rounded-full bg-black mr-1 align-middle" />}
                  {s.status}
                </span>
              </div>
              <div className="relative font-display font-black tracking-[0.06em] text-white text-base uppercase mt-2 truncate">
                {s.title}
              </div>
              <div className="relative flex items-center justify-between gap-2 mt-1">
                <span className="font-mono text-[10px] tracking-[0.18em] text-white/55 uppercase truncate">{s.host}</span>
                <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-white/40">{s.tag}</span>
              </div>
            </div>
          )
        })}
      </div>
    </PanelShell>
  )
}
