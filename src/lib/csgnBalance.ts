import { api } from './api'

/**
 * A wallet's $CSGN balance, read through our own endpoint.
 *
 * ── Why this is not a direct RPC call any more ──────────────────────────────
 *
 * It used to POST to `api.mainnet-beta.solana.com` from the browser, and it had
 * never once worked in production. `connect-src` in our CSP lists no Solana
 * host, so the browser blocked the request before it left the page — and the
 * old `catch { return 0 }` turned that block into a balance of zero. Every
 * wallet, every time, including one holding 1.89 million $CSGN.
 *
 * The read now goes through `netlify/functions/walletBalance.ts`, which shares
 * the server's failover RPC list with the daily airtime lock and the vote
 * weighting — so there is exactly one implementation of "what does this wallet
 * hold", and fixing it fixes it everywhere.
 *
 * RETURNS NULL WHEN IT COULD NOT BE READ. That distinction is the entire point:
 * "the chain is unreachable" and "you hold nothing" are opposite facts, and
 * collapsing them into 0 is what made this invisible for so long. Callers must
 * render null as unknown, not as empty.
 */
export async function fetchCsgnBalance(walletAddress: string): Promise<number | null> {
  try {
    const res = await api.walletBalance(walletAddress)
    return res.balance
  } catch {
    return null
  }
}

// The Right Now threshold lives in src/lib/tokenGates.ts (and, live, in
// config/tokenGates) so the client and the server can never drift apart.
export { DEFAULT_TOKEN_GATES } from './tokenGates'
