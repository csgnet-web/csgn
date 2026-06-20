import { describe, it, expect } from 'vitest'
import { resolvePumpFeeTier, PUMP_FUN_FEE_TIERS, STREAMER_SHARE_OF_CREATOR_FEE } from './feeCalc'

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
