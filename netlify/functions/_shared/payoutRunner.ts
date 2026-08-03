/**
 * THE PAYOUT RUN — the sequence that turns a settled game into confirmed
 * transfers out of EftavCt6Tk2bzWJ9Dnz7cAvfa5RAnh8S9vZcrorV7Hmv.
 *
 * Written against injected I/O (`RunnerDeps`) rather than importing Firestore
 * and the wallet directly. That is not testing dogma — it means the exact
 * ordering that keeps this crash-safe can be tested by simulating a crash
 * between any two steps, which is impossible if the ordering is welded to a live
 * database and a live cluster.
 *
 * THE ORDER IS THE SAFETY PROPERTY. Read it once, and don't reorder it:
 *
 *   1. Claim every payout id in the ledger as `pending`, with a CREATE that
 *      fails if the id exists. This is the mutual exclusion. Two overlapping
 *      runs both reach this step; only one wins each id.
 *   2. Check solvency ONCE, for the whole run.
 *   3. Per transaction: sign → write signature + `sending` → broadcast → confirm
 *      → write `confirmed`.
 *
 * Step 3's middle write is the one that looks redundant and isn't. Between
 * "sign" and "broadcast" there is a window where the process can die holding a
 * valid, unsent, fully-signed transaction. Recording the signature first turns
 * that from an unknowable state into a question the cluster can answer.
 */

import {
  buildPayoutBatch, checkSolvency, planTransactions, recoveryAction, isInconsistent, etDayKey,
  type PayoutRequest, type PayoutRecord, type PayoutLimits, type PayoutSource,
  type RunSummary, type TransactionPlan,
} from './payouts'

/* ─── Injected I/O ─── */

export interface RunnerDeps {
  /** CREATE the ledger doc. MUST reject if the id already exists — the whole
   *  double-payment guarantee rests on this being a create, not a set. */
  claimLedgerEntry: (record: PayoutRecord) => Promise<boolean>
  /** Merge-update an existing ledger doc. */
  updateLedgerEntry: (id: string, patch: Partial<PayoutRecord>) => Promise<void>
  /** Ledger entries for a source, so a re-run knows what's already been paid. */
  loadExisting: (source: PayoutSource, sourceId: string) => Promise<PayoutRecord[]>
  /** $CSGN already sent today, across every run. */
  spentToday: (dayKey: string) => Promise<number>
  limits: () => Promise<PayoutLimits>
  balances: () => Promise<{ sol: number; csgn: number }>
  /** Recipients with no $CSGN token account yet — each costs rent. */
  missingTokenAccounts: (wallets: string[]) => Promise<Set<string>>
  sign: (plan: TransactionPlan) => Promise<{ signature: string; send: () => Promise<string> }>
  /** On-chain fate of a signature recorded by a previous, crashed run. */
  signatureOutcome: (signature: string) => Promise<'confirmed' | 'failed' | 'unknown'>
  writeRunSummary: (summary: RunSummary) => Promise<void>
  now: () => Date
}

export interface RunOptions {
  source: PayoutSource
  sourceId: string
  requests: PayoutRequest[]
  /** Build the batch and check solvency, then stop without signing anything.
   *  Every settlement should be dry-run once before it ever pays a stranger. */
  dryRun?: boolean
}

export interface RunResult extends RunSummary {
  dryRun: boolean
  solvency: ReturnType<typeof checkSolvency>
  /** Payouts parked for a human. */
  review: PayoutRecord[]
}

/* ─── The run ─── */

export async function runPayouts(deps: RunnerDeps, opts: RunOptions): Promise<RunResult> {
  const startedAt = deps.now()
  const runId = `${opts.source}:${opts.sourceId}:${startedAt.toISOString()}`
  const errors: string[] = []
  const signatures: string[] = []

  const [limits, existing, spentTodayCsgn] = await Promise.all([
    deps.limits(),
    deps.loadExisting(opts.source, opts.sourceId),
    deps.spentToday(etDayKey(startedAt)),
  ])

  // ── Recovery first. A previous run may have left signed-but-unconfirmed work,
  // and resolving it BEFORE building a new batch means those ids are correctly
  // seen as taken rather than re-issued.
  await reconcileStragglers(deps, existing, errors, signatures)

  // Ids that must not be re-issued: anything already terminal or in flight.
  const existingIds = new Set(existing.filter((r) => r.status !== 'failed').map((r) => r.id))

  const batch = buildPayoutBatch(opts.requests, {
    limits,
    spentTodayCsgn,
    existingIds,
    nowIso: startedAt.toISOString(),
  })

  const plans = planTransactions(batch.payable)
  const wallets = batch.payable.map((p) => p.wallet)
  const [walletBalances, missing] = await Promise.all([
    deps.balances(),
    wallets.length ? deps.missingTokenAccounts(wallets) : Promise.resolve(new Set<string>()),
  ])

  const solvency = checkSolvency({
    requiredCsgn: batch.totalCsgn,
    balanceCsgn: walletBalances.csgn,
    balanceSol: walletBalances.sol,
    transactionCount: plans.length,
    newAccounts: missing.size,
  })

  const summary = (paid: number, finished: boolean): RunResult => ({
    runId,
    startedAt: startedAt.toISOString(),
    ...(finished ? { finishedAt: deps.now().toISOString() } : {}),
    source: opts.source,
    sourceId: opts.sourceId,
    requested: opts.requests.length,
    paid,
    review: batch.review,
    skipped: batch.skipped.length,
    totalCsgn: batch.totalCsgn,
    signatures,
    errors,
    dryRun: Boolean(opts.dryRun),
    solvency,
  })

  if (opts.dryRun) return summary(0, true)

  // A run that can't cover its field does not start. Half a leaderboard paid is
  // worse than none: the unpaid half is public, indignant, and correct.
  if (!solvency.ok) {
    errors.push(`insolvent: ${solvency.reason}`)
    const result = summary(0, true)
    await deps.writeRunSummary(result)
    return result
  }

  // ── Step 1: claim every id. Losing a claim is not an error — it means another
  // run got there first, which is the mechanism working.
  const claimed: PayoutRecord[] = []
  for (const record of batch.payable) {
    try {
      if (await deps.claimLedgerEntry(record)) claimed.push(record)
    } catch (err) {
      errors.push(`claim ${record.id}: ${message(err)}`)
    }
  }
  for (const record of batch.review) {
    // Parked payouts are still written, so a human can find and approve them.
    try { await deps.claimLedgerEntry(record) } catch { /* already parked */ }
  }

  // ── Step 3: sign → record → broadcast → confirm, one transaction at a time.
  let paid = 0
  const claimedIds = new Set(claimed.map((c) => c.id))
  for (const plan of plans) {
    const live = { ...plan, payouts: plan.payouts.filter((p) => claimedIds.has(p.id)) }
    if (live.payouts.length === 0) continue

    try {
      const { signature, send } = await deps.sign(live)

      // Signature BEFORE broadcast. This line is the crash-safety guarantee.
      await Promise.all(live.payouts.map((p) => deps.updateLedgerEntry(p.id, { status: 'sending', signature })))

      const confirmed = await send()
      signatures.push(confirmed)

      const confirmedAt = deps.now().toISOString()
      await Promise.all(live.payouts.map((p) => deps.updateLedgerEntry(p.id, { status: 'confirmed', confirmedAt })))
      paid += live.payouts.length
    } catch (err) {
      const reason = message(err)
      errors.push(`tx ${plan.index}: ${reason}`)
      // Deliberately NOT marked failed. The transaction may have landed after
      // the error (a confirmation timeout is not a rejection). Leaving them
      // `sending` with a signature routes them to the recovery path above on the
      // next run, which asks the chain instead of guessing.
      for (const p of live.payouts) {
        try { await deps.updateLedgerEntry(p.id, { failureReason: reason }) } catch { /* best effort */ }
      }
    }
  }

  const result = summary(paid, true)
  await deps.writeRunSummary(result)
  return result
}

/* ─── Recovery ─── */

/**
 * Resolve payouts left in flight by a previous run.
 *
 * `check_chain` is the interesting case. A recorded signature with no on-chain
 * status is NOT proof it never sent — it may be a transaction still propagating.
 * So `unknown` leaves the record exactly as it is, in `sending`, where the next
 * run will ask again. That's a payout that stays stuck rather than one that pays
 * twice, and between those two failure modes there is no contest.
 */
async function reconcileStragglers(
  deps: RunnerDeps,
  existing: PayoutRecord[],
  errors: string[],
  signatures: string[],
): Promise<void> {
  for (const record of existing) {
    const action = recoveryAction(record)
    if (action === 'skip') continue

    if (isInconsistent(record)) {
      // `sending` with no signature can only be a torn write — nothing was ever
      // broadcast, so put it back where a fresh run can pick it up.
      await deps.updateLedgerEntry(record.id, { status: 'pending', failureReason: 'torn_write_recovered' })
      continue
    }

    if (action === 'check_chain' && record.signature) {
      try {
        const outcome = await deps.signatureOutcome(record.signature)
        if (outcome === 'confirmed') {
          await deps.updateLedgerEntry(record.id, { status: 'confirmed', confirmedAt: deps.now().toISOString() })
          signatures.push(record.signature)
        } else if (outcome === 'failed') {
          await deps.updateLedgerEntry(record.id, { status: 'failed', failureReason: 'on_chain_error' })
        }
        // 'unknown' → leave in `sending`. Ask again next run.
      } catch (err) {
        errors.push(`recover ${record.id}: ${message(err)}`)
      }
    }
  }
}

const message = (err: unknown): string => (err instanceof Error ? err.message : String(err))

/* ─── Turning a settled game into payout requests ─── */

/**
 * Squares: one request per period the winner took. The sourceId carries the
 * period key so a wallet winning two periods produces two distinct payouts
 * rather than colliding on one id — the exact case the `payoutId` doc warns
 * about.
 */
export function squaresPayoutRequests(
  boardId: string,
  results: Array<{ periodKey: string; label: string; winner: { wallet: string; displayName: string } | null; payoutCsgn: number }>,
): PayoutRequest[] {
  return results
    .filter((r) => r.winner && r.payoutCsgn > 0)
    .map((r) => ({
      source: 'squares' as const,
      sourceId: `${boardId}:${r.periodKey}`,
      wallet: r.winner!.wallet,
      displayName: r.winner!.displayName,
      amountCsgn: r.payoutCsgn,
      note: `Squares — ${r.label}`,
    }))
}

/** Starting 5: one request per paid finishing position on the slate. */
export function startingFivePayoutRequests(
  slateId: string,
  payouts: Array<{ rank: number; wallet: string; displayName: string; payoutCsgn: number }>,
): PayoutRequest[] {
  return payouts
    .filter((p) => p.payoutCsgn > 0)
    .map((p) => ({
      source: 'starting5' as const,
      sourceId: `${slateId}:rank${p.rank}:${p.wallet}`,
      wallet: p.wallet,
      displayName: p.displayName,
      amountCsgn: p.payoutCsgn,
      note: `Starting 5 — ${ordinal(p.rank)} place`,
    }))
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`
}
