/**
 * Record the email a wallet-first account just linked.
 *
 * The Firebase side of this happens on the CLIENT: `linkWithCredential` attaches
 * an email/password credential to the existing session, then
 * `sendEmailVerification` mails the link. That has to be client-side — linking a
 * credential requires the live session, and doing it server-side would mean
 * handling the user's password, which we go out of our way never to touch.
 *
 * So this function's job is narrow and it should stay narrow: mirror the address
 * onto the user document and take the uniqueness lock, so two accounts can't end
 * up on one email. It trusts the address from the VERIFIED TOKEN, never from the
 * request body — a caller could otherwise claim any address they liked and
 * squat the lock on someone else's.
 */

import { requireUser } from './_shared/auth'
import { auditLog } from './_shared/audit'
import { badRequest, conflict, notFound } from './_shared/errors'
import { commitWrites, createWrite, getDoc, updateWrite } from './_shared/firebaseAdmin'
import { json, requireMethod, withHttp } from './_shared/http'
import { emailKey, normalizeEmail } from './_shared/validators'
import { checkRateLimit, clientIp } from './_shared/rateLimit'

type UserDoc = { email?: string }
type EmailIndex = { uid?: string }

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  await checkRateLimit(clientIp(event), 'setAccountEmail', 10)

  const authUser = await requireUser(event)
  // The address comes from the ID token, which Firebase only issues with an
  // email once the credential is genuinely linked to this account.
  if (!authUser.email) throw badRequest('Link the email to your account first.', 'no_email_on_token')
  const emailLower = normalizeEmail(authUser.email)
  const key = emailKey(emailLower)

  const user = await getDoc<UserDoc>(`users/${authUser.uid}`)
  if (!user) throw notFound('No CSGN account found for this sign-in.')

  // Idempotent: re-running after a refresh is a success, not a duplicate.
  if (user.email && normalizeEmail(user.email) === emailLower) {
    return json(200, { ok: true, email: emailLower, alreadySet: true })
  }
  if (user.email) throw conflict('This account already has an email address.', 'email_already_set')

  const existing = await getDoc<EmailIndex>(`uniqueEmails/${key}`)
  if (existing?.uid && existing.uid !== authUser.uid) {
    throw conflict('An account with this email already exists.', 'duplicate_email')
  }

  const now = new Date()
  try {
    await commitWrites([
      createWrite(`uniqueEmails/${key}`, { uid: authUser.uid, emailLower, createdAt: now }),
      updateWrite(`users/${authUser.uid}`, { email: authUser.email, emailLower, updatedAt: now }, true),
    ])
  } catch {
    throw conflict('An account with this email already exists.', 'duplicate_email')
  }

  await auditLog('setAccountEmail', authUser.uid, { emailLower })
  return json(200, { ok: true, email: emailLower, alreadySet: false })
})
