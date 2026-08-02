/**
 * Deterministic, publicly re-derivable randomness.
 *
 * Every random moment in a CSGN game — the Squares digit draw, a tiebreak — has
 * to survive the only question that matters to a crypto audience: "how do I know
 * you didn't rig it?" The answer here is that we never generate randomness. We
 * *derive* it, from a seed that is published, that nobody (including us) could
 * predict while entries were still open, and that anyone can feed back through
 * these same pure functions to reproduce the result byte for byte.
 *
 * The seed is a Solana blockhash sampled AFTER entries close (see
 * `SeedCommitment`). That gives three properties for free:
 *
 *   1. Unpredictable at entry time — no one knows the hash of a block that
 *      hasn't been produced yet.
 *   2. Unforgeable after the fact — the hash is on-chain at a known slot, so a
 *      "different" seed is trivially disproven.
 *   3. Verifiable by a stranger — blockhash + these functions = the same board.
 *
 * The PRNG below is xmur3 (seed hashing) + sfc32 (generator): tiny, well-known,
 * and identical in any language, which matters because a verifier should be able
 * to re-implement it in ten lines of Python and get our exact answer.
 */

/** Hash an arbitrary seed string into four 32-bit words for the generator. */
function xmur3(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return h >>> 0
  }
}

/**
 * A seeded [0,1) generator. Same seed → same sequence, on any machine, forever.
 * Never use `Math.random()` anywhere a result decides who gets paid.
 */
export function seededRandom(seed: string): () => number {
  const h = xmur3(seed)
  let a = h(), b = h(), c = h(), d = h()
  return () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0
    let t = (a + b) >>> 0
    a = b ^ (b >>> 9)
    b = (c + (c << 3)) >>> 0
    c = (c << 21) | (c >>> 11)
    d = (d + 1) >>> 0
    t = (t + d) >>> 0
    c = (c + t) >>> 0
    return (t >>> 0) / 4294967296
  }
}

/**
 * Fisher-Yates, driven by the seeded generator. Returns a new array — the input
 * is never mutated, so a caller can show "before" and "after" side by side.
 *
 * Drawn back-to-front with an inclusive index, which is the unbiased form; the
 * common `Math.floor(random() * length)` swap-anywhere variant is subtly biased
 * and would be a real (if small) unfairness in a 10-digit draw.
 */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const out = [...items]
  const rand = seededRandom(seed)
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * The public record of where a game's randomness came from. Written to the game
 * doc at draw time and rendered on the results screen, so "verify this yourself"
 * is a link and a paragraph rather than a support ticket.
 */
export interface SeedCommitment {
  /** The Solana blockhash used as the seed. */
  blockhash: string
  /** The slot that blockhash belongs to — the anchor a verifier looks up. */
  slot: number
  /** When the seed was sampled. Must be after the entry deadline. */
  sampledAt: string
  /** Extra entropy bound in so two games sharing a blockhash still differ. */
  gameId: string
}

/**
 * The exact string fed to the generator. Binding the gameId in means two games
 * that happen to draw against the same block don't produce identical boards —
 * a real risk, since a Solana slot is 400ms and our games settle in batches.
 */
export function seedString(commitment: SeedCommitment): string {
  return `${commitment.blockhash}:${commitment.slot}:${commitment.gameId}`
}

/**
 * Is this commitment usable? A seed sampled before entries closed is worthless —
 * whoever saw it first could have picked their squares around it — so a game
 * that can't prove "seed came after close" must not be allowed to settle.
 */
export function isSeedValid(commitment: SeedCommitment | null | undefined, entriesClosedAt: string): boolean {
  if (!commitment) return false
  if (!commitment.blockhash || commitment.blockhash.length < 32) return false
  if (!Number.isFinite(commitment.slot) || commitment.slot <= 0) return false
  const sampled = Date.parse(commitment.sampledAt)
  const closed = Date.parse(entriesClosedAt)
  if (!Number.isFinite(sampled) || !Number.isFinite(closed)) return false
  return sampled >= closed
}
