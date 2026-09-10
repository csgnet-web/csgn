/**
 * GIVING SOMEBODY A HANDLE WITHOUT ASKING THEM FOR ONE.
 *
 * Every sign-up door that is not the wallet arrives with a name we could
 * plausibly use — a TikTok handle, a Google display name — and a hard
 * requirement that a collision must never be a dead end. The one screen where a
 * stranger decides whether to bother is not the place to say "that name is
 * taken, try another".
 *
 * So: take what they came with if it can be made valid and is free, otherwise
 * mint one from a stable seed and walk salts until one lands. Stable matters —
 * retrying the same sign-up produces the same name rather than a different
 * stranger each time.
 *
 * This was written twice (finalizeSocialAccount had its own copy) before the
 * TikTok door would have made it three. Two implementations of "what are you
 * called" is two answers.
 */
import { getDoc } from './firebaseAdmin'
import { usernameKey } from './validators'

/** Same word lists as src/lib/username.ts, so a name suggested in the browser
 *  and a name minted here look like they came from the same product. */
const ADJECTIVES = [
  'Neon', 'Rapid', 'Golden', 'Silent', 'Prime', 'Wild', 'Solar', 'Iron',
  'Lucky', 'Bold', 'Swift', 'Vivid', 'Cobalt', 'Crimson', 'Onyx', 'Turbo',
  'Atomic', 'Cosmic', 'Rogue', 'Sharp', 'Bright', 'Frost', 'Hyper', 'Quantum',
]
const NOUNS = [
  'Ticker', 'Candle', 'Whale', 'Rally', 'Alpha', 'Chart', 'Runner', 'Anchor',
  'Signal', 'Vault', 'Pulse', 'Relay', 'Beacon', 'Circuit', 'Nova', 'Orbit',
  'Wire', 'Studio', 'Cutter', 'Feed', 'Static', 'Vector', 'Ledger', 'Prism',
]

function hash(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** A handle nobody had to invent. Deterministic for a given seed and salt. */
export function suggestUsername(seed: string, salt = 0): string {
  const h = hash(`${seed}:${salt}`)
  const adjective = ADJECTIVES[h % ADJECTIVES.length]
  const noun = NOUNS[(h >>> 8) % NOUNS.length]
  return `${adjective}${noun}${(h >>> 16) % 100}`
}

/**
 * Coerce whatever a provider gave us into something the username rules accept,
 * or answer null when there is nothing left to work with.
 *
 * Pure, and exported, because "@some.handle" becoming "somehandle" is the kind
 * of rule that wants a test rather than a hope.
 */
export function sanitizeHandle(raw: string): string | null {
  const cleaned = String(raw ?? '')
    .trim()
    .replace(/^@+/, '')
    // The rules are letters, digits and underscore. A dot or a dash in a TikTok
    // handle becomes an underscore rather than vanishing, so "big.dog" reads as
    // "big_dog" instead of "bigdog".
    .replace(/[.\-\s]+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20)
  // Under three characters is not a handle we can register, and padding it out
  // would invent a name that looks like theirs but is not.
  return cleaned.length >= 3 ? cleaned : null
}

/**
 * Find a free handle, preferring the one they arrived with.
 *
 * `seed` should be stable for the person (a provider id), never random, so a
 * retried sign-up converges on the same name.
 */
export async function allocateUsername(preferred: string, seed: string, maxSalts = 12): Promise<string | null> {
  const candidate = sanitizeHandle(preferred)
  if (candidate && !(await getDoc(`uniqueUsernames/${usernameKey(candidate)}`))) return candidate

  for (let salt = 0; salt < maxSalts; salt++) {
    const minted = suggestUsername(seed, salt)
    if (!(await getDoc(`uniqueUsernames/${usernameKey(minted)}`))) return minted
  }
  return null
}
