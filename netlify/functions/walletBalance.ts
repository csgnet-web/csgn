/**
 * $CSGN BALANCE FOR A WALLET — one implementation, served over HTTP.
 *
 * ── Why the browser stopped reading the chain itself ────────────────────────
 *
 * `src/lib/csgnBalance.ts` used to POST to `api.mainnet-beta.solana.com`
 * directly from the page. It never worked, and it failed in the worst possible
 * way: `connect-src` in our Content-Security-Policy does not list any Solana
 * host, so the browser BLOCKED the request outright — and the function's
 * `catch { return 0 }` turned that block into a balance of zero.
 *
 * So the wallet panel, the Right Now gate and the jukebox affordability check
 * all read zero for every wallet, always, including one holding 1.89 million
 * $CSGN. Not a chain problem, not a wallet problem: a CSP rule and a catch that
 * swallowed it.
 *
 * Three reasons this belongs on the server rather than being fixed by widening
 * the CSP:
 *
 *  1. ONE IMPLEMENTATION. The server already reads balances — for the daily
 *     lock, for votes, for the jukebox — through a failover list of RPC
 *     providers. A second reader in the browser is a second thing to keep
 *     right, and it was already wrong.
 *  2. THE CSP STAYS TIGHT. Adding public RPC hosts to `connect-src` widens what
 *     any injected script on the page may talk to, on a site that handles
 *     wallet signatures.
 *  3. RATE LIMITS ARE SHARED. A per-visitor browser read hammers a public
 *     endpoint from thousands of IPs; one server read can be cached.
 *
 * Public and unauthenticated, because a balance is public on-chain data and
 * gating it would mean the connect panel could not show a number until after
 * sign-in. Rate-limited, because it costs an outbound RPC call.
 */
import { json, requireMethod, withHttp } from './_shared/http'
import { checkRateLimit, clientIp } from './_shared/rateLimit'
import { getCsgnBalance } from './_shared/solana'
import { memo } from './_shared/cache'

/** Balances move on trades, not on renders. Ten seconds is short enough that a
 *  member who just bought sees it, long enough that a page with three panels
 *  reading the same wallet costs one RPC call. */
const BALANCE_TTL_MS = 10_000

const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

export const handler = withHttp(async (event) => {
  requireMethod(event, 'GET')

  const address = String(event.queryStringParameters?.address || '').trim()
  if (!SOLANA_ADDRESS_RE.test(address)) {
    return json(400, { error: 'bad_address', message: 'Not a Solana address.' })
  }

  try {
    await checkRateLimit(clientIp(event), 'walletBalance', 60)
  } catch {
    // Rate-limited. `null` rather than 0 — see below.
    return json(200, { address, balance: null, error: 'busy' })
  }

  try {
    const balance = await memo(`balance:${address}`, BALANCE_TTL_MS, () => getCsgnBalance(address))
    return json(200, { address, balance })
  } catch (err) {
    // NULL, NEVER ZERO.
    //
    // This is the whole lesson of the bug this endpoint replaces. "We could not
    // read the chain" and "this wallet holds nothing" are opposite facts, and
    // rendering the first as the second told a holder their tokens did not
    // count. Every caller treats null as unknown and says so.
    return json(200, {
      address,
      balance: null,
      error: err instanceof Error ? err.message : 'unreadable',
    })
  }
})
