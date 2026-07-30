import { describe, it, expect } from 'vitest'
import { readLiveWeights, settleTally } from '../_shared/settleVotes'

const ballot = (wallet: string, key: string, storedWeight = 0) => ({ wallet, key, storedWeight })

describe('settleTally — live balances decide, stored weights do not', () => {
  it('counts each wallet at what it actually holds now', () => {
    const { tally } = settleTally(
      [ballot('A', '0', 5_000), ballot('B', '1', 1_000)],
      new Map([['A', 9_000], ['B', 2_000]]),
    )
    expect(tally['0']).toEqual({ tokens: 9_000, wallets: 1 })
    expect(tally['1']).toEqual({ tokens: 2_000, wallets: 1 })
  })

  // The attack the incremental tally allowed: vote, move the coins to a fresh
  // wallet, vote again. Both weights stuck. Settling from live balances leaves
  // the tokens counted exactly once, wherever they actually sit.
  it('kills the vote-then-move-the-bag inflation', () => {
    const ballots = [ballot('A', '0', 10_000_000), ballot('B', '0', 10_000_000)]
    const incremental = ballots.reduce((sum, b) => sum + b.storedWeight, 0)
    expect(incremental).toBe(20_000_000) // what the running tally showed

    // In reality the 10M ended up in B; A is empty.
    const { tally, counted, dropped } = settleTally(ballots, new Map([['A', 0], ['B', 10_000_000]]))
    expect(tally['0']).toEqual({ tokens: 10_000_000, wallets: 1 })
    expect(counted).toBe(1)
    expect(dropped).toBe(1)
  })

  it('drops a wallet that sold everything after voting', () => {
    const { tally, dropped } = settleTally([ballot('A', 'BONK', 5_000_000)], new Map([['A', 0]]))
    expect(tally.BONK).toBeUndefined()
    expect(dropped).toBe(1)
  })

  it('keeps the stored weight when a balance cannot be read, never zeroes it', () => {
    // A transient RPC failure must not silently delete someone's vote.
    const { tally, unread } = settleTally([ballot('A', '0', 4_000)], new Map([['A', null]]))
    expect(tally['0']).toEqual({ tokens: 4_000, wallets: 1 })
    expect(unread).toBe(1)
  })

  it('sums several wallets backing the same option', () => {
    const { tally } = settleTally(
      [ballot('A', 'WIF'), ballot('B', 'WIF'), ballot('C', 'BONK')],
      new Map([['A', 100], ['B', 250], ['C', 700]]),
    )
    expect(tally.WIF).toEqual({ tokens: 350, wallets: 2 })
    expect(tally.BONK).toEqual({ tokens: 700, wallets: 1 })
  })

  it('returns an empty tally for no ballots', () => {
    expect(settleTally([], new Map())).toEqual({ tally: {}, counted: 0, dropped: 0, unread: 0 })
  })
})

describe('readLiveWeights', () => {
  it('reads every wallet once, even when repeated across ballots', async () => {
    const seen: string[] = []
    const weights = await readLiveWeights(['A', 'B', 'A'], async (w) => { seen.push(w); return 42 })
    expect(seen.sort()).toEqual(['A', 'B'])
    expect(weights.get('A')).toBe(42)
  })

  it('floors fractional balances', async () => {
    const weights = await readLiveWeights(['A'], async () => 10.9)
    expect(weights.get('A')).toBe(10)
  })

  it('reports null for a wallet the RPC could not answer for', async () => {
    const weights = await readLiveWeights(['A'], async () => { throw new Error('429') })
    expect(weights.get('A')).toBeNull()
  })

  it('batches instead of firing every wallet at once', async () => {
    let inFlight = 0
    let peak = 0
    const wallets = Array.from({ length: 25 }, (_, i) => `w${i}`)
    await readLiveWeights(wallets, async () => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await new Promise((r) => setTimeout(r, 1))
      inFlight--
      return 1
    })
    expect(peak).toBeLessThanOrEqual(8)
  })
})
