/**
 * Public, discoverable member profiles.
 *
 * A network of people you can't find is a list, not a network. This is the read
 * side of discoverability: a recommended set of members for the profile page,
 * and a single lookup by username for a public profile route.
 *
 * WHY THIS IS A FUNCTION AND NOT A FIRESTORE QUERY: `users/{uid}` documents hold
 * emails, wallet addresses and role flags, and `firestore.rules` correctly lets
 * a signed-in user read only their own. Opening that up for a "browse members"
 * feature would leak every field to everyone. Instead the server reads with the
 * admin SDK and returns a hand-written projection — `toPublicProfile` below is
 * the ONLY place that decides what leaves this collection, so there is exactly
 * one line to audit when someone asks "can people see my email?".
 *
 * (They can't. Email is never in the projection.)
 */

import { json, requireMethod, withHttp } from './_shared/http'
import { badRequest } from './_shared/errors'
import { fieldFilter, queryCollection } from './_shared/firebaseAdmin'
import { checkRateLimit, clientIp } from './_shared/rateLimit'

/** Everything a stranger may see. Add a field here and you have published it. */
export interface PublicProfile {
  username: string
  displayName: string
  avatarUrl: string
  role: string
  /** Twitch login, when linked and verified. The whole point of discovery. */
  twitch: string
  bio: string
  /** Lifetime slots streamed — the one number that says "this member is real". */
  slots: number
  /** Lifetime $CSGN won across the games. */
  winnings: number
}

type UserRow = Record<string, unknown>

const str = (v: unknown, max = 120): string => String(v ?? '').trim().slice(0, max)
const num = (v: unknown): number => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : 0)

/**
 * The projection. Deliberately explicit — a spread of the user doc with a few
 * deletes would leak every field somebody adds later, which is exactly the bug
 * class this function exists to prevent.
 */
export function toPublicProfile(row: UserRow): PublicProfile | null {
  const username = str(row.username, 20)
  if (!username) return null
  if (row.status === 'disabled') return null

  const twitch = (row.twitch ?? {}) as Record<string, unknown>
  const stats = (row.gameStats ?? {}) as Record<string, unknown>
  const linked = twitch.verified === true

  return {
    username,
    displayName: str(row.displayName, 40) || username,
    avatarUrl: linked ? str(twitch.profileImageUrl, 300) : '',
    role: str(row.role, 20) || 'viewer',
    twitch: linked ? str(twitch.username, 40) : '',
    bio: str(row.bio, 200),
    slots: num(row.slotsCompleted),
    winnings: num(stats.winningsCsgn),
  }
}

/**
 * Rank members for the "Recommended" rail.
 *
 * Linked-Twitch first, then by slots streamed, then by winnings. The ordering is
 * a value judgement and worth stating: we surface people who can actually GO
 * LIVE, because the point of discovery here is finding someone to watch — not
 * ranking members by how much they hold. A leaderboard by bag size would be
 * easier to compute and would make the network worse.
 */
export function rankProfiles(profiles: PublicProfile[]): PublicProfile[] {
  return [...profiles].sort((a, b) => {
    const live = Number(Boolean(b.twitch)) - Number(Boolean(a.twitch))
    if (live !== 0) return live
    if (b.slots !== a.slots) return b.slots - a.slots
    if (b.winnings !== a.winnings) return b.winnings - a.winnings
    return a.username.localeCompare(b.username)
  })
}

const MAX_LIMIT = 24

export const handler = withHttp(async (event) => {
  requireMethod(event, 'GET')
  await checkRateLimit(clientIp(event), 'publicProfiles', 60)

  const q = event.queryStringParameters || {}
  const username = str(q.username, 20).toLowerCase()
  const exclude = str(q.exclude, 64)
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(q.limit) || 8))

  // Single profile by username — powers /u/:username.
  if (username) {
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) throw badRequest('Invalid username.', 'invalid_username')
    const rows = await queryCollection('users', [fieldFilter('usernameLower', 'EQUAL', username)], [], 1)
    const profile = rows[0] ? toPublicProfile(rows[0].data) : null
    return json(200, { profile })
  }

  // Recommended set. Bounded read — never an unbounded scan of the collection.
  const rows = await queryCollection('users', [fieldFilter('status', 'EQUAL', 'active')], [], MAX_LIMIT * 3)
  const profiles = rankProfiles(
    rows
      .map((r) => toPublicProfile(r.data))
      .filter((p): p is PublicProfile => p !== null)
      .filter((p) => p.username.toLowerCase() !== exclude.toLowerCase()),
  ).slice(0, limit)

  return json(200, { profiles })
})
