import { useEffect, useState } from 'react'
import { useLiveSlot } from '@/contexts/useLiveSlot'
import { formatESTRange, isNetworkSlot, slotIdentity, toMillis, CSGN_MINT, type Slot } from '@/lib/slots'
import { X_HANDLE } from '@/lib/social'
import { CsgnLogo } from '@/components/ui/CsgnLogo'
import { formatPrice, compactUsd } from '@/lib/format'

const PANEL_INTERVAL_MS = 12_000

const TAGLINES = [
  "Crypto's Entertainment Flagship",
  'The ESPN and TMZ of Crypto',
  '24/7. On-chain. Live on X.',
  'Streamers earn creator fees — live, on screen',
  'Hold $CSGN. Post a clip. Get on television.',
] as const

function UpNextPanel({ slots, networkBlockEnabled }: { slots: Slot[]; networkBlockEnabled: boolean }) {
  return (
    <div className="flex flex-col items-center gap-8">
      <p className="text-2xl font-black tracking-[0.4em] uppercase text-gray-400">Tonight on CSGN</p>
      <div className="flex flex-col gap-5">
        {slots.length > 0 ? (
          slots.map((s) => (
            <div key={s.id} className="flex items-baseline justify-center gap-6">
              <span className="text-4xl font-black font-display text-white">
                {slotIdentity(s, { networkBlockEnabled, openName: 'Member Clips' }).name}
              </span>
              <span className="text-2xl font-mono text-primary-300">{formatESTRange(s)}</span>
            </div>
          ))
        ) : (
          <p className="text-3xl font-display font-bold text-white">Clips roll around the clock</p>
        )}
      </div>
      <p className="text-xl text-gray-500">
        Any hour without a live member runs the member reel — the more <span className="text-white font-bold">$CSGN</span> you hold, the more of it is yours
      </p>
    </div>
  )
}

/**
 * The headline act. NOT a claim billboard any more — nobody reserves an hour.
 *
 * The old panel sold "TAKE THIS SLOT", a path that no longer exists: the channel
 * now runs off the roster, so the only two things a viewer can actually do are
 * post a clip (free, airs by holdings) or connect Twitch once and get put on when
 * they happen to be live. Advertising a button that isn't there was the fastest
 * way to make the network look abandoned. This sells the two real doors.
 */
function GetOnPanel() {
  return (
    <div className="flex flex-col items-center gap-10">
      <div className="flex flex-col items-center gap-3">
        <p className="text-2xl font-black tracking-[0.4em] uppercase text-primary-400">Two ways on the air</p>
        <p className="text-6xl font-black font-display text-white text-center leading-tight">
          Post a clip. Or go live as you already do.
        </p>
      </div>

      <div className="flex items-stretch gap-8">
        <div className="stage-border-sweep rounded-3xl p-[2px]">
          <div className="stage-card-breathe rounded-3xl bg-[#0a0a14] px-12 py-8 max-w-[520px] h-full text-left">
            <p className="text-sm uppercase tracking-[0.3em] text-gray-500 mb-3">No tokens needed to start</p>
            <p className="text-4xl font-black font-display text-white leading-tight">Post a clip</p>
            <p className="text-lg text-gray-400 mt-3 leading-snug">
              Drop a link from X, YouTube, TikTok or Instagram. It airs on the member reel — your share of the
              hour tracks the <span className="text-white font-bold">$CSGN</span> you hold.
            </p>
          </div>
        </div>

        <div className="stage-border-sweep rounded-3xl p-[2px]">
          <div className="stage-card-breathe rounded-3xl bg-[#0a0a14] px-12 py-8 max-w-[520px] h-full text-left">
            <p className="text-sm uppercase tracking-[0.3em] text-gray-500 mb-3">Nothing to schedule</p>
            <p className="text-4xl font-black font-display text-white leading-tight">Connect Twitch</p>
            <p className="text-lg text-gray-400 mt-3 leading-snug">
              Grant CSGN permission once. Stream whenever you normally do — the network picks you up while
              you're live and pays creator fees for the minutes you're on.
            </p>
          </div>
        </div>
      </div>

      <p className="text-2xl font-mono text-gray-400">csgn.fun · streamed to X on <span className="text-white font-bold">@{X_HANDLE}</span></p>
    </div>
  )
}

/**
 * WHY THE CHANNEL IS IN CLIP MODE RIGHT NOW — said out loud, on the broadcast.
 *
 * The switch between the member reel and a live streamer is the single most
 * confusing thing about a 24/7 channel with no fixed lineup. A viewer who tunes
 * in twice and sees two different products, with no explanation, files the
 * channel as broken. So the rule is published rather than inferred: clips are
 * the floor, a live member is an interruption, and both are normal.
 */
function ModeExplainerPanel() {
  return (
    <div className="flex flex-col items-center gap-9">
      <p className="text-2xl font-black tracking-[0.4em] uppercase text-gray-400">How this channel runs</p>
      <div className="flex items-center gap-5">
        {[
          ['Clip Mode', 'The floor — runs whenever nothing beats it', 'The member reel. Your share of the day is your share of $CSGN'],
          ['Stream Mode', 'A member on the roster goes live', 'The network cuts to them — they connected Twitch and let us carry it'],
          ['Master Mode', 'CSGN goes on directly', 'The control room takes the channel. 7 PM–3 AM ET is reserved for it'],
        ].map(([title, when, what]) => (
          <div key={title} className="px-9 py-7 rounded-2xl bg-white/[0.04] border border-white/[0.1] max-w-[400px] text-left">
            <p className="text-2xl font-black font-display text-white">{title}</p>
            <p className="text-sm uppercase tracking-[0.2em] text-primary-300 mt-2">{when}</p>
            <p className="text-lg text-gray-400 mt-3 leading-snug">{what}</p>
          </div>
        ))}
      </div>
      <p className="text-xl text-gray-500">Every switch, and its reason, is published at <span className="text-white font-bold">csgn.fun/schedule</span></p>
    </div>
  )
}

/**
 * Shown on /player when the hour ON AIR is inside the MASTER MODE block, so it
 * reads as programmed television rather than as an ordinary clip hour.
 */
function NetworkNowPanel({ slot }: { slot: Slot | null }) {
  const showName = slot ? slotIdentity(slot).name : 'CSGN Originals'
  return (
    <div className="flex flex-col items-center gap-10">
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-gold animate-live-pulse" />
          <p className="text-2xl font-black tracking-[0.4em] uppercase text-gold">Master Mode</p>
        </div>
        <p className="text-7xl font-black font-display text-white text-center leading-tight">{showName}</p>
        {slot && <p className="text-3xl font-mono text-primary-300">{formatESTRange(slot)}</p>}
      </div>

      <div className="stage-border-sweep rounded-3xl p-[2px]">
        <div className="rounded-3xl bg-[#0a0a14] px-14 py-8 text-center max-w-[820px]">
          <p className="text-xl text-gray-300">Network programming — streamed to X on <span className="text-white font-bold">@{X_HANDLE}</span></p>
          <p className="text-lg text-gray-500 mt-3">The master block runs 7 PM–3 AM ET. The other sixteen hours belong to the members at <span className="text-white font-bold">csgn.fun</span></p>
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
            {compactUsd(tokenStats?.marketCapUsd)}
          </p>
        </div>
        <div>
          <p className="text-lg uppercase tracking-[0.25em] text-gray-500">24h Volume</p>
          <p className="text-3xl font-black font-mono text-white mt-1">
            {compactUsd(tokenStats?.volumeH24Usd)}
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
 * whenever no streamer is live. Cycles branded panels: how to get on, the
 * clip/live rule, up-next, live token stats, follow card, taglines. `dimmed`
 * renders it as the backdrop behind BRB / starting-soon status cards.
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

  // Is the hour on the air inside the MASTER MODE block? If so the featured
  // panel is the master billboard rather than the recruiting one.
  const currentIsNetwork = !!currentSlot && isNetworkSlot(currentSlot) && networkBlockEnabled

  const featured = (key: string) =>
    currentIsNetwork ? <NetworkNowPanel key={key} slot={currentSlot} /> : <GetOnPanel key={key} />

  const panels = [
    featured('stage-a'),
    <UpNextPanel key="next" slots={upcoming} networkBlockEnabled={networkBlockEnabled} />,
    featured('stage-b'),
    <ModeExplainerPanel key="mode" />,
    featured('stage-c'),
    <TokenPanelBoard key="token" />,
    featured('stage-d'),
    <FollowPanel key="follow" />,
    featured('stage-e'),
    <TaglinePanel key="tag" index={Math.floor(panel / 10)} />,
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

      {/* Mode flag, top-right — the network never "pauses". Names the mode the
          channel is actually in so a viewer can read it off the screen. */}
      <div className="absolute top-14 right-14 flex items-center gap-2.5">
        <span className={`w-2.5 h-2.5 rounded-full animate-live-pulse ${currentIsNetwork ? 'bg-gold' : 'bg-primary-500'}`} />
        <span className="text-sm font-bold tracking-[0.3em] uppercase text-gray-400">{currentIsNetwork ? 'Master Mode' : 'Clip Mode'}</span>
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
            ? <>master mode · live on X · @{X_HANDLE} · post a clip at csgn.fun</>
            : <>clip mode · member reel · post yours at csgn.fun · live on X · @{X_HANDLE}</>}
        </span>
        <span className="text-sm font-mono text-gray-600">{CSGN_MINT}</span>
      </div>
    </div>
  )
}
