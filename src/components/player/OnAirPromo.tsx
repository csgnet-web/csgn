import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLiveSlot } from '@/contexts/useLiveSlot'
import { formatESTRange } from '@/lib/slots'
import { X_HANDLE } from '@/lib/social'

/** Broadcast-network promo cadence: each appearance is on screen ~9s, and the
 *  gap between appearances is a full five minutes — frequent enough that any
 *  viewer learns who's on, who's next and what CSGN is, rare enough that it
 *  never feels like an ad crawl over the streamer's content. */
export const PROMO_INTERVAL_MS = 5 * 60_000
/** First appearance after going LIVE — late enough to clear the branded
 *  reveal + brand wipe, early enough that a fresh viewer gets oriented. */
export const PROMO_FIRST_DELAY_MS = 90_000
export const PROMO_VISIBLE_MS = 9_000

type Variant = 'now' | 'next' | 'network' | 'token'
/** Each appearance shows ONE rotating card, in this order. */
const ROTATION: Variant[] = ['now', 'network', 'next', 'token']

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

/**
 * On-air promo lower-third — the FOX/ESPN-style network bug that slides in
 * over a LIVE feed at most once every five minutes, holds ~9s, and slides
 * back out. Rotates through: who's on now, what CSGN is, who's up next, and
 * $CSGN stats. Purely presentational and pointer-transparent; the feed and
 * its audio are never touched.
 *
 * `preview` (via /player?preview=promo) shows it immediately and cycles the
 * cards every few seconds so each look can be checked inside OBS.
 */
export default function OnAirPromo({ preview = false }: { preview?: boolean }) {
  const { currentSlot, allSlots, tokenStats, nowMs } = useLiveSlot()
  // Which appearance is currently on screen (drives the rotation); null = hidden.
  const [appearance, setAppearance] = useState<number | null>(null)
  const countRef = useRef(0)

  useEffect(() => {
    const firstDelay = preview ? 400 : PROMO_FIRST_DELAY_MS
    const interval = preview ? PROMO_VISIBLE_MS + 2_000 : PROMO_INTERVAL_MS
    let hideTimer: ReturnType<typeof setTimeout> | null = null
    let showTimer: ReturnType<typeof setTimeout> | null = null
    const run = () => {
      setAppearance(countRef.current++)
      hideTimer = setTimeout(() => setAppearance(null), PROMO_VISIBLE_MS)
      // Chain (not setInterval) so the gap between appearances is always the
      // full interval, honouring "at most once every five minutes".
      showTimer = setTimeout(run, interval)
    }
    showTimer = setTimeout(run, firstDelay)
    return () => {
      if (showTimer) clearTimeout(showTimer)
      if (hideTimer) clearTimeout(hideTimer)
    }
  }, [preview])

  if (appearance === null) return null

  const streamerName = currentSlot?.assignedName || (preview ? 'Streamer' : '')
  const nextSlot = allSlots.find((s) => toMillis(s.startTime) > nowMs) ?? null

  // Pick this appearance's card, falling back to the network card whenever a
  // rotation entry has no data to show (no name on the slot, no next slot,
  // token stats not loaded yet).
  let variant = ROTATION[appearance % ROTATION.length]
  if (variant === 'now' && !streamerName) variant = 'network'
  if (variant === 'next' && !nextSlot) variant = 'network'
  if (variant === 'token' && !tokenStats) variant = 'network'

  let kicker: string
  let title: ReactNode
  let sub: ReactNode
  if (variant === 'now') {
    kicker = 'Live on CSGN'
    title = streamerName
    sub = (
      <>
        {currentSlot ? <span className="font-mono text-primary-300">{formatESTRange(currentSlot)}</span> : null}
        {currentSlot ? ' · ' : ''}streaming to X on <span className="font-bold text-white">@{X_HANDLE}</span>
      </>
    )
  } else if (variant === 'next' && nextSlot) {
    kicker = 'Up next'
    title = nextSlot.assignedName || 'Open slot — claim it at csgn.fun'
    sub = (
      <>
        <span className="font-mono text-primary-300">{formatESTRange(nextSlot)}</span> · live on <span className="font-bold text-white">@{X_HANDLE}</span>
      </>
    )
  } else if (variant === 'token' && tokenStats) {
    const change = tokenStats.priceChangeH24Pct
    const positive = change >= 0
    kicker = '$CSGN'
    title = (
      <>
        <span className="font-mono">{formatPrice(tokenStats.priceUsd)}</span>{' '}
        <span className={`font-mono text-xl ${positive ? 'text-positive' : 'text-negative'}`}>
          {positive ? '+' : ''}{change.toFixed(2)}%
        </span>
      </>
    )
    sub = <>The network's token · <span className="font-bold text-white">csgn.fun</span></>
  } else {
    kicker = 'The 24/7 network'
    title = 'CSGN — decentralized live TV'
    sub = <>Anyone can claim a slot & keep the creator fees · <span className="font-bold text-white">csgn.fun</span></>
  }

  return (
    // key remounts per appearance so the in-hold-out animation replays each time.
    <div
      key={appearance}
      className="pointer-events-none absolute bottom-10 left-12 z-10"
      style={{ animation: `promo-life ${PROMO_VISIBLE_MS}ms cubic-bezier(0.22, 1, 0.36, 1) both` }}
    >
      <div className="flex items-stretch overflow-hidden rounded-xl border border-white/10 bg-black/75 shadow-2xl backdrop-blur-md">
        {/* Network cap — the constant CSGN brand block */}
        <div className="flex flex-col items-center justify-center gap-1 bg-primary-500 px-5">
          <span className="text-xl font-black tracking-widest text-white">CSGN</span>
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-white/80">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-live-pulse" /> 24/7
          </span>
        </div>
        {/* Rotating card body */}
        <div className="flex flex-col justify-center gap-0.5 py-3.5 pl-6 pr-9">
          <span className="text-xs font-bold uppercase tracking-[0.3em] text-primary-300">{kicker}</span>
          <span className="font-display text-2xl font-black leading-tight text-white">{title}</span>
          <span className="text-sm text-gray-400">{sub}</span>
        </div>
      </div>
    </div>
  )
}
