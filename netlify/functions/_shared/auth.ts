import { bearerToken, type HandlerEvent } from './http'
import { unauthorized } from './errors'
import { requireAdmin, verifyIdToken, type DecodedIdToken } from './firebaseAdmin'

export async function requireUser(event: HandlerEvent): Promise<DecodedIdToken> {
  const token = bearerToken(event)
  if (!token) throw unauthorized()
  return verifyIdToken(token)
}

/**
 * The caller, if there is one — for the endpoints that serve both a member and
 * a stranger and do genuinely different things for each.
 *
 * A BAD token answers null rather than throwing, and that is the deliberate
 * part: an expired session arriving at a sign-up door should get the sign-up,
 * not a 401 telling somebody with no account that they are not signed in.
 * Anything that must be certain who it is talking to still uses `requireUser`.
 */
export async function optionalUser(event: HandlerEvent): Promise<DecodedIdToken | null> {
  const token = bearerToken(event)
  if (!token) return null
  try {
    return await verifyIdToken(token)
  } catch {
    return null
  }
}

export async function requireAdminUser(event: HandlerEvent): Promise<DecodedIdToken> {
  const user = await requireUser(event)
  await requireAdmin(user.uid)
  return user
}
