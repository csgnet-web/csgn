/** Dexscreener API integration for live CSGN trading data. */

const PAIR_ADDRESS = 'BKA7zC19FwWzVxPHwxAe7ZTbgyqoC3wUsioK6pGs5pVx'
const API_URL = `https://api.dexscreener.com/latest/dex/pairs/solana/${PAIR_ADDRESS}`

export interface DexPair {
  priceNative: string   // CSGN price in SOL (e.g. "0.00000812")
  priceUsd: string      // CSGN price in USD
  volume: {
    h24: number         // 24-hour volume USD
    h6: number
    h1: number
    m5: number
  }
  liquidity?: { usd: number }
  txns?: { h24: { buys: number; sells: number } }
}

export async function fetchCSGNPair(): Promise<DexPair | null> {
  try {
    const res = await fetch(API_URL)
    if (!res.ok) return null
    const data = await res.json()
    // API may return { pair: {...} } or { pairs: [...] }
    return (data.pair ?? data.pairs?.[0]) as DexPair | null
  } catch {
    return null
  }
}

/**
 * Convert a USD volume amount to SOL using the pair's own price data.
 * sol_price_usd = priceUsd / priceNative
 * volumeSOL = volumeUSD / sol_price_usd = volumeUSD * priceNative / priceUsd
 */
export function usdVolumeToSOL(pair: DexPair, volumeUSD: number): number {
  const priceNative = parseFloat(pair.priceNative)
  const priceUsd = parseFloat(pair.priceUsd)
  if (!priceUsd || !priceNative) return 0
  return volumeUSD * priceNative / priceUsd
}

/**
 * Estimate CSGN trading volume in SOL that occurred since slotStartISO.
 * Uses the baseline h24 volume captured at slot-start and the current h24
 * delta to give an accurate picture of volume during this specific block.
 */
export function estimateSlotVolumeSOL(
  pair: DexPair,
  baselineH24USD: number,
): number {
  const deltaUSD = Math.max(0, pair.volume.h24 - baselineH24USD)
  return usdVolumeToSOL(pair, deltaUSD)
}

/** Creator fee owed to streamer = 0.3% of slot trading volume in SOL. */
export function calcFeeSOL(volumeSOL: number): number {
  return volumeSOL * 0.003
}
