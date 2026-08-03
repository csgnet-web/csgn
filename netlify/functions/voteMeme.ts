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
type Body = { proofToken?: string; address?: string; symbol?: string }
type Cell = { tokens: number; wallets: number }
type Ballot = { address?: string; symbol?: string; weight?: number }
type VoteDoc = { tallies?: Record<string, Cell> }

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  await checkRateLimit(clientIp(event), 'voteMeme', 20)

  const body = parseJson<Body>(event)
  const proof = verifyProofToken<WalletProof>(requireString(body.proofToken, 'proofToken'), 'phantom_wallet')
  const wallet = proof.walletAddress
  // Ballots are cast against the MINT, not a typed ticker. Symbols collide
  // ($BONK / BONK / Bonk all used to be three different rows in the tally) and a
  // string nobody can look up makes the whole ranking unauditable. The mint is
  // the identity; the symbol below is carried only for display.
  const address = requireString(body.address, 'address')
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) throw badRequest('Pick a coin from the board.', 'bad_mint')

  // It must be ON the published board. An open nomination field is a moderation
  // incident waiting to happen when the result goes on air — holders rank the
  // curated set, they don't nominate into it.
  const board = await getDoc<{ coins?: Array<{ address?: string; symbol?: string }> }>('public/memeBoard')
  const entry = (board?.coins || []).find((c) => c?.address === address)
  if (!entry) throw badRequest('That coin is not on the Meme 100 board.', 'not_on_board')
  const symbol = String(entry.symbol || '').toUpperCase().slice(0, 12)

  const weight = Math.floor(await getCsgnBalance(wallet))
  if (weight <= 0) throw forbidden('You must hold $CSGN to vote — your voting power equals your $CSGN balance.')

  const votePath = 'public/memeVote'
  const ballotPath = `memeBallots/${wallet}`
  const key = address

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const txn = await beginTransaction()
      const [prev, voteDoc] = await Promise.all([getDoc<Ballot>(ballotPath, txn), getDoc<VoteDoc>(votePath, txn)])
      const tallies: Record<string, Cell> = { ...(voteDoc?.tallies || {}) }
      const cell = (k: string): Cell => {
        if (!tallies[k]) tallies[k] = { tokens: 0, wallets: 0 }
        return tallies[k]
      }
      if (prev && (prev.address || prev.symbol)) {
        // Legacy ballots were keyed by symbol; decrement whichever key they used
        // so a re-vote can't strand old weight on a row nobody can clear.
        const p = cell(prev.address || prev.symbol!)
        p.tokens = Math.max(0, p.tokens - (prev.weight || 0))
        p.wallets = Math.max(0, p.wallets - 1)
      }
      const c = cell(key)
      c.tokens += weight
      c.wallets += 1
      const now = new Date().toISOString()
      const writes = [
        voteDoc ? updateWrite(votePath, { tallies, updatedAt: now }, true) : createWrite(votePath, { tallies, updatedAt: now }),
        prev
          ? updateWrite(ballotPath, { address, symbol, weight, wallet, updatedAt: now }, true)
          : createWrite(ballotPath, { address, symbol, weight, wallet, createdAt: now }),
      ]
      await commitWrites(writes, txn)
      if (!prev) await bumpOnAirAction('vote')
      return json(200, { ok: true, address, symbol, weight, tallies })
    } catch {
      // transaction conflict / transient — retry with a fresh read
    }
  }
  throw conflict('The meme vote is busy right now — please try again.', 'tally_contended')
})
