import { describe, it, expect } from 'vitest'
import { buildTokenStatsDoc, CSGN_MINT, type DexData } from '../_shared/feeCalc'

const fixture: DexData = {
  volumeH1Usd: 1200,
  volumeH24Usd: 48000,
  solPriceUsd: 150,
  marketCapSOL: 3200,
  priceUsd: 0.00048,
  marketCapUsd: 480000,
  priceChangeH24Pct: 12.5,
  liquidityUsd: 65000,
  pairUrl: 'https://dexscreener.com/solana/abc123',
}

describe('CSGN_MINT', () => {
  it('is the canonical pump.fun mint (must match src/lib/slots.ts)', () => {
    expect(CSGN_MINT).toBe('GFV7fphvprMr1PYpYGPJort2QP7JJLEp3J1Buu7Zpump')
  })
})

describe('buildTokenStatsDoc', () => {
  it('maps DexData fields onto the public/tokenStats shape', () => {
    const doc = buildTokenStatsDoc(fixture)
    expect(doc.priceUsd).toBe(0.00048)
    expect(doc.marketCapUsd).toBe(480000)
    expect(doc.volumeH24Usd).toBe(48000)
    expect(doc.priceChangeH24Pct).toBe(12.5)
    expect(doc.liquidityUsd).toBe(65000)
    expect(doc.solPriceUsd).toBe(150)
    expect(doc.pairUrl).toBe('https://dexscreener.com/solana/abc123')
    expect(doc.mint).toBe(CSGN_MINT)
    expect(Number.isFinite(Date.parse(doc.updatedAt))).toBe(true)
  })

  it('passes through zero defaults for missing optional pair fields', () => {
    const doc = buildTokenStatsDoc({ ...fixture, priceChangeH24Pct: 0, liquidityUsd: 0, pairUrl: '' })
    expect(doc.priceChangeH24Pct).toBe(0)
    expect(doc.liquidityUsd).toBe(0)
    expect(doc.pairUrl).toBe('')
  })
})
