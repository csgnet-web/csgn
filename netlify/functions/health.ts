import { json, requireMethod, withHttp } from './_shared/http'

export const handler = withHttp(async (event) => {
  requireMethod(event, 'GET')
  return json(200, { ok: true, service: 'csgn-v1', time: new Date().toISOString() })
})
