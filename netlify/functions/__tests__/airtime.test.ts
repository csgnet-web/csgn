import { describe, it, expect } from 'vitest'
import {
  airtimeShares, deriveAirtimeWindows, windowSeconds, buildAirtimeSchedule,
  AIRTIME_FLOOR_SECONDS, AIRTIME_MAX_SHARE,
  type AirtimeMember, type AirtimeClip,
} from '../_shared/airtime'

const SUPPLY = 1_000_000_000
const HOUR = 3_600_000
const T0 = Date.parse('2026-08-17T12:00:00.000Z')

const member = (uid: string, balance: number, clipSeconds = 600): AirtimeMember => ({ uid, balance, clipSeconds })

describe('airtimeShares', () => {
  it('splits 1:1 with tokens held', () => {
    // The headline rule: a 3× bag gets 3× the airtime. Isolated from the floor
    // and the cap (both tested below) and given more content than either member
    // could possibly air, so the ratio is the only thing under test.
    const out = airtimeShares(
      [member('a', 30_000_000, 100_000), member('b', 10_000_000, 100_000)],
      10_000, SUPPLY, { floorSeconds: 0, maxShare: 1 },
    )
    const a = out.find((x) => x.uid === 'a')!.seconds
    const b = out.find((x) => x.uid === 'b')!.seconds
    expect(a / b).toBeCloseTo(3, 1)
  })

  it('keeps an opened floor equal and applies the ratio only to what is left', () => {
    const out = airtimeShares(
      [member('a', 30_000_000, 100_000), member('b', 10_000_000, 100_000)],
      10_000, SUPPLY, { maxShare: 1, floorSeconds: 30 },
    )
    const a = out.find((x) => x.uid === 'a')!.seconds - 30
    const b = out.find((x) => x.uid === 'b')!.seconds - 30
    expect(a / b).toBeCloseTo(3, 1)
  })

  // With very few members a 25% ceiling cannot be satisfied AND the day filled —
  // two members can take at most half of it between them. The remainder is left
  // unallocated on purpose and falls through to house content. Forcing it out
  // would mean quietly ignoring the cap the moment the network is small, which
  // is exactly when one holder dominating is most likely.
  it('leaves inventory unallocated rather than breaching the cap on a small network', () => {
    const out = airtimeShares([member('a', 30_000_000, 100_000), member('b', 10_000_000, 100_000)], 10_000, SUPPLY)
    const total = out.reduce((sum, x) => sum + x.seconds, 0)
    expect(total).toBeLessThanOrEqual(10_000 * AIRTIME_MAX_SHARE * 2)
    expect(out.every((x) => x.capped)).toBe(true)
  })

  // AIRTIME IS WHAT THE TOKEN BUYS. A member holding nothing gets no airtime —
  // not a token slice, none — because a free floor for everybody would make the
  // number meaningless and dilute the people who actually hold.
  //
  // This is not an access gate: the same member can still make an account, claim
  // a two-hour block and go live holding zero. Airtime is promotion.
  it('gives a member holding nothing no airtime at all', () => {
    const out = airtimeShares([member('whale', 500_000_000), member('nobody', 0)], 10_000, SUPPLY)
    expect(out.find((x) => x.uid === 'nobody')).toBeUndefined()
    expect(out.find((x) => x.uid === 'whale')).toBeDefined()
  })

  it('ships with no floor, but can still open one for a promotion', () => {
    expect(AIRTIME_FLOOR_SECONDS).toBe(0)
    const promo = airtimeShares([member('nobody', 0)], 10_000, SUPPLY, { floorSeconds: 60 })
    expect(promo.find((x) => x.uid === 'nobody')?.seconds).toBeGreaterThanOrEqual(60)
  })

  it('caps a whale and redistributes what it claws back', () => {
    const out = airtimeShares(
      [member('whale', 900_000_000, 100_000), member('b', 1_000_000), member('c', 1_000_000)],
      10_000,
      SUPPLY,
    )
    const whale = out.find((x) => x.uid === 'whale')!
    expect(whale.capped).toBe(true)
    expect(whale.seconds).toBeLessThanOrEqual(Math.ceil(10_000 * AIRTIME_MAX_SHARE))
    // The clawback went somewhere — the others are well above a bare floor.
    expect(out.find((x) => x.uid === 'b')!.seconds).toBeGreaterThan(AIRTIME_FLOOR_SECONDS)
  })

  it('honours an uncapped pure 1:1 split when asked for one', () => {
    const out = airtimeShares(
      [member('whale', 900_000_000, 100_000), member('b', 100_000_000, 100_000)],
      10_000,
      SUPPLY,
      { maxShare: 1, floorSeconds: 0 },
    )
    const whale = out.find((x) => x.uid === 'whale')!
    expect(whale.capped).toBe(false)
    expect(whale.seconds / 10_000).toBeGreaterThan(0.85)
  })

  it('supports the sub-linear curve as an alternative', () => {
    const linear = airtimeShares([member('a', 40_000_000, 100_000), member('b', 10_000_000, 100_000)], 10_000, SUPPLY, { maxShare: 1, floorSeconds: 0 })
    const sqrt = airtimeShares([member('a', 40_000_000, 100_000), member('b', 10_000_000, 100_000)], 10_000, SUPPLY, { maxShare: 1, floorSeconds: 0, weightMode: 'sqrt' })
    const ratio = (out: typeof linear) => out.find((x) => x.uid === 'a')!.seconds / out.find((x) => x.uid === 'b')!.seconds
    expect(ratio(linear)).toBeCloseTo(4, 0)   // 4× the bag, 4× the airtime
    expect(ratio(sqrt)).toBeCloseTo(2, 0)     // 4× the bag, 2× the airtime
  })

  it('never allocates more than a member has content for', () => {
    const out = airtimeShares([member('a', 500_000_000, 45), member('b', 1_000_000, 5_000)], 10_000, SUPPLY)
    expect(out.find((x) => x.uid === 'a')!.seconds).toBeLessThanOrEqual(45)
  })

  it('excludes members with nothing to air', () => {
    const out = airtimeShares([member('a', 500_000_000, 0)], 10_000, SUPPLY)
    expect(out).toEqual([])
  })

  it('shares an opened floor when there are more members than seconds', () => {
    const members = Array.from({ length: 100 }, (_, i) => member(`m${i}`, 1_000, 600))
    const out = airtimeShares(members, 1_000, SUPPLY, { floorSeconds: 30 })
    expect(out.reduce((sum, a) => sum + a.seconds, 0)).toBeLessThanOrEqual(1_000)
  })

  it('survives zero inventory, zero supply and junk input without throwing', () => {
    expect(airtimeShares([member('a', 1_000)], 0, SUPPLY)).toEqual([])
    expect(airtimeShares([], 10_000, SUPPLY)).toEqual([])
    const noSupply = airtimeShares([member('a', 1_000), member('b', 2_000)], 10_000, 0)
    expect(noSupply.every((a) => Number.isFinite(a.seconds))).toBe(true)
    // NaN balance reads as zero held, which now means no airtime rather than a
    // free slice — junk input must never be more generous than a real zero.
    expect(airtimeShares([{ uid: 'x', balance: NaN, clipSeconds: 600 }], 10_000, SUPPLY)).toEqual([])
  })

  it('is deterministic — two runs over the same input are identical', () => {
    const input = [member('a', 5_000_000), member('b', 5_000_000), member('c', 1_000)]
    expect(airtimeShares(input, 10_000, SUPPLY)).toEqual(airtimeShares(input, 10_000, SUPPLY))
  })

  it('never allocates more than the inventory in total', () => {
    const members = Array.from({ length: 40 }, (_, i) => member(`m${i}`, i * 1_000_000, 10_000))
    const total = airtimeShares(members, 20_000, SUPPLY).reduce((sum, a) => sum + a.seconds, 0)
    expect(total).toBeLessThanOrEqual(20_000)
  })
})

// ── The 16-hour / 24-hour toggle ──
//
// There is deliberately no branch for it. The owner's block either arrives as a
// blocked range or it does not, and the same subtraction produces both shapes.

describe('deriveAirtimeWindows', () => {
  it('returns the whole horizon when nothing is blocked', () => {
    const w = deriveAirtimeWindows(T0, T0 + 24 * HOUR, [])
    expect(w).toEqual([{ startMs: T0, endMs: T0 + 24 * HOUR }])
    expect(windowSeconds(w)).toBe(24 * 3600)
  })

  it('subtracts the owner block, leaving the 16-hour open window', () => {
    const block = { startMs: T0 + 8 * HOUR, endMs: T0 + 16 * HOUR }
    expect(windowSeconds(deriveAirtimeWindows(T0, T0 + 24 * HOUR, [block]))).toBe(16 * 3600)
  })

  it('gives the same arithmetic 24 hours once the block is toggled off', () => {
    expect(windowSeconds(deriveAirtimeWindows(T0, T0 + 24 * HOUR, []))).toBe(24 * 3600)
  })

  it('subtracts claimed live slots as well', () => {
    const w = deriveAirtimeWindows(T0, T0 + 6 * HOUR, [{ startMs: T0 + 2 * HOUR, endMs: T0 + 4 * HOUR }])
    expect(w).toEqual([
      { startMs: T0, endMs: T0 + 2 * HOUR },
      { startMs: T0 + 4 * HOUR, endMs: T0 + 6 * HOUR },
    ])
  })

  it('merges overlapping and adjacent blocks instead of double-subtracting', () => {
    const w = deriveAirtimeWindows(T0, T0 + 8 * HOUR, [
      { startMs: T0 + 1 * HOUR, endMs: T0 + 3 * HOUR },
      { startMs: T0 + 2 * HOUR, endMs: T0 + 5 * HOUR },
    ])
    expect(w).toEqual([
      { startMs: T0, endMs: T0 + 1 * HOUR },
      { startMs: T0 + 5 * HOUR, endMs: T0 + 8 * HOUR },
    ])
  })

  it('never returns a window in the past, or one too short to hold a segment', () => {
    expect(deriveAirtimeWindows(T0, T0 - HOUR, [])).toEqual([])
    expect(deriveAirtimeWindows(T0, T0 + 2_000, [])).toEqual([])
    const w = deriveAirtimeWindows(T0, T0 + 4 * HOUR, [{ startMs: T0 - 5 * HOUR, endMs: T0 + 1 * HOUR }])
    expect(w[0].startMs).toBe(T0 + 1 * HOUR)
  })

  it('returns nothing when the whole horizon is blocked', () => {
    expect(deriveAirtimeWindows(T0, T0 + 2 * HOUR, [{ startMs: T0 - HOUR, endMs: T0 + 3 * HOUR }])).toEqual([])
  })
})

describe('buildAirtimeSchedule', () => {
  const clip = (clipId: string, uid: string, seconds: number, order = 0): AirtimeClip => ({
    clipId, uid, username: uid, url: `https://cdn/${clipId}.mp4`, title: clipId, seconds, order,
  })
  const window = [{ startMs: T0, endMs: T0 + HOUR }]

  it('lays clips on the clock back to back', () => {
    const items = buildAirtimeSchedule(
      [{ uid: 'a', seconds: 60, supplyShare: 0.01, capped: false }],
      [clip('c1', 'a', 30, 0), clip('c2', 'a', 30, 1)],
      window,
    )
    expect(items).toHaveLength(2)
    expect(items[0].startsAt).toBe(new Date(T0).toISOString())
    expect(items[1].startsAt).toBe(items[0].endsAt)
  })

  it("respects the member's own ordering", () => {
    const items = buildAirtimeSchedule(
      [{ uid: 'a', seconds: 60, supplyShare: 0.01, capped: false }],
      [clip('second', 'a', 20, 5), clip('first', 'a', 20, 1)],
      window,
    )
    expect(items.map((i) => i.clipId)).toEqual(['first', 'second', 'first'])
  })

  it('round-robins members so the channel changes hands', () => {
    const items = buildAirtimeSchedule(
      [
        { uid: 'a', seconds: 60, supplyShare: 0.03, capped: false },
        { uid: 'b', seconds: 60, supplyShare: 0.01, capped: false },
      ],
      [clip('a1', 'a', 30), clip('a2', 'a', 30), clip('b1', 'b', 30), clip('b2', 'b', 30)],
      window,
    )
    // Not four of a's in a row — the uid alternates.
    expect(items.slice(0, 4).map((i) => i.uid)).toEqual(['a', 'b', 'a', 'b'])
  })

  it('never exceeds a member allocation', () => {
    const items = buildAirtimeSchedule(
      [{ uid: 'a', seconds: 45, supplyShare: 0.01, capped: false }],
      [clip('c1', 'a', 30)],
      window,
    )
    expect(items.reduce((s, i) => s + i.seconds, 0)).toBeLessThanOrEqual(45)
  })

  it('never runs a segment past the end of its window', () => {
    const items = buildAirtimeSchedule(
      [{ uid: 'a', seconds: 600, supplyShare: 0.01, capped: false }],
      [clip('c1', 'a', 100)],
      [{ startMs: T0, endMs: T0 + 250_000 }],
    )
    for (const item of items) expect(Date.parse(item.endsAt)).toBeLessThanOrEqual(T0 + 250_000)
  })

  it('spans multiple windows, skipping the blocked stretch between them', () => {
    const items = buildAirtimeSchedule(
      [{ uid: 'a', seconds: 600, supplyShare: 0.01, capped: false }],
      [clip('c1', 'a', 60)],
      [{ startMs: T0, endMs: T0 + 120_000 }, { startMs: T0 + HOUR, endMs: T0 + HOUR + 120_000 }],
    )
    expect(items.some((i) => Date.parse(i.startsAt) >= T0 + HOUR)).toBe(true)
    // Nothing landed inside the blocked stretch.
    expect(items.every((i) => Date.parse(i.startsAt) < T0 + 120_000 || Date.parse(i.startsAt) >= T0 + HOUR)).toBe(true)
  })

  it('is deterministic — the preview a member is shown has to be the truth', () => {
    const allocations = [
      { uid: 'a', seconds: 120, supplyShare: 0.02, capped: false },
      { uid: 'b', seconds: 60, supplyShare: 0.01, capped: false },
    ]
    const clips = [clip('a1', 'a', 30), clip('b1', 'b', 30)]
    expect(buildAirtimeSchedule(allocations, clips, window)).toEqual(buildAirtimeSchedule(allocations, clips, window))
  })

  it('drops clips too short to air and clamps ones too long', () => {
    const items = buildAirtimeSchedule(
      [{ uid: 'a', seconds: 600, supplyShare: 0.01, capped: false }],
      [clip('tiny', 'a', 1), clip('huge', 'a', 9_999, 1)],
      window,
    )
    expect(items.every((i) => i.clipId !== 'tiny')).toBe(true)
    expect(items.every((i) => i.seconds <= 120)).toBe(true)
  })

  it('returns nothing rather than dead air when there is nothing to place', () => {
    expect(buildAirtimeSchedule([], [], window)).toEqual([])
    expect(buildAirtimeSchedule([{ uid: 'a', seconds: 60, supplyShare: 0, capped: false }], [], window)).toEqual([])
    expect(buildAirtimeSchedule([{ uid: 'a', seconds: 60, supplyShare: 0, capped: false }], [clip('c', 'a', 30)], [])).toEqual([])
  })
})
