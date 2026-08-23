/**
 * Change your username.
 *
 * ── Why this needs a whole endpoint ────────────────────────────────────────
 *
 * A username here is not just a label. It is an INDEX: `uniqueUsernames/{key}`
 * is a real document whose existence is what stops two members holding the same
 * handle, and it is denormalised onto slots (`assignedUsername`, `assignedName`)
 * and clips (`username`) so the broadcast and the review queue can render a name
 * without a join.
 *
 * So a change is four things that have to happen together: claim the new index
 * document, release the old one, update the profile, and leave the historical
 * records alone. It cannot be a field edit from the client, which is why
 * `firestore.rules` keeps `username` server-only.
 *
 * ── The rules ──────────────────────────────────────────────────────────────
 *
 *  • THE CLAIM IS A CREATE. Two people renaming to the same handle at the same
 *    instant is decided by the database refusing the second write, not by a
 *    read-then-write that both pass.
 *  • THE OLD HANDLE IS RELEASED. Holding it forever would let one account
 *    squat every good name by renaming through them. It goes back in the pool.
 *  • RATE LIMITED, HARD. Renaming is how impersonation works on a network with
 *    a public schedule: take a name, appear on air, change it, repeat. One
 *    change per RENAME_COOLDOWN_DAYS, enforced from a stored timestamp rather
 *    than an IP bucket — an IP limit is defeated by a different coffee shop.
 *  • HISTORY IS NOT REWRITTEN. Slots and clips keep the name that was on air at
 *    the time. Retroactively renaming a past broadcast would make the schedule
 *    a record of who someone is now rather than who was actually on.
 */
import { requireUser } from './_shared/auth'
import { auditLog } from './_shared/audit'
import { badRequest, conflict, notFound } from './_shared/errors'
import { commitWrites, createWrite, deleteWrite, getDoc, updateWrite } from './_shared/firebaseAdmin'
import { json, parseJson, requireMethod, withHttp } from './_shared/http'
import { checkRateLimit, clientIp } from './_shared/rateLimit'
import { normalizeUsername, usernameKey } from './_shared/validators'

/** Long enough that a name is an identity rather than a costume, short enough
 *  that a typo made at sign-up is not permanent. */
const RENAME_COOLDOWN_DAYS = 7

type Body = { username?: unknown }
interface UserDoc {
  username?: string
  usernameLower?: string
  displayName?: string
  status?: string
  usernameChangedAt?: unknown
}

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  await checkRateLimit(clientIp(event), 'changeUsername', 10)

  const authUser = await requireUser(event)
  const body = parseJson<Body>(event)

  // Throws a 400 with the rule spelled out if it is malformed.
  const username = normalizeUsername(String(body.username ?? ''))
  const key = usernameKey(username)

  const user = await getDoc<UserDoc>(`users/${authUser.uid}`)
  if (!user) throw notFound('No CSGN account found for this sign-in.')
  if (user.status && user.status !== 'active') throw badRequest('Active CSGN account required.', 'inactive_account')

  const currentKey = String(user.usernameLower || usernameKey(String(user.username || 'placeholder')))

  // Changing capitalisation only — "bob" to "Bob" — is a display change, not a
  // rename. It keeps the same index document, so it skips the cooldown and the
  // claim entirely rather than failing on "that name is taken (by you)".
  if (key === currentKey) {
    if (String(user.username || '') === username) return json(200, { ok: true, unchanged: true, username })
    await commitWrites([updateWrite(`users/${authUser.uid}`, { username, updatedAt: new Date() }, true)])
    await auditLog('changeUsernameCase', authUser.uid, { username })
    return json(200, { ok: true, username, caseOnly: true })
  }

  const lastChanged = msOf(user.usernameChangedAt)
  const cooldownMs = RENAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
  if (lastChanged > 0 && Date.now() - lastChanged < cooldownMs) {
    const daysLeft = Math.ceil((cooldownMs - (Date.now() - lastChanged)) / (24 * 60 * 60 * 1000))
    throw conflict(
      `You can change your username again in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`,
      'rename_cooldown',
    )
  }

  const taken = await getDoc(`uniqueUsernames/${key}`)
  if (taken) throw conflict('That username is taken.', 'username_taken')

  const now = new Date()
  try {
    await commitWrites([
      // CREATE — a concurrent rename to the same handle loses here rather than
      // in a check both requests happened to pass.
      createWrite(`uniqueUsernames/${key}`, { uid: authUser.uid, username, createdAt: now }),
      updateWrite(`users/${authUser.uid}`, {
        username,
        usernameLower: key,
        // displayName tracks the username unless it was set to something else.
        ...(user.displayName && user.displayName !== user.username ? {} : { displayName: username }),
        usernameChangedAt: now,
        updatedAt: now,
      }, true),
      // Released last, and in the same batch: if the claim above fails, the old
      // handle is still ours. Dropping it first would leave an account nameless
      // on a lost race.
      deleteWrite(`uniqueUsernames/${currentKey}`),
    ])
  } catch {
    throw conflict('That username was just taken. Try another.', 'username_taken')
  }

  await auditLog('changeUsername', authUser.uid, { from: currentKey, to: key })
  return json(200, { ok: true, username, cooldownDays: RENAME_COOLDOWN_DAYS })
})

/** Firestore hands timestamps back in several shapes. Unreadable reads as 0,
 *  i.e. "never changed", which fails open toward letting somebody rename. */
function msOf(value: unknown): number {
  if (typeof value === 'string') {
    const t = Date.parse(value)
    return Number.isFinite(t) ? t : 0
  }
  if (value instanceof Date) return value.getTime()
  if (value && typeof value === 'object' && 'seconds' in value) {
    return Number((value as { seconds?: number }).seconds || 0) * 1000
  }
  return 0
}
