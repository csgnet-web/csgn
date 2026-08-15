/**
 * A username the user does not have to think of.
 *
 * The sign-up is one signature and one field, and the field was the slower
 * half: picking a name is a decision, decisions on a phone keyboard are where
 * people leave, and "csgn_user" sitting in a placeholder is not a suggestion —
 * it's a blank. So the field arrives filled in with something that already
 * looks like a handle, valid on the first render, and the primary button is
 * live the moment the wallet is proven. Editing it is one tap for the people
 * who care; everyone else is done.
 *
 * Derived from the wallet address rather than random, so it is stable: a user
 * who backs out and starts again sees the same name instead of wondering
 * which one was theirs. Collisions are possible (57,600 combinations) and are
 * handled the way every other taken name is — the server says so and the field
 * is right there, already focused.
 */

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/

export function isValidUsername(value: string): boolean {
  return USERNAME_RE.test(value.trim())
}

/** Broadcast-and-markets flavoured, deliberately short: adjective + noun + two
 *  digits never exceeds the 20-character limit. */
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

/** Small, stable, non-cryptographic hash — this only has to spread evenly. */
function hash(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function suggestUsername(seed: string): string {
  const clean = String(seed || '').trim()
  if (!clean) return 'NeonTicker01'
  const h = hash(clean)
  const adjective = ADJECTIVES[h % ADJECTIVES.length]
  const noun = NOUNS[Math.floor(h / ADJECTIVES.length) % NOUNS.length]
  const digits = String(Math.floor(h / (ADJECTIVES.length * NOUNS.length)) % 100).padStart(2, '0')
  return `${adjective}${noun}${digits}`
}
