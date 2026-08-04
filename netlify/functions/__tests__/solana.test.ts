import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  verifySplPaymentFromTx,
  isEstablishedWallet,
  CSGN_MINT_ADDRESS,
  CSGN_TREASURY_ADDRESS,
  type ParsedTransaction,
  type TokenBalanceEntry,
} from '../_shared/solana'

const WALLET = 'PayerWa11etAddress11111111111111111111111111'
const OTHER = 'SomeoneE1seWa11et1111111111111111111111111111'
const MINT = CSGN_MINT_ADDRESS
const TREASURY = CSGN_TREASURY_ADDRESS

function bal(owner: string, mint: string, raw: string, decimals = 6): TokenBalanceEntry {
  return { owner, mint, uiTokenAmount: { amount: raw, decimals } }
}

/** A well-formed payment: wallet sends `raw` of the mint to the treasury. */
function payTx(raw: string, over: Partial<ParsedTransaction['meta']> = {}): ParsedTransaction {
  return {
    meta: {
      err: null,
      preTokenBalances: [bal(WALLET, MINT, raw), bal(TREASURY, MINT, '0')],
      postTokenBalances: [bal(WALLET, MINT, '0'), bal(TREASURY, MINT, raw)],
      ...over,
    },
    transaction: { message: { accountKeys: [{ pubkey: WALLET, signer: true }] } },
  }
}

describe('verifySplPaymentFromTx — the $CSGN jukebox trust boundary', () => {
  it('accepts a real payment of at least the minimum and returns the raw amount', () => {
    const res = verifySplPaymentFromTx(payTx('1000000'), WALLET, MINT, 1_000_000n)
    expect(res.raw).toBe(1_000_000n)
    expect(res.decimals).toBe(6)
  })

  it('accepts a payment larger than the minimum', () => {
    expect(verifySplPaymentFromTx(payTx('5000000'), WALLET, MINT, 1_000_000n).raw).toBe(5_000_000n)
  })

  it('rejects a payment below the minimum', () => {
    expect(() => verifySplPaymentFromTx(payTx('900000'), WALLET, MINT, 1_000_000n)).toThrow(/below the required/i)
  })

  it('rejects a missing/unconfirmed transaction', () => {
    expect(() => verifySplPaymentFromTx(null, WALLET, MINT, 1n)).toThrow(/not found or not yet confirmed/i)
  })

  it('rejects a transaction that failed on-chain', () => {
    expect(() => verifySplPaymentFromTx(payTx('1000000', { err: { InstructionError: [0, 'X'] } }), WALLET, MINT, 1n)).toThrow(/failed on-chain/i)
  })

  it('rejects a transaction the wallet did not sign', () => {
    const tx = payTx('1000000')
    tx.transaction!.message!.accountKeys = [{ pubkey: WALLET, signer: false }]
    expect(() => verifySplPaymentFromTx(tx, WALLET, MINT, 1n)).toThrow(/not signed by this wallet/i)
  })

  it('rejects when the treasury never received the mint', () => {
    const tx = payTx('1000000')
    tx.meta!.postTokenBalances = [bal(WALLET, MINT, '0'), bal(TREASURY, MINT, '0')]
    expect(() => verifySplPaymentFromTx(tx, WALLET, MINT, 1n)).toThrow(/no token payment to the treasury/i)
  })

  // The piggyback attack: the treasury really was paid, but by SOMEONE ELSE's
  // wallet, and the caller merely co-signed the tx to claim it. The sender-balance
  // check defeats it — the caller's own balance never dropped.
  it("rejects when the payment came from another wallet the caller only co-signed", () => {
    const tx: ParsedTransaction = {
      meta: {
        err: null,
        preTokenBalances: [bal(OTHER, MINT, '1000000'), bal(TREASURY, MINT, '0'), bal(WALLET, MINT, '500')],
        postTokenBalances: [bal(OTHER, MINT, '0'), bal(TREASURY, MINT, '1000000'), bal(WALLET, MINT, '500')],
      },
      transaction: { message: { accountKeys: [{ pubkey: WALLET, signer: true }, { pubkey: OTHER, signer: true }] } },
    }
    expect(() => verifySplPaymentFromTx(tx, WALLET, MINT, 1_000_000n)).toThrow(/did not come from this wallet/i)
  })

  it('sums multiple treasury token accounts and multiple payer accounts', () => {
    const tx: ParsedTransaction = {
      meta: {
        err: null,
        preTokenBalances: [bal(WALLET, MINT, '600000'), bal(WALLET, MINT, '400000'), bal(TREASURY, MINT, '0')],
        postTokenBalances: [bal(WALLET, MINT, '0'), bal(WALLET, MINT, '0'), bal(TREASURY, MINT, '1000000')],
      },
      transaction: { message: { accountKeys: [{ pubkey: WALLET, signer: true }] } },
    }
    expect(verifySplPaymentFromTx(tx, WALLET, MINT, 1_000_000n).raw).toBe(1_000_000n)
  })

  it('ignores a different mint paid to the treasury in the same tx', () => {
    const tx = payTx('1000000')
    // A junk-mint credit to the treasury must not count toward the CSGN minimum.
    tx.meta!.postTokenBalances = [
      bal(WALLET, MINT, '0'),
      bal(TREASURY, MINT, '1000000'),
      bal(TREASURY, 'OtherMint1111111111111111111111111111111111', '9999999'),
    ]
    expect(verifySplPaymentFromTx(tx, WALLET, MINT, 1_000_000n).raw).toBe(1_000_000n)
  })
})

// ── isEstablishedWallet — the wallet-only sign-up sybil gate ────────────────
//
// Wallet-only registration was pulled once (v1.18) because a keypair is free
// and instant to generate, making "prove you hold a wallet" a weaker toll than
// a verified email. This check is what puts the toll back: SOL or history, both
// of which cost the sprayer real money per wallet. These tests pin the decision
// table, because getting it wrong either reopens mass registration or locks
// real members out.

/** Stub the two RPC calls isEstablishedWallet makes, in the order it makes them. */
function stubRpc(balanceLamports: number, signatures: unknown[]) {
  const bodies = [
    { result: { value: balanceLamports } },
    { result: signatures },
  ]
  let call = 0
  return vi.fn(async () => {
    const body = bodies[call] ?? bodies[bodies.length - 1]
    // getBalance and getSignaturesForAddress are issued concurrently, so the
    // stub answers by call order — which is the order they're constructed in.
    call += 1
    return { ok: true, json: async () => body } as unknown as Response
  })
}

describe('isEstablishedWallet', () => {
  const WALLET_ADDR = '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1'
  const MIN = 1_000_000

  afterEach(() => { vi.unstubAllGlobals() })

  it('accepts a wallet holding at least the minimum, with no history', async () => {
    vi.stubGlobal('fetch', stubRpc(MIN, []))
    expect(await isEstablishedWallet(WALLET_ADDR, MIN)).toBe(true)
  })

  it('accepts an emptied wallet that has transacted before', async () => {
    vi.stubGlobal('fetch', stubRpc(0, [{ signature: 'sig' }]))
    expect(await isEstablishedWallet(WALLET_ADDR, MIN)).toBe(true)
  })

  it('rejects a keypair minted seconds ago — no balance, no history', async () => {
    vi.stubGlobal('fetch', stubRpc(0, []))
    expect(await isEstablishedWallet(WALLET_ADDR, MIN)).toBe(false)
  })

  it('rejects dust below the minimum when there is no history to fall back on', async () => {
    vi.stubGlobal('fetch', stubRpc(MIN - 1, []))
    expect(await isEstablishedWallet(WALLET_ADDR, MIN)).toBe(false)
  })

  // The caller treats a throw as "unavailable" and falls open on purpose, so
  // this must throw rather than quietly returning false — a false would read as
  // a real rejection and lock members out during an RPC outage.
  it('throws (never returns false) when the RPC errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }) as unknown as Response))
    await expect(isEstablishedWallet(WALLET_ADDR, MIN)).rejects.toThrow(/RPC error/i)

    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ error: { message: 'boom' } }) }) as unknown as Response))
    await expect(isEstablishedWallet(WALLET_ADDR, MIN)).rejects.toThrow(/boom/i)
  })
})
