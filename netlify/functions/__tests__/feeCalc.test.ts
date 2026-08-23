import { describe, it, expect } from 'vitest'
import {
  buildTokenStatsDoc,
  payableAirtime,
  airtimeStartMs,
  airtimeAppliesToSlot,
  AIRTIME_DEFAULT_START_AT,
  AIRTIME_FULL_CREDIT,
  AIRTIME_FLOOR,
  AIRTIME_MIN_SAMPLES,
  CSGN_MINT,
  type DexData,
} from '../_shared/feeCalc'

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

// ── payableAirtime — the function that decides what a streamed hour is worth ──
//
// Every case here is a way this gets somebody's money wrong. The denominator
// tests matter most: dividing by slot minutes instead of samples taken would
// silently bill our own scheduler drift to the streamer, and nothing downstream
// would ever show that it happened.

describe('payableAirtime', () => {
  const airtime = (liveCheckCount: number, checkCount: number) => payableAirtime({ liveCheckCount, checkCount })

  it('pays in full for an hour streamed end to end', () => {
    expect(airtime(60, 60)).toEqual({ fraction: 1, ratio: 1, reason: 'full' })
  })

  it('pays in full inside the grace band — a BRB or an encoder restart costs nothing', () => {
    // 51/60 = 0.85 exactly: the boundary is inclusive, so a stream that loses
    // nine minutes of an hour is still a stream that happened.
    expect(airtime(51, 60).reason).toBe('full')
    expect(airtime(51, 60).fraction).toBe(1)
    expect(airtime(57, 60).fraction).toBe(1)
  })

  it('pro-rates the middle band by the share of samples actually live', () => {
    const half = airtime(30, 60)
    expect(half.reason).toBe('prorated')
    expect(half.ratio).toBeCloseTo(0.5, 10)
    // Pro-rated means what it says — half the hour pays half the fee, not a
    // rescaled curve that would penalise the same minutes twice.
    expect(half.fraction).toBeCloseTo(0.5, 10)

    // Just under full credit is still pro-rated, and just above the floor pays.
    expect(airtime(50, 60).reason).toBe('prorated')
    expect(airtime(13, 60).fraction).toBeCloseTo(13 / 60, 10)
  })

  it('pays nothing below the floor', () => {
    const noShow = airtime(5, 60)
    expect(noShow.reason).toBe('no_show')
    expect(noShow.fraction).toBe(0)
    expect(noShow.ratio).toBeCloseTo(5 / 60, 10)
    // The floor itself is the first paying ratio, so 20% is prorated, not void.
    expect(airtime(12, 60).reason).toBe('prorated')
    expect(airtime(0, 60)).toEqual({ fraction: 0, ratio: 0, reason: 'no_show' })
  })

  it('fails OPEN on thin telemetry — pays in full and flags for review', () => {
    // Nine samples cannot judge an hour. That is our failure, not theirs.
    const thin = airtime(0, AIRTIME_MIN_SAMPLES - 1)
    expect(thin.reason).toBe('unverified')
    expect(thin.fraction).toBe(1)
    expect(airtime(9, 9).reason).toBe('unverified')
  })

  it('never divides by zero when no sample was ever taken', () => {
    expect(airtime(0, 0)).toEqual({ fraction: 1, ratio: 0, reason: 'unverified' })
    expect(Number.isFinite(airtime(0, 0).ratio)).toBe(true)
    // A slot logged before checkCount existed: live samples, no denominator.
    expect(airtime(40, 0).fraction).toBe(1)
  })

  // THE OUTAGE CASE from the plan's verification list. A 60-minute slot where
  // the poller only managed 30 runs and saw the channel live in 29 of them is a
  // streamer who was on air the whole hour. Divide by 60 and they lose half
  // their fee for our downtime.
  it('does not dock a streamer for a poller outage', () => {
    const result = airtime(29, 30)
    expect(result.reason).toBe('full')
    expect(result.fraction).toBe(1)
    expect(result.fraction).not.toBeCloseTo(29 / 60, 2)
  })

  it('clamps corrupt telemetry instead of paying more than the fee', () => {
    // liveCheckCount > checkCount can only be a migration artefact; it must not
    // produce a ratio above 1 or a fraction that inflates the payout.
    const result = airtime(80, 60)
    expect(result.ratio).toBe(1)
    expect(result.fraction).toBe(1)
  })

  it('ignores negative, fractional and non-numeric inputs', () => {
    expect(airtime(-5, 60).reason).toBe('no_show')
    expect(airtime(30.7, 60).fraction).toBeCloseTo(30 / 60, 10)
    expect(payableAirtime({ liveCheckCount: NaN, checkCount: NaN }).reason).toBe('unverified')
    expect(payableAirtime({} as { liveCheckCount: number; checkCount: number }).fraction).toBe(1)
  })

  it('keeps the published bands where the policy says they are', () => {
    expect(AIRTIME_FULL_CREDIT).toBe(0.85)
    expect(AIRTIME_FLOOR).toBe(0.20)
    expect(AIRTIME_MIN_SAMPLES).toBe(10)
  })
})

// ── The cutover gate ──
// Changing what a finished hour owed, after the fact, is the credibility loss
// this product is built against.

describe('airtimeStartMs', () => {
  it('reads the cutover from config/season', () => {
    expect(airtimeStartMs({ airtimeStartAt: '2026-09-01T00:00:00.000Z' })).toBe(Date.parse('2026-09-01T00:00:00.000Z'))
  })

  it('falls back to the shipped default when config is missing or unusable', () => {
    const fallback = Date.parse(AIRTIME_DEFAULT_START_AT)
    expect(airtimeStartMs(null)).toBe(fallback)
    expect(airtimeStartMs(undefined)).toBe(fallback)
    expect(airtimeStartMs({})).toBe(fallback)
    // A typo must not silently switch the rule off for every slot.
    expect(airtimeStartMs({ airtimeStartAt: 'next tuesday' })).toBe(fallback)
    expect(airtimeStartMs({ airtimeStartAt: 42 })).toBe(fallback)
  })
})

describe('airtimeAppliesToSlot', () => {
  const cutover = Date.parse('2026-09-01T00:00:00.000Z')

  it('never reaches a slot that started before the cutover', () => {
    expect(airtimeAppliesToSlot('2026-08-31T23:00:00.000Z', cutover)).toBe(false)
    expect(airtimeAppliesToSlot('2025-01-01T00:00:00.000Z', cutover)).toBe(false)
  })

  it('applies from the cutover instant onward', () => {
    expect(airtimeAppliesToSlot('2026-09-01T00:00:00.000Z', cutover)).toBe(true)
    expect(airtimeAppliesToSlot('2026-09-01T03:00:00.000Z', cutover)).toBe(true)
  })

  it('leaves a slot alone when its start time is missing or unreadable', () => {
    expect(airtimeAppliesToSlot(undefined, cutover)).toBe(false)
    expect(airtimeAppliesToSlot('', cutover)).toBe(false)
    expect(airtimeAppliesToSlot('whenever', cutover)).toBe(false)
  })
})
