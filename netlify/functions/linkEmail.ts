/**
 * Record an email + password added to an EXISTING wallet-only account.
 *
 * This is the other half of the promise wallet-only sign-up makes. Dropping
 * email from the door is only honest if it can be added afterwards, because a
 * seed phrase is the one credential that cannot be recovered — lose it and,
 * with nothing else on the account, the account is gone. So `/account` lets a
 * member attach an address and a password whenever they want the safety net,
 * and this function is what makes it real to the rest of the system.
 *
 * The ACTUAL linking happens in the browser, via Firebase's
 * `linkWithCredential`, because only Firebase Auth can attach a password to an
 * existing user and only it can enforce that one address maps to one auth user.
 * By the time this is called the caller's ID token already carries the new
 * email — which is exactly why this function trusts nothing else. It reads the
 * address off the verified token, never off the request body, so a caller
 * cannot claim an address they haven't actually linked.
 *
 * The `uniqueEmails` write is a CREATE, mirroring linkTwitch: the database
 * refuses a second account on one address rather than the code remembering to
 * check. Firebase Auth has normally rejected the duplicate long before we get
 * here; this is the backstop for data that drifted.
 */

import { requireUser } from './_shared/auth'
import { auditLog } from './_shared/audit'
import { badRequest, conflict, notFound } from './_shared/errors'
import { commitWrites, createWrite, getDoc, updateWrite } from './_shared/firebaseAdmin'
import { json, requireMethod, withHttp } from './_shared/http'
import { emailKey, normalizeEmail } from './_shared/validators'
import { checkRateLimit, clientIp } from './_shared/rateLimit'

type UserDoc = { email?: string; emailLower?: string }
type EmailIndex = { uid?: string }

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  await checkRateLimit(clientIp(event), 'linkEmail', 10)

  const authUser = await requireUser(event)
  // Straight off the verified token. If the client hasn't completed
  // linkWithCredential yet there is nothing here, and there is nothing to record.
  if (!authUser.email) {
    throw badRequest('Link the email to your sign-in first, then save it.', 'missing_email')
  }
  const emailLower = normalizeEmail(authUser.email)
  const key = emailKey(emailLower)

  const user = await getDoc<UserDoc>(`users/${authUser.uid}`)
  if (!user) throw notFound('No CSGN account found for this sign-in.')

  // Saving the same address twice is a no-op success, not an error — this can be
  // re-entered by a retry or a second tab, and neither is a mistake worth an
  // error message.
  if (user.emailLower === emailLower) return json(200, { ok: true, alreadyLinked: true, email: authUser.email })
  if (user.emailLower) throw conflict('This account already has a different email address.', 'email_already_linked')

  const claimed = await getDoc<EmailIndex>(`uniqueEmails/${key}`)
  if (claimed && claimed.uid !== authUser.uid) {
    throw conflict('An account with this email already exists.', 'duplicate_email')
  }

  const now = new Date()
  try {
    await commitWrites([
      createWrite(`uniqueEmails/${key}`, { uid: authUser.uid, emailLower, createdAt: now }),
      updateWrite(`users/${authUser.uid}`, {
        email: authUser.email,
        emailLower,
        // The account now has both credentials. Nothing downstream branches on
        // this today beyond the profile copy, but "wallet-only" stops being true
        // the moment a password exists and the record should say so.
        authMethod: 'email',
        updatedAt: now,
      }, true),
    ])
  } catch {
    throw conflict('An account with this email already exists.', 'duplicate_email')
  }

  await auditLog('linkEmail', authUser.uid, { emailLower })
  return json(200, { ok: true, email: authUser.email })
})
