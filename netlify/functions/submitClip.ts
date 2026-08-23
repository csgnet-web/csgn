// A member adds a clip to their reel.
//
// What arrives is a LINK to a post that already exists on YouTube, TikTok or
// Instagram. We store the parsed reference and nothing else — no file, no
// transcode, no storage bill, and no question about what a binary we host
// actually contains.
//
// The rules about what actually lands on a reel — the per-member cap, the
// duplicate check, the ordering, the pending status, the exact runtime — live
// in _shared/clipIntake.ts, because this is no longer the only door: a member
// with TikTok connected imports through `tiktokVideos`, and a member on Android
// shares straight in from Instagram through /share. Three doors, one set of
// rules, or they are not rules.
import { requireUser } from './_shared/auth'
import { auditLog } from './_shared/audit'
import { json, parseJson, requireMethod, withHttp } from './_shared/http'
import { checkRateLimit, clientIp } from './_shared/rateLimit'
import { intakeClip, loadIntakeMember } from './_shared/clipIntake'

// No `seconds`. The member never types a length — we read the real one off the
// platform, and fall back to a default when the platform will not say.
type Body = { url?: unknown; title?: unknown }

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  const authUser = await requireUser(event)
  await checkRateLimit(clientIp(event), 'submitClip', 20)

  const body = parseJson<Body>(event)
  const member = await loadIntakeMember(authUser.uid)
  const clip = await intakeClip({
    uid: authUser.uid,
    url: String(body.url ?? ''),
    title: String(body.title ?? ''),
  }, member)

  await auditLog('submitClip', authUser.uid, { clipId: clip.id, platform: clip.platform, measured: clip.measured })

  return json(200, { ok: true, clip })
})
