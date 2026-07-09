import { useEffect, useMemo, useRef, useState } from 'react'
import { onSnapshot, doc } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { subscribeToSlots, type Slot } from '@/lib/slots'
import { fetchTokenStats } from '@/lib/dexscreener'
import {
  LiveSlotContext,
  type LiveSlotContextValue,
  type ManualOverride,
  type TokenStats,
} from './LiveSlotContextCore'

/** Treat the server-written token doc as stale after this long and fall back to
 *  a direct client fetch, so the coin readout survives a stalled fee poller. */
const TOKEN_STATS_STALE_MS = 3 * 60_000

function tokenStatsFresh(stats: TokenStats | null): boolean {
  if (!stats) return false
  const t = Date.parse(stats.updatedAt)
  return Number.isFinite(t) && Date.now() - t < TOKEN_STATS_STALE_MS
}

function toMillis(value: unknown): number {
  if (typeof value === 'string' || value instanceof Date || typeof value === 'number') {
    const ms = new Date(value as string | Date | number).getTime()
    return Number.isFinite(ms) ? ms : 0
  }
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().getTime()
  }
  return 0
}

export function LiveSlotProvider({ children }: { children: React.ReactNode }) {
  const [allSlots, setAllSlots] = useState<Slot[]>([])
  const [slotsReady, setSlotsReady] = useState(false)
  const [manualOverride, setManualOverride] = useState<ManualOverride | null>(null)
  const [tokenStats, setTokenStats] = useState<TokenStats | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // Clock — drives current-slot derivation every 30s
  useEffect(() => {
    const t = setInterval(() => { if (mountedRef.current) setNowMs(Date.now()) }, 30_000)
    return () => clearInterval(t)
  }, [])

  // Single listener for admin manual override
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'config', 'liveStream'),
      (snap) => {
        if (!mountedRef.current) return
        if (snap.exists()) {
          const data = snap.data()
          setManualOverride(data.url ? { url: data.url as string, streamerName: (data.streamerName as string) || '', title: (data.title as string) || '' } : null)
        } else {
          setManualOverride(null)
        }
      },
      () => { if (mountedRef.current) setManualOverride(null) },
    )
    return unsub
  }, [])

  // Single listener for token stats — written server-side by feePollerBackground (~1/min)
  const tokenStatsRef = useRef<TokenStats | null>(null)
  useEffect(() => { tokenStatsRef.current = tokenStats }, [tokenStats])
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'public', 'tokenStats'),
      (snap) => {
        if (!mountedRef.current) return
        // Only accept the server doc when it's actually fresher than what we
        // already hold, so a stale/missing doc can't stomp a good client fetch.
        const next = snap.exists() ? (snap.data() as TokenStats) : null
        if (next || !tokenStatsFresh(tokenStatsRef.current)) setTokenStats(next)
      },
      () => { if (mountedRef.current && !tokenStatsFresh(tokenStatsRef.current)) setTokenStats(null) },
    )
    return unsub
  }, [])

  // Client-side fallback: whenever the server doc is missing or stale, fetch
  // token stats straight from DexScreener (once a minute — well within rate
  // limits). Keeps the coin readout populated even if the fee poller is down.
  useEffect(() => {
    let cancelled = false
    const ensureFresh = async () => {
      if (tokenStatsFresh(tokenStatsRef.current)) return
      const snap = await fetchTokenStats()
      if (cancelled || !mountedRef.current || !snap) return
      if (!tokenStatsFresh(tokenStatsRef.current)) setTokenStats(snap)
    }
    ensureFresh()
    const t = setInterval(ensureFresh, 60_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [])

  // Single listener for all slot data — creatorFees are written server-side by
  // feePollerBackground. Window: -3h catches the in-progress slot (2h max) and
  // +8d covers the /schedule page's 7 ET days incl. the trailing 1 AM slot; no
  // consumer renders already-finished slots, so deeper history is never read.
  useEffect(() => {
    const from = new Date(Date.now() - 3 * 60 * 60 * 1000)
    const to = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000)
    const unsub = subscribeToSlots(from, to, (slots) => {
      if (!mountedRef.current) return
      setSlotsReady(true)
      setAllSlots(
        slots
          .filter((s) => toMillis(s.startTime) > 0 && toMillis(s.endTime) > 0)
          .sort((a, b) => toMillis(a.startTime) - toMillis(b.startTime)),
      )
    }, 120)
    // Backstop: if Firestore can't deliver a first snapshot (rules/network),
    // declare readiness anyway after a generous window so consumers with a
    // "wait for slot data" gate (/player) can still fall back to defaults
    // rather than waiting forever.
    const readyBackstop = setTimeout(() => { if (mountedRef.current) setSlotsReady(true) }, 20_000)
    return () => { clearTimeout(readyBackstop); unsub() }
  }, [])

  // Derive current slot from shared slots list
  const currentSlot = useMemo(() => {
    return allSlots.find((s) => nowMs >= toMillis(s.startTime) && nowMs < toMillis(s.endTime)) ?? null
  }, [allSlots, nowMs])

  const value = useMemo<LiveSlotContextValue>(
    () => ({ currentSlot, allSlots, manualOverride, tokenStats, nowMs, slotsReady }),
    [currentSlot, allSlots, manualOverride, tokenStats, nowMs, slotsReady],
  )

  return <LiveSlotContext.Provider value={value}>{children}</LiveSlotContext.Provider>
}
