import { describe, it, expect } from 'vitest'
import {
  FALLBACK_CIRCULATING_SUPPLY, circulatingSupply, supplySharePct, formatSharePct,
  formatTokens, holderStanding, tokensToNextEntry,
} from './profile'
import { squaresAllowance, MAX_SQUARES_PER_WALLET, FREE_SQUARES } from './squares'
import { lineupAllowance, MAX_LINEUPS, FREE_LINEUPS } from './startingFive'

describe('circulating supply', () => {
  it('is derived from market cap over price, not hardcoded', () => {
    expect(circulatingSupply({ marketCapUsd: 4_000_000, priceUsd: 0.004 })).toBe(1_000_000_000)
    expect(circulatingSupply({ marketCapUsd: 900_000, priceUsd: 0.0009 })).toBe(1_000_000_000)
  })

  it('falls back when either input is missing or nonsensical', () => {
    for (const stats of [
      null,
      {},
      { marketCapUsd: 0, priceUsd: 0.004 },
      { marketCapUsd: 4_000_000, priceUsd: 0 },
      { marketCapUsd: -1, priceUsd: 0.004 },
      { marketCapUsd: Number.NaN, priceUsd: 0.004 },
    ]) {
      expect(circulatingSupply(stats)).toBe(FALLBACK_CIRCULATING_SUPPLY)
    }
  })
})

describe('supply share', () => {
  it('is a percentage of circulating supply', () => {
    expect(supplySharePct(10_000_000, 1_000_000_000)).toBe(1)
    expect(supplySharePct(500_000_000, 1_000_000_000)).toBe(50)
  })

  it('is zero for an empty, negative or unreadable balance', () => {
    expect(supplySharePct(0, 1_000_000_000)).toBe(0)
    expect(supplySharePct(-5, 1_000_000_000)).toBe(0)
    expect(supplySharePct(Number.NaN, 1_000_000_000)).toBe(0)
    expect(supplySharePct(100, 0)).toBe(0)
  })

  it('cannot exceed 100% even on bad data', () => {
    expect(supplySharePct(2_000_000_000, 1_000_000_000)).toBe(100)
  })
})

describe('formatting a share', () => {
  it('scales decimals so a small holder never reads as zero', () => {
    expect(formatSharePct(4.2)).toBe('4.20%')
    expect(formatSharePct(0.42)).toBe('0.420%')
    expect(formatSharePct(0.0042)).toBe('0.00420%')
  })

  it('has an explicit floor rather than rounding someone out of existence', () => {
    expect(formatSharePct(0.000005)).toBe('<0.0001%')
  })

  it('says zero when it really is zero', () => {
    expect(formatSharePct(0)).toBe('0%')
    expect(formatSharePct(Number.NaN)).toBe('0%')
  })
})

describe('formatting token counts', () => {
  it('compacts by magnitude', () => {
    expect(formatTokens(4_200_000_000)).toBe('4.20B')
    expect(formatTokens(4_200_000)).toBe('4.20M')
    expect(formatTokens(4_200)).toBe('4.2K')
    expect(formatTokens(420)).toBe('420')
  })

  it('handles nothing at all', () => {
    expect(formatTokens(0)).toBe('0')
    expect(formatTokens(Number.NaN)).toBe('0')
  })
})

describe('holder standing', () => {
  const stats = { marketCapUsd: 4_000_000, priceUsd: 0.004 } // 1B supply

  it('gives a disconnected wallet the FREE allowances, not zeroes', () => {
    const s = holderStanding(null, stats)
    expect(s.disconnected).toBe(true)
    expect(s.squares).toBe(FREE_SQUARES)
    expect(s.lineups).toBe(FREE_LINEUPS)
    expect(s.shareLabel).toBe('0%')
  })

  it('gives a zero-balance holder the same free allowances', () => {
    const s = holderStanding(0, stats)
    expect(s.disconnected).toBe(false)
    expect(s.squares).toBe(FREE_SQUARES)
    expect(s.lineups).toBe(FREE_LINEUPS)
  })

  it('reports share and entitlements for a real holder', () => {
    const s = holderStanding(10_000_000, stats) // 1% of supply
    expect(s.sharePct).toBe(1)
    expect(s.shareLabel).toBe('1.00%')
    expect(s.balanceLabel).toBe('10.00M')
    expect(s.squares).toBe(MAX_SQUARES_PER_WALLET)
    expect(s.lineups).toBe(MAX_LINEUPS)
  })

  it('never exceeds the caps', () => {
    const s = holderStanding(900_000_000, stats)
    expect(s.squares).toBe(s.squaresMax)
    expect(s.lineups).toBe(s.lineupsMax)
  })

  it('survives token stats being unavailable', () => {
    const s = holderStanding(10_000_000, null)
    expect(s.supply).toBe(FALLBACK_CIRCULATING_SUPPLY)
    expect(s.sharePct).toBe(1)
  })
})

describe('tokens to the next entry', () => {
  const SUPPLY = 1_000_000_000

  it('returns a positive amount that actually buys the next square', () => {
    const balance = 0
    const needed = tokensToNextEntry(balance, SUPPLY, squaresAllowance, MAX_SQUARES_PER_WALLET)!
    expect(needed).toBeGreaterThan(0)
    expect(squaresAllowance(balance + needed, SUPPLY)).toBeGreaterThan(squaresAllowance(balance, SUPPLY))
  })

  it('is tight — one token less does NOT buy the entry', () => {
    const balance = 0
    const needed = tokensToNextEntry(balance, SUPPLY, squaresAllowance, MAX_SQUARES_PER_WALLET)!
    expect(squaresAllowance(balance + needed - 1, SUPPLY)).toBe(squaresAllowance(balance, SUPPLY))
  })

  it('works the same for lineups', () => {
    const needed = tokensToNextEntry(0, SUPPLY, lineupAllowance, MAX_LINEUPS)!
    expect(lineupAllowance(needed, SUPPLY)).toBeGreaterThan(FREE_LINEUPS)
  })

  it('returns null at the cap so the UI can say "maxed" instead of an impossible target', () => {
    expect(tokensToNextEntry(10_000_000, SUPPLY, squaresAllowance, MAX_SQUARES_PER_WALLET)).toBeNull()
    expect(tokensToNextEntry(900_000_000, SUPPLY, lineupAllowance, MAX_LINEUPS)).toBeNull()
  })

  it('handles a junk balance without throwing', () => {
    expect(tokensToNextEntry(Number.NaN, SUPPLY, squaresAllowance, MAX_SQUARES_PER_WALLET)).toBeGreaterThan(0)
  })
})
