// The small, self-serve parts of a member's profile.
//
// Right now that is exactly one thing: their ON-AIR LOOK — the colour their
// lower third uses when a clip of theirs is on the broadcast. It is a cosmetic
// choice with no economic effect, which is precisely why it can be self-serve:
// everything that decides what an account can DO (role, status, slotLimits,
// verified wallet, verified Twitch) stays server-only and is not reachable from
// here. See the users rule in firestore.rules for the same split.
import { requireUser } from './_shared/auth'
import { badRequest } from './_shared/errors'
import { commitWrites, updateWrite } from './_shared/firebaseAdmin'
import { json, parseJson, requireMethod, withHttp } from './_shared/http'

/** Mirrors ON_AIR_LOOKS in src/lib/clipEmbed.ts. An unknown id is rejected
 *  rather than stored, so the broadcast can never be handed a class name that
 *  does not exist. */
const LOOK_IDS = ['signal', 'money', 'gold', 'ice', 'violet', 'mono']

type Body = { onAirLook?: unknown }

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  const authUser = await requireUser(event)
  const body = parseJson<Body>(event)

  const look = String(body.onAirLook ?? '')
  if (!LOOK_IDS.includes(look)) throw badRequest('Unknown on-air look.', 'invalid_look')

  await commitWrites([updateWrite(`users/${authUser.uid}`, { onAirLook: look, updatedAt: new Date() })])

  return json(200, { ok: true, onAirLook: look })
})
