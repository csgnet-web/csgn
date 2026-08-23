// Approve or reject a submitted clip.
//
// This is the gate the whole feature depends on. A CSGN hour goes out on a real
// Twitch channel, and one copyrighted song or one piece of illegal content is a
// strike against the channel everybody else is relying on. So approval is
// PRE-air and manual, and the reviewer is looking at the member's actual post on
// the platform it lives on.
import { requireAdminUser } from './_shared/auth'
import { auditLog } from './_shared/audit'
import { badRequest, notFound } from './_shared/errors'
import { commitWrites, getDoc, updateWrite } from './_shared/firebaseAdmin'
import { json, parseJson, requireMethod, withHttp } from './_shared/http'

type Body = { clipId?: unknown; decision?: unknown; reason?: unknown }

const CLIP_ID_RE = /^[a-zA-Z0-9_-]{3,120}$/

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  const admin = await requireAdminUser(event)
  const body = parseJson<Body>(event)

  const clipId = String(body.clipId ?? '')
  if (!CLIP_ID_RE.test(clipId)) throw badRequest('Valid clipId is required.', 'invalid_clip_id')

  const decision = String(body.decision ?? '')
  if (decision !== 'approved' && decision !== 'rejected') {
    throw badRequest("Decision must be 'approved' or 'rejected'.", 'bad_decision')
  }

  const clip = await getDoc<{ uid?: string; sourceUrl?: string; platform?: string }>(`clips/${clipId}`)
  if (!clip) throw notFound('Clip not found.')

  const reason = String(body.reason ?? '').trim().slice(0, 300)
  if (decision === 'rejected' && !reason) {
    // A rejection without a reason is a dead end for the member and a mystery
    // for the next reviewer.
    throw badRequest('Say why it was rejected.', 'missing_reason')
  }

  await commitWrites([updateWrite(`clips/${clipId}`, {
    status: decision,
    rejectReason: decision === 'rejected' ? reason : null,
    reviewedAt: new Date(),
    reviewedByUid: admin.uid,
    updatedAt: new Date(),
  })])

  await auditLog('reviewClip', admin.uid, { clipId, decision, reason: reason || null, owner: clip.uid ?? null, sourceUrl: clip.sourceUrl ?? null })

  return json(200, { ok: true, clipId, status: decision })
})
