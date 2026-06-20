import { describe, it, expect } from 'vitest'
import { resolvePumpFeeTier, PUMP_FUN_FEE_TIERS, STREAMER_SHARE_OF_CREATOR_FEE, buildTokenData } from './feeCalc'

describe('live earnings — fee calculation', () => {
  it('resolves the base tier for a fresh/low market cap', () => {
    const tier = resolvePumpFeeTier(100)
    expect(tier.minMarketCapSOL).toBe(0)
    expect(tier.creatorFeeRate).toBe(0.003)
  })

  it('calculates streamer earnings for a $50 trade at the base tier', () => {
    // Streamer earns 30% of the creator fee; base tier creator fee = 0.30%.
    const tradeUsd = 50
    const tier = resolvePumpFeeTier(100)
    const streamerUsd = tradeUsd * tier.creatorFeeRate * STREAMER_SHARE_OF_CREATOR_FEE
    expect(streamerUsd).toBeCloseTo(0.045, 6)
  })

  it('is SOL/USD consistent for a $50 trade (SOL @ $150)', () => {
    const tradeUsd = 50
    const solPriceUsd = 150
    const volumeSOL = tradeUsd / solPriceUsd
    const tier = resolvePumpFeeTier(100)
    const streamerFeeSOL = volumeSOL * tier.creatorFeeRate * STREAMER_SHARE_OF_CREATOR_FEE
    expect(streamerFeeSOL * solPriceUsd).toBeCloseTo(0.045, 6)
  })

  it('applies the correct higher tier as market cap grows', () => {
    const tier = resolvePumpFeeTier(1000) // 420–1470 SOL → 0.95% creator fee
    expect(tier.creatorFeeRate).toBe(0.0095)
    expect(50 * tier.creatorFeeRate * STREAMER_SHARE_OF_CREATOR_FEE).toBeCloseTo(0.1425, 6)
  })

  it('has contiguous, ordered tiers with no gaps', () => {
    for (let i = 1; i < PUMP_FUN_FEE_TIERS.length; i++) {
      expect(PUMP_FUN_FEE_TIERS[i].minMarketCapSOL).toBe(PUMP_FUN_FEE_TIERS[i - 1].maxMarketCapSOL)
    }
    expect(PUMP_FUN_FEE_TIERS[PUMP_FUN_FEE_TIERS.length - 1].maxMarketCapSOL).toBeNull()
  })
})

describe('live earnings — Solscan token-data parsing', () => {
  it('builds token data and converts market cap USD -> SOL', () => {
    const d = buildTokenData({ market_cap: 30000, volume_24h: 5000 }, 150) // SOL @ $150
    expect(d).not.toBeNull()
    expect(d!.volumeH24Usd).toBe(5000)
    expect(d!.solPriceUsd).toBe(150)
    expect(d!.marketCapSOL).toBeCloseTo(200, 6) // 30000 / 150
  })

  it('tolerates camelCase / alternate Solscan field names', () => {
    expect(buildTokenData({ marketCap: 30000, volume24h: 5000 }, 150)).not.toBeNull()
    expect(buildTokenData({ marketcap: '30000', volume: '5000' }, 150)).not.toBeNull()
  })

  it('freezes (returns null) on missing or invalid inputs', () => {
    expect(buildTokenData({ volume_24h: 5000 }, 150)).toBeNull()        // no market cap
    expect(buildTokenData({ market_cap: 30000 }, 150)).toBeNull()       // no volume
    expect(buildTokenData({ market_cap: 30000, volume_24h: 5000 }, 0)).toBeNull()  // no SOL price
    expect(buildTokenData({ market_cap: -1, volume_24h: 5000 }, 150)).toBeNull()   // negative
  })

  it('a $50 trade right now resolves to the expected streamer fee end-to-end', () => {
    // CSGN market cap $30k, SOL @ $150 -> 200 SOL market cap -> base tier (0.30%).
    const d = buildTokenData({ market_cap: 30000, volume_24h: 0 }, 150)!
    const tier = resolvePumpFeeTier(d.marketCapSOL)
    expect(tier.creatorFeeRate).toBe(0.003)
    const tradeUsd = 50
    const streamerUsd = tradeUsd * tier.creatorFeeRate * STREAMER_SHARE_OF_CREATOR_FEE
    expect(streamerUsd).toBeCloseTo(0.045, 6)
  })
})
