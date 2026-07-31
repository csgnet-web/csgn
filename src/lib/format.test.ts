import { describe, it, expect } from 'vitest'
import { compact, compactUsd, formatPrice } from './format'

describe('compact / compactUsd', () => {
  it('abbreviates large numbers', () => {
    expect(compact(1_234_567)).toBe('1.23M')
    expect(compact(843_500)).toBe('843.5K')
    expect(compact(950)).toBe('950')
  })
  it('prefixes the dollar sign, and shows the placeholder for nothing to report', () => {
    expect(compactUsd(1_234_567)).toBe('$1.23M')
    expect(compactUsd(0)).toBe('—')
    expect(compactUsd(null)).toBe('—')
    expect(compactUsd(undefined)).toBe('—')
  })
})

describe('formatPrice — precision scales to magnitude', () => {
  it('uses 2 decimals at or above $1 (SOL, BTC…)', () => {
    expect(formatPrice(184.2)).toBe('$184.20')
    expect(formatPrice(1)).toBe('$1.00')
  })
  it('uses 4 decimals between a cent and a dollar', () => {
    expect(formatPrice(0.5)).toBe('$0.5000')
    expect(formatPrice(0.01)).toBe('$0.0100')
  })
  // The memecoin case: 2 decimals would render every $CSGN price as "$0.00".
  it('keeps significant digits on sub-cent memecoin prices', () => {
    expect(formatPrice(0.0000034)).toBe('$0.00000340')
    expect(formatPrice(0.000123)).toBe('$0.000123')
  })
  it('shows the placeholder rather than a fake zero when there is no price', () => {
    expect(formatPrice(0)).toBe('—')
    expect(formatPrice(-1)).toBe('—')
    expect(formatPrice(null)).toBe('—')
    expect(formatPrice(undefined)).toBe('—')
  })
})
