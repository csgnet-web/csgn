import { bearerToken, type HandlerEvent } from './http'
import { unauthorized } from './errors'
import { requireAdmin, verifyIdToken, type DecodedIdToken } from './firebaseAdmin'

export async function requireUser(event: HandlerEvent): Promise<DecodedIdToken> {
  const token = bearerToken(event)
  if (!token) throw unauthorized()
  return verifyIdToken(token)
}

export async function requireAdminUser(event: HandlerEvent): Promise<DecodedIdToken> {
  const user = await requireUser(event)
  await requireAdmin(user.uid)
  return user
}
