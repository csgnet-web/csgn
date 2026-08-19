/**
 * The self-serve parts of a member's profile — their ON-AIR IDENTITY.
 *
 * Everything here is presentational: how a member's lower third looks when a
 * clip of theirs is on the broadcast. Nothing that decides what an account can
 * DO (role, status, slotLimits, verified wallet, verified Twitch, username)
 * is reachable from here — those stay server-only, which is the same split
 * `firestore.rules` enforces on the users collection.
 *
 * ── Why the avatar is captured here rather than sent ───────────────────────
 *
 * A member who signed in with X has a profile picture, and putting it on air is
 * the cheapest way to make a segment look like it belongs to a person rather
 * than to a template. But the URL must not come from the request body: that
 * would let anyone put any image on the broadcast by posting a link, which is
 * an open image-hosting hole on a channel that goes out publicly.
 *
 * So it is read from the VERIFIED ID TOKEN. Firebase puts the provider's
 * `picture` claim in there, signed, along with which provider issued the
 * sign-in. If the caller signed in with X, we take X's own CDN URL for their
 * avatar and store that. If they did not, there is nothing to store and the
 * on-air card falls back to their initial. Nothing a caller types is trusted.
 */
import { requireUser } from './_shared/auth'
import { badRequest } from './_shared/errors'
import { commitWrites, updateWrite } from './_shared/firebaseAdmin'
import { json, parseJson, requireMethod, withHttp } from './_shared/http'

/** Mirrors ON_AIR_LOOKS in src/lib/clipEmbed.ts. An unknown id is rejected
 *  rather than stored, so the broadcast can never be handed a class name that
 *  does not exist. */
const LOOK_IDS = ['signal', 'money', 'gold', 'ice', 'violet', 'mono', 'sunset', 'toxic', 'midnight', 'blood']

/** Mirrors ON_AIR_STYLES. Same rule. */
const STYLE_IDS = ['bar', 'badge', 'ticker', 'stack', 'minimal']

/** Mirrors ON_AIR_MOTIONS — how the card arrives on screen. */
const MOTION_IDS = ['cut', 'slide', 'wipe', 'pop']

/** Providers whose avatar we will put on air, and the host each one serves it
 *  from. An allowlist, not a URL check: it is the difference between "an image
 *  X hosts for this account" and "any https URL at all". */
const AVATAR_HOSTS: Record<string, RegExp> = {
  'twitter.com': /^https:\/\/pbs\.twimg\.com\//,
  'google.com': /^https:\/\/lh3\.googleusercontent\.com\//,
}

type Body = { onAirLook?: unknown; onAirStyle?: unknown; onAirMotion?: unknown; showAvatarOnAir?: unknown }

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  const authUser = await requireUser(event)
  const body = parseJson<Body>(event)

  const patch: Record<string, unknown> = { updatedAt: new Date() }

  if (body.onAirLook !== undefined) {
    const look = String(body.onAirLook)
    if (!LOOK_IDS.includes(look)) throw badRequest('Unknown on-air look.', 'invalid_look')
    patch.onAirLook = look
  }

  if (body.onAirStyle !== undefined) {
    const style = String(body.onAirStyle)
    if (!STYLE_IDS.includes(style)) throw badRequest('Unknown on-air style.', 'invalid_style')
    patch.onAirStyle = style
  }

  if (body.onAirMotion !== undefined) {
    const motion = String(body.onAirMotion)
    if (!MOTION_IDS.includes(motion)) throw badRequest('Unknown on-air motion.', 'invalid_motion')
    patch.onAirMotion = motion
  }

  if (body.showAvatarOnAir !== undefined) {
    if (typeof body.showAvatarOnAir !== 'boolean') throw badRequest('showAvatarOnAir must be true or false.', 'invalid_flag')
    patch.showAvatarOnAir = body.showAvatarOnAir
  }

  // Refreshed on every save, from the token — so a member who changes their
  // picture on X sees it update here the next time they touch this screen,
  // without us polling anybody's API.
  const social = socialAvatarFrom(authUser)
  if (social) patch.socialAvatar = social

  if (Object.keys(patch).length === 1) throw badRequest('Nothing to update.', 'empty_patch')
  await commitWrites([updateWrite(`users/${authUser.uid}`, patch, true)])

  return json(200, {
    ok: true,
    onAirLook: patch.onAirLook ?? null,
    onAirStyle: patch.onAirStyle ?? null,
    onAirMotion: patch.onAirMotion ?? null,
    showAvatarOnAir: patch.showAvatarOnAir ?? null,
    socialAvatar: social,
  })
})

/**
 * The signed-in provider's avatar, from the verified token and nowhere else.
 *
 * Returns null unless BOTH the provider is one we accept AND the URL it gave
 * is on that provider's own CDN. Two checks rather than one because the claim
 * is only as trustworthy as its issuer, and a provider we have not thought
 * about is not one we want serving images onto a television channel.
 */
function socialAvatarFrom(token: { [key: string]: unknown }): { provider: string; url: string } | null {
  const firebase = token.firebase as { sign_in_provider?: string } | undefined
  const provider = String(firebase?.sign_in_provider || '')
  const url = String(token.picture || '')
  const host = AVATAR_HOSTS[provider]
  if (!host || !url || !host.test(url)) return null
  return { provider, url: url.slice(0, 400) }
}
