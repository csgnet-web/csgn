// Settle a member's outstanding creator fees in one action.
//
// SOL creator-fee transfers are manual until the pull-based claim contract
// exists (docs/plan-twitch-first-claim.md §5.3–5.5), so an admin sends the SOL
// by hand and then records it here. That is the whole reason a transaction
// signature is REQUIRED: a "paid" flag with nothing behind it is a claim, while
// a signature is a receipt anyone can check on-chain. We validate its shape and
// deliberately do not verify it against the chain — that needs an RPC round
// trip per slot and would make an outage at the RPC provider block settlement.
//
// The batch is per member rather than per slot because that is how the money
// actually moves: one transfer covering the hours they are owed for.
import { requireAdminUser } from './_shared/auth'
import { auditLog } from './_shared/audit'
import { badRequest } from './_shared/errors'
import { commitWrites, getDoc, updateWrite } from './_shared/firebaseAdmin'
import { json, parseJson, requireMethod, withHttp } from './_shared/http'

type Body = { slotIds?: unknown; txSignature?: unknown }

/** Enough slots for a long backlog, few enough to stay one commit. */
const MAX_SLOTS_PER_CALL = 50
const SLOT_ID_RE = /^[a-zA-Z0-9_-]{3,120}$/
/** Base58, at the length a Solana signature actually is. */
const TX_SIGNATURE_RE = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/
/** Notification arrays live on the member's own doc; cap so settling fees can
 *  never grow a document every profile read then pays to transfer. */
const MAX_NOTIFICATIONS = 50

export interface SlotDoc {
  id?: string
  label?: string
  startTime?: string
  assignedUid?: string
  creatorFees?: { paymentStatus?: string; paidAt?: string; feeOwedSOL?: number }
}

export interface SettlementRow { id: string; doc: SlotDoc | null }

/** A signature we are willing to record. Shape only — see the header for why we
 *  deliberately stop short of asking the chain. */
export const isValidTxSignature = (value: unknown): boolean => TX_SIGNATURE_RE.test(String(value ?? '').trim())

/**
 * Split the requested slots into what this call settles and what it leaves
 * alone. Pure, and exported, because it IS the idempotency guarantee: marking a
 * group paid twice — a double-click, a retried request, an admin working from a
 * stale list — must never restamp a settled slot with a second signature, and
 * must never double-count one in the audit trail.
 *
 * A slot with no fee record is not payable either: there is no amount that
 * could have been sent. The pending default matches `isFeePending` on the
 * client, so what the admin sees as awaiting a decision is exactly what this
 * will settle.
 */
export function partitionSettlement(rows: SettlementRow[]): {
  settling: SettlementRow[]
  alreadySettled: string[]
  missing: string[]
} {
  const pending = (row: SettlementRow) =>
    !!row.doc?.creatorFees && (row.doc.creatorFees.paymentStatus ?? 'pending') === 'pending'
  return {
    settling: rows.filter(pending),
    alreadySettled: rows.filter((r) => r.doc?.creatorFees && !pending(r)).map((r) => r.id),
    missing: rows.filter((r) => !r.doc?.creatorFees).map((r) => r.id),
  }
}

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  const user = await requireAdminUser(event)
  const body = parseJson<Body>(event)

  const slotIds = [...new Set((Array.isArray(body.slotIds) ? body.slotIds : []).map((id) => String(id ?? '')))]
  if (slotIds.length === 0) throw badRequest('At least one slotId is required.', 'missing_slot_ids')
  if (slotIds.length > MAX_SLOTS_PER_CALL) throw badRequest(`At most ${MAX_SLOTS_PER_CALL} slots per call.`, 'too_many_slots')
  if (!slotIds.every((id) => SLOT_ID_RE.test(id))) throw badRequest('Invalid slotId.', 'invalid_slot_id')

  const txSignature = String(body.txSignature ?? '').trim()
  if (!isValidTxSignature(txSignature)) {
    throw badRequest('A valid Solana transaction signature is required.', 'invalid_tx_signature')
  }

  const nowISO = new Date().toISOString()
  const slots = await Promise.all(slotIds.map(async (id) => ({ id, doc: await getDoc<SlotDoc>(`slots/${id}`) })))
  const { settling, alreadySettled, missing } = partitionSettlement(slots)

  if (settling.length === 0) {
    return json(200, { ok: true, marked: 0, skipped: [...alreadySettled, ...missing], totalSOL: 0 })
  }

  await commitWrites(settling.map(({ id }) => updateWrite(`slots/${id}`, {
    'creatorFees.paymentStatus': 'paid',
    'creatorFees.paidAt': nowISO,
    'creatorFees.paidTxSignature': txSignature,
    'creatorFees.paidByUid': user.uid,
    'creatorFees.updatedAt': nowISO,
  })))

  const totalSOL = settling.reduce((sum, { doc }) => sum + (Number(doc!.creatorFees?.feeOwedSOL) || 0), 0)

  // One notification per member covering the whole transfer — the streamer got
  // one payment, so they should read about one payment.
  const byMember = new Map<string, typeof settling>()
  for (const row of settling) {
    const uid = String(row.doc!.assignedUid || '')
    if (!uid) continue
    byMember.set(uid, [...(byMember.get(uid) ?? []), row])
  }
  await Promise.all([...byMember].map(async ([uid, rows]) => {
    try {
      const member = await getDoc<{ notifications?: unknown[] }>(`users/${uid}`)
      if (!member) return
      const memberSOL = rows.reduce((sum, { doc }) => sum + (Number(doc!.creatorFees?.feeOwedSOL) || 0), 0)
      const existing = Array.isArray(member.notifications) ? member.notifications : []
      const notification = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        type: 'fee_paid',
        slotId: rows[0].id,
        slotLabel: String(rows[0].doc!.label || ''),
        slotStart: String(rows[0].doc!.startTime || ''),
        message: `Your creator fee payment of ${memberSOL.toFixed(6)} SOL for ${rows.length} slot${rows.length === 1 ? '' : 's'} has been sent to your wallet.`,
        read: false,
        createdAt: nowISO,
      }
      await commitWrites([updateWrite(`users/${uid}`, {
        notifications: [notification, ...existing].slice(0, MAX_NOTIFICATIONS),
      })])
    } catch (err) {
      // The money moved and the slots are settled; a notification that failed
      // to write is not a reason to report the payout as failed.
      console.warn('[adminMarkFeesPaid] notification failed', uid, err)
    }
  }))

  await auditLog('markFeesPaid', user.uid, {
    slotIds: settling.map((s) => s.id),
    skipped: [...alreadySettled, ...missing],
    txSignature,
    totalSOL,
    members: [...byMember.keys()],
  })

  return json(200, { ok: true, marked: settling.length, skipped: [...alreadySettled, ...missing], totalSOL })
})
