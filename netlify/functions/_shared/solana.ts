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

interface ParsedInstr { program?: string; parsed?: { type?: string; info?: Record<string, unknown> } }
interface TxResponse {
  result?: {
    meta?: { err?: unknown; innerInstructions?: Array<{ instructions?: ParsedInstr[] }> }
    transaction?: { message?: { instructions?: ParsedInstr[]; accountKeys?: Array<{ pubkey?: string; signer?: boolean }> } }
  } | null
  error?: { message?: string }
}

const CSGN_TREASURY = 'CSGNUgUpBqTNM7EBZSMeA5jzPLFNR2hELhLjbHLpbEY4'
export const CSGN_TREASURY_ADDRESS = CSGN_TREASURY

/**
 * Verify `signature` is a CONFIRMED transfer of at least `minLamports` SOL from
 * `wallet` to the CSGN treasury — the trust boundary for the SOL "jukebox"
 * spotlight. Returns the lamports paid; throws unless it's a real, successful,
 * wallet-signed transfer to the treasury of >= the minimum. (A plain SOL
 * transfer is far simpler to construct + verify than an SPL burn.)
 *
 * NOTE: dry-run against a tiny real payment on mainnet before going public.
 */
export async function verifySolPayment(signature: string, wallet: string, minLamports: number): Promise<number> {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'getTransaction',
      params: [signature, { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 }],
    }),
  })
  if (!res.ok) throw new Error(`Solana RPC error ${res.status}`)
  const data = (await res.json()) as TxResponse
  if (data.error) throw new Error(`Solana RPC: ${data.error.message || 'error'}`)
  const tx = data.result
  if (!tx) throw new Error('Payment transaction not found or not yet confirmed.')
  if (tx.meta?.err) throw new Error('The payment transaction failed on-chain.')

  const keys = tx.transaction?.message?.accountKeys || []
  if (!keys.some((k) => k.pubkey === wallet && k.signer)) throw new Error('The payment was not signed by this wallet.')

  const all: ParsedInstr[] = [
    ...(tx.transaction?.message?.instructions || []),
    ...(tx.meta?.innerInstructions || []).flatMap((g) => g.instructions || []),
  ]
  let paid = 0
  for (const ix of all) {
    if (ix.program !== 'system') continue
    if (ix.parsed?.type !== 'transfer') continue
    const info = ix.parsed?.info || {}
    if (info.source !== wallet || info.destination !== CSGN_TREASURY) continue
    paid += Number(info.lamports) || 0
  }
  if (paid <= 0) throw new Error('No SOL payment from this wallet to the treasury found in that transaction.')
  if (paid < minLamports) throw new Error(`Payment of ${(paid / 1e9).toFixed(4)} SOL is below the required ${(minLamports / 1e9).toFixed(4)} SOL.`)
  return paid
}

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
