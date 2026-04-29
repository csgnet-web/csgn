import { useState } from 'react'
import { PanelShell } from '@/components/menu/PanelShell'
import { adminBroadcast } from '@/data/dummy'

const REGION_STYLE: Record<string, string> = {
  NOMINAL: 'border-[color:var(--color-live)]/40 text-[color:var(--color-live)]',
  WATCH:   'border-[color:var(--color-gold)]/40 text-[color:var(--color-gold)]',
  ALERT:   'border-primary-500/60 text-primary-300',
}

export default function Commissioner() {
  const [killArmed, setKillArmed] = useState(adminBroadcast.killSwitch === 'ARMED')
  const [feedLive, setFeedLive] = useState(true)

  return (
    <PanelShell
      eyebrow="GAME MODE 09"
      title="Commissioner Mode"
      subtitle="Broadcast operations. Approvals. Kill-switch. The booth."
      badge={adminBroadcast.status}
    >
      {/* Top status row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat label="STATUS"      value={adminBroadcast.status} hot />
        <Stat label="UPTIME"      value={adminBroadcast.uptimePct + '%'} />
        <Stat label="RTMP HEALTH" value={adminBroadcast.rtmpHealth} />
        <Stat label="LIVE SLOT"   value={adminBroadcast.liveSlot.split(' — ')[0]} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Big switch board */}
        <div className="lg:col-span-2 metal-panel rounded-sm p-5">
          <div className="font-display font-black tracking-[0.2em] text-white text-sm mb-4">BROADCAST CONTROLS</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Switch
              label="LIVE FEED"
              status={feedLive ? 'ON AIR' : 'OFF AIR'}
              on={feedLive}
              onToggle={() => setFeedLive(v => !v)}
            />
            <Switch
              label="KILL SWITCH"
              status={killArmed ? 'ARMED' : 'DISARMED'}
              on={killArmed}
              danger
              onToggle={() => setKillArmed(v => !v)}
            />
            <Switch label="REPLAY ENGINE"  status="RUNNING" on />
            <Switch label="AUTO-MODERATE"  status="AGGRESSIVE" on />
            <Switch label="ALT-FEED (B)"   status="STANDBY" on={false} />
            <Switch label="EMERGENCY SLATE" status="READY" on={false} />
          </div>
          <div className="mt-5 pt-4 border-t border-white/10">
            <div className="font-display font-black tracking-[0.2em] text-white text-sm mb-3">INGEST REGIONS</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {adminBroadcast.ingestRegions.map(r => (
                <div key={r.region} className="metal-panel rounded-sm p-3">
                  <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-white/55">{r.region}</div>
                  <div className="scoreboard-digits text-lg text-white">{r.latencyMs}ms</div>
                  <span className={`mt-1 inline-block font-mono text-[9px] tracking-[0.22em] uppercase px-1.5 py-0.5 rounded-sm border ${REGION_STYLE[r.status]}`}>{r.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pending approvals + logs */}
        <div className="space-y-4">
          <div className="metal-panel rounded-sm p-5">
            <div className="font-display font-black tracking-[0.2em] text-white text-sm mb-3">PENDING APPROVALS</div>
            <div className="space-y-2">
              {adminBroadcast.pendingApprovals.map((a, i) => (
                <div key={i} className="metal-panel rounded-sm p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-primary-400">{a.kind}</span>
                    <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-white/45">{a.when}</span>
                  </div>
                  <div className="font-display font-black tracking-[0.04em] text-white text-sm uppercase mt-1">{a.who}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <button className="px-2.5 py-1 rounded-sm bg-[color:var(--color-live)]/15 text-[color:var(--color-live)] border border-[color:var(--color-live)]/40 font-display font-black tracking-[0.18em] text-[10px]">APPROVE</button>
                    <button className="px-2.5 py-1 rounded-sm bg-primary-600/15 text-primary-300 border border-primary-600/50 font-display font-black tracking-[0.18em] text-[10px]">DENY</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="metal-panel rounded-sm p-5">
            <div className="font-display font-black tracking-[0.2em] text-white text-sm mb-3">RECENT ACTIONS</div>
            <div className="space-y-2 font-mono text-xs">
              {adminBroadcast.recentActions.map((a, i) => (
                <div key={i} className="flex items-start gap-2 border-b border-white/5 pb-2 last:border-0">
                  <span className="text-primary-400 shrink-0">[{a.who}]</span>
                  <span className="flex-1 text-white/80">{a.text}</span>
                  <span className="text-white/40 text-[10px] shrink-0">{a.when}</span>
                </div>
              ))}
            </div>
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
      <div className={`scoreboard-digits text-xl ${hot ? 'text-[color:var(--color-live)]' : 'text-white/95'}`}>{value}</div>
    </div>
  )
}

function Switch({
  label,
  status,
  on,
  onToggle,
  danger = false,
}: {
  label: string
  status: string
  on: boolean
  onToggle?: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onToggle}
      className={[
        'relative rounded-sm p-4 text-left transition-all',
        on
          ? danger
            ? 'metal-panel-hot'
            : 'metal-panel border-[color:var(--color-live)]/40 hover:border-[color:var(--color-live)]'
          : 'metal-panel hover:border-primary-500/60',
      ].join(' ')}
      style={{ borderWidth: 1 }}
    >
      <div className="flex items-center justify-between">
        <span className="font-display font-black tracking-[0.18em] text-white text-xs uppercase">{label}</span>
        <span
          className={[
            'inline-block w-10 h-5 rounded-full relative transition-all',
            on ? (danger ? 'bg-primary-500' : 'bg-[color:var(--color-live)]') : 'bg-white/15',
          ].join(' ')}
        >
          <span
            className={[
              'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all',
              on ? 'left-5' : 'left-0.5',
            ].join(' ')}
          />
        </span>
      </div>
      <div className={[
        'font-mono text-[10px] tracking-[0.25em] uppercase mt-1',
        on ? (danger ? 'text-primary-300' : 'text-[color:var(--color-live)]') : 'text-white/55',
      ].join(' ')}>{status}</div>
    </button>
  )
}
