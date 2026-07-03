import { useEffect, useState } from 'react'
import { useLiveSlot } from '@/contexts/useLiveSlot'
import { formatESTRange, CSGN_MINT, type Slot } from '@/lib/slots'
import { X_HANDLE } from '@/lib/social'

const PANEL_INTERVAL_MS = 12_000

const TAGLINES = [
  "Crypto's Entertainment Flagship",
  'The ESPN and TMZ of Crypto',
  '24/7. On-chain. Live on X.',
  'Streamers earn creator fees — live, on screen',
] as const

function toMillis(value: unknown): number {
  if (typeof value === 'string' || value instanceof Date || typeof value === 'number') {
    const ms = new Date(value as string | Date | number).getTime()
    return Number.isFinite(ms) ? ms : 0
  }
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: unknown }).toDate === 'function') {
    const ms = (value as { toDate: () => Date }).toDate().getTime()
    return Number.isFinite(ms) ? ms : 0
  }
  return 0
}

function formatPrice(price: number): string {
  if (price <= 0) return '—'
  if (price >= 1) return `$${price.toFixed(2)}`
  if (price >= 0.01) return `$${price.toFixed(4)}`
  return `$${Number(price.toPrecision(3)).toFixed(Math.max(0, -Math.floor(Math.log10(price)) + 2))}`
}

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 })

function UpNextPanel({ slots }: { slots: Slot[] }) {
  return (
    <div className="flex flex-col items-center gap-8">
      <p className="text-2xl font-black tracking-[0.4em] uppercase text-gray-400">Up Next</p>
      <div className="flex flex-col gap-5">
        {slots.length > 0 ? (
          slots.map((s) => (
            <div key={s.id} className="flex items-baseline justify-center gap-6">
              <span className="text-4xl font-black font-display text-white">
                {s.assignedName || (s.type === 'auction' ? 'Open Slot' : 'CEO Schedule')}
              </span>
              <span className="text-2xl font-mono text-primary-300">{formatESTRange(s)}</span>
            </div>
          ))
        ) : (
          <p className="text-3xl font-display font-bold text-white">Fresh schedule drops daily</p>
        )}
      </div>
      <p className="text-xl text-gray-500">
        Claim a slot at <span className="text-white font-bold">csgn.fun</span> — go live, earn creator fees
      </p>
    </div>
  )
}

function TokenPanelBoard() {
  const { tokenStats } = useLiveSlot()
  const change = tokenStats?.priceChangeH24Pct ?? 0
  const positive = change >= 0
  return (
    <div className="flex flex-col items-center gap-8">
      <p className="text-2xl font-black tracking-[0.4em] uppercase text-gray-400">$CSGN</p>
      <div className="flex items-baseline gap-6">
        <span className="text-7xl font-black font-mono text-white">
          {tokenStats ? formatPrice(tokenStats.priceUsd) : '—'}
        </span>
        {tokenStats && (
          <span className={`text-3xl font-bold font-mono ${positive ? 'text-positive' : 'text-negative'}`}>
            {positive ? '+' : ''}{change.toFixed(2)}%
          </span>
        )}
      </div>
      <div className="flex gap-14 text-center">
        <div>
          <p className="text-lg uppercase tracking-[0.25em] text-gray-500">Market Cap</p>
          <p className="text-3xl font-black font-mono text-white mt-1">
            {tokenStats?.marketCapUsd ? `$${compact.format(tokenStats.marketCapUsd)}` : '—'}
          </p>
        </div>
        <div>
          <p className="text-lg uppercase tracking-[0.25em] text-gray-500">24h Volume</p>
          <p className="text-3xl font-black font-mono text-white mt-1">
            {tokenStats?.volumeH24Usd ? `$${compact.format(tokenStats.volumeH24Usd)}` : '—'}
          </p>
        </div>
      </div>
    </div>
  )
}

function FollowPanel() {
  return (
    <div className="flex flex-col items-center gap-8">
      <p className="text-2xl font-black tracking-[0.4em] uppercase text-gray-400">Join the Network</p>
      <p className="text-6xl font-black font-display text-white">@{X_HANDLE}</p>
      <p className="text-xl text-gray-400">Chat lives in the broadcast post replies on X</p>
      <div className="px-8 py-4 rounded-2xl bg-white/[0.04] border border-white/[0.1]">
        <p className="text-sm uppercase tracking-[0.3em] text-gray-500 mb-2 text-center">$CSGN Contract</p>
        <p className="text-2xl font-mono text-primary-300">{CSGN_MINT}</p>
      </div>
    </div>
  )
}

function TaglinePanel({ index }: { index: number }) {
  return (
    <div className="flex flex-col items-center gap-6">
      <p className="text-6xl font-black font-display text-center leading-tight max-w-[1100px] text-gradient">
        {TAGLINES[index % TAGLINES.length]}
      </p>
      <p className="text-2xl text-gray-400 font-mono">csgn.fun</p>
    </div>
  )
}

/**
 * The network intermission board — fully code-driven 1080p programming shown
 * whenever no streamer is live. Cycles branded panels: up-next schedule,
 * live token stats, follow card, taglines. `dimmed` renders it as the
 * backdrop behind BRB / starting-soon status cards.
 */
export default function IntermissionBoard({ dimmed = false }: { dimmed?: boolean }) {
  const { allSlots, nowMs } = useLiveSlot()
  const [panel, setPanel] = useState(0)

  useEffect(() => {
    if (dimmed) return
    const t = setInterval(() => setPanel((p) => p + 1), PANEL_INTERVAL_MS)
    return () => clearInterval(t)
  }, [dimmed])

  const upcoming = allSlots.filter((s) => toMillis(s.startTime) > nowMs).slice(0, 3)

  const panels = [
    <UpNextPanel key="next" slots={upcoming} />,
    <TokenPanelBoard key="token" />,
    <FollowPanel key="follow" />,
    <TaglinePanel key="tag" index={Math.floor(panel / 4)} />,
  ]

  return (
    <div className={`absolute inset-0 csgn-bg overflow-hidden ${dimmed ? 'opacity-30' : ''}`}>
      <div className="absolute inset-0 bg-grid" />
      {/* Drifting ambient glow */}
      <div className="absolute -top-40 left-1/4 w-[700px] h-[700px] rounded-full bg-primary-500/10 blur-[140px] animate-float" />
      <div className="absolute -bottom-52 right-1/5 w-[600px] h-[600px] rounded-full bg-[#5000ff]/10 blur-[140px] animate-float" style={{ animationDelay: '2s' }} />

      {/* Wordmark, top-left */}
      <div className="absolute top-12 left-14 flex items-center gap-4">
        <svg viewBox="0 0 120 40" className="h-14 w-auto fill-white" xmlns="http://www.w3.org/2000/svg">
          <text x="0" y="32" fontFamily="system-ui, sans-serif" fontWeight="900" fontSize="38" letterSpacing="2">CSGN</text>
        </svg>
        <span className="px-3 py-1 rounded-full border border-white/20 text-xs font-bold tracking-[0.3em] uppercase text-gray-400">
          24/7 Network
        </span>
      </div>

      {/* Live dot, top-right */}
      <div className="absolute top-14 right-14 flex items-center gap-2.5">
        <span className="w-2.5 h-2.5 rounded-full bg-primary-500 animate-live-pulse" />
        <span className="text-sm font-bold tracking-[0.3em] uppercase text-gray-400">Intermission</span>
      </div>

      {/* Center panel carousel */}
      {!dimmed && (
        <div key={panel} className="absolute inset-0 flex items-center justify-center" style={{ animation: 'board-fade 12s ease-in-out both' }}>
          {panels[panel % panels.length]}
        </div>
      )}

      {/* Bottom ticker strip */}
      <div className="absolute bottom-0 inset-x-0 h-16 bg-black/50 border-t border-white/[0.08] flex items-center px-14 justify-between">
        <span className="text-sm font-mono tracking-[0.2em] uppercase text-gray-500">
          csgn.fun · live on X · @{X_HANDLE}
        </span>
        <span className="text-sm font-mono text-gray-600">{CSGN_MINT}</span>
      </div>
    </div>
  )
}
