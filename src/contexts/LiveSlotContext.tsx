import { useEffect, useMemo, useRef, useState } from 'react'
import { onSnapshot, doc } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { subscribeToSlots, type Slot } from '@/lib/slots'
import {
  LiveSlotContext,
  type LiveSlotContextValue,
  type ManualOverride,
  type TokenStats,
} from './LiveSlotContextCore'

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
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'public', 'tokenStats'),
      (snap) => {
        if (!mountedRef.current) return
        setTokenStats(snap.exists() ? (snap.data() as TokenStats) : null)
      },
      () => { if (mountedRef.current) setTokenStats(null) },
    )
    return unsub
  }, [])

  // Single listener for all slot data — creatorFees are written server-side by feePollerBackground
  useEffect(() => {
    const from = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const to = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000)
    const unsub = subscribeToSlots(from, to, (slots) => {
      if (!mountedRef.current) return
      setAllSlots(
        slots
          .filter((s) => toMillis(s.startTime) > 0 && toMillis(s.endTime) > 0)
          .sort((a, b) => toMillis(a.startTime) - toMillis(b.startTime)),
      )
    })
    return unsub
  }, [])

  // Derive current slot from shared slots list
  const currentSlot = useMemo(() => {
    return allSlots.find((s) => nowMs >= toMillis(s.startTime) && nowMs < toMillis(s.endTime)) ?? null
  }, [allSlots, nowMs])

  const value = useMemo<LiveSlotContextValue>(
    () => ({ currentSlot, allSlots, manualOverride, tokenStats, nowMs }),
    [currentSlot, allSlots, manualOverride, tokenStats, nowMs],
  )

  return <LiveSlotContext.Provider value={value}>{children}</LiveSlotContext.Provider>
}
