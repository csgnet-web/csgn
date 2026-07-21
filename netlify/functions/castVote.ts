// Token-weighted vote. Voting power = the wallet's on-chain CSGN balance
// (the wallet is signature-proven first, so the weight cannot be spoofed).
// One ballot per wallet — re-voting moves that wallet's full weight. The
// running tally (tokens + distinct wallet count per option) is kept in
// votes/{voteId} and updated atomically so concurrent votes never lose counts.
import { verifyProofToken } from './_shared/proofTokens'
import { beginTransaction, commitWrites, createWrite, getDoc, updateWrite } from './_shared/firebaseAdmin'
import { badRequest, conflict, forbidden } from './_shared/errors'
import { json, parseJson, requireMethod, withHttp } from './_shared/http'
import { requireString } from './_shared/validators'
import { checkRateLimit, clientIp } from './_shared/rateLimit'
import { getCsgnBalance } from './_shared/solana'

type WalletProof = { type: string; walletAddress: string; exp: number; iat: number; jti: string }
type Body = { proofToken?: string; voteId?: string; option?: number }
type Ballot = { option?: number; weight?: number }
type Cell = { tokens: number; wallets: number }
type VoteDoc = { tally?: Record<string, Cell>; options?: string[]; status?: string }

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  await checkRateLimit(clientIp(event), 'castVote', 20)

  const body = parseJson<Body>(event)
  const proof = verifyProofToken<WalletProof>(requireString(body.proofToken, 'proofToken'), 'phantom_wallet')
  const wallet = proof.walletAddress
  const voteId = requireString(body.voteId, 'voteId')
  const option = Number(body.option)
  if (!Number.isInteger(option) || option < 0 || option > 3) throw badRequest('Invalid option.', 'invalid_option')

  // Must match the current, open vote in config/ticker.
  const ticker = await getDoc<{ vote?: { id?: string; options?: string[]; status?: string } }>('config/ticker')
  const cur = ticker?.vote
  if (!cur || cur.id !== voteId) throw conflict('This vote is no longer active.', 'vote_inactive')
  if (cur.status === 'closed') throw conflict('Voting is closed.', 'vote_closed')
  const options = Array.isArray(cur.options) ? cur.options.map(String) : []
  if (option >= options.length) throw badRequest('Invalid option.', 'invalid_option')

  // Voting power = on-chain CSGN balance.
  const weight = Math.floor(await getCsgnBalance(wallet))
  if (weight <= 0) throw forbidden('You must hold $CSGN to vote — your voting power equals your $CSGN balance.')

  const votePath = `votes/${voteId}`
  const ballotPath = `votes/${voteId}/ballots/${wallet}`

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const txn = await beginTransaction()
      const [prev, voteDoc] = await Promise.all([getDoc<Ballot>(ballotPath, txn), getDoc<VoteDoc>(votePath, txn)])
      const tally: Record<string, Cell> = { ...(voteDoc?.tally || {}) }
      const cell = (k: number): Cell => {
        const key = String(k)
        if (!tally[key]) tally[key] = { tokens: 0, wallets: 0 }
        return tally[key]
      }
      if (prev && Number.isInteger(prev.option)) {
        const p = cell(prev.option as number)
        p.tokens = Math.max(0, p.tokens - (prev.weight || 0))
        p.wallets = Math.max(0, p.wallets - 1)
      }
      const c = cell(option)
      c.tokens += weight
      c.wallets += 1
      const now = new Date().toISOString()
      const writes = [
        voteDoc
          ? updateWrite(votePath, { tally, options, status: cur.status || 'open', updatedAt: now }, true)
          : createWrite(votePath, { tally, options, status: cur.status || 'open', voteId, updatedAt: now }),
        prev
          ? updateWrite(ballotPath, { option, weight, wallet, updatedAt: now }, true)
          : createWrite(ballotPath, { option, weight, wallet, createdAt: now }),
      ]
      await commitWrites(writes, txn)
      return json(200, { ok: true, option, weight, tally })
    } catch {
      // transaction conflict / transient — retry with a fresh read
    }
  }
  throw conflict('The vote is busy right now — please try again.', 'tally_contended')
})
