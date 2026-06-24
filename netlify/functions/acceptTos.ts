import { requireUser } from './_shared/auth'
import { auditLog } from './_shared/audit'
import { notFound } from './_shared/errors'
import { commitWrites, getDoc, updateWrite } from './_shared/firebaseAdmin'
import { json, requireMethod, withHttp } from './_shared/http'
import { checkRateLimit, clientIp } from './_shared/rateLimit'
import { TOS_VERSION } from './_shared/tos'

// Lets an already-authenticated user accept the Terms of Service. Needed for
// pre-existing accounts created before the ToS gate (which have no
// acceptedTosAt). Writes go through the Admin SDK because /users is server-only
// in Firestore rules, and the version is stamped server-side so it can't be
// spoofed.
export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  await checkRateLimit(clientIp(event), 'acceptTos', 10)
  const authUser = await requireUser(event)
  if (!(await getDoc(`users/${authUser.uid}`))) throw notFound('User account not found.')
  const now = new Date()
  await commitWrites([updateWrite(`users/${authUser.uid}`, { acceptedTosAt: now, tosVersion: TOS_VERSION, updatedAt: now })])
  await auditLog('acceptTos', authUser.uid, { tosVersion: TOS_VERSION })
  return json(200, { ok: true, tosVersion: TOS_VERSION })
})
