// Admin: close a token-weighted vote and settle it against live on-chain
// balances. The running tally is incremental and therefore inflatable (vote,
// move the bag to a fresh wallet, vote again — see _shared/settleVotes.ts); this
// is the pass that makes the RESULT mean something. The settled tally is written
// back over the live one, and `settledAt` marks it as final.
import { requireAdminUser } from './_shared/auth'
import { auditLog } from './_shared/audit'
import { getDoc, queryCollection, writeDoc } from './_shared/firebaseAdmin'
import { badRequest } from './_shared/errors'
import { json, parseJson, requireMethod, withHttp } from './_shared/http'
import { readLiveWeights, settleTally, type BallotRow } from './_shared/settleVotes'

/** Ballots read per settle. Generous for a network this size, and bounded so one
 *  call can never fan out into thousands of RPC reads. */
const MAX_BALLOTS = 500

type Body = { voteId?: string; close?: boolean }
type StoredBallot = { option?: unknown; symbol?: unknown; weight?: unknown; wallet?: unknown }

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  const admin = await requireAdminUser(event)
  const body = parseJson<Body>(event)
  const voteId = String(body.voteId || '')
  if (!/^[a-zA-Z0-9_-]{3,120}$/.test(voteId)) throw badRequest('Valid voteId is required.', 'invalid_vote_id')

  const rows = await queryCollection('ballots', [], [], MAX_BALLOTS, `votes/${voteId}`)
  const ballots: Array<BallotRow & { storedWeight?: number }> = rows.flatMap((row) => {
    const d = row.data as StoredBallot
    const wallet = String(d.wallet || row.path.split('/').pop() || '')
    if (!wallet) return []
    // A vote ballot carries an option index; a Meme-100 ballot carries a symbol.
    const key = d.option != null ? String(d.option) : String(d.symbol || '')
    if (!key) return []
    return [{ wallet, key, storedWeight: Number(d.weight) || 0 }]
  })

  const live = await readLiveWeights(ballots.map((b) => b.wallet))
  const settled = settleTally(ballots, live)

  const existing = await getDoc<{ options?: unknown }>(`votes/${voteId}`)
  await writeDoc(`votes/${voteId}`, {
    tally: settled.tally,
    settledAt: new Date().toISOString(),
    settledCounts: { counted: settled.counted, dropped: settled.dropped, unread: settled.unread, ballots: ballots.length },
    ...(body.close === false ? {} : { status: 'closed' }),
    updatedAt: new Date().toISOString(),
  }, { merge: true })

  // Keep the on-air card in step with the ledger when this vote is the live one.
  const ticker = await getDoc<{ vote?: { id?: string } | null }>('config/ticker')
  if (ticker?.vote?.id === voteId && body.close !== false) {
    await writeDoc('config/ticker', {
      vote: { ...ticker.vote, status: 'closed' },
      updatedAt: new Date().toISOString(),
    }, { merge: true })
  }

  await auditLog('adminSettleVote', admin.uid, { voteId, ...settled.counted !== undefined ? { counted: settled.counted, dropped: settled.dropped } : {} })
  return json(200, {
    ok: true,
    voteId,
    ballots: ballots.length,
    counted: settled.counted,
    dropped: settled.dropped,
    unread: settled.unread,
    tally: settled.tally,
    options: existing?.options ?? [],
  })
})
