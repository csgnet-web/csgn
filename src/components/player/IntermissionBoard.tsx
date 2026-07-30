import { useEffect, useState } from 'react'
import { useLiveSlot } from '@/contexts/useLiveSlot'
import { formatESTRange, isNetworkSlot, isSlotClaimable, slotIdentity, CSGN_MINT, type Slot } from '@/lib/slots'
import { X_HANDLE } from '@/lib/social'
import { CsgnLogo } from '@/components/ui/CsgnLogo'

const PANEL_INTERVAL_MS = 12_000

const TAGLINES = [
  "Crypto's Entertainment Flagship",
  'The ESPN and TMZ of Crypto',
  '24/7. On-chain. Live on X.',
  'Streamers earn creator fees — live, on screen',
  'This stage could be yours — claim it at csgn.fun',
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

function UpNextPanel({ slots, networkBlockEnabled }: { slots: Slot[]; networkBlockEnabled: boolean }) {
  return (
    <div className="flex flex-col items-center gap-8">
      <p className="text-2xl font-black tracking-[0.4em] uppercase text-gray-400">Tonight on CSGN</p>
      <div className="flex flex-col gap-5">
        {slots.length > 0 ? (
          slots.map((s) => (
            <div key={s.id} className="flex items-baseline justify-center gap-6">
              <span className="text-4xl font-black font-display text-white">
                {slotIdentity(s, { networkBlockEnabled }).name}
              </span>
              <span className="text-2xl font-mono text-primary-300">{formatESTRange(s)}</span>
            </div>
          ))
        ) : (
          <p className="text-3xl font-display font-bold text-white">New slots open every day</p>
        )}
      </div>
      <p className="text-xl text-gray-500">
        Open slots are up for grabs at <span className="text-white font-bold">csgn.fun</span> — take one, go live, earn creator fees
      </p>
    </div>
  )
}

/**
 * The headline act: the stage is empty RIGHT NOW and anyone can claim it.
 * Broadcast-billboard styling — marching gradient border, breathing glow,
 * radar rings and a sheen sweep on the "TAKE THIS SLOT" pill — plus the three
 * steps a viewer follows on their phone (Phantom browser → Twitch → go live).
 * Renders on the OBS output, so the CTA is a billboard, not a button.
 */
function OpenStagePanel({ slot, isCurrent = false }: { slot: Slot | null; isCurrent?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-10">
      <div className="flex flex-col items-center gap-3">
        <p className="text-2xl font-black tracking-[0.4em] uppercase text-primary-400">The Stage Is Open</p>
        <p className="text-6xl font-black font-display text-white text-center leading-tight">
          Go live on CSGN — right now
        </p>
      </div>

      {/* Featured claimable slot — gradient-sweep frame around a glowing card */}
      <div className="stage-border-sweep rounded-3xl p-[2px]">
        <div className="stage-card-breathe rounded-3xl bg-[#0a0a14] px-14 py-9 flex items-center gap-12">
          <div className="text-left">
            <p className="text-sm uppercase tracking-[0.3em] text-gray-500 mb-2">{slot ? (isCurrent ? 'On Air Now' : 'Open Slot') : 'Next Open Slot'}</p>
            <p className="text-4xl font-black font-mono text-white">{slot ? formatESTRange(slot) : 'Announced daily'}</p>
            <p className="text-lg text-gray-400 mt-2">Streamed to X on <span className="text-white font-bold">@{X_HANDLE}</span> · you keep creator fees</p>
          </div>
          <div className="relative shrink-0">
            <span className="stage-ring" />
            <span className="stage-ring" style={{ animationDelay: '1.3s' }} />
            <span className="stage-cta-shine relative overflow-hidden inline-flex items-center gap-3 px-10 py-5 rounded-full bg-primary-500 text-white text-2xl font-black uppercase tracking-widest">
              <span className="w-3 h-3 rounded-full bg-white animate-live-pulse" />
              Take This Slot
            </span>
          </div>
        </div>
      </div>

      {/* The three steps, exactly as a viewer does them on their phone */}
      <div className="flex items-stretch gap-6">
        {[
          ['1', 'Open csgn.fun in your Phantom wallet browser'],
          ['2', 'Create your account & connect Twitch'],
          ['3', 'Take the slot — you’re live on the network'],
        ].map(([n, text]) => (
          <div key={n} className="flex items-center gap-4 px-7 py-4 rounded-2xl bg-white/[0.04] border border-white/[0.1] max-w-[360px]">
            <span className="shrink-0 w-10 h-10 rounded-full bg-primary-500/20 border border-primary-500/50 flex items-center justify-center text-xl font-black text-primary-300">{n}</span>
            <span className="text-lg text-gray-300 text-left leading-snug">{text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Shown on /player when the hour ON AIR is a reserved CSGN Originals (network)
 * hour. It presents the block as programmed television, NOT a claimable stage —
 * so a network hour never renders the "Take This Slot" billboard even while it's
 * confirmed/live. Open hours are still advertised for claiming in the up-next
 * panel and the ticker strip below.
 */
function NetworkNowPanel({ slot }: { slot: Slot | null }) {
  const showName = slot ? slotIdentity(slot).name : 'CSGN Originals'
  return (
    <div className="flex flex-col items-center gap-10">
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-gold animate-live-pulse" />
          <p className="text-2xl font-black tracking-[0.4em] uppercase text-gold">CSGN Originals</p>
        </div>
        <p className="text-7xl font-black font-display text-white text-center leading-tight">{showName}</p>
        {slot && <p className="text-3xl font-mono text-primary-300">{formatESTRange(slot)}</p>}
      </div>

      <div className="stage-border-sweep rounded-3xl p-[2px]">
        <div className="rounded-3xl bg-[#0a0a14] px-14 py-8 text-center max-w-[820px]">
          <p className="text-xl text-gray-300">Network programming — streamed to X on <span className="text-white font-bold">@{X_HANDLE}</span></p>
          <p className="text-lg text-gray-500 mt-3">The CSGN Originals block runs 7 PM–3 AM ET. The open hours are yours to claim at <span className="text-white font-bold">csgn.fun</span></p>
        </div>
      </div>
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
  const { allSlots, currentSlot, nowMs, networkBlockEnabled } = useLiveSlot()
  const [panel, setPanel] = useState(0)

  useEffect(() => {
    if (dimmed) return
    const t = setInterval(() => setPanel((p) => p + 1), PANEL_INTERVAL_MS)
    return () => clearInterval(t)
  }, [dimmed])

  const upcoming = allSlots.filter((s) => toMillis(s.startTime) > nowMs).slice(0, 3)

  // Is the hour on the air a reserved CSGN Originals (network) hour? If so the
  // featured panel is the network billboard, never the "take this slot" one.
  const currentIsNetwork = !!currentSlot && isNetworkSlot(currentSlot) && networkBlockEnabled

  // The open-stage billboard only ever features a GENUINELY claimable hour: the
  // one on the air if it's open (a streamer ended mid-slot → the stage is empty
  // and takeable this second), else the next open slot. A reserved network hour
  // is never advertised as claimable — the same isSlotClaimable rule /watch and
  // /schedule use, so the three surfaces agree.
  const currentClaimable = currentSlot && isSlotClaimable(currentSlot, networkBlockEnabled) ? currentSlot : null
  const claimable =
    currentClaimable
      ?? allSlots.find((s) => toMillis(s.startTime) > nowMs && isSlotClaimable(s, networkBlockEnabled))
      ?? null
  const claimableIsCurrent = claimable != null && claimable === currentSlot

  // The featured panel alternates with the info panels. During a network hour it
  // sells CSGN Originals; otherwise it sells the open stage. Either way the claim
  // message for the OPEN hours still reaches viewers via up-next and the ticker.
  const featured = (key: string) =>
    currentIsNetwork
      ? <NetworkNowPanel key={key} slot={currentSlot} />
      : <OpenStagePanel key={key} slot={claimable} isCurrent={claimableIsCurrent} />

  const panels = [
    featured('stage-a'),
    <UpNextPanel key="next" slots={upcoming} networkBlockEnabled={networkBlockEnabled} />,
    featured('stage-b'),
    <TokenPanelBoard key="token" />,
    featured('stage-c'),
    <FollowPanel key="follow" />,
    featured('stage-d'),
    <TaglinePanel key="tag" index={Math.floor(panel / 8)} />,
  ]

  return (
    <div className={`absolute inset-0 csgn-bg overflow-hidden ${dimmed ? 'opacity-30' : ''}`}>
      <div className="absolute inset-0 bg-grid" />
      {/* Drifting ambient glow */}
      <div className="absolute -top-40 left-1/4 w-[700px] h-[700px] rounded-full bg-primary-500/10 blur-[140px] animate-float" />
      <div className="absolute -bottom-52 right-1/5 w-[600px] h-[600px] rounded-full bg-[#5000ff]/10 blur-[140px] animate-float" style={{ animationDelay: '2s' }} />

      {/* Wordmark, top-left */}
      <div className="absolute top-12 left-14 flex items-center gap-4">
        <CsgnLogo className="h-16 w-auto" />
        <span className="px-3 py-1 rounded-full border border-white/20 text-xs font-bold tracking-[0.3em] uppercase text-gray-400">
          24/7 Network
        </span>
      </div>

      {/* Live dot, top-right — the network never "pauses". Reads CSGN Originals
          on a reserved hour, Stage Open when the hour is claimable. */}
      <div className="absolute top-14 right-14 flex items-center gap-2.5">
        <span className={`w-2.5 h-2.5 rounded-full animate-live-pulse ${currentIsNetwork ? 'bg-gold' : 'bg-primary-500'}`} />
        <span className="text-sm font-bold tracking-[0.3em] uppercase text-gray-400">{currentIsNetwork ? 'CSGN Originals' : 'Stage Open'}</span>
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
          {currentIsNetwork
            ? <>csgn originals · live on X · @{X_HANDLE} · claim the open hours at csgn.fun</>
            : <>stage open · claim it at csgn.fun · live on X · @{X_HANDLE}</>}
        </span>
        <span className="text-sm font-mono text-gray-600">{CSGN_MINT}</span>
      </div>
    </div>
  )
}
