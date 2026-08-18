// The review queue — everything waiting on a decision, oldest first.
//
// Served by a function rather than a browser query for the same reason the auth
// log is: it must work on a project whose firestore.rules have never been
// deployed, and clips are server-only by rule anyway.
import { requireAdminUser } from './_shared/auth'
import { queryCollection, fieldFilter, order } from './_shared/firebaseAdmin'
import { json, requireMethod, withHttp } from './_shared/http'

const MAX = 100

export const handler = withHttp(async (event) => {
  requireMethod(event, 'GET')
  await requireAdminUser(event)

  const status = String(event.queryStringParameters?.status || 'pending')
  const rows = await queryCollection(
    'clips',
    [fieldFilter('status', 'EQUAL', status)],
    [order('createdAt', 'ASCENDING')],
    MAX,
  )

  return json(200, {
    clips: rows.map((row) => {
      const d = row.data as Record<string, unknown>
      return {
        id: row.path.split('/').pop()!,
        uid: String(d.uid || ''),
        username: String(d.username || ''),
        platform: String(d.platform || ''),
        sourceUrl: String(d.sourceUrl || ''),
        title: String(d.title || ''),
        seconds: Number(d.seconds) || 0,
        status: String(d.status || ''),
        createdAt: d.createdAt ?? null,
      }
    }),
  })
})
