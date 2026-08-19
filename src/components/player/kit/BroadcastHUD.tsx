import { useEffect, useState } from 'react'
import { useLiveSlot } from '@/contexts/useLiveSlot'
import { formatTimeET, isNetworkSlot, slotIdentity, toMillis } from '@/lib/slots'
import { compactUsd, formatPrice } from '@/lib/format'

/**
 * THE PERSISTENT HUD — everything that stays on screen, always.
 *
 * ── The reference, and the argument for density ────────────────────────────
 *
 * ESPN's Bottom Line, CNN's lower band, the Chive TV channel bug: all of them
 * cover 15–20% of the frame with information that has nothing to do with the
 * picture behind it, and all of them are right to. A viewer arriving mid-clip
 * with no audio has to be able to answer four questions in one glance:
 *
 *   1. What am I watching?            → the slug, top-left
 *   2. Is this live or a replay?      → the LIVE/REEL state, unmissable
 *   3. What time is it, and what's next? → the clock and the up-next crawl
 *   4. What IS this channel?          → the wordmark, the price, the URL
 *
 * A clean frame answers none of those. That is fine for a film and wrong for a
 * channel, because a channel is something people arrive at in the middle. Err
 * toward more: a viewer can ignore information they do not want far more
 * easily than they can find information that is not there.
 *
 * ── What this deliberately does NOT do ─────────────────────────────────────
 *
 * It does not cover the centre. Everything lives in a top band and a bottom
 * band, with the middle 66% of the frame untouched, so a vertical TikTok clip
 * — the most common thing on this channel — is never cropped by furniture.
 */

/** ET wall clock, ticking. A channel without a clock is a video file. */
function useEtClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1_000)
    return () => clearInterval(t)
  }, [])
  return now
}

export interface HUDProps {
  /** 'LIVE' when a person is on air, 'REEL' when clips are carrying it. */
  mode: 'live' | 'reel' | 'standby'
  /** Who or what is on — the slug. */
  slug: string
  /** Second line of the slug: a stream title, a clip title. */
  subtitle?: string
  /** Live viewer count, when there is one. */
  viewers?: number
  /** 0–1 through the current segment, for the progress hairline. */
  progress?: number
}

export function BroadcastHUD({ mode, slug, subtitle, viewers, progress }: HUDProps) {
  const now = useEtClock()
  const { allSlots, networkBlockEnabled, tokenStats, nowMs } = useLiveSlot()

  const upNext = allSlots
    .filter((slot) => toMillis(slot.startTime) > nowMs)
    .sort((a, b) => toMillis(a.startTime) - toMillis(b.startTime))
    .slice(0, 3)

  const clock = now.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true,
  })

  const price = tokenStats?.priceUsd
  const change = tokenStats?.priceChangeH24Pct ?? 0
  const volume = tokenStats?.volumeH24Usd

  return (
    <div className="absolute inset-0 pointer-events-none select-none">

      {/* ══ TOP BAND ══
          The slug and the state. Left-weighted because that is where an eye
          lands, and because the right side has to stay clear for a platform's
          own overlay when the channel is restreamed. */}
      <div className="absolute top-0 inset-x-0 flex items-start justify-between gap-8 px-10 pt-8">
        <div className="flex items-center gap-5 min-w-0">
          {/* THE STATE FLAG. Hard red block for live, neutral for the reel —
              the single most important pixel on the screen, and it is a solid
              fill rather than a dot because a dot at 1080p on a phone is
              invisible. */}
          <span
            className={`shrink-0 flex items-center gap-2.5 px-4 py-2 ${
              mode === 'live' ? 'bg-[#ff2346]' : mode === 'reel' ? 'bg-white/10' : 'bg-white/[0.07]'
            }`}
          >
            {mode === 'live' && <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />}
            <span className="text-[18px] font-black uppercase tracking-[0.28em] text-white leading-none">
              {mode === 'live' ? 'Live' : mode === 'reel' ? 'Reel' : 'Standby'}
            </span>
          </span>

          <div className="min-w-0">
            <p className="text-[30px] font-display font-black uppercase text-white leading-none tracking-[-0.02em] truncate">
              {slug}
            </p>
            {subtitle && (
              <p className="mt-1.5 text-[16px] text-white/55 leading-none truncate max-w-[720px]">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[30px] font-mono font-bold text-white leading-none tabular-nums">{clock}</p>
          <p className="mt-1.5 text-[12px] font-black uppercase tracking-[0.28em] text-white/40 leading-none">ET</p>
        </div>
      </div>

      {/* ══ SEGMENT PROGRESS ══
          A hairline under the top band. Tells a viewer how much of this thing
          is left, which is the question they ask before deciding to stay. */}
      {typeof progress === 'number' && (
        <div className="absolute top-[104px] inset-x-10 h-[3px] bg-white/10">
          <div
            className="h-full bg-[#ff2346] transition-[width] duration-1000 ease-linear"
            style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%` }}
          />
        </div>
      )}

      {/* ══ BOTTOM BAND ══
          Two rows. The top one is the channel's own identity and market data;
          the bottom is what's next. This is the Bottom Line, and it is where a
          viewer who arrived by accident learns what they arrived at. */}
      <div className="absolute bottom-0 inset-x-0">

        {/* Up next — a real strip rather than a crawl. A crawl makes a viewer
            wait for the information to come round again; a strip is readable
            the instant they look at it. */}
        {upNext.length > 0 && (
          <div className="flex items-stretch bg-black/85 backdrop-blur-sm border-t border-white/10">
            <span className="shrink-0 flex items-center bg-[#ff2346] px-5">
              <span className="text-[13px] font-black uppercase tracking-[0.28em] text-white leading-none">Next</span>
            </span>
            <div className="flex items-center gap-9 px-6 py-3 min-w-0 overflow-hidden">
              {upNext.map((slot) => {
                const identity = slotIdentity(slot, { networkBlockEnabled, openName: 'Open' })
                return (
                  <span key={slot.id} className="flex items-baseline gap-3 shrink-0">
                    <span className="text-[17px] font-mono font-bold text-white/45 tabular-nums">
                      {formatTimeET(slot.startTime)}
                    </span>
                    <span className={`text-[19px] font-black uppercase tracking-[-0.01em] ${
                      identity.isOpen ? 'text-white/35' : isNetworkSlot(slot) && networkBlockEnabled ? 'text-[#ffb020]' : 'text-white'
                    }`}>
                      {identity.name}
                    </span>
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* The identity row. Wordmark, token, viewers, URL — the four facts a
            screenshot of this channel needs to carry on its own, because a
            screenshot is how most people will first see it. */}
        <div className="flex items-center justify-between gap-8 bg-[#050507] border-t-[3px] border-[#ff2346] px-10 py-4">
          <div className="flex items-center gap-7 min-w-0">
            <span className="text-[30px] font-display font-black uppercase text-white leading-none tracking-[-0.03em]">
              CSGN
            </span>
            <span className="w-px h-7 bg-white/15" />
            <span className="text-[13px] font-black uppercase tracking-[0.3em] text-white/40 leading-none">24/7</span>
          </div>

          <div className="flex items-center gap-8 shrink-0">
            {typeof viewers === 'number' && viewers > 0 && (
              <span className="flex items-baseline gap-2.5">
                <span className="text-[24px] font-mono font-bold text-[#35ff8a] tabular-nums leading-none">
                  {viewers.toLocaleString('en-US')}
                </span>
                <span className="text-[12px] font-black uppercase tracking-[0.22em] text-white/35 leading-none">Watching</span>
              </span>
            )}

            {typeof price === 'number' && price > 0 && (
              <span className="flex items-baseline gap-2.5">
                <span className="text-[12px] font-black uppercase tracking-[0.22em] text-white/35 leading-none">$CSGN</span>
                <span className="text-[24px] font-mono font-bold text-white tabular-nums leading-none">
                  {formatPrice(price)}
                </span>
                <span className={`text-[18px] font-mono font-bold tabular-nums leading-none ${
                  change >= 0 ? 'text-[#35ff8a]' : 'text-[#ff4d6a]'
                }`}>
                  {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                </span>
                {typeof volume === 'number' && volume > 0 && (
                  <span className="text-[15px] font-mono text-white/35 tabular-nums leading-none">
                    {compactUsd(volume)} vol
                  </span>
                )}
              </span>
            )}

            <span className="text-[19px] font-black uppercase tracking-[0.16em] text-white/70 leading-none">
              csgn.fun
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BroadcastHUD
