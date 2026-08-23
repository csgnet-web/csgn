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
import { boundClipTrim } from './_shared/clipEmbed'

// No raw `seconds`. Length comes from the platform on submit — a member never
// types a duration. What they CAN do is crop: pick which part of their own video
// airs, which is only ever needed when their earned airtime is shorter than the
// video. The aired length is derived from that crop, never set directly.
type Body = {
  clipId?: unknown
  action?: unknown
  order?: unknown
  title?: unknown
  trimStartSeconds?: unknown
  trimEndSeconds?: unknown
}

const CLIP_ID_RE = /^[a-zA-Z0-9_-]{3,120}$/

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  const authUser = await requireUser(event)
  const body = parseJson<Body>(event)

  const clipId = String(body.clipId ?? '')
  if (!CLIP_ID_RE.test(clipId)) throw badRequest('Valid clipId is required.', 'invalid_clip_id')

  const clip = await getDoc<{ uid?: string; status?: string; sourceSeconds?: number; seconds?: number }>(`clips/${clipId}`)
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
    if (body.title !== undefined) patch.title = String(body.title).trim().slice(0, 80)

    // ── The crop ──
    // Bounded by the source length, so a member can only ever select a window
    // INSIDE their own video. Without that bound a crop could ask the scheduler
    // for more airtime than the clip contains, and the segment would run out
    // into dead air on the broadcast.
    if (body.trimStartSeconds !== undefined || body.trimEndSeconds !== undefined) {
      const source = Math.max(0, Math.floor(Number(clip.sourceSeconds) || 0))
      if (source <= 0) throw badRequest('This clip has no measured length to crop.', 'not_croppable')

      // boundClipTrim, not inline arithmetic — it is unit-tested and it is the
      // only thing that knows how a crop maps onto a real video.
      const bounded = boundClipTrim(source, body.trimStartSeconds, body.trimEndSeconds)
      patch.trimStartSeconds = bounded.startSeconds
      patch.trimEndSeconds = bounded.endSeconds
      patch.seconds = bounded.seconds
      // A crop changes what airs, so it goes back through review. Otherwise
      // "approve the clean thirty seconds, then move the window" is an
      // unreviewed edit to the broadcast.
      if (clip.status === 'approved') {
        patch.status = 'pending'
        patch.rejectReason = null
      }
    }

    // Retitling an already-approved clip sends it back for review: the title is
    // what a reviewer read, and what appears beside it on air.
    if (body.title !== undefined && clip.status === 'approved') {
      patch.status = 'pending'
      patch.rejectReason = null
    }
    await commitWrites([updateWrite(`clips/${clipId}`, patch)])
    return json(200, { ok: true, clipId, reReview: patch.status === 'pending' })
  }

  throw badRequest('Unknown action.', 'bad_action')
})
