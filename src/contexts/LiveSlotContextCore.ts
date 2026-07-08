import { createContext } from 'react'
import type { Slot } from '@/lib/slots'

export interface ManualOverride {
  url: string
  streamerName: string
  title: string
}

export interface TokenStats {
  priceUsd: number
  marketCapUsd: number
  volumeH24Usd: number
  priceChangeH24Pct: number
  liquidityUsd: number
  solPriceUsd: number
  pairUrl: string
  mint: string
  updatedAt: string
}

export interface LiveSlotContextValue {
  currentSlot: Slot | null
  allSlots: Slot[]
  manualOverride: ManualOverride | null
  tokenStats: TokenStats | null
  nowMs: number
  /** True once the first slots snapshot has arrived. Until then currentSlot
   *  is null because the data hasn't loaded — NOT because no slot is claimed —
   *  and consumers like /player must not fall back to the default channel. */
  slotsReady: boolean
}

export const LiveSlotContext = createContext<LiveSlotContextValue>({
  currentSlot: null,
  allSlots: [],
  manualOverride: null,
  tokenStats: null,
  nowMs: Date.now(),
  slotsReady: false,
})
