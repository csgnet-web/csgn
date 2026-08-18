// A member adds a clip to their reel.
//
// What arrives is a LINK to a post that already exists on YouTube, TikTok or
// Instagram. We store the parsed reference and nothing else — no file, no
// transcode, no storage bill, and no question about what a binary we host
// actually contains.
//
// It lands as `pending` and stays there. Nothing airs unreviewed: this is a
// broadcast, and one bad segment is everybody's problem, so there is no path
// through this endpoint that produces an approved clip.
import { requireUser } from './_shared/auth'
import { auditLog } from './_shared/audit'
import { badRequest, conflict } from './_shared/errors'
import { getDoc, queryCollection, writeDoc, fieldFilter } from './_shared/firebaseAdmin'
import { json, parseJson, requireMethod, withHttp } from './_shared/http'
import { checkRateLimit, clientIp } from './_shared/rateLimit'
import { parseClipUrl, clipKey, clampClipSeconds } from './_shared/clipEmbed'

/** Per member. A reel, not a channel — and a bound on the review queue. */
const MAX_CLIPS_PER_MEMBER = 25
const MAX_TITLE = 80

type Body = { url?: unknown; seconds?: unknown; title?: unknown }

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  const authUser = await requireUser(event)
  await checkRateLimit(clientIp(event), 'submitClip', 20)

  const body = parseJson<Body>(event)
  const parsed = parseClipUrl(String(body.url ?? ''))
  if (!parsed) {
    throw badRequest(
      'Paste a link to a YouTube, TikTok or Instagram post. Short links (vm.tiktok.com) need to be opened first so we get the real one.',
      'unsupported_clip_url',
    )
  }

  const user = await getDoc<{ username?: string; displayName?: string; status?: string }>(`users/${authUser.uid}`)
  if (!user || (user.status && user.status !== 'active')) throw badRequest('Active CSGN account required.', 'inactive_account')

  const mine = await queryCollection('clips', [fieldFilter('uid', 'EQUAL', authUser.uid)], [], MAX_CLIPS_PER_MEMBER + 1)
  if (mine.length >= MAX_CLIPS_PER_MEMBER) {
    throw conflict(`You can keep up to ${MAX_CLIPS_PER_MEMBER} clips. Remove one to add another.`, 'clip_limit_reached')
  }

  // Same post pasted a second way is the same post. Without this a member can
  // fill their whole allocation with one video and eight different URLs.
  const key = clipKey(parsed)
  if (mine.some((row) => String((row.data as { clipKey?: string }).clipKey || '') === key)) {
    throw conflict('That post is already in your reel.', 'duplicate_clip')
  }

  const clipId = `${authUser.uid.slice(0, 8)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const seconds = clampClipSeconds(body.seconds)
  const order = mine.reduce((max, row) => Math.max(max, Number((row.data as { order?: number }).order) || 0), 0) + 1

  await writeDoc(`clips/${clipId}`, {
    uid: authUser.uid,
    username: String(user.username || user.displayName || ''),
    platform: parsed.platform,
    videoId: parsed.videoId,
    clipKey: key,
    sourceUrl: parsed.canonicalUrl,
    embedUrl: parsed.embedUrl,
    title: String(body.title ?? '').trim().slice(0, MAX_TITLE),
    seconds,
    order,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  await auditLog('submitClip', authUser.uid, { clipId, platform: parsed.platform, videoId: parsed.videoId })

  return json(200, {
    ok: true,
    clip: {
      id: clipId, platform: parsed.platform, sourceUrl: parsed.canonicalUrl,
      title: String(body.title ?? '').trim().slice(0, MAX_TITLE), seconds, order, status: 'pending',
    },
  })
})
