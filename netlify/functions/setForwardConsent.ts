/**
 * Grant or withdraw permission for CSGN to forward this member's streams.
 *
 * ── Why this is its own endpoint ───────────────────────────────────────────
 *
 * The grant is first captured at Twitch link time (see linkTwitch.ts), but it
 * has to be changeable afterwards without re-doing OAuth. A permission you can
 * only give — never take back without repeating a five-step round trip through
 * another company's login — is not really a permission, and for a grant to
 * re-broadcast somebody's video that is not good enough.
 *
 * No proof token is needed here, unlike linkTwitch: the caller is authenticated
 * and the channel is ALREADY verified against their account. They are changing
 * a setting on something they have already proved they own, so re-proving it
 * would be ceremony rather than security. What the endpoint will not do is
 * grant consent for a channel that was never verified in the first place.
 *
 * `_shared/liveRoster.ts` re-reads this flag on every pass, so withdrawal takes
 * effect on the next sample — within a minute — rather than at some later
 * cleanup. That is the property that makes it an honest control.
 */
import { requireUser } from './_shared/auth'
import { auditLog } from './_shared/audit'
import { badRequest, notFound } from './_shared/errors'
import { commitWrites, getDoc, updateWrite } from './_shared/firebaseAdmin'
import { json, parseJson, requireMethod, withHttp } from './_shared/http'
import { checkRateLimit, clientIp } from './_shared/rateLimit'

/** Bumped when the wording of the grant materially changes, so a stored
 *  consent can always be traced to the text the member actually agreed to. */
const FORWARD_CONSENT_VERSION = 1

type Body = { forwardConsent?: unknown }
type UserDoc = {
  twitch?: {
    verified?: boolean
    username?: string
    forwardConsent?: boolean
  }
}

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  await checkRateLimit(clientIp(event), 'setForwardConsent', 20)

  const authUser = await requireUser(event)
  const body = parseJson<Body>(event)
  if (typeof body.forwardConsent !== 'boolean') {
    throw badRequest('forwardConsent must be true or false.', 'invalid_consent')
  }
  const forwardConsent = body.forwardConsent

  const user = await getDoc<UserDoc>(`users/${authUser.uid}`)
  if (!user) throw notFound('No CSGN account found for this sign-in.')
  if (!user.twitch?.verified || !user.twitch.username) {
    throw badRequest('Connect a Twitch channel before setting this.', 'no_twitch')
  }

  const now = new Date()
  await commitWrites([updateWrite(`users/${authUser.uid}`, {
    twitch: {
      ...user.twitch,
      forwardConsent,
      // Cleared rather than left behind on withdrawal — a stale "consented at"
      // beside `forwardConsent: false` is the kind of record that gets read the
      // wrong way round a year later.
      forwardConsentVersion: forwardConsent ? FORWARD_CONSENT_VERSION : null,
      forwardConsentAt: forwardConsent ? now : null,
    },
    updatedAt: now,
  }, true)])

  await auditLog(
    forwardConsent ? 'twitchForwardConsentGranted' : 'twitchForwardConsentRevoked',
    authUser.uid,
    { username: user.twitch.username },
  )

  return json(200, { ok: true, forwardConsent })
})
