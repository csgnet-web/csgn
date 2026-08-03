import { describe, it, expect, vi } from 'vitest'
import {
  CSGN_PAYOUT_WALLET, DEFAULT_PAYOUT_LIMITS, resolveLimits, payoutId, toRawAmount,
  isValidSolanaAddress, buildPayoutBatch, checkSolvency, planTransactions,
  recoveryAction, isInconsistent, etDayKey, TRANSFERS_PER_TX, ATA_RENT_SOL, TX_FEE_SOL,
  type PayoutRequest, type PayoutRecord, type PayoutLimits,
} from '../_shared/payouts'
import {
  runPayouts, squaresPayoutRequests, startingFivePayoutRequests,
  type RunnerDeps,
} from '../_shared/payoutRunner'

/* Real-shaped base58 addresses (32-44 chars, no 0/O/I/l). */
const W = {
  a: '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1',
  b: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
  c: 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH',
}

const NOW = new Date('2026-08-02T22:00:00.000Z')

const req = (over: Partial<PayoutRequest> = {}): PayoutRequest => ({
  source: 'starting5',
  sourceId: 'slate-1:rank1',
  wallet: W.a,
  displayName: 'alice',
  amountCsgn: 100_000,
  note: 'Starting 5 — 1st place',
  ...over,
})

const ctx = (over: Partial<Parameters<typeof buildPayoutBatch>[1]> = {}) => ({
  limits: DEFAULT_PAYOUT_LIMITS,
  spentTodayCsgn: 0,
  existingIds: new Set<string>(),
  nowIso: NOW.toISOString(),
  ...over,
})

describe('the official payout wallet', () => {
  it('is the address the network published', () => {
    expect(CSGN_PAYOUT_WALLET).toBe('EftavCt6Tk2bzWJ9Dnz7cAvfa5RAnh8S9vZcrorV7Hmv')
    expect(isValidSolanaAddress(CSGN_PAYOUT_WALLET)).toBe(true)
  })
})

describe('address validation', () => {
  it('accepts real Solana addresses', () => {
    for (const address of Object.values(W)) expect(isValidSolanaAddress(address)).toBe(true)
  })

  it('rejects anything that is not one', () => {
    expect(isValidSolanaAddress('')).toBe(false)
    expect(isValidSolanaAddress('short')).toBe(false)
    expect(isValidSolanaAddress('0OIl'.repeat(10))).toBe(false) // ambiguous base58 chars
    expect(isValidSolanaAddress('0x71C7656EC7ab88b098defB751B7401B5f6d8976F')).toBe(false) // EVM
    expect(isValidSolanaAddress(undefined as unknown as string)).toBe(false)
  })
})

describe('the idempotency key', () => {
  it('is derived only from what the payout is for', () => {
    expect(payoutId('squares', 'board-1:q1', W.a)).toBe(`squares:board-1_q1:${W.a}`)
  })

  it('is stable across calls — no timestamp, no nonce', () => {
    expect(payoutId('squares', 'board-1', W.a)).toBe(payoutId('squares', 'board-1', W.a))
  })

  it('separates different sources, games and winners', () => {
    const base = payoutId('squares', 'board-1', W.a)
    expect(payoutId('starting5', 'board-1', W.a)).not.toBe(base)
    expect(payoutId('squares', 'board-2', W.a)).not.toBe(base)
    expect(payoutId('squares', 'board-1', W.b)).not.toBe(base)
  })

  it('never contains a slash, which Firestore document ids forbid', () => {
    expect(payoutId('squares', 'board/1/q1', W.a)).not.toContain('/')
  })
})

describe('raw amount conversion', () => {
  it('scales by the mint decimals', () => {
    expect(toRawAmount(1)).toBe('1000000')
    expect(toRawAmount(1_000_000)).toBe('1000000000000')
  })

  it('floors fractions and clamps negatives — a payout is whole tokens', () => {
    expect(toRawAmount(1.99)).toBe('1000000')
    expect(toRawAmount(-5)).toBe('0')
  })

  it('stays exact past 2^53, where a number would silently lose precision', () => {
    expect(toRawAmount(90_000_000_000)).toBe('90000000000000000')
  })
})

describe('limits', () => {
  it('falls back per field on a partial doc', () => {
    const limits = resolveLimits({ maxPerPayoutCsgn: 999 })
    expect(limits.maxPerPayoutCsgn).toBe(999)
    expect(limits.maxPerRunCsgn).toBe(DEFAULT_PAYOUT_LIMITS.maxPerRunCsgn)
  })

  it('never lets a corrupt doc widen or zero a cap', () => {
    expect(resolveLimits({ maxPerRunCsgn: 0 })).toEqual(DEFAULT_PAYOUT_LIMITS)
    expect(resolveLimits({ maxPerRunCsgn: -1 })).toEqual(DEFAULT_PAYOUT_LIMITS)
    expect(resolveLimits({ maxPerRunCsgn: 'lots' })).toEqual(DEFAULT_PAYOUT_LIMITS)
    expect(resolveLimits(null)).toEqual(DEFAULT_PAYOUT_LIMITS)
    expect(resolveLimits('nonsense')).toEqual(DEFAULT_PAYOUT_LIMITS)
  })
})

describe('building a batch', () => {
  it('turns clean requests into payable records', () => {
    const batch = buildPayoutBatch([req()], ctx())
    expect(batch.payable).toHaveLength(1)
    expect(batch.payable[0].status).toBe('pending')
    expect(batch.payable[0].amountRaw).toBe('100000000000')
    expect(batch.totalCsgn).toBe(100_000)
  })

  it('drops a request to an invalid address before it reaches the ledger', () => {
    const batch = buildPayoutBatch([req({ wallet: 'not-a-wallet' })], ctx())
    expect(batch.payable).toHaveLength(0)
    expect(batch.skipped[0].reason).toBe('invalid_address')
  })

  it('drops non-positive amounts', () => {
    const batch = buildPayoutBatch([req({ amountCsgn: 0 }), req({ amountCsgn: -1 })], ctx())
    expect(batch.payable).toHaveLength(0)
    expect(batch.skipped.every((s) => s.reason === 'non_positive')).toBe(true)
  })

  it('drops dust below the minimum', () => {
    const batch = buildPayoutBatch([req({ amountCsgn: 10 })], ctx())
    expect(batch.skipped[0].reason).toBe('below_minimum')
  })

  it('MERGES two wins by the same wallet on the same source instead of colliding', () => {
    const batch = buildPayoutBatch([
      req({ amountCsgn: 60_000, note: 'Q1' }),
      req({ amountCsgn: 40_000, note: 'Final' }),
    ], ctx())
    expect(batch.payable).toHaveLength(1)
    expect(batch.payable[0].amountCsgn).toBe(100_000)
    expect(batch.payable[0].note).toContain('Q1')
    expect(batch.payable[0].note).toContain('Final')
  })

  it('merges BEFORE the dust check, so two dust wins that add up still pay', () => {
    const batch = buildPayoutBatch([
      req({ amountCsgn: 600 }),
      req({ amountCsgn: 600 }),
    ], ctx())
    expect(batch.payable).toHaveLength(1)
    expect(batch.payable[0].amountCsgn).toBe(1_200)
  })

  it('silently drops ids already in the ledger — a re-run is normal, not an error', () => {
    const existingIds = new Set([payoutId('starting5', 'slate-1:rank1', W.a)])
    const batch = buildPayoutBatch([req()], ctx({ existingIds }))
    expect(batch.payable).toHaveLength(0)
    expect(batch.skipped).toHaveLength(0)
  })

  it('parks an oversized payout for review rather than sending or dropping it', () => {
    const batch = buildPayoutBatch([req({ amountCsgn: 9_000_000 })], ctx())
    expect(batch.payable).toHaveLength(0)
    expect(batch.review[0].status).toBe('needs_review')
    expect(batch.review[0].failureReason).toBe('over_per_payout_cap')
  })

  it('stops at the per-run ceiling', () => {
    const limits: PayoutLimits = { ...DEFAULT_PAYOUT_LIMITS, maxPerRunCsgn: 150_000 }
    const batch = buildPayoutBatch([
      req({ sourceId: 'a', amountCsgn: 100_000 }),
      req({ sourceId: 'b', amountCsgn: 100_000 }),
    ], ctx({ limits }))
    expect(batch.payable).toHaveLength(1)
    expect(batch.review[0].failureReason).toBe('over_run_cap')
  })

  it('counts what was already spent today against the daily ceiling', () => {
    const limits: PayoutLimits = { ...DEFAULT_PAYOUT_LIMITS, maxPerDayCsgn: 150_000 }
    const batch = buildPayoutBatch([req({ amountCsgn: 100_000 })], ctx({ limits, spentTodayCsgn: 100_000 }))
    expect(batch.payable).toHaveLength(0)
    expect(batch.review[0].failureReason).toBe('over_daily_cap')
  })

  it('pays the headline first when a ceiling truncates the run', () => {
    const limits: PayoutLimits = { ...DEFAULT_PAYOUT_LIMITS, maxPerRunCsgn: 100_000 }
    const batch = buildPayoutBatch([
      req({ sourceId: 'tenth', wallet: W.b, amountCsgn: 10_000 }),
      req({ sourceId: 'first', wallet: W.a, amountCsgn: 90_000 }),
    ], ctx({ limits }))
    expect(batch.payable.map((p) => p.amountCsgn)).toEqual([90_000, 10_000])
  })

  it('floors a fractional amount rather than paying a fraction of a token', () => {
    const batch = buildPayoutBatch([req({ amountCsgn: 100_000.9 })], ctx())
    expect(batch.payable[0].amountCsgn).toBe(100_000)
  })
})

describe('solvency', () => {
  it('passes when the wallet covers tokens and fees', () => {
    const check = checkSolvency({ requiredCsgn: 100, balanceCsgn: 1000, balanceSol: 1, transactionCount: 2, newAccounts: 3 })
    expect(check.ok).toBe(true)
    expect(check.requiredSol).toBeCloseTo(2 * TX_FEE_SOL + 3 * ATA_RENT_SOL)
  })

  it('fails, with a shortfall, when the $CSGN is short', () => {
    const check = checkSolvency({ requiredCsgn: 1000, balanceCsgn: 400, balanceSol: 1, transactionCount: 1, newAccounts: 0 })
    expect(check.ok).toBe(false)
    expect(check.reason).toBe('insufficient_csgn')
    expect(check.shortfallCsgn).toBe(600)
  })

  it('fails when SOL cannot cover the rent for first-time winners', () => {
    // 100 brand-new holders is the SUCCESS case for this network, and it is
    // exactly the case a zero rent budget would strand.
    const check = checkSolvency({ requiredCsgn: 100, balanceCsgn: 1000, balanceSol: 0.001, transactionCount: 13, newAccounts: 100 })
    expect(check.ok).toBe(false)
    expect(check.reason).toBe('insufficient_sol')
  })
})

describe('transaction planning', () => {
  const records = (n: number): PayoutRecord[] =>
    Array.from({ length: n }, (_, i) => ({
      ...req(), id: `p${String(i).padStart(3, '0')}`, status: 'pending' as const,
      amountRaw: '1000000', createdAt: NOW.toISOString(), amountCsgn: 1,
    }))

  it('chunks at the transfers-per-transaction limit', () => {
    const plans = planTransactions(records(20))
    expect(plans).toHaveLength(3)
    expect(plans[0].payouts).toHaveLength(TRANSFERS_PER_TX)
    expect(plans[2].payouts).toHaveLength(20 - 2 * TRANSFERS_PER_TX)
  })

  it('is deterministic, so a recovery run rebuilds identical transactions', () => {
    const input = records(20)
    expect(planTransactions(input)).toEqual(planTransactions([...input].reverse()))
  })

  it('totals each chunk', () => {
    expect(planTransactions(records(3))[0].totalCsgn).toBe(3)
  })

  it('handles an empty batch', () => {
    expect(planTransactions([])).toEqual([])
  })
})

describe('crash recovery decisions', () => {
  const rec = (status: PayoutRecord['status'], signature?: string) => ({ status, signature })

  it('never touches a terminal payout', () => {
    expect(recoveryAction(rec('confirmed', 'sig'))).toBe('skip')
    expect(recoveryAction(rec('failed'))).toBe('skip')
    expect(recoveryAction(rec('needs_review'))).toBe('skip')
  })

  it('re-signs a pending payout — nothing was ever broadcast', () => {
    expect(recoveryAction(rec('pending'))).toBe('resign')
  })

  it('ASKS THE CHAIN about a sending payout rather than re-signing it', () => {
    expect(recoveryAction(rec('sending', 'sig123'))).toBe('check_chain')
  })

  it('spots the torn write: sending with no signature', () => {
    expect(isInconsistent(rec('sending'))).toBe(true)
    expect(isInconsistent(rec('sending', 'sig'))).toBe(false)
    expect(isInconsistent(rec('pending'))).toBe(false)
  })
})

describe('the ET day key', () => {
  it('uses Eastern time, not UTC — the network day runs 3am-3am ET', () => {
    // 01:00 UTC on the 3rd is still the evening of the 2nd in New York.
    expect(etDayKey(new Date('2026-08-03T01:00:00.000Z'))).toBe('2026-08-02')
    expect(etDayKey(new Date('2026-08-02T16:00:00.000Z'))).toBe('2026-08-02')
  })
})

/* ─── The run ─── */

interface Harness {
  deps: RunnerDeps
  ledger: Map<string, PayoutRecord>
  broadcasts: string[]
  signCalls: number
}

function harness(over: Partial<RunnerDeps> = {}, opts: { balanceCsgn?: number; balanceSol?: number; failSendOn?: number } = {}): Harness {
  const ledger = new Map<string, PayoutRecord>()
  const broadcasts: string[] = []
  const h = { ledger, broadcasts, signCalls: 0 }

  const deps: RunnerDeps = {
    claimLedgerEntry: async (record) => {
      if (ledger.has(record.id)) return false // CREATE semantics: id already taken
      ledger.set(record.id, record)
      return true
    },
    updateLedgerEntry: async (id, patch) => {
      const prev = ledger.get(id)
      if (prev) ledger.set(id, { ...prev, ...patch })
    },
    loadExisting: async () => [...ledger.values()],
    spentToday: async () => 0,
    limits: async () => DEFAULT_PAYOUT_LIMITS,
    balances: async () => ({ csgn: opts.balanceCsgn ?? 10_000_000, sol: opts.balanceSol ?? 5 }),
    missingTokenAccounts: async () => new Set<string>(),
    sign: async (plan) => {
      const n = h.signCalls++
      const signature = `sig-${plan.index}-${n}`
      return {
        signature,
        send: async () => {
          if (opts.failSendOn === plan.index) throw new Error('confirmation timeout')
          broadcasts.push(signature)
          return signature
        },
      }
    },
    signatureOutcome: async () => 'unknown',
    writeRunSummary: async () => {},
    now: () => NOW,
    ...over,
  }

  return { ...h, deps }
}

describe('a payout run', () => {
  it('pays a clean field and records confirmed signatures', async () => {
    const h = harness()
    const result = await runPayouts(h.deps, {
      source: 'starting5',
      sourceId: 'slate-1',
      requests: [req({ sourceId: 'slate-1:r1', wallet: W.a }), req({ sourceId: 'slate-1:r2', wallet: W.b })],
    })

    expect(result.paid).toBe(2)
    expect(result.errors).toEqual([])
    expect(h.broadcasts).toHaveLength(1) // both fit in one transaction
    expect([...h.ledger.values()].every((r) => r.status === 'confirmed')).toBe(true)
  })

  it('records the signature BEFORE broadcasting — the crash-safety guarantee', async () => {
    const order: string[] = []
    const h = harness({
      updateLedgerEntry: async (_id, patch) => { if (patch.signature) order.push('recorded') },
    })
    const base = harness()
    h.deps.sign = async (plan) => {
      const inner = await base.deps.sign(plan)
      return { ...inner, send: async () => { order.push('broadcast'); return inner.signature } }
    }

    await runPayouts(h.deps, { source: 'squares', sourceId: 'b1', requests: [req()] })
    expect(order).toEqual(['recorded', 'broadcast'])
  })

  it('NEVER pays twice when the same settlement runs again', async () => {
    const h = harness()
    const opts = { source: 'starting5' as const, sourceId: 'slate-1', requests: [req()] }

    const first = await runPayouts(h.deps, opts)
    const second = await runPayouts(h.deps, opts)

    expect(first.paid).toBe(1)
    expect(second.paid).toBe(0)
    expect(h.broadcasts).toHaveLength(1)
  })

  it('refuses to start when the wallet cannot cover the field', async () => {
    const h = harness({}, { balanceCsgn: 1 })
    const result = await runPayouts(h.deps, {
      source: 'starting5', sourceId: 'slate-1', requests: [req({ amountCsgn: 500_000 })],
    })

    expect(result.paid).toBe(0)
    expect(result.solvency.ok).toBe(false)
    expect(result.errors[0]).toContain('insolvent')
    expect(h.broadcasts).toHaveLength(0)
    expect(h.ledger.size).toBe(0) // nothing claimed, so a topped-up wallet can retry cleanly
  })

  it('dry-runs without signing, claiming, or sending anything', async () => {
    const h = harness()
    const result = await runPayouts(h.deps, {
      source: 'starting5', sourceId: 'slate-1', requests: [req()], dryRun: true,
    })

    expect(result.dryRun).toBe(true)
    expect(result.totalCsgn).toBe(100_000)
    expect(result.solvency.ok).toBe(true)
    expect(h.signCalls).toBe(0)
    expect(h.ledger.size).toBe(0)
    expect(h.broadcasts).toHaveLength(0)
  })

  it('leaves a timed-out transaction in sending, NOT failed, so the chain decides', async () => {
    const h = harness({}, { failSendOn: 0 })
    const result = await runPayouts(h.deps, { source: 'squares', sourceId: 'b1', requests: [req()] })

    expect(result.paid).toBe(0)
    expect(result.errors[0]).toContain('confirmation timeout')
    const record = [...h.ledger.values()][0]
    expect(record.status).toBe('sending')
    expect(record.signature).toBeTruthy()
  })

  it('confirms a straggler the chain says landed, without re-sending it', async () => {
    const h = harness({ signatureOutcome: async () => 'confirmed' })
    h.ledger.set('stuck', {
      ...req(), id: 'stuck', status: 'sending', signature: 'sig-old',
      amountRaw: '1000000', createdAt: NOW.toISOString(),
    })

    const result = await runPayouts(h.deps, { source: 'starting5', sourceId: 'slate-1', requests: [] })
    expect(h.ledger.get('stuck')!.status).toBe('confirmed')
    expect(result.signatures).toContain('sig-old')
    expect(h.signCalls).toBe(0)
  })

  it('marks a straggler failed when the chain says it errored', async () => {
    const h = harness({ signatureOutcome: async () => 'failed' })
    h.ledger.set('stuck', {
      ...req(), id: 'stuck', status: 'sending', signature: 'sig-old',
      amountRaw: '1000000', createdAt: NOW.toISOString(),
    })

    await runPayouts(h.deps, { source: 'starting5', sourceId: 'slate-1', requests: [] })
    expect(h.ledger.get('stuck')!.status).toBe('failed')
  })

  it('leaves an unknown straggler alone rather than risking a double payment', async () => {
    const h = harness({ signatureOutcome: async () => 'unknown' })
    h.ledger.set('stuck', {
      ...req(), id: 'stuck', status: 'sending', signature: 'sig-old',
      amountRaw: '1000000', createdAt: NOW.toISOString(),
    })

    await runPayouts(h.deps, { source: 'starting5', sourceId: 'slate-1', requests: [] })
    expect(h.ledger.get('stuck')!.status).toBe('sending')
    expect(h.signCalls).toBe(0)
  })

  it('recovers a torn write back to pending so the winner is not stranded', async () => {
    const h = harness()
    h.ledger.set('torn', {
      ...req(), id: 'torn', status: 'sending',
      amountRaw: '1000000', createdAt: NOW.toISOString(),
    })

    await runPayouts(h.deps, { source: 'starting5', sourceId: 'slate-1', requests: [] })
    expect(h.ledger.get('torn')!.status).toBe('pending')
    expect(h.ledger.get('torn')!.failureReason).toBe('torn_write_recovered')
  })

  it('writes parked payouts to the ledger so a human can find them', async () => {
    const h = harness()
    const result = await runPayouts(h.deps, {
      source: 'squares', sourceId: 'b1', requests: [req({ amountCsgn: 9_000_000 })],
    })

    expect(result.paid).toBe(0)
    expect(result.review).toHaveLength(1)
    expect([...h.ledger.values()][0].status).toBe('needs_review')
    expect(h.broadcasts).toHaveLength(0)
  })

  it('skips a payout another concurrent run already claimed', async () => {
    const h = harness()
    const claimed = payoutId('starting5', 'slate-1:r1', W.a)
    h.ledger.set(claimed, {
      ...req(), id: claimed, status: 'pending', amountRaw: '1', createdAt: NOW.toISOString(),
    })

    const result = await runPayouts(h.deps, {
      source: 'starting5', sourceId: 'slate-1',
      requests: [req({ sourceId: 'slate-1:r1', wallet: W.a }), req({ sourceId: 'slate-1:r2', wallet: W.b })],
    })

    expect(result.paid).toBe(1)
  })

  it('always writes a run summary for the audit trail', async () => {
    const writeRunSummary = vi.fn(async () => {})
    const h = harness({ writeRunSummary })
    await runPayouts(h.deps, { source: 'squares', sourceId: 'b1', requests: [req()] })
    expect(writeRunSummary).toHaveBeenCalledOnce()
  })
})

describe('turning settled games into payout requests', () => {
  it('gives each squares period its own id so one wallet can win twice', () => {
    const requests = squaresPayoutRequests('board-1', [
      { periodKey: 'q1', label: 'End of 1st', winner: { wallet: W.a, displayName: 'alice' }, payoutCsgn: 150_000 },
      { periodKey: 'f', label: 'Final', winner: { wallet: W.a, displayName: 'alice' }, payoutCsgn: 500_000 },
      { periodKey: 'h', label: 'Halftime', winner: null, payoutCsgn: 0 },
    ])

    expect(requests).toHaveLength(2)
    expect(new Set(requests.map((r) => payoutId(r.source, r.sourceId, r.wallet))).size).toBe(2)
  })

  it('skips rolled-over periods', () => {
    expect(squaresPayoutRequests('b1', [
      { periodKey: 'q1', label: 'End of 1st', winner: null, payoutCsgn: 150_000 },
    ])).toEqual([])
  })

  it('labels Starting 5 finishes with an ordinal', () => {
    const requests = startingFivePayoutRequests('slate-1', [
      { rank: 1, wallet: W.a, displayName: 'alice', payoutCsgn: 300_000 },
      { rank: 2, wallet: W.b, displayName: 'bob', payoutCsgn: 180_000 },
      { rank: 3, wallet: W.c, displayName: 'cam', payoutCsgn: 120_000 },
    ])

    expect(requests.map((r) => r.note)).toEqual([
      'Starting 5 — 1st place',
      'Starting 5 — 2nd place',
      'Starting 5 — 3rd place',
    ])
  })

  it('gives tied ranks distinct ids by binding the wallet in', () => {
    const requests = startingFivePayoutRequests('slate-1', [
      { rank: 1, wallet: W.a, displayName: 'alice', payoutCsgn: 240_000 },
      { rank: 1, wallet: W.b, displayName: 'bob', payoutCsgn: 240_000 },
    ])
    expect(new Set(requests.map((r) => payoutId(r.source, r.sourceId, r.wallet))).size).toBe(2)
  })
})
