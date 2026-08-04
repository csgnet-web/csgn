// Server-side auth audit logging.
//
// WHY THIS EXISTS: auth_events used to be written directly from the browser, but
// firestore.rules only allowed `create: if isSignedIn()` — so every event fired
// BEFORE a session exists (`signin-start`, `signin-failure`, `signup-email-start`,
// and a `signup-email-failure` where account creation itself failed) was rejected,
// and the client's best-effort `catch {}` swallowed the denial. The result: the
// admin's Auth Events tab could look empty even while people were trying — and
// failing — to sign up. Those are exactly the events worth having.
//
// Writing them here (firebase-admin bypasses rules) fixes that AND lets the rule
// tighten to server-only, so the collection can't be spammed straight from a
// browser console. Rate-limited per IP; every field is length-capped.
import { writeDoc } from './_shared/firebaseAdmin'
import { badRequest } from './_shared/errors'
import { json, parseJson, requireMethod, withHttp } from './_shared/http'
import { checkRateLimit, clientIp } from './_shared/rateLimit'

/** Every kind the client may log. Anything else is rejected. */
export const AUTH_EVENT_KINDS = [
  'twitch-callback-start',
  'twitch-callback-resolved',
  'twitch-link-merged',
  'twitch-link-failure',
  'signup-twitch-start',
  'signup-twitch-success',
  'signup-twitch-failure',
  'signup-email-start',
  'signup-email-success',
  'signup-email-failure',
  'signup-phantom-start',
  'signup-phantom-success',
  'signup-phantom-failure',
  'signin-start',
  'signin-success',
  'signin-failure',
] as const

export type AuthEventKind = (typeof AUTH_EVENT_KINDS)[number]

const MAX_ERR = 500
const MAX_UA = 300
const MAX_NAME = 80
const MAX_UID = 128
const AUTH_EVENT_TTL_MS = 90 * 24 * 60 * 60 * 1000

export interface NormalizedAuthEvent {
  kind: AuthEventKind
  uid: string | null
  twitchUsername: string | null
  errorMessage: string | null
  ua: string | null
}

const clip = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t.slice(0, max) : null
}

/**
 * Validate + clamp one client-reported auth event. Pure, so it's unit-tested.
 * Throws on an unknown kind; never throws on the optional fields (they're just
 * dropped when malformed) — an audit write must not fail on a stray value.
 */
export function normalizeAuthEvent(body: Record<string, unknown>): NormalizedAuthEvent {
  const kind = typeof body.kind === 'string' ? body.kind : ''
  if (!(AUTH_EVENT_KINDS as readonly string[]).includes(kind)) {
    throw badRequest('Unknown auth event kind.', 'bad_kind')
  }
  return {
    kind: kind as AuthEventKind,
    uid: clip(body.uid, MAX_UID),
    twitchUsername: clip(body.twitchUsername, MAX_NAME),
    errorMessage: clip(body.errorMessage, MAX_ERR),
    ua: clip(body.ua, MAX_UA),
  }
}

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  // Generous but bounded: a single sign-up flow fires several events.
  await checkRateLimit(clientIp(event), 'logAuthEvent', 40)

  const ev = normalizeAuthEvent(parseJson<Record<string, unknown>>(event))
  const id = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/-/g, '')

  await writeDoc(`auth_events/${id}`, {
    ...ev,
    meta: null,
    ts: new Date(),
    expiresAt: new Date(Date.now() + AUTH_EVENT_TTL_MS), // Firestore TTL policy on expiresAt
  })

  return json(200, { ok: true })
})
