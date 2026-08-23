import { describe, it, expect } from 'vitest'
import { partitionSettlement, isValidTxSignature, type SettlementRow } from '../adminMarkFeesPaid'

const row = (id: string, paymentStatus?: string, feeOwedSOL = 0.5): SettlementRow => ({
  id,
  doc: { id, assignedUid: 'u1', creatorFees: { paymentStatus, feeOwedSOL } },
})

describe('partitionSettlement', () => {
  it('settles the pending slots in the group', () => {
    const rows = [row('a', 'pending'), row('b', 'pending')]
    const result = partitionSettlement(rows)
    expect(result.settling.map((r) => r.id)).toEqual(['a', 'b'])
    expect(result.alreadySettled).toEqual([])
    expect(result.missing).toEqual([])
  })

  // The double-click / retry / stale-list case. The second call must be a
  // no-op: a settled slot never takes a second signature, and never lands in
  // the audit entry a second time.
  it('leaves an already-settled slot completely alone', () => {
    const result = partitionSettlement([row('a', 'paid'), row('b', 'declined'), row('c', 'void'), row('d', 'pending')])
    expect(result.settling.map((r) => r.id)).toEqual(['d'])
    expect(result.alreadySettled).toEqual(['a', 'b', 'c'])
  })

  it('settles nothing when the whole group has already been paid', () => {
    const result = partitionSettlement([row('a', 'paid'), row('b', 'paid')])
    expect(result.settling).toEqual([])
    expect(result.alreadySettled).toEqual(['a', 'b'])
  })

  it('treats a missing status as pending, exactly like isFeePending does', () => {
    expect(partitionSettlement([row('a', undefined)]).settling.map((r) => r.id)).toEqual(['a'])
  })

  it('refuses a slot with no fee record — there is no amount to have sent', () => {
    const result = partitionSettlement([
      { id: 'a', doc: null },
      { id: 'b', doc: { id: 'b' } },
    ])
    expect(result.settling).toEqual([])
    expect(result.missing).toEqual(['a', 'b'])
    expect(result.alreadySettled).toEqual([])
  })
})

describe('isValidTxSignature', () => {
  it('accepts a base58 signature at Solana signature length', () => {
    expect(isValidTxSignature('5'.repeat(64))).toBe(true)
    expect(isValidTxSignature('z'.repeat(88))).toBe(true)
    expect(isValidTxSignature(`  ${'a'.repeat(70)}  `)).toBe(true)
  })

  it('rejects anything that is not one', () => {
    expect(isValidTxSignature('')).toBe(false)
    expect(isValidTxSignature(undefined)).toBe(false)
    expect(isValidTxSignature('a'.repeat(63))).toBe(false)
    expect(isValidTxSignature('a'.repeat(89))).toBe(false)
    // Base58 excludes 0, O, I and l precisely so a hand-copied signature with a
    // transcription error fails here instead of becoming a fake receipt.
    expect(isValidTxSignature(`0OIl${'a'.repeat(66)}`)).toBe(false)
    expect(isValidTxSignature(`paid in cash${'a'.repeat(60)}`)).toBe(false)
  })
})
