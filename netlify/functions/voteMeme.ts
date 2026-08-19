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
import { fetchJson } from './_shared/cache'
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

  // ── ON THE BOARD, OR A REAL COIN ──
  //
  // The board is the pick list, not the limit. A member who wants to back
  // something that launched this morning should not be told it does not exist;
  // the ranking's thresholds decide what makes the BOARD, and a vote is a
  // member's own conviction rather than an editorial decision.
  //
  // What is still refused is a string that resolves to nothing. Every ballot is
  // cast against a mint that has a real Solana pair, so the tally can never
  // contain an address nobody can look up — which is the property that makes
  // the whole ranking auditable.
  const board = await getDoc<{ coins?: Array<{ address?: string; symbol?: string }> }>('public/memeBoard')
  const entry = (board?.coins || []).find((c) => c?.address === address)

  let symbol = String(entry?.symbol || '').toUpperCase().slice(0, 12)
  if (!entry) {
    const looked = await lookupSolanaCoin(address)
    if (!looked) {
      throw badRequest(
        'No Solana trading pair found for that address. Check the contract address and try again.',
        'unknown_mint',
      )
    }
    symbol = looked.symbol
  }

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


/**
 * Resolve a mint that is not on the board.
 *
 * Deliberately minimal: it answers "is this a real, tradeable Solana coin, and
 * what is it called". It does not judge the coin and it does not add it to the
 * board — an off-board vote counts toward that mint's tally and the coin
 * appears in the ranking only if it later clears the published thresholds on
 * its own.
 */
async function lookupSolanaCoin(address: string): Promise<{ symbol: string } | null> {
  interface Pair {
    chainId?: string
    baseToken?: { symbol?: string }
    liquidity?: { usd?: number }
  }
  const data = await fetchJson<{ pairs?: Pair[] }>(
    `https://api.dexscreener.com/latest/dex/tokens/${address}`,
    { timeoutMs: 4_000 },
  )
  const pairs = (data?.pairs ?? []).filter((p) => !p.chainId || p.chainId === 'solana')
  if (pairs.length === 0) return null
  const best = pairs.reduce((a, b) => ((b.liquidity?.usd ?? 0) > (a.liquidity?.usd ?? 0) ? b : a))
  const symbol = String(best.baseToken?.symbol || '').toUpperCase().slice(0, 12)
  return { symbol: symbol || address.slice(0, 4).toUpperCase() }
}
