import { describe, it, expect } from 'vitest'
import {
  verifySplPaymentFromTx,
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
