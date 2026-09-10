import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/config/firebase'

/**
 * WHAT IS ON AND WHY — read, never derived.
 *
 * The server writes `public/channelMode` every poll tick and immediately after
 * an operator action (see netlify/functions/_shared/channelMode.ts). This hook
 * only displays it. That is deliberate: /watch, /schedule, /player and the OBS
 * graphics all need this answer, and four surfaces each deriving it from
 * slightly different inputs is precisely how this codebase ended up with a live
 * network show headlined "THE STAGE IS OPEN".
 *
 * `null` means NOT READ YET — never CLIP MODE. A verdict we do not have is not
 * a verdict of clips, and rendering unknown as a fact is the single most
 * expensive habit this project has had.
 */

/** CLIP MODE (the member reel), STREAM MODE (a roster streamer the MP put on),
 *  MASTER MODE (the MP live from their own encoder, or their 7 PM–3 AM block).
 *  Mirrors netlify/functions/_shared/channelMode.ts — the server decides. */
export type ChannelMode = 'master' | 'stream' | 'clip'

export interface ModeEvent {
  at: string
  mode: ChannelMode
  who: string | null
  because: string
}

export interface ChannelModeDoc {
  mode: ChannelMode
  label: string
  who: string | null
  isGuest: boolean
  because: string
  nextSwitch: string
  since: string | null
  /** The picture is coming from the MP's own encoder right now, so nothing may
   *  be drawn over it and the reel must not run. True ONLY for a live "I'm
   *  going on" takeover — never for the 7 PM–3 AM block, which is master mode
   *  on the sign with no encoder behind it. Mirrors `encoder` in
   *  netlify/functions/_shared/channelMode.ts. */
  encoder: boolean
  log: ModeEvent[]
  liveCount: number
  updatedAt: string
}

/** Older than this and the sign is not shown as fact — a stalled poller must
 *  not leave a five-hour-old "LIVE: someone" on the page. */
export const CHANNEL_MODE_STALE_MS = 10 * 60_000

function isFresh(updatedAt: string, nowMs: number): boolean {
  const t = Date.parse(updatedAt || '')
  return Number.isFinite(t) && nowMs - t <= CHANNEL_MODE_STALE_MS
}

export function useChannelMode(): { channelMode: ChannelModeDoc | null; stale: boolean } {
  const [channelMode, setChannelMode] = useState<ChannelModeDoc | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'public', 'channelMode'),
      (snap) => {
        if (!snap.exists()) { setChannelMode(null); return }
        const d = snap.data() as Partial<ChannelModeDoc>
        if (!d.mode || !d.because) { setChannelMode(null); return }
        setChannelMode({
          mode: d.mode,
          label: d.label || 'Clip Mode',
          who: d.who ?? null,
          isGuest: d.isGuest === true,
          because: d.because,
          nextSwitch: d.nextSwitch || '',
          since: d.since ?? null,
          // Absent (a doc written before this field existed) reads as false —
          // the safe direction, because false keeps the reel running and true
          // would blank the channel on the strength of a missing field.
          encoder: d.encoder === true,
          log: Array.isArray(d.log) ? d.log.filter((e) => e && e.at && e.mode) : [],
          liveCount: Math.max(0, Number(d.liveCount) || 0),
          updatedAt: d.updatedAt || '',
        })
      },
      // A read failure leaves the sign off the page entirely, which is honest.
      () => setChannelMode(null),
    )
    return unsub
  }, [])

  // Freshness is DERIVED during render off a ticking clock, not stored. A doc
  // that stops updating never fires another snapshot, so staleness can only be
  // noticed by the clock — and a clock tick is the state, not the conclusion.
  const stale = channelMode == null || !isFresh(channelMode.updatedAt, nowMs)

  return { channelMode, stale }
}
