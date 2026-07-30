// The CSGN treasury — the public balance sheet that replaces burning.
//
// CSGN never burns anything (see §11.1 of docs/master-plan.md). Instead every
// token the network receives goes to ONE public address under published rules,
// so anyone can watch the balance and hold us to the policy. A burn is a press
// release; a rule-bound public treasury is a balance sheet that does the same
// "supply won't come back to hit you" reassurance while the capital stays
// productive. This module is the read side of that promise.

import { CSGN_TREASURY, CSGN_MINT } from './slots'

const RPC_URL = 'https://api.mainnet-beta.solana.com'
const LAMPORTS_PER_SOL = 1_000_000_000

export const TREASURY_ADDRESS = CSGN_TREASURY
export const TREASURY_SOLSCAN_URL = `https://solscan.io/account/${CSGN_TREASURY}`

/** One published rule the treasury operates under — rendered verbatim on /treasury. */
export interface TreasuryRule {
  title: string
  body: string
}

/**
 * The policy, stated up front rather than promised in a DM. These four lines are
 * exactly what a burn buys (credibility that supply won't dump) delivered as a
 * balance sheet instead of a bonfire.
 */
export const TREASURY_RULES: TreasuryRule[] = [
  {
    title: 'Nothing is ever burned',
    body: 'Not $CSGN, not SOL, not a partner’s token. A burn destroys capital once for a press release; a public, rule-bound treasury buys the same trust while the capital stays working.',
  },
  {
    title: 'A 180-day no-sell window',
    body: 'Any partner token the treasury receives is held for a stated minimum of 180 days before it could ever be sold — published up front, not decided later.',
  },
  {
    title: 'A published drip cap',
    body: 'If anything is ever sold, never more than a small stated share of that token’s daily volume, and never more than a stated share of holdings per month. Slow and disclosed, never a dump.',
  },
  {
    title: 'A stated purpose',
    body: 'The treasury funds distribution, creator payouts, and liquidity — working capital, not a pile. Attention revenue accumulates and is recycled, including open-market $CSGN buys to pay creators.',
  },
]

export interface TreasuryBalances {
  /** Treasury SOL balance (UI amount), or null if the read failed. */
  sol: number | null
  /** Treasury $CSGN balance (UI amount), or null if the read failed. */
  csgn: number | null
}

async function rpc<T>(method: string, params: unknown[]): Promise<T | null> {
  try {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { result?: T; error?: unknown }
    if (data.error) return null
    return data.result ?? null
  } catch {
    return null
  }
}

/** Live treasury balances straight from Solana RPC. Read-only, best-effort — a
 *  failed read shows "—" rather than a wrong number. */
export async function fetchTreasuryBalances(): Promise<TreasuryBalances> {
  const [solRes, csgnRes] = await Promise.all([
    rpc<{ value?: number }>('getBalance', [CSGN_TREASURY]),
    rpc<{ value?: Array<{ account?: { data?: { parsed?: { info?: { tokenAmount?: { uiAmount?: number | null } } } } } }> }>(
      'getTokenAccountsByOwner',
      [CSGN_TREASURY, { mint: CSGN_MINT }, { encoding: 'jsonParsed' }],
    ),
  ])

  const sol = solRes?.value != null ? solRes.value / LAMPORTS_PER_SOL : null

  let csgn: number | null = null
  if (csgnRes?.value) {
    csgn = 0
    for (const acc of csgnRes.value) {
      const ui = acc.account?.data?.parsed?.info?.tokenAmount?.uiAmount
      if (ui != null) csgn += ui
    }
  }

  return { sol, csgn }
}
