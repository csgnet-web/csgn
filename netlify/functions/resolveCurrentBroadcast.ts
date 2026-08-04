import { getDoc, queryCollection, fieldFilter, order, writeDoc } from './_shared/firebaseAdmin'
import { json, requireMethod, withHttp } from './_shared/http'
import { checkRateLimit, clientIp } from './_shared/rateLimit'

type Override = { enabled?: boolean; streamUrl?: string; reason?: string }

export async function resolveBroadcast() {
  const fallbackUrl = process.env.CSGN_FALLBACK_STREAM_URL || ''
  const defaultUrl = process.env.CSGN_DEFAULT_STREAM_URL || 'https://www.twitch.tv/csgnet'
  const emergency = await getDoc<Override>('config/emergencyOverride')
  let source = 'default'
  let streamUrl = defaultUrl
  let slotId: string | null = null
  if (emergency?.enabled && emergency.streamUrl) {
    source = 'emergency_override'; streamUrl = emergency.streamUrl
  } else {
    const now = new Date().toISOString()
    const slots = await queryCollection('slots', [fieldFilter('status', 'IN', ['confirmed', 'live']), fieldFilter('startTime', 'LESS_THAN_OR_EQUAL', now)], [order('startTime', 'DESCENDING')], 10)
    const current = slots.find((s) => {
      const url = s.data.streamUrl ?? s.data.twitchChannelUrl
      return typeof s.data.endTime === 'string' && String(s.data.endTime) > now && typeof url === 'string' && Boolean(url)
    })
    if (current) { source = 'slot'; streamUrl = String(current.data.streamUrl ?? current.data.twitchChannelUrl); slotId = current.path.split('/').pop() || null }
    else if (fallbackUrl) { source = 'fallback'; streamUrl = fallbackUrl }
  }
  const doc = { streamUrl, source, slotId, resolvedAt: new Date(), updatedAt: new Date() }
  await writeDoc('public/currentBroadcast', doc)
  return doc
}

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  // Unauthenticated by design — /player and the admin panel both nudge it — but
  // every call costs a slots query plus a document write, so it needs a ceiling.
  // The internal callers (claimSlot, the admin force-resolve) invoke
  // `resolveBroadcast()` directly and never touch this limit.
  await checkRateLimit(clientIp(event), 'resolveCurrentBroadcast', 10)
  return json(200, { currentBroadcast: await resolveBroadcast() })
})
