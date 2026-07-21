// Server-side CSGN SPL-token balance via Solana JSON-RPC. Used to gate holder
// actions (Right Now submission, token-weighted voting) with a balance the
// caller cannot spoof — the wallet is first proven via the Phantom signature
// challenge (verifyPhantomSignature → phantom_wallet proof token), then this
// reads the on-chain balance for that address.

const CSGN_MINT = 'GFV7fphvprMr1PYpYGPJort2QP7JJLEp3J1Buu7Zpump'
// Configure a paid/less-throttled RPC via SOLANA_RPC_URL in Netlify; the public
// endpoint is the fallback and is fine at low request volume.
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'

export const CSGN_MINT_ADDRESS = CSGN_MINT

interface TokenAmount { uiAmount?: number | null; amount?: string; decimals?: number }
interface RpcAccount { account?: { data?: { parsed?: { info?: { tokenAmount?: TokenAmount } } } } }
interface RpcResponse { result?: { value?: RpcAccount[] }; error?: { message?: string } }

/** UI-amount CSGN held by a wallet (sums every token account for the mint). */
export async function getCsgnBalance(walletAddress: string): Promise<number> {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTokenAccountsByOwner',
      params: [walletAddress, { mint: CSGN_MINT }, { encoding: 'jsonParsed' }],
    }),
  })
  if (!res.ok) throw new Error(`Solana RPC error ${res.status}`)
  const data = (await res.json()) as RpcResponse
  if (data.error) throw new Error(`Solana RPC: ${data.error.message || 'error'}`)
  let total = 0
  for (const acc of data.result?.value || []) {
    const ta = acc.account?.data?.parsed?.info?.tokenAmount
    if (!ta) continue
    if (ta.uiAmount != null) total += ta.uiAmount
    else if (ta.amount != null && ta.decimals != null) total += Number(ta.amount) / Math.pow(10, ta.decimals)
  }
  return total
}
