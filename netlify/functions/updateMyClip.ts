// Reorder or remove one of your own clips.
//
// Ordering is the "you are the producer" part of /studio — a member decides the
// running order of their own reel and the scheduler honours it exactly. Removal
// is immediate and total: a clip pulled here cannot air, including out of a
// schedule that was already built, because the builder only ever reads clips
// that still exist and are still approved.
import { requireUser } from './_shared/auth'
import { auditLog } from './_shared/audit'
import { badRequest, forbidden, notFound } from './_shared/errors'
import { commitWrites, deleteWrite, getDoc, updateWrite } from './_shared/firebaseAdmin'
import { json, parseJson, requireMethod, withHttp } from './_shared/http'
import { clampClipSeconds } from './_shared/clipEmbed'

type Body = { clipId?: unknown; action?: unknown; order?: unknown; seconds?: unknown; title?: unknown }

const CLIP_ID_RE = /^[a-zA-Z0-9_-]{3,120}$/

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  const authUser = await requireUser(event)
  const body = parseJson<Body>(event)

  const clipId = String(body.clipId ?? '')
  if (!CLIP_ID_RE.test(clipId)) throw badRequest('Valid clipId is required.', 'invalid_clip_id')

  const clip = await getDoc<{ uid?: string; status?: string }>(`clips/${clipId}`)
  if (!clip) throw notFound('Clip not found.')
  if (clip.uid !== authUser.uid) throw forbidden('That is not your clip.')

  const action = String(body.action ?? '')

  if (action === 'remove') {
    await commitWrites([deleteWrite(`clips/${clipId}`)])
    await auditLog('removeClip', authUser.uid, { clipId })
    return json(200, { ok: true, removed: clipId })
  }

  if (action === 'update') {
    const patch: Record<string, unknown> = { updatedAt: new Date() }
    if (body.order !== undefined) patch.order = Math.max(0, Math.floor(Number(body.order) || 0))
    if (body.seconds !== undefined) patch.seconds = clampClipSeconds(body.seconds)
    if (body.title !== undefined) patch.title = String(body.title).trim().slice(0, 80)
    // Editing the content of an already-approved clip sends it back for review.
    // Otherwise "approve it short and clean, then make it 2 minutes" is an
    // unreviewed change to what airs.
    if ((body.seconds !== undefined || body.title !== undefined) && clip.status === 'approved') {
      patch.status = 'pending'
      patch.rejectReason = null
    }
    await commitWrites([updateWrite(`clips/${clipId}`, patch)])
    return json(200, { ok: true, clipId, reReview: patch.status === 'pending' })
  }

  throw badRequest('Unknown action.', 'bad_action')
})
