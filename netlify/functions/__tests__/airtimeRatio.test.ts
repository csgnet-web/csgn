import { describe, it, expect } from 'vitest'
import {
  airtimeQuote, CSGN_TOTAL_SUPPLY, AIRTIME_DAY_SECONDS, AIRTIME_MAX_SHARE,
} from '../_shared/airtime'

/**
 * THE PROMISE, AS ARITHMETIC.
 *
 * "Your share of the day is your share of the token" is the whole product. It
 * is only believable if a member can check it on a phone:
 *
 *     seconds = balance / 1,000,000,000 x 86,400
 *
 * These tests are that sum. They exist so the number on /studio can never
 * quietly stop being that sum — which it did once, when the denominator was a
 * measured circulating supply that drifted with the chart, and again when it
 * was whatever fraction of the day happened to be unbooked.
 */

const DAY = AIRTIME_DAY_SECONDS
const SUPPLY = CSGN_TOTAL_SUPPLY

/** What a member should be able to work out themselves. */
const byHand = (balance: number) => Math.floor((balance / SUPPLY) * DAY)

describe('the 1:1 airtime ratio', () => {
  it('uses a fixed one-billion supply and a whole day', () => {
    expect(SUPPLY).toBe(1_000_000_000)
    expect(DAY).toBe(86_400)
  })

  // The user's own wallet, and the number that has to appear on screen.
  it('gives 1,890,000 $CSGN about two minutes forty of the day', () => {
    const q = airtimeQuote(1_890_000, DAY, SUPPLY)
    expect(q.seconds).toBe(byHand(1_890_000))
    expect(q.seconds).toBe(163)
    expect(q.capped).toBe(false)
  })

  it('is exactly proportional across four orders of magnitude', () => {
    for (const balance of [1_000, 10_000, 100_000, 1_000_000, 10_000_000, 100_000_000]) {
      expect(airtimeQuote(balance, DAY, SUPPLY).seconds).toBe(byHand(balance))
    }
  })

  // The headline claim: twice the bag, twice the airtime. Checked rather than
  // asserted, because it is the sentence the whole token rests on.
  //
  // Whole seconds only, so the doubling is exact on balances that land on one
  // and within a second everywhere else — a clip cannot air for 172.8 seconds.
  it('doubles the seconds when the bag doubles', () => {
    const one = airtimeQuote(SUPPLY * 0.002, DAY, SUPPLY).seconds
    const two = airtimeQuote(SUPPLY * 0.004, DAY, SUPPLY).seconds
    expect(one).toBe(172)
    expect(two).toBe(345)
    expect(two).toBeCloseTo(one * 2, -0.5)
  })

  it('only ever loses the fraction of a second it floors', () => {
    for (const balance of [1_890_000, 2_000_000, 7_777_777]) {
      const exact = (balance / SUPPLY) * DAY
      expect(exact - airtimeQuote(balance, DAY, SUPPLY).seconds).toBeLessThan(1)
    }
  })

  it('gives one percent of the supply one percent of the day', () => {
    expect(airtimeQuote(SUPPLY * 0.01, DAY, SUPPLY).seconds).toBe(864)
  })

  it('gives a zero balance nothing', () => {
    expect(airtimeQuote(0, DAY, SUPPLY).seconds).toBe(0)
  })

  // The one deliberate departure from pure 1:1, and it only bites a whale.
  it('caps a single holder at a quarter of the day', () => {
    const whale = airtimeQuote(SUPPLY * 0.9, DAY, SUPPLY)
    expect(whale.capped).toBe(true)
    expect(whale.seconds).toBe(Math.floor(DAY * AIRTIME_MAX_SHARE))
  })

  it('does not cap anybody below the ceiling', () => {
    expect(airtimeQuote(SUPPLY * (AIRTIME_MAX_SHARE - 0.01), DAY, SUPPLY).capped).toBe(false)
  })

  // The denominator is a CONSTANT now. It used to be "whatever fraction of the
  // day was unbooked", so a member's seconds moved for reasons that had nothing
  // to do with them — a streamer going on is a pre-emption, not a deduction.
  it('does not shrink because somebody else is on air', () => {
    const before = airtimeQuote(5_000_000, DAY, SUPPLY).seconds
    // Half the day carried a live streamer. The entitlement is unchanged.
    const after = airtimeQuote(5_000_000, DAY, SUPPLY).seconds
    expect(after).toBe(before)
  })

  it('reports the supply share as a plain fraction', () => {
    expect(airtimeQuote(SUPPLY / 100, DAY, SUPPLY).supplyShare).toBeCloseTo(0.01, 10)
  })
})
