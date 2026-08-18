// Everything /studio needs in one call: your reel, and how much of the day is
// yours.
//
// The allocation is READ from the schedule the poller already published, never
// recomputed here. `public/airtimeSchedule` is what actually goes on air, so
// showing a member a number derived any other way would be showing them a
// number that is not true.
import { requireUser } from './_shared/auth'
import { getDoc, queryCollection, fieldFilter, order } from './_shared/firebaseAdmin'
import { json, requireMethod, withHttp } from './_shared/http'

interface ScheduleDoc {
  items?: Array<{ startsAt?: string; endsAt?: string; seconds?: number; clipId?: string; uid?: string }>
  allocations?: Array<{ uid?: string; seconds?: number; capped?: boolean }>
  inventorySeconds?: number
  networkBlockEnabled?: boolean
  builtAt?: string
}

export const handler = withHttp(async (event) => {
  requireMethod(event, 'GET')
  const authUser = await requireUser(event)

  const [rows, schedule, profile] = await Promise.all([
    queryCollection('clips', [fieldFilter('uid', 'EQUAL', authUser.uid)], [order('order', 'ASCENDING')], 50),
    getDoc<ScheduleDoc>('public/airtimeSchedule'),
    getDoc<{ onAirLook?: string; username?: string }>(`users/${authUser.uid}`),
  ])

  const clips = rows.map((row) => {
    const d = row.data as Record<string, unknown>
    return {
      id: row.path.split('/').pop()!,
      platform: String(d.platform || ''),
      sourceUrl: String(d.sourceUrl || ''),
      title: String(d.title || ''),
      thumbnailUrl: String(d.thumbnailUrl || ''),
      seconds: Number(d.seconds) || 0,
      /** The video's real full length, when the platform gave us one. */
      sourceSeconds: Number(d.sourceSeconds) || 0,
      trimStartSeconds: Number(d.trimStartSeconds) || 0,
      trimEndSeconds: Number(d.trimEndSeconds) || 0,
      /** True when the platform told us the real runtime, false when we guessed. */
      measured: d.measured === true,
      order: Number(d.order) || 0,
      status: String(d.status || 'pending'),
      rejectReason: d.rejectReason ? String(d.rejectReason) : null,
    }
  })

  const mine = (schedule?.allocations ?? []).find((a) => a?.uid === authUser.uid)
  // Only future airings — a member wants to know when they are next on, not
  // when they were on an hour ago.
  const nowMs = Date.now()
  const airings = (schedule?.items ?? [])
    .filter((i) => i?.uid === authUser.uid && Date.parse(String(i.startsAt ?? '')) > nowMs)
    .slice(0, 20)
    .map((i) => ({ startsAt: i.startsAt ?? '', seconds: Number(i.seconds) || 0, clipId: String(i.clipId || '') }))

  return json(200, {
    onAirLook: String(profile?.onAirLook || 'signal'),
    username: String(profile?.username || ''),
    clips,
    airtime: {
      seconds: Number(mine?.seconds) || 0,
      capped: Boolean(mine?.capped),
      inventorySeconds: Number(schedule?.inventorySeconds) || 0,
      networkBlockEnabled: schedule?.networkBlockEnabled !== false,
      builtAt: schedule?.builtAt ?? null,
    },
    airings,
  })
})
