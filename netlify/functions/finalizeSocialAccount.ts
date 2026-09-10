// Create a CSGN profile for someone who just signed in with Google, X, or an
// email link.
//
// ── Why this exists ───────────────────────────────────────────────────────
//
// Until now the ONLY door was `signupWithPhantom`, which requires a Solana
// wallet with prior on-chain history. That is a sybil gate, and it worked, but
// it also meant a person with no crypto could not create an account at all —
// not "with extra steps", at all. Everything the network wants more of (people
// who make things, people who watch) was on the wrong side of it.
//
// So the wallet moves to where it actually protects something: PAYOUT. You need
// somewhere for SOL to land before we owe you SOL, and not one moment earlier.
//
// ── What replaced the sybil gate ──────────────────────────────────────────
//
// Nothing here, and deliberately. A free account is worth almost nothing on its
// own: it cannot claim an hour (that needs a verified Twitch channel, which is
// itself scarce and one-per-account), and it cannot put anything on air, because
// airtime only counts members with an APPROVED clip and approval is a person
// watching the post. A thousand farmed accounts produce a thousand review items,
// not a thousand slots of television. The moderation queue is the gate.
import { requireUser } from './_shared/auth'
import { auditLog } from './_shared/audit'
import { conflict } from './_shared/errors'
import { createWrite, commitWrites, getDoc } from './_shared/firebaseAdmin'
import { json, parseJson, requireMethod, withHttp } from './_shared/http'
import { emailKey, normalizeEmail, usernameKey } from './_shared/validators'
import { allocateUsername } from './_shared/handles'
import { checkRateLimit, clientIp } from './_shared/rateLimit'

type Body = { username?: unknown }

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  await checkRateLimit(clientIp(event), 'finalizeSocialAccount', 10)
  const authUser = await requireUser(event)

  // Already have a profile? Say so plainly and let the client carry on — this
  // endpoint is called on every social sign-in, not just the first.
  const existing = await getDoc<Record<string, unknown>>(`users/${authUser.uid}`)
  if (existing) return json(200, { created: false, user: existing })

  const body = parseJson<Body>(event)
  const now = new Date()

  // Email is OPTIONAL here. Google and email-link always carry one; X often
  // does not, and refusing an account over it would recreate the exact wall
  // this endpoint exists to remove.
  const email = typeof authUser.email === 'string' && authUser.email ? normalizeEmail(authUser.email) : null

  // Take the requested handle if it can be made valid and is free; otherwise
  // mint one and walk salts until it lands. A name collision must never be a
  // dead end on the one screen where a stranger decides whether to bother.
  // The rule lives in _shared/handles.ts because the TikTok door needs the same
  // one, and "what are you called" is not a question with two answers.
  const username = await allocateUsername(String(body.username ?? ''), authUser.uid)
  if (!username) throw conflict('Could not allocate a username. Try again.', 'username_unavailable')

  const usernameLower = usernameKey(username)
  if (email && (await getDoc(`uniqueEmails/${emailKey(email)}`))) {
    throw conflict('An account with this email already exists. Sign in with it instead.', 'duplicate_email')
  }

  const userDoc = {
    uid: authUser.uid,
    email: email ?? null,
    emailLower: email ?? null,
    username,
    usernameLower,
    displayName: String((authUser as { name?: unknown }).name ?? '') || username,
    // Every consumer reads the same shape whether or not a thing is linked, so
    // nobody has to tell "absent" from "not yet done".
    phantom: { verified: false },
    twitch: { verified: false },
    /** How they got in. Useful in the auth log and for knowing which prompt to
     *  show next ("link Twitch to go live", "add a wallet to get paid"). */
    signupMethod: String((authUser as { firebase?: { sign_in_provider?: string } }).firebase?.sign_in_provider ?? 'social'),
    role: 'user',
    status: 'active',
    slotLimits: { maxConcurrentClaims: 2 },
    createdAt: now,
    updatedAt: now,
  }

  await commitWrites([
    ...(email ? [createWrite(`uniqueEmails/${emailKey(email)}`, { uid: authUser.uid, emailLower: email, createdAt: now })] : []),
    createWrite(`uniqueUsernames/${usernameLower}`, { uid: authUser.uid, username, createdAt: now }),
    createWrite(`users/${authUser.uid}`, userDoc),
  ])

  await auditLog('finalizeSocialAccount', authUser.uid, { usernameLower, method: userDoc.signupMethod, hasEmail: Boolean(email) })

  return json(200, { created: true, user: userDoc })
})
