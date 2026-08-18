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
import { fetchClipMeta, resolveShortLink } from './_shared/clipMeta'

/** Per member. A reel, not a channel — and a bound on the review queue. */
const MAX_CLIPS_PER_MEMBER = 25
const MAX_TITLE = 80

// No `seconds`. The member never types a length — we read the real one off the
// platform, and fall back to a default when the platform will not say.
type Body = { url?: unknown; title?: unknown }

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  const authUser = await requireUser(event)
  await checkRateLimit(clientIp(event), 'submitClip', 20)

  const body = parseJson<Body>(event)
  const submitted = String(body.url ?? '')

  // Try the pasted link as-is first — the overwhelmingly common case, and it
  // costs no network call. Only a link the pure parser cannot place gets the
  // redirect round trip, and only if it is a short-link host we recognise.
  let parsed = parseClipUrl(submitted)
  if (!parsed) parsed = parseClipUrl(await resolveShortLink(submitted))
  if (!parsed) {
    throw badRequest(
      'Paste a link to a YouTube, TikTok or Instagram post — the address of the post itself, not a profile or a search page.',
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

  // Ask the platform what this actually is. Best-effort: a slow or unkeyed
  // provider costs us a title and a measured runtime, never the post itself.
  const meta = await fetchClipMeta(parsed)

  const clipId = `${authUser.uid.slice(0, 8)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  // The real runtime when we could measure it, clamped to what the scheduler
  // will air; the default when we could not. `measured` is stored so /studio can
  // be honest about which of the two a member is looking at.
  const measured = meta.seconds != null
  // The EXACT length when the platform gave us one — no rounding to a preset,
  // no clamping down to some house maximum. Cropping only ever becomes
  // necessary when a member's earned airtime is shorter than their video.
  const sourceSeconds = measured ? clampClipSeconds(meta.seconds) : null
  const seconds = sourceSeconds ?? clampClipSeconds(undefined)
  const order = mine.reduce((max, row) => Math.max(max, Number((row.data as { order?: number }).order) || 0), 0) + 1

  await writeDoc(`clips/${clipId}`, {
    uid: authUser.uid,
    username: String(user.username || user.displayName || ''),
    platform: parsed.platform,
    videoId: parsed.videoId,
    clipKey: key,
    sourceUrl: parsed.canonicalUrl,
    embedUrl: parsed.embedUrl,
    // The member's own title wins; the platform's is the fallback, so a clip
    // posted with an empty title still reads as something on the review queue.
    title: (String(body.title ?? '').trim() || meta.title).slice(0, MAX_TITLE),
    thumbnailUrl: meta.thumbnailUrl,
    authorName: meta.authorName,
    sourceSeconds,
    trimStartSeconds: 0,
    trimEndSeconds: 0,
    seconds,
    measured,
    order,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  await auditLog('submitClip', authUser.uid, { clipId, platform: parsed.platform, videoId: parsed.videoId, measured })

  return json(200, {
    ok: true,
    clip: {
      id: clipId, platform: parsed.platform, sourceUrl: parsed.canonicalUrl,
      title: (String(body.title ?? '').trim() || meta.title).slice(0, MAX_TITLE),
      thumbnailUrl: meta.thumbnailUrl,
      sourceSeconds, seconds, measured, order, status: 'pending',
    },
  })
})
