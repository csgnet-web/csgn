// Client-side auth audit logging.
//
// These events are written by the SERVER (netlify/functions/logAuthEvent), not
// straight to Firestore. That's deliberate: the most valuable events fire before
// a session exists (`signin-start`, `signin-failure`, `signup-email-start`, and a
// `signup-email-failure` where account creation itself failed). Firestore's rule
// for auth_events requires an authenticated caller, so browser-side writes for
// those were silently rejected — the admin's Auth Events tab looked empty even
// when people were trying and failing to sign up. Going through the function
// (firebase-admin bypasses rules) captures the whole funnel, and lets the rule
// stay server-only so the collection can't be spammed from a console.

export type AuthEventKind =
  | 'twitch-callback-start'
  | 'twitch-callback-resolved'
  | 'twitch-link-merged'
  | 'twitch-link-failure'
  | 'signup-twitch-start'
  | 'signup-twitch-success'
  | 'signup-twitch-failure'
  | 'signup-email-start'
  | 'signup-email-success'
  | 'signup-email-failure'
  | 'signup-phantom-start'
  | 'signup-phantom-success'
  | 'signup-phantom-failure'
  | 'signin-start'
  | 'signin-success'
  | 'signin-failure'

export interface AuthEventFields {
  uid?: string | null
  twitchUsername?: string | null
  errorMessage?: string | null
  meta?: Record<string, unknown> | null
}

export async function logAuthEvent(kind: AuthEventKind, fields: AuthEventFields = {}): Promise<void> {
  try {
    await fetch('/.netlify/functions/logAuthEvent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // keepalive so an event fired during a redirect/unload still ships.
      keepalive: true,
      body: JSON.stringify({
        kind,
        uid: fields.uid ?? null,
        twitchUsername: fields.twitchUsername ?? null,
        errorMessage: fields.errorMessage ?? null,
        ua: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      }),
    })
  } catch {
    // Best-effort logging: never let an audit-write failure break auth.
  }
}
