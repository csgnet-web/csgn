import { json, requireMethod, withHttp } from './_shared/http'

export const handler = withHttp(async (event) => {
  requireMethod(event, 'GET')
  // Deliberately uncached: a health check served from a cache is not a health
  // check, it is a memory of one.
  return json(200, { ok: true, service: 'csgn-v1', time: new Date().toISOString() }, { 'Cache-Control': 'no-store' })
})
