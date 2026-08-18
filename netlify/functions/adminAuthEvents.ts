// The admin Auth Events feed.
//
// WHY THIS IS A FUNCTION and not a Firestore query from the admin page:
//
// The browser used to list `auth_events` directly, which put the whole tab at
// the mercy of whether firestore.rules had actually been DEPLOYED. The rule
// itself is correct and has been in the repo for a while — but rules only take
// effect when someone runs a deploy, and until that happens every read comes
// back "Missing or insufficient permissions" with nothing in the UI to explain
// why. That is a bad failure for the one screen whose entire job is telling you
// whether sign-in is working.
//
// firebase-admin bypasses rules, so reading through here works on a fresh
// project with no rules deployed at all. It also removes an unbounded
// client-side collection listing, which is the same cost-control reason the
// slots rule caps anonymous list queries.
import { requireAdminUser } from './_shared/auth'
import { queryCollection, order } from './_shared/firebaseAdmin'
import { json, requireMethod, withHttp } from './_shared/http'

/** Enough to see a pattern, few enough to stay one cheap query. */
const MAX_EVENTS = 100

interface AuthEventRow {
  kind?: string
  uid?: string | null
  twitchUsername?: string | null
  errorMessage?: string | null
  ua?: string | null
  ts?: string
}

export const handler = withHttp(async (event) => {
  requireMethod(event, 'GET')
  await requireAdminUser(event)

  const limitParam = Number(event.queryStringParameters?.limit)
  const max = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(MAX_EVENTS, Math.floor(limitParam)) : 50

  const rows = await queryCollection('auth_events', [], [order('ts', 'DESCENDING')], max)

  return json(200, {
    events: rows.map((row) => {
      const d = row.data as AuthEventRow
      return {
        id: row.path.split('/').pop()!,
        kind: String(d.kind || ''),
        uid: d.uid ?? null,
        twitchUsername: d.twitchUsername ?? null,
        errorMessage: d.errorMessage ?? null,
        ua: d.ua ?? null,
        ts: d.ts ?? null,
      }
    }),
  })
})
