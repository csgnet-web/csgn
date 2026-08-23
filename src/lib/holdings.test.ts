import { describe, it, expect } from 'vitest'
import {
  circulatingSupply, supplySharePct, formatSharePct, formatTokens,
  holderStanding, tokensToNextStep, FALLBACK_CIRCULATING_SUPPLY,
} from './holdings'

describe('circulating supply', () => {
  it('is derived from market cap over price, not hardcoded', () => {
    expect(circulatingSupply({ marketCapUsd: 500_000, priceUsd: 0.0005 })).toBe(1_000_000_000)
    expect(circulatingSupply({ marketCapUsd: 250_000, priceUsd: 0.0005 })).toBe(500_000_000)
  })

  it('falls back when either input is missing or nonsensical', () => {
    expect(circulatingSupply(null)).toBe(FALLBACK_CIRCULATING_SUPPLY)
    expect(circulatingSupply({})).toBe(FALLBACK_CIRCULATING_SUPPLY)
    expect(circulatingSupply({ marketCapUsd: 0, priceUsd: 0.0005 })).toBe(FALLBACK_CIRCULATING_SUPPLY)
    expect(circulatingSupply({ marketCapUsd: 500_000, priceUsd: 0 })).toBe(FALLBACK_CIRCULATING_SUPPLY)
    expect(circulatingSupply({ marketCapUsd: -5, priceUsd: -1 })).toBe(FALLBACK_CIRCULATING_SUPPLY)
  })
})

describe('supply share', () => {
  it('is a percentage of circulating supply', () => {
    expect(supplySharePct(10_000_000, 1_000_000_000)).toBeCloseTo(1, 10)
    expect(supplySharePct(5_000_000, 1_000_000_000)).toBeCloseTo(0.5, 10)
  })

  it('is zero for an empty, negative or unreadable balance', () => {
    expect(supplySharePct(0, 1_000_000_000)).toBe(0)
    expect(supplySharePct(-100, 1_000_000_000)).toBe(0)
    expect(supplySharePct(NaN, 1_000_000_000)).toBe(0)
    expect(supplySharePct(100, 0)).toBe(0)
  })

  it('cannot exceed 100% even on bad data', () => {
    expect(supplySharePct(2_000_000_000, 1_000_000_000)).toBe(100)
  })
})

describe('formatting a share', () => {
  it('scales decimals so a small holder never reads as zero', () => {
    expect(formatSharePct(12.3456)).toBe('12.35%')
    expect(formatSharePct(0.5)).toBe('0.500%')
    expect(formatSharePct(0.001)).toBe('0.00100%')
  })

  it('has an explicit floor rather than rounding someone out of existence', () => {
    expect(formatSharePct(0.00001)).toBe('<0.0001%')
  })

  it('says zero when it really is zero', () => {
    expect(formatSharePct(0)).toBe('0%')
    expect(formatSharePct(NaN)).toBe('0%')
  })
})

describe('formatting token counts', () => {
  it('compacts by magnitude', () => {
    expect(formatTokens(1_500_000_000)).toBe('1.50B')
    expect(formatTokens(2_400_000)).toBe('2.40M')
    expect(formatTokens(3_400)).toBe('3.4K')
    expect(formatTokens(900)).toBe('900')
  })

  it('handles nothing at all', () => {
    expect(formatTokens(0)).toBe('0')
    expect(formatTokens(-5)).toBe('0')
    expect(formatTokens(NaN)).toBe('0')
  })
})

describe('holder standing', () => {
  const stats = { marketCapUsd: 500_000, priceUsd: 0.0005 }

  it('marks a disconnected wallet rather than claiming it holds zero', () => {
    const standing = holderStanding(null, stats)
    expect(standing.disconnected).toBe(true)
    expect(standing.balance).toBe(0)
  })

  it('reports share for a real holder', () => {
    const standing = holderStanding(10_000_000, stats)
    expect(standing.disconnected).toBe(false)
    expect(standing.sharePct).toBeCloseTo(1, 10)
    expect(standing.shareLabel).toBe('1.00%')
    expect(standing.balanceLabel).toBe('10.00M')
  })

  it('survives token stats being unavailable', () => {
    const standing = holderStanding(10_000_000, null)
    expect(standing.supply).toBe(FALLBACK_CIRCULATING_SUPPLY)
    expect(standing.sharePct).toBeCloseTo(1, 10)
  })
})

describe('tokens to the next step', () => {
  // A sample curve: one step per whole percent of supply held, capped at 5.
  const steps = (held: number, supply: number) => Math.min(5, Math.floor((held / supply) * 100))

  it('returns an amount that actually buys the next step, and is tight', () => {
    const supply = 1_000_000_000
    const held = 15_000_000 // 1.5% → 1 step
    const needed = tokensToNextStep(held, supply, steps, 5)!
    expect(needed).toBeGreaterThan(0)
    expect(steps(held + needed, supply)).toBe(2)
    expect(steps(held + needed - 1, supply)).toBe(1)
  })

  it('returns null at the cap so the UI can say "maxed" instead of an impossible target', () => {
    expect(tokensToNextStep(900_000_000, 1_000_000_000, steps, 5)).toBeNull()
  })

  it('handles a junk balance without throwing', () => {
    expect(tokensToNextStep(NaN, 1_000_000_000, steps, 5)).toBeGreaterThan(0)
  })
})
