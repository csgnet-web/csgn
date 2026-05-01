import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '@/config/firebase'

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
    await addDoc(collection(db, 'auth_events'), {
      kind,
      ts: serverTimestamp(),
      uid: fields.uid ?? null,
      twitchUsername: fields.twitchUsername ?? null,
      errorMessage: fields.errorMessage ?? null,
      meta: fields.meta ?? null,
      ua: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    })
  } catch {
    // Best-effort logging: never let an audit-write failure break auth.
  }
}
