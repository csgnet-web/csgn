/**
 * Re-settling token-weighted votes against LIVE balances.
 *
 * The problem this exists to fix: a ballot stores the weight the wallet held at
 * the moment it voted, and the tally is updated incrementally. That weight then
 * never changes — so the running tally is not a measure of tokens currently
 * backing an option, it's a measure of tokens that *once* backed it. Two
 * consequences, both bad:
 *
 *   1. Sell your bag after voting and your weight keeps counting forever.
 *   2. Vote, send the tokens to a fresh wallet, vote again — and the same coins
 *      count twice. Repeat for arbitrary inflation, at the cost of gas.
 *
 * The fix is to recompute from the chain: read every ballot, ask what each
 * wallet holds *right now*, and rebuild the tally from that. Tokens can only be
 * in one wallet at a time, so the cycling attack collapses to a single count and
 * a seller drops to zero.
 *
 * Live tallies stay incremental (cheap, instant, good enough to show on air).
 * The settled tally is the one that decides anything.
 */

import { getCsgnBalance } from './solana'

export interface BallotRow {
  wallet: string
  /** Which bucket this ballot backs — an option index for a vote, a symbol for the Meme-100. */
  key: string
}

export interface Cell { tokens: number; wallets: number }

/** Wallets read per batch. Keeps a settle from opening 200 RPC sockets at once. */
const RPC_BATCH = 8

/**
 * Live balance for each wallet, batched. A wallet whose balance can't be read
 * (RPC hiccup) is reported as null rather than 0, so a transient failure never
 * silently deletes someone's voting weight.
 */
export async function readLiveWeights(
  wallets: string[],
  balanceOf: (wallet: string) => Promise<number> = getCsgnBalance,
): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>()
  const unique = [...new Set(wallets)]
  for (let i = 0; i < unique.length; i += RPC_BATCH) {
    const batch = unique.slice(i, i + RPC_BATCH)
    const results = await Promise.all(batch.map(async (wallet) => {
      try {
        return { wallet, weight: Math.floor(await balanceOf(wallet)) }
      } catch {
        return { wallet, weight: null }
      }
    }))
    for (const r of results) out.set(r.wallet, r.weight)
  }
  return out
}

export interface SettleResult {
  tally: Record<string, Cell>
  /** Wallets that still hold a positive balance and therefore still count. */
  counted: number
  /** Wallets that voted and have since gone to zero — their weight is dropped. */
  dropped: number
  /** Wallets whose balance could not be read; their stored weight is kept as-is. */
  unread: number
}

/**
 * Rebuild a tally from ballots + live balances.
 *
 * `storedWeight` is used only as the fallback for a wallet the RPC couldn't
 * answer for — never as the primary. A wallet at zero is dropped entirely
 * (tokens AND its wallet count), because a wallet with no stake is not a voter.
 */
export function settleTally(
  ballots: Array<BallotRow & { storedWeight?: number }>,
  live: Map<string, number | null>,
): SettleResult {
  const tally: Record<string, Cell> = {}
  let counted = 0
  let dropped = 0
  let unread = 0

  for (const ballot of ballots) {
    const liveWeight = live.get(ballot.wallet)
    let weight: number
    if (liveWeight == null) {
      weight = Math.max(0, Math.floor(ballot.storedWeight || 0))
      unread++
    } else {
      weight = Math.max(0, liveWeight)
      if (weight > 0) counted++
      else { dropped++; continue }
    }
    if (weight <= 0) continue
    if (!tally[ballot.key]) tally[ballot.key] = { tokens: 0, wallets: 0 }
    tally[ballot.key].tokens += weight
    tally[ballot.key].wallets += 1
  }

  return { tally, counted, dropped, unread }
}
