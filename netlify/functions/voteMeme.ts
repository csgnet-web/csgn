// Meme-100 community vote. Holders back a memecoin with their $CSGN WEIGHT — no
// burn, no stake, no transfer: voting power simply equals the wallet's on-chain
// $CSGN balance (signature-proven, so it can't be spoofed). One ballot per wallet
// (re-voting moves the wallet's full weight). The running tally per symbol lives
// in the world-readable public/memeVote doc; the OBS ticker blends this vote
// weight with each coin's live volume + market cap into a "power score" and airs
// the community pick. Individual ballots (memeBallots/{wallet}) are server-only.
import { verifyProofToken } from './_shared/proofTokens'
import { beginTransaction, commitWrites, createWrite, getDoc, updateWrite } from './_shared/firebaseAdmin'
import { badRequest, conflict, forbidden } from './_shared/errors'
import { json, parseJson, requireMethod, withHttp } from './_shared/http'
import { requireString } from './_shared/validators'
import { checkRateLimit, clientIp } from './_shared/rateLimit'
import { getCsgnBalance } from './_shared/solana'
import { bumpOnAirAction } from './_shared/onAirActions'

type WalletProof = { type: string; walletAddress: string; exp: number; iat: number; jti: string }
type Body = { proofToken?: string; symbol?: string }
type Cell = { tokens: number; wallets: number }
type Ballot = { symbol?: string; weight?: number }
type VoteDoc = { tallies?: Record<string, Cell> }

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  await checkRateLimit(clientIp(event), 'voteMeme', 20)

  const body = parseJson<Body>(event)
  const proof = verifyProofToken<WalletProof>(requireString(body.proofToken, 'proofToken'), 'phantom_wallet')
  const wallet = proof.walletAddress
  const symbol = requireString(body.symbol, 'symbol').toUpperCase().slice(0, 12)
  if (!/^[A-Z0-9$]{2,12}$/.test(symbol)) throw badRequest('Enter a valid ticker symbol (2–12 chars).', 'bad_symbol')

  const weight = Math.floor(await getCsgnBalance(wallet))
  if (weight <= 0) throw forbidden('You must hold $CSGN to vote — your voting power equals your $CSGN balance.')

  const votePath = 'public/memeVote'
  const ballotPath = `memeBallots/${wallet}`

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const txn = await beginTransaction()
      const [prev, voteDoc] = await Promise.all([getDoc<Ballot>(ballotPath, txn), getDoc<VoteDoc>(votePath, txn)])
      const tallies: Record<string, Cell> = { ...(voteDoc?.tallies || {}) }
      const cell = (k: string): Cell => {
        if (!tallies[k]) tallies[k] = { tokens: 0, wallets: 0 }
        return tallies[k]
      }
      if (prev && prev.symbol) {
        const p = cell(prev.symbol)
        p.tokens = Math.max(0, p.tokens - (prev.weight || 0))
        p.wallets = Math.max(0, p.wallets - 1)
      }
      const c = cell(symbol)
      c.tokens += weight
      c.wallets += 1
      const now = new Date().toISOString()
      const writes = [
        voteDoc ? updateWrite(votePath, { tallies, updatedAt: now }, true) : createWrite(votePath, { tallies, updatedAt: now }),
        prev ? updateWrite(ballotPath, { symbol, weight, wallet, updatedAt: now }, true) : createWrite(ballotPath, { symbol, weight, wallet, createdAt: now }),
      ]
      await commitWrites(writes, txn)
      if (!prev) await bumpOnAirAction('vote')
      return json(200, { ok: true, symbol, weight, tallies })
    } catch {
      // transaction conflict / transient — retry with a fresh read
    }
  }
  throw conflict('The meme vote is busy right now — please try again.', 'tally_contended')
})
