/**
 * THE SIGNING SIDE OF PAYOUTS — everything that actually touches the chain.
 *
 *      Official payout wallet: EftavCt6Tk2bzWJ9Dnz7cAvfa5RAnh8S9vZcrorV7Hmv
 *
 * payouts.ts decides WHO gets paid and HOW MUCH, with no I/O, so those rules are
 * provable in a test. This file does the irreversible part. The split is not
 * bureaucracy: it means the dangerous code is small enough to read in one sitting
 * and contains no business logic worth arguing about.
 *
 * ── On the key ──────────────────────────────────────────────────────────────
 *
 * This is a HOT WALLET. Its secret key sits in a Netlify environment variable,
 * which means anyone who can deploy, read the build environment, or compromise a
 * function can drain it. That is not a flaw to be fixed with better secrets
 * hygiene — it is inherent to a wallet that signs unattended at 3am. So the
 * mitigation is not secrecy, it's FLOAT:
 *
 *   • Keep only a few days of prize money in it. Top it up from the treasury on
 *     a schedule; never park the reserve here.
 *   • The caps in payouts.ts bound the blast radius of a bug. They do NOT bound
 *     a stolen key — a thief signs whatever they like. Only the balance does.
 *   • Rotate the key on any suspicion, and on every team change. Rotation is
 *     cheap: generate, fund, update the env var, drain the old one.
 *   • This wallet must never hold LP tokens, authority over the mint, or
 *     anything else whose loss is unrecoverable. It holds prize money. Period.
 *
 * Configure with PAYOUT_WALLET_SECRET (base58 64-byte secret key). If it is
 * unset, every function here fails closed and the settlement run reports "not
 * configured" rather than silently paying nobody.
 */

import {
  Connection, PublicKey, Keypair, Transaction, LAMPORTS_PER_SOL,
  type TransactionSignature,
} from '@solana/web3.js'
import {
  getAssociatedTokenAddressSync,
  createTransferCheckedInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
} from '@solana/spl-token'
import bs58 from 'bs58'
import { CSGN_PAYOUT_WALLET, CSGN_MINT, CSGN_DECIMALS, type PayoutRecord, type TransactionPlan } from './payouts'

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'

let cachedConnection: Connection | null = null
export function connection(): Connection {
  if (!cachedConnection) cachedConnection = new Connection(RPC_URL, 'confirmed')
  return cachedConnection
}

/* ─── The key ─── */

let cachedKeypair: Keypair | null = null

/**
 * Load the payout keypair from the environment.
 *
 * The public-key assertion at the end is the important line. A wrong key in the
 * env var wouldn't throw on its own — it would happily sign transfers from some
 * *other* wallet, which either fails confusingly or, if that wallet happens to
 * hold $CSGN, succeeds catastrophically. Checking that the derived address is
 * exactly the published payout wallet turns a silent misconfiguration into a
 * startup error, which is the only acceptable outcome.
 */
export function loadPayoutKeypair(): Keypair {
  if (cachedKeypair) return cachedKeypair

  const secret = process.env.PAYOUT_WALLET_SECRET
  if (!secret) throw new Error('PAYOUT_WALLET_SECRET is not configured — payouts are disabled.')

  let bytes: Uint8Array
  try {
    bytes = bs58.decode(secret.trim())
  } catch {
    throw new Error('PAYOUT_WALLET_SECRET is not valid base58.')
  }
  if (bytes.length !== 64) throw new Error('PAYOUT_WALLET_SECRET must be a 64-byte secret key.')

  const keypair = Keypair.fromSecretKey(bytes)
  const derived = keypair.publicKey.toBase58()
  if (derived !== CSGN_PAYOUT_WALLET) {
    throw new Error(`PAYOUT_WALLET_SECRET belongs to ${derived}, not the official payout wallet.`)
  }

  cachedKeypair = keypair
  return keypair
}

/** Is payout signing available at all? Lets a run report cleanly instead of throwing. */
export function isPayoutConfigured(): boolean {
  try {
    loadPayoutKeypair()
    return true
  } catch {
    return false
  }
}

/* ─── Reading the wallet ─── */

export interface WalletBalances {
  sol: number
  csgn: number
}

/** Live SOL + $CSGN balances of the payout wallet. Throws on RPC failure — a
 *  solvency check that guesses zero would block every run on a network blip,
 *  and one that guesses "plenty" would start a run it can't finish. */
export async function payoutWalletBalances(): Promise<WalletBalances> {
  const conn = connection()
  const owner = new PublicKey(CSGN_PAYOUT_WALLET)
  const ata = getAssociatedTokenAddressSync(new PublicKey(CSGN_MINT), owner)

  const [lamports, token] = await Promise.all([
    conn.getBalance(owner),
    conn.getTokenAccountBalance(ata).catch(() => null),
  ])

  return {
    sol: lamports / LAMPORTS_PER_SOL,
    csgn: token?.value?.uiAmount ?? 0,
  }
}

/**
 * Which recipients have no $CSGN token account yet. Feeds the solvency check's
 * rent budget — and it's usually a big number, because a first-time winner is
 * exactly the person this network is trying to create.
 *
 * Batched through getMultipleAccountsInfo (100 per call) instead of one lookup
 * per winner; a 200-winner slate would otherwise open 200 RPC round-trips before
 * a single token moved.
 */
export async function findMissingTokenAccounts(wallets: string[]): Promise<Set<string>> {
  const conn = connection()
  const mint = new PublicKey(CSGN_MINT)
  const unique = [...new Set(wallets)]
  const missing = new Set<string>()

  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100)
    const atas = chunk.map((w) => getAssociatedTokenAddressSync(mint, new PublicKey(w)))
    const infos = await conn.getMultipleAccountsInfo(atas)
    infos.forEach((info, idx) => {
      if (!info) missing.add(chunk[idx])
    })
  }
  return missing
}

/* ─── Building and signing ─── */

export interface SignedPayoutTx {
  plan: TransactionPlan
  /** Known BEFORE broadcast — this is what makes the ledger crash-safe. */
  signature: TransactionSignature
  transaction: Transaction
  blockhash: string
  lastValidBlockHeight: number
}

/**
 * Build and sign one transaction for a plan chunk. Does NOT broadcast.
 *
 * The separation is the whole crash-safety story: the caller writes
 * `signature` into the ledger and only then calls `broadcast`. If the process
 * dies in between, recovery finds a `sending` record with a signature and asks
 * the cluster what happened, instead of blindly re-paying.
 *
 * Every recipient gets an idempotent create-ATA instruction ahead of their
 * transfer. It's a no-op for anyone who already has an account, and it removes
 * an entire class of race: checking "does this account exist?" and then acting
 * on the answer is wrong when two runs overlap, and overlapping runs are exactly
 * what a retry produces.
 */
export async function signPayoutTransaction(plan: TransactionPlan): Promise<SignedPayoutTx> {
  const payer = loadPayoutKeypair()
  const conn = connection()
  const mint = new PublicKey(CSGN_MINT)
  const fromAta = getAssociatedTokenAddressSync(mint, payer.publicKey)

  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed')
  const tx = new Transaction({ feePayer: payer.publicKey, blockhash, lastValidBlockHeight })

  for (const payout of plan.payouts) {
    const owner = new PublicKey(payout.wallet)
    const toAta = getAssociatedTokenAddressSync(mint, owner)
    tx.add(createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, toAta, owner, mint))
    tx.add(createTransferCheckedInstruction(
      fromAta, mint, toAta, payer.publicKey, BigInt(payout.amountRaw), CSGN_DECIMALS,
    ))
  }

  tx.sign(payer)
  const rawSignature = tx.signature
  if (!rawSignature) throw new Error('Transaction failed to sign.')

  return {
    plan,
    signature: bs58.encode(rawSignature),
    transaction: tx,
    blockhash,
    lastValidBlockHeight,
  }
}

/**
 * Broadcast an already-signed transaction and wait for confirmation.
 *
 * `skipPreflight: false` keeps the simulation, which catches an under-funded
 * wallet before it burns a fee. `maxRetries: 0` hands retry control to us rather
 * than the RPC client, because a client-side retry that outlives our function
 * invocation is a send we can't observe — and an unobserved send is the one that
 * turns into a double payment on the next run.
 *
 * Re-broadcasting an identical signed transaction is SAFE and is the intended
 * recovery path: the cluster recognises the signature and will not execute it
 * twice.
 */
export async function broadcastPayoutTransaction(signed: SignedPayoutTx): Promise<TransactionSignature> {
  const conn = connection()
  const signature = await conn.sendRawTransaction(signed.transaction.serialize(), {
    skipPreflight: false,
    maxRetries: 0,
  })

  const result = await conn.confirmTransaction({
    signature,
    blockhash: signed.blockhash,
    lastValidBlockHeight: signed.lastValidBlockHeight,
  }, 'confirmed')

  if (result.value.err) throw new Error(`Payout transaction failed on-chain: ${JSON.stringify(result.value.err)}`)
  return signature
}

/* ─── Recovery ─── */

export type ChainOutcome = 'confirmed' | 'failed' | 'unknown'

/**
 * What happened to a signature we recorded but may never have broadcast.
 *
 * `unknown` is a real, expected answer, not an error: a signature that was
 * signed and never sent has no on-chain status, and neither does one whose
 * blockhash expired before it landed. The caller must treat `unknown` as
 * "not paid, and safe to re-sign" ONLY after the blockhash has definitively
 * expired — which is why `blockhashExpired` exists below. Re-signing too early
 * is how a transaction that was merely slow becomes a transaction that pays
 * twice.
 */
export async function signatureOutcome(signature: string): Promise<ChainOutcome> {
  const conn = connection()
  const status = await conn.getSignatureStatus(signature, { searchTransactionHistory: true })
  const value = status.value
  if (!value) return 'unknown'
  if (value.err) return 'failed'
  if (value.confirmationStatus === 'confirmed' || value.confirmationStatus === 'finalized') return 'confirmed'
  return 'unknown'
}

/**
 * Has this blockhash aged out? Once it has, the transaction it signed can never
 * land, so an `unknown` signature is definitively unpaid and re-signing is safe.
 * This is the only condition under which a `sending` record may be re-signed.
 */
export async function blockhashExpired(lastValidBlockHeight: number): Promise<boolean> {
  const height = await connection().getBlockHeight('confirmed')
  return height > lastValidBlockHeight
}

/** Solscan link for a payout, for the winner's history and the admin ledger. */
export const payoutExplorerUrl = (signature: string): string => `https://solscan.io/tx/${signature}`

/** Everything a run needs to know about the wallet, in one call. */
export async function payoutWalletStatus(): Promise<{
  address: string
  configured: boolean
  balances: WalletBalances | null
}> {
  const configured = isPayoutConfigured()
  return {
    address: CSGN_PAYOUT_WALLET,
    configured,
    balances: configured ? await payoutWalletBalances().catch(() => null) : null,
  }
}

/** Narrow the record type used by the ledger writer, so callers don't import
 *  the whole payouts module just to type a callback. */
export type LedgerUpdate = Pick<PayoutRecord, 'id' | 'status' | 'signature' | 'confirmedAt' | 'failureReason'>
