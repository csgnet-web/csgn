// The review queue — everything waiting on a decision, oldest first.
//
// Served by a function rather than a browser query for the same reason the auth
// log is: it must work on a project whose firestore.rules have never been
// deployed, and clips are server-only by rule anyway.
import { requireAdminUser } from './_shared/auth'
import { queryCollection, fieldFilter } from './_shared/firebaseAdmin'
import { json, requireMethod, withHttp } from './_shared/http'

const MAX = 100

export const handler = withHttp(async (event) => {
  requireMethod(event, 'GET')
  await requireAdminUser(event)

  const status = String(event.queryStringParameters?.status || 'pending')
  // NO orderBy — see the warning on queryCollection. `status == x` plus
  // `orderBy(createdAt)` needs a composite index, and without it this endpoint
  // returned 500, which is why submitted clips never appeared for review.
  const rows = await queryCollection('clips', [fieldFilter('status', 'EQUAL', status)], [], MAX)
  // Oldest first: a review queue is a queue.
  rows.sort((a, b) => msOf(a.data.createdAt) - msOf(b.data.createdAt))

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


/** Firestore hands timestamps back in a few shapes depending on how they were
 *  written. Anything unreadable sorts as 0 (oldest), which puts it at the front
 *  of the review queue rather than losing it off the end. */
function msOf(value: unknown): number {
  if (typeof value === 'string') {
    const t = Date.parse(value)
    return Number.isFinite(t) ? t : 0
  }
  if (value instanceof Date) return value.getTime()
  if (value && typeof value === 'object' && 'seconds' in value) {
    return Number((value as { seconds?: number }).seconds || 0) * 1000
  }
  return 0
}
