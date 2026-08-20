/**
 * A MEMBER'S OWN TIKTOKS — list them, and import the ones they pick.
 *
 * This is the payoff of connecting an account, and the reason it is worth a
 * week of work: it changes the unit of the ask. Today posting a clip means "go
 * to TikTok, find the post, copy the link, come back, paste". With this it
 * means "tick three of these". Choosing from what you already made is an order
 * of magnitude easier than fetching, and it is the single biggest lever on
 * posting conversion in the product.
 *
 * GET  → up to 20 of the member's public videos, newest first, with real
 *        durations. `?cursor=` pages.
 * POST → import the ticked ones onto their reel.
 *
 * ── Durations come free ────────────────────────────────────────────────────
 *
 * Every TikTok pasted by hand falls back to a 45-second guess, because TikTok's
 * oEmbed does not carry a runtime. video.list does. So an imported clip is
 * scheduled against its REAL length, and the airtime maths stops being
 * approximate for anybody who connects.
 *
 * ── What this endpoint will not do ─────────────────────────────────────────
 *
 * Import everything. A member with a connected account and forty videos would
 * otherwise fill the review queue and their own allocation in one tap, and then
 * wonder why thirty-eight of them never aired. The picker is deliberate, the
 * per-request batch is capped, and the response says how much airtime they
 * actually have so the choice is informed.
 */
import { requireUser } from './_shared/auth'
import { auditLog } from './_shared/audit'
import { badRequest } from './_shared/errors'
import { getDoc, writeDoc } from './_shared/firebaseAdmin'
import { json, parseJson, withHttp } from './_shared/http'
import { checkRateLimit, clientIp } from './_shared/rateLimit'
import { intakeClip, loadIntakeMember, MAX_CLIPS_PER_MEMBER } from './_shared/clipIntake'
import {
  accessTokenUsable, fetchVideoPage, refreshTokenExpired, refreshTokens, videoLabel,
  type TikTokTokens, type TikTokVideo,
} from './_shared/tiktok'

/** Clips per import request. Enough to be worth doing, small enough that a
 *  mistake is undoable and the review queue stays human-sized. */
const MAX_IMPORT_PER_CALL = 10

interface StoredTokens {
  accessToken?: string
  refreshToken?: string
  accessExpiresAt?: number
  refreshExpiresAt?: number
  openId?: string
}

type Body = { videoIds?: unknown }

/**
 * A usable access token, refreshing it if needed and persisting the rotation.
 *
 * Returns null when the member must reconnect — TikTok rotates the refresh
 * token on every use, so a refresh that fails is terminal and the honest thing
 * to do is say "reconnect", not retry forever.
 */
async function usableAccessToken(uid: string): Promise<string | null> {
  const stored = await getDoc<StoredTokens>(`tiktokTokens/${uid}`)
  if (!stored?.refreshToken) return null
  if (accessTokenUsable(stored)) return stored.accessToken || null
  if (refreshTokenExpired(stored)) return null

  const fresh: TikTokTokens | null = await refreshTokens(stored.refreshToken)
  if (!fresh) return null
  await writeDoc(`tiktokTokens/${uid}`, {
    accessToken: fresh.accessToken,
    refreshToken: fresh.refreshToken,
    accessExpiresAt: fresh.accessExpiresAt,
    refreshExpiresAt: fresh.refreshExpiresAt,
    openId: fresh.openId || stored.openId || '',
    updatedAt: new Date(),
  }, { merge: true })
  // Keep the member document's expiry in step so the UI's reconnect warning is
  // driven by the same number the server enforces.
  await writeDoc(`users/${uid}`, { tiktok: { refreshExpiresAt: fresh.refreshExpiresAt } }, { merge: true })
  return fresh.accessToken
}

/** Present a video for the picker. `alreadyOnReel` is what stops a member
 *  importing the same clip twice and being told off for it afterwards. */
function toPickerRow(v: TikTokVideo, onReel: Set<string>) {
  return {
    id: v.id,
    title: videoLabel(v),
    seconds: v.duration,
    coverImageUrl: v.coverImageUrl,
    shareUrl: v.shareUrl,
    createdAt: v.createdAt,
    alreadyOnReel: onReel.has(`tiktok:${v.id}`),
  }
}

export const handler = withHttp(async (event) => {
  const authUser = await requireUser(event)

  if (event.httpMethod === 'GET') {
    await checkRateLimit(clientIp(event), 'tiktokVideos', 30)
    const token = await usableAccessToken(authUser.uid)
    // NOT an empty list. "Reconnect TikTok" and "you have no videos" are
    // different sentences and the UI has to be able to tell them apart.
    if (!token) return json(200, { connected: false, videos: [], cursor: null, hasMore: false, slotsLeft: 0 })

    const cursorParam = Number(event.queryStringParameters?.cursor)
    const page = await fetchVideoPage(token, Number.isFinite(cursorParam) && cursorParam > 0 ? cursorParam : null)
    if (!page) return json(200, { connected: true, unreadable: true, videos: [], cursor: null, hasMore: false, slotsLeft: 0 })

    const member = await loadIntakeMember(authUser.uid)
    const onReel = new Set(member.existing.map((c) => c.clipKey))
    return json(200, {
      connected: true,
      videos: page.videos.map((v) => toPickerRow(v, onReel)),
      cursor: page.cursor,
      hasMore: page.hasMore,
      // How many more clips will fit. Shown up front so a member picks eight
      // rather than picking twenty and having twelve refused.
      slotsLeft: Math.max(0, MAX_CLIPS_PER_MEMBER - member.existing.length),
      maxPerImport: MAX_IMPORT_PER_CALL,
    })
  }

  if (event.httpMethod !== 'POST') throw badRequest('Method not allowed.', 'method_not_allowed')
  await checkRateLimit(clientIp(event), 'tiktokImport', 10)

  const body = parseJson<Body>(event)
  const ids = Array.isArray(body.videoIds) ? body.videoIds.map((v) => String(v)).filter(Boolean) : []
  if (ids.length === 0) throw badRequest('Pick at least one video.', 'no_videos_selected')
  if (ids.length > MAX_IMPORT_PER_CALL) {
    throw badRequest(`Import up to ${MAX_IMPORT_PER_CALL} at a time.`, 'too_many_videos')
  }

  const token = await usableAccessToken(authUser.uid)
  if (!token) throw badRequest('Reconnect TikTok to import — the connection has expired.', 'tiktok_reconnect')

  // Re-read the videos from TikTok rather than trusting ids and URLs from the
  // client. The share URL is what becomes the clip, so accepting one from the
  // browser would let anybody put any TikTok on their reel under the cover of
  // an "import" — and the durations we are importing FOR have to come from the
  // platform to mean anything.
  const wanted = new Set(ids)
  const found = new Map<string, TikTokVideo>()
  let cursor: number | null = null
  for (let page = 0; page < 3 && found.size < wanted.size; page++) {
    const res: Awaited<ReturnType<typeof fetchVideoPage>> = await fetchVideoPage(token, cursor)
    if (!res) break
    for (const v of res.videos) if (wanted.has(v.id)) found.set(v.id, v)
    if (!res.hasMore || !res.cursor) break
    cursor = res.cursor
  }
  if (found.size === 0) throw badRequest('Could not find those videos on your TikTok account.', 'videos_not_found')

  const member = await loadIntakeMember(authUser.uid)
  const imported: Array<{ id: string; title: string; seconds: number }> = []
  const skipped: Array<{ videoId: string; reason: string }> = []

  // One clip at a time, and a failure on one never stops the rest: a member who
  // ticked six and hit their cap on the fifth should get four, not zero, and be
  // told plainly which ones did not make it.
  for (const id of ids) {
    const video = found.get(id)
    if (!video) { skipped.push({ videoId: id, reason: 'not_found' }); continue }
    try {
      const clip = await intakeClip({
        uid: authUser.uid,
        url: video.shareUrl,
        title: videoLabel(video),
        // The whole reason this integration exists: a real runtime instead of
        // the 45-second guess a pasted TikTok gets.
        knownSeconds: video.duration > 0 ? video.duration : null,
        knownTitle: videoLabel(video),
        knownThumbnailUrl: video.coverImageUrl,
      }, member)
      imported.push({ id: clip.id, title: clip.title, seconds: clip.seconds })
    } catch (err) {
      const code = (err as { code?: string })?.code
      skipped.push({ videoId: id, reason: code || 'failed' })
    }
  }

  if (imported.length > 0) {
    await auditLog('tiktokImport', authUser.uid, { count: imported.length, skipped: skipped.length })
  }

  return json(200, {
    ok: imported.length > 0,
    imported,
    skipped,
    slotsLeft: Math.max(0, MAX_CLIPS_PER_MEMBER - member.existing.length),
  })
})
