// Server-side Solana reads: CSGN SPL-token balance (gates holder actions) and
// on-chain payment verification (the Coin Jukebox trust boundary). The wallet is
// first proven via the Phantom signature challenge, then these read the chain for
// that address — a spoofed client can never move the outcome.

const CSGN_MINT = 'GFV7fphvprMr1PYpYGPJort2QP7JJLEp3J1Buu7Zpump'
// pump.fun standard. $CSGN uses 6 decimals; used to convert a UI token price into
// the raw base-unit amount the on-chain transfer is verified against.
const CSGN_DECIMALS = 6
// Configure a paid/less-throttled RPC via SOLANA_RPC_URL in Netlify; the public
// endpoint is the fallback and is fine at low request volume.
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'

/**
 * Hard ceiling on an RPC call. Netlify bills wall-clock and kills the
 * invocation at its limit, so a hung socket doesn't fail fast — it burns the
 * entire budget and then fails anyway, taking everything else in the run with
 * it. Public Solana RPC stalls often enough that this is a when, not an if.
 *
 * Deliberately THROWS rather than returning null like `_shared/cache.fetchJson`:
 * these calls verify payments and read balances that decide payouts, and
 * "couldn't reach the chain" must never be indistinguishable from "no payment
 * found". Fail loud on the money path.
 */
const RPC_TIMEOUT_MS = 8_000

async function rpcFetch(body: string): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS)
  try {
    return await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Solana RPC timed out after ${RPC_TIMEOUT_MS}ms`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export const CSGN_MINT_ADDRESS = CSGN_MINT
export const CSGN_TOKEN_DECIMALS = CSGN_DECIMALS

interface TokenAmount { uiAmount?: number | null; amount?: string; decimals?: number }
interface RpcAccount { account?: { data?: { parsed?: { info?: { tokenAmount?: TokenAmount } } } } }
interface RpcResponse { result?: { value?: RpcAccount[] }; error?: { message?: string } }

interface ParsedInstr { program?: string; parsed?: { type?: string; info?: Record<string, unknown> } }

/** A jsonParsed token-balance entry from getTransaction meta (pre/post). */
export interface TokenBalanceEntry {
  accountIndex?: number
  mint?: string
  owner?: string
  uiTokenAmount?: { amount?: string; decimals?: number; uiAmount?: number | null }
}

/** The `result` of a jsonParsed getTransaction — enough of it to verify a payment. */
export interface ParsedTransaction {
  meta?: {
    err?: unknown
    innerInstructions?: Array<{ instructions?: ParsedInstr[] }>
    preTokenBalances?: TokenBalanceEntry[]
    postTokenBalances?: TokenBalanceEntry[]
  } | null
  transaction?: {
    message?: {
      instructions?: ParsedInstr[]
      accountKeys?: Array<{ pubkey?: string; signer?: boolean }>
    }
  }
}

interface TxResponse { result?: ParsedTransaction | null; error?: { message?: string } }

const CSGN_TREASURY = 'CSGNUgUpBqTNM7EBZSMeA5jzPLFNR2hELhLjbHLpbEY4'
export const CSGN_TREASURY_ADDRESS = CSGN_TREASURY

/** Fetch a CONFIRMED transaction (jsonParsed). Shared by every payment verifier
 *  so they all read the chain the same way. */
export async function fetchTransaction(signature: string): Promise<ParsedTransaction | null> {
  const res = await rpcFetch(JSON.stringify({
    jsonrpc: '2.0', id: 1, method: 'getTransaction',
    params: [signature, { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 }],
  }))
  if (!res.ok) throw new Error(`Solana RPC error ${res.status}`)
  const data = (await res.json()) as TxResponse
  if (data.error) throw new Error(`Solana RPC: ${data.error.message || 'error'}`)
  return data.result ?? null
}

function signedBy(tx: ParsedTransaction, wallet: string): boolean {
  const keys = tx.transaction?.message?.accountKeys || []
  return keys.some((k) => k.pubkey === wallet && k.signer)
}

/**
 * Verify `signature` is a CONFIRMED transfer of at least `minLamports` SOL from
 * `wallet` to the CSGN treasury — the trust boundary for the SOL jukebox
 * spotlight. Returns the lamports paid; throws unless it's a real, successful,
 * wallet-signed transfer to the treasury of >= the minimum.
 *
 * NOTE: dry-run against a tiny real payment on mainnet before going public.
 */
export async function verifySolPayment(signature: string, wallet: string, minLamports: number): Promise<number> {
  const tx = await fetchTransaction(signature)
  if (!tx) throw new Error('Payment transaction not found or not yet confirmed.')
  if (tx.meta?.err) throw new Error('The payment transaction failed on-chain.')
  if (!signedBy(tx, wallet)) throw new Error('The payment was not signed by this wallet.')

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

/** Sum the raw base-unit balance held by `owner` for `mint` across every token
 *  account touched in the tx (a wallet can hold a mint in more than one account). */
function sumRawFor(balances: TokenBalanceEntry[] | undefined, owner: string, mint: string): { raw: bigint; decimals: number } {
  let raw = 0n
  let decimals = 0
  for (const b of balances || []) {
    if (b.owner !== owner || b.mint !== mint) continue
    const amt = b.uiTokenAmount?.amount
    if (amt != null && /^\d+$/.test(String(amt))) raw += BigInt(amt)
    if (b.uiTokenAmount?.decimals != null) decimals = b.uiTokenAmount.decimals
  }
  return { raw, decimals }
}

/**
 * Pure verifier for an SPL-token payment, so every case is unit-testable without
 * an RPC round-trip. Proves, from the transaction's pre/post token balances, that
 * the treasury RECEIVED at least `minRawAmount` base units of `mint` AND that the
 * paying `wallet`'s own balance of that mint dropped by at least as much — so a
 * caller can't claim a payment someone else's wallet made by merely co-signing.
 * Returns the raw amount received. Throws on any failure (fails closed).
 */
export function verifySplPaymentFromTx(
  tx: ParsedTransaction | null,
  wallet: string,
  mint: string,
  minRawAmount: bigint,
  treasury: string = CSGN_TREASURY,
): { raw: bigint; decimals: number } {
  if (!tx) throw new Error('Payment transaction not found or not yet confirmed.')
  if (tx.meta?.err) throw new Error('The payment transaction failed on-chain.')
  if (!signedBy(tx, wallet)) throw new Error('The payment was not signed by this wallet.')

  const pre = tx.meta?.preTokenBalances
  const post = tx.meta?.postTokenBalances

  const treasuryReceived = sumRawFor(post, treasury, mint).raw - sumRawFor(pre, treasury, mint).raw
  if (treasuryReceived <= 0n) throw new Error('No token payment to the treasury found in that transaction.')

  const walletSpent = sumRawFor(pre, wallet, mint).raw - sumRawFor(post, wallet, mint).raw
  if (walletSpent < treasuryReceived) throw new Error('The token payment did not come from this wallet.')

  if (treasuryReceived < minRawAmount) throw new Error('The token payment is below the required amount.')

  const decimals = sumRawFor(post, treasury, mint).decimals || sumRawFor(pre, treasury, mint).decimals
  return { raw: treasuryReceived, decimals }
}

/**
 * Verify `signature` is a CONFIRMED SPL-token payment of at least `minRawAmount`
 * base units of `mint` from `wallet` to the CSGN treasury. The token equivalent
 * of verifySolPayment — used for paying a jukebox spotlight in $CSGN.
 *
 * NOTE: dry-run against a tiny real payment on mainnet before going public.
 */
export async function verifySplPayment(
  signature: string,
  wallet: string,
  mint: string,
  minRawAmount: bigint,
): Promise<{ raw: bigint; decimals: number }> {
  const tx = await fetchTransaction(signature)
  return verifySplPaymentFromTx(tx, wallet, mint, minRawAmount)
}

/** UI-amount CSGN held by a wallet (sums every token account for the mint). */
export async function getCsgnBalance(walletAddress: string): Promise<number> {
  const res = await rpcFetch(JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'getTokenAccountsByOwner',
    params: [walletAddress, { mint: CSGN_MINT }, { encoding: 'jsonParsed' }],
  }))
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

/**
 * Is this wallet ESTABLISHED on-chain — does it hold lamports, or has it ever
 * signed anything?
 *
 * This is the sybil gate for wallet-only sign-up, and it exists because of a
 * real objection: a keypair is free and instant to generate offline, which
 * makes a bare "prove you hold a wallet" check a weaker registration cost than
 * a verified email, not a stronger one. Funding thousands of wallets is not
 * free — it costs SOL, per wallet, on a public ledger — and neither is putting
 * a transaction through one. A person who has actually used Phantom clears this
 * instantly; a script that minted 10,000 keypairs a second ago clears none of
 * them.
 *
 * `getSignaturesForAddress` is capped at one result: we only need existence,
 * and asking for a page of history would cost the RPC far more for no answer we
 * use.
 */
export async function isEstablishedWallet(walletAddress: string, minLamports: number): Promise<boolean> {
  const [balanceRes, sigRes] = await Promise.all([
    rpcFetch(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [walletAddress] })),
    rpcFetch(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSignaturesForAddress', params: [walletAddress, { limit: 1 }] })),
  ])
  if (!balanceRes.ok || !sigRes.ok) throw new Error(`Solana RPC error ${balanceRes.status}/${sigRes.status}`)

  const balance = (await balanceRes.json()) as { result?: { value?: number }; error?: { message?: string } }
  const sigs = (await sigRes.json()) as { result?: unknown[]; error?: { message?: string } }
  if (balance.error) throw new Error(`Solana RPC: ${balance.error.message || 'error'}`)
  if (sigs.error) throw new Error(`Solana RPC: ${sigs.error.message || 'error'}`)

  const lamports = Number(balance.result?.value ?? 0)
  const hasHistory = Array.isArray(sigs.result) && sigs.result.length > 0
  // Either signal is enough. A wallet that has been swept to zero but has
  // history is still a real wallet, and a funded wallet that has never sent
  // anything is still one somebody paid for.
  return lamports >= minLamports || hasHistory
}
