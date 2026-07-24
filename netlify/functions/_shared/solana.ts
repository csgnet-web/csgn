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

/**
 * Verify that `signature` is a CONFIRMED transaction that burned at least
 * `minUiAmount` CSGN, authorized by `wallet`. Returns the burned UI amount.
 * Throws (never returns a partial success) if the tx is missing, failed, not a
 * CSGN burn, not signed/authorized by `wallet`, or under the minimum. This is
 * the trust boundary for buy-and-burn: nothing on-chain is taken on faith — the
 * server re-reads the confirmed transaction and re-checks every field.
 *
 * NOTE: exercise this against a tiny real burn on mainnet before opening it to
 * the public — it has not been run against a live transaction in this repo.
 */
export async function verifyCsgnBurn(signature: string, wallet: string, minUiAmount: number): Promise<number> {
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
  if (!tx) throw new Error('Transaction not found or not yet confirmed.')
  if (tx.meta?.err) throw new Error('The burn transaction failed on-chain.')

  // `wallet` must be a signer of the transaction (it authorized the burn).
  const keys = tx.transaction?.message?.accountKeys || []
  const isSigner = keys.some((k) => k.pubkey === wallet && k.signer)
  if (!isSigner) throw new Error('The burn was not signed by this wallet.')

  // Scan every instruction (top-level + inner) for an spl-token burn of CSGN
  // authorized by the wallet, and sum the burned amount.
  const all: ParsedInstr[] = [
    ...(tx.transaction?.message?.instructions || []),
    ...(tx.meta?.innerInstructions || []).flatMap((g) => g.instructions || []),
  ]
  let burned = 0
  for (const ix of all) {
    if (ix.program !== 'spl-token') continue
    const t = ix.parsed?.type
    if (t !== 'burn' && t !== 'burnChecked') continue
    const info = ix.parsed?.info || {}
    if (info.mint !== CSGN_MINT) continue
    if (info.authority !== wallet) continue
    if (t === 'burnChecked') {
      const ta = info.tokenAmount as TokenAmount | undefined
      if (ta?.uiAmount != null) burned += ta.uiAmount
      else if (ta?.amount != null && ta.decimals != null) burned += Number(ta.amount) / Math.pow(10, ta.decimals)
    } else {
      // legacy burn: raw base units, CSGN is 6 decimals
      const amt = info.amount as string | undefined
      if (amt != null) burned += Number(amt) / 1e6
    }
  }
  if (burned <= 0) throw new Error('No CSGN burn from this wallet found in that transaction.')
  if (burned + 1e-6 < minUiAmount) throw new Error(`Burn of ${burned.toLocaleString()} CSGN is below the required ${minUiAmount.toLocaleString()}.`)
  return burned
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
