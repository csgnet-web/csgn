/**
 * THE CSGN PAYOUT LEDGER — the rules for moving $CSGN out of the network wallet.
 *
 *      Official payout wallet: EftavCt6Tk2bzWJ9Dnz7cAvfa5RAnh8S9vZcrorV7Hmv
 *
 * This is the highest-consequence code in the repository. Everything else, at
 * worst, shows someone the wrong number. This spends money, irreversibly, to
 * strangers, unattended, on a schedule. So the whole module is built around one
 * assumption: THIS PROCESS WILL CRASH MID-RUN. Not might — will. A Netlify
 * function has a wall-clock limit, Solana RPC times out, a deploy lands at 3am
 * while the daily settle is halfway through the field. Every rule below exists
 * to make sure that when it happens, nobody gets paid twice and nobody gets
 * skipped.
 *
 * The four guarantees:
 *
 *   1. IDEMPOTENT BY CONSTRUCTION. A payout's id is derived from what it's for
 *      (`game:source:wallet`), never from a counter or a timestamp. Re-running
 *      the same settlement produces the same ids, and the ledger write that
 *      claims an id is a CREATE — which fails, loudly, if that id already
 *      exists. Double payment isn't prevented by being careful; it's prevented
 *      by the database refusing.
 *
 *   2. SIGNATURE RECORDED BEFORE BROADCAST. We sign, write the resulting
 *      signature to the ledger, and only then send it to the cluster. Crash
 *      between the two and recovery re-broadcasts the identical signed
 *      transaction — same signature, so the cluster deduplicates it for us.
 *      Broadcasting first and recording after is the classic way to pay twice.
 *
 *   3. CAPPED AT EVERY LEVEL. Per payout, per run, per day. A bug that computes
 *      a nine-figure prize hits a ceiling and files for review instead of
 *      emptying the wallet. The caps are deliberately lower than what the wallet
 *      holds — they are a circuit breaker, not a budget.
 *
 *   4. SOLVENT BEFORE THE FIRST TRANSFER. A run that can't cover its whole field
 *      never starts. Paying the first forty winners and discovering the purse
 *      was short is worse than paying nobody, because it's unfixable in public.
 *
 * The pure logic lives here so every one of those rules is unit-tested without
 * touching a wallet. The signing and sending live in payoutWallet.ts.
 */

/** The network's official payout wallet. Winnings are sent FROM this address. */
export const CSGN_PAYOUT_WALLET = 'EftavCt6Tk2bzWJ9Dnz7cAvfa5RAnh8S9vZcrorV7Hmv'

/** $CSGN mint + decimals, matching src/lib/slots.ts and _shared/solana.ts. */
export const CSGN_MINT = 'GFV7fphvprMr1PYpYGPJort2QP7JJLEp3J1Buu7Zpump'
export const CSGN_DECIMALS = 6

/* ─── Circuit breakers ─── */

/**
 * Ceilings, in whole $CSGN. Anything over the per-payout cap is not rejected —
 * it's parked as `needs_review` for a human, because a prize that large is
 * either the best day the network ever had or a bug, and both deserve a look.
 *
 * Tunable from config/payoutLimits without a deploy (see `resolveLimits`), for
 * the same reason the token gates are: a fixed token count is a moving dollar
 * amount, and a cap that made sense at one market cap is absurd at another.
 */
export interface PayoutLimits {
  /** Largest single payout that goes out automatically. */
  maxPerPayoutCsgn: number
  /** Largest total one settlement run may disburse. */
  maxPerRunCsgn: number
  /** Largest total across all runs in one ET day. */
  maxPerDayCsgn: number
  /** Payouts below this are dropped — a transfer whose fee exceeds its value is
   *  worse than nothing, and it clutters the winner's wallet with dust. */
  minPayoutCsgn: number
}

export const DEFAULT_PAYOUT_LIMITS: PayoutLimits = {
  maxPerPayoutCsgn: 5_000_000,
  maxPerRunCsgn: 25_000_000,
  maxPerDayCsgn: 50_000_000,
  minPayoutCsgn: 1_000,
}

/** Read a stored limits doc, falling back per field. A corrupt or partial doc
 *  must never widen a cap — every fallback is the conservative default. */
export function resolveLimits(raw: unknown): PayoutLimits {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const pick = (key: keyof PayoutLimits): number => {
    const n = Number(d[key])
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_PAYOUT_LIMITS[key]
  }
  return {
    maxPerPayoutCsgn: pick('maxPerPayoutCsgn'),
    maxPerRunCsgn: pick('maxPerRunCsgn'),
    maxPerDayCsgn: pick('maxPerDayCsgn'),
    minPayoutCsgn: pick('minPayoutCsgn'),
  }
}

/* ─── What a payout is ─── */

/** Where a payout came from. Every disbursement is attributable to a game. */
export type PayoutSource = 'squares' | 'starting5' | 'slot_vote' | 'creator_fee' | 'manual'

export type PayoutStatus =
  /** Claimed in the ledger, nothing signed yet. */
  | 'pending'
  /** Signed, signature recorded, broadcast may or may not have happened. */
  | 'sending'
  /** Confirmed on-chain. Terminal. */
  | 'confirmed'
  /** Failed on-chain or permanently rejected. Terminal until re-opened. */
  | 'failed'
  /** Over a cap, or otherwise parked for a human. Terminal until approved. */
  | 'needs_review'

export interface PayoutRequest {
  source: PayoutSource
  /** The board id / slate id / slot id this payout settles. */
  sourceId: string
  /** Recipient's Solana address. */
  wallet: string
  displayName: string
  /** Whole $CSGN. Fractions are not payable and are floored at build time. */
  amountCsgn: number
  /** Human-readable reason, shown in the winner's history: "Squares — Final". */
  note: string
}

export interface PayoutRecord extends PayoutRequest {
  /** Deterministic. THE idempotency key — see `payoutId`. */
  id: string
  status: PayoutStatus
  /** Raw base units actually transferred. Derived, never trusted from input. */
  amountRaw: string
  createdAt: string
  /** Recorded BEFORE broadcast. Present from `sending` onward. */
  signature?: string
  confirmedAt?: string
  failureReason?: string
}

/**
 * The idempotency key. Derived only from what the payout is FOR, so the same
 * settlement always regenerates the same id no matter how many times it runs.
 *
 * Note what is deliberately absent: no timestamp, no random suffix, no attempt
 * counter. Any of those would make a retry look like a new payout, which is
 * precisely the bug this whole file exists to prevent. If a winner legitimately
 * wins the same source twice, that's two sources — give it a distinct sourceId
 * (`board-42:q1` vs `board-42:final`), never a nonce.
 *
 * Firestore document ids may not contain '/', so the separator is ':'.
 */
export function payoutId(source: PayoutSource, sourceId: string, wallet: string): string {
  const clean = (s: string) => String(s).replace(/[/:]/g, '_')
  return `${clean(source)}:${clean(sourceId)}:${clean(wallet)}`
}

/** Whole $CSGN → raw base units, as a string (amounts exceed 2^53 at scale). */
export function toRawAmount(csgn: number): string {
  const whole = BigInt(Math.max(0, Math.floor(csgn)))
  return (whole * 10n ** BigInt(CSGN_DECIMALS)).toString()
}

/** A Solana address is 32 bytes base58 — 32 to 44 chars, no 0/O/I/l. */
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
export const isValidSolanaAddress = (address: string): boolean => BASE58.test(String(address ?? ''))

/* ─── Building a run ─── */

export interface PayoutBatch {
  /** Ready to sign and send. */
  payable: PayoutRecord[]
  /** Parked for a human: over the per-payout cap, or past a run/day ceiling. */
  review: PayoutRecord[]
  /** Dropped before the ledger: dust, bad address, non-positive amount. */
  skipped: Array<{ request: PayoutRequest; reason: string }>
  /** Total $CSGN in `payable`. */
  totalCsgn: number
}

export interface BatchContext {
  limits: PayoutLimits
  /** $CSGN already disbursed today, across every prior run. */
  spentTodayCsgn: number
  /** Payout ids already in the ledger — these are silently dropped, because a
   *  re-run of a settled game is normal, not an error. */
  existingIds: ReadonlySet<string>
  nowIso: string
}

/**
 * Turn a settlement's winners into a vetted, deduplicated, capped batch.
 *
 * The ordering of the checks is the safety property. Cheap structural rejects
 * (bad address, zero amount, dust) happen before anything touches the ledger.
 * Then per-payout caps. Then the running total against the run and day ceilings,
 * walking the list in descending amount so that if a ceiling is hit, the payouts
 * that make it through are the ones that matter most — a truncated run should
 * pay the winner, not the tenth-place consolation.
 *
 * Multiple requests to the same wallet from the same source are MERGED, not
 * emitted twice, because they'd collide on the same idempotency key. This is a
 * real case: one wallet holding two winning squares on the same board.
 */
export function buildPayoutBatch(requests: PayoutRequest[], ctx: BatchContext): PayoutBatch {
  const { limits } = ctx
  const skipped: PayoutBatch['skipped'] = []

  // Merge same-key requests so the id stays unique and the winner gets one send.
  const merged = new Map<string, PayoutRequest>()
  for (const req of requests) {
    const amount = Math.floor(Number(req.amountCsgn) || 0)
    if (!isValidSolanaAddress(req.wallet)) {
      skipped.push({ request: req, reason: 'invalid_address' })
      continue
    }
    if (amount <= 0) {
      skipped.push({ request: req, reason: 'non_positive' })
      continue
    }
    const id = payoutId(req.source, req.sourceId, req.wallet)
    const prev = merged.get(id)
    merged.set(id, prev
      ? { ...prev, amountCsgn: prev.amountCsgn + amount, note: `${prev.note} + ${req.note}` }
      : { ...req, amountCsgn: amount })
  }

  // Dust and already-paid drop out after merging — two dust wins can add up to a
  // payable amount, and dropping them individually would rob that winner.
  const candidates: Array<{ id: string; request: PayoutRequest }> = []
  for (const [id, request] of merged) {
    if (ctx.existingIds.has(id)) continue
    if (request.amountCsgn < limits.minPayoutCsgn) {
      skipped.push({ request, reason: 'below_minimum' })
      continue
    }
    candidates.push({ id, request })
  }

  // Largest first, so a ceiling truncates the tail rather than the headline.
  candidates.sort((a, b) => b.request.amountCsgn - a.request.amountCsgn)

  const payable: PayoutRecord[] = []
  const review: PayoutRecord[] = []
  let runTotal = 0

  const record = (id: string, r: PayoutRequest, status: PayoutStatus, failureReason?: string): PayoutRecord => ({
    ...r,
    id,
    status,
    amountRaw: toRawAmount(r.amountCsgn),
    createdAt: ctx.nowIso,
    ...(failureReason ? { failureReason } : {}),
  })

  for (const { id, request } of candidates) {
    if (request.amountCsgn > limits.maxPerPayoutCsgn) {
      review.push(record(id, request, 'needs_review', 'over_per_payout_cap'))
      continue
    }
    if (runTotal + request.amountCsgn > limits.maxPerRunCsgn) {
      review.push(record(id, request, 'needs_review', 'over_run_cap'))
      continue
    }
    if (ctx.spentTodayCsgn + runTotal + request.amountCsgn > limits.maxPerDayCsgn) {
      review.push(record(id, request, 'needs_review', 'over_daily_cap'))
      continue
    }
    runTotal += request.amountCsgn
    payable.push(record(id, request, 'pending'))
  }

  return { payable, review, skipped, totalCsgn: runTotal }
}

/* ─── Solvency ─── */

export interface SolvencyCheck {
  ok: boolean
  requiredCsgn: number
  balanceCsgn: number
  shortfallCsgn: number
  /** SOL needed for fees + any associated-token-account rent we may create. */
  requiredSol: number
  balanceSol: number
  reason?: string
}

/**
 * Cost of creating an associated token account, in SOL. The payout wallet pays
 * this when a winner has never held $CSGN before — which, for a game whose whole
 * job is turning viewers into holders, is the COMMON case, not the edge case.
 * Budgeting zero for it is how a payout run dies on its first real new user.
 */
export const ATA_RENT_SOL = 0.00204
/** Generous per-transaction fee allowance (base fee + priority headroom). */
export const TX_FEE_SOL = 0.00005

/**
 * Can this run actually be paid? Checked once, before the first transfer.
 *
 * `newAccounts` is how many recipients have no $CSGN token account yet; each one
 * costs rent the payout wallet fronts. That rent is recoverable by the winner,
 * not by us, and it is a genuine cost of doing business — it's the price of the
 * network handing someone their first tokens instead of asking them to buy some.
 */
export function checkSolvency(args: {
  requiredCsgn: number
  balanceCsgn: number
  balanceSol: number
  transactionCount: number
  newAccounts: number
}): SolvencyCheck {
  const requiredSol = args.transactionCount * TX_FEE_SOL + args.newAccounts * ATA_RENT_SOL
  const shortfallCsgn = Math.max(0, args.requiredCsgn - args.balanceCsgn)

  let reason: string | undefined
  if (shortfallCsgn > 0) reason = 'insufficient_csgn'
  else if (args.balanceSol < requiredSol) reason = 'insufficient_sol'

  return {
    ok: !reason,
    requiredCsgn: args.requiredCsgn,
    balanceCsgn: args.balanceCsgn,
    shortfallCsgn,
    requiredSol,
    balanceSol: args.balanceSol,
    reason,
  }
}

/* ─── Transaction planning ─── */

/**
 * Transfers per transaction.
 *
 * A Solana transaction is capped at 1232 bytes. An SPL transferChecked with its
 * account metas runs a bit over 60 bytes, and a recipient who needs an
 * associated token account created costs roughly twice that. Eight is a
 * comfortable ceiling that never has to think about it — and small batches have
 * a second, better property: one failed transaction strands eight winners, not
 * eighty, and the retry is cheap.
 */
export const TRANSFERS_PER_TX = 8

export interface TransactionPlan {
  index: number
  payouts: PayoutRecord[]
  totalCsgn: number
}

/**
 * Chunk a batch into transactions. Deterministic — the same batch always plans
 * the same way, so a recovery run reconstructs the identical transactions and
 * can match them against signatures already recorded in the ledger.
 */
export function planTransactions(payouts: PayoutRecord[], perTx = TRANSFERS_PER_TX): TransactionPlan[] {
  const ordered = [...payouts].sort((a, b) => a.id.localeCompare(b.id))
  const plans: TransactionPlan[] = []
  for (let i = 0; i < ordered.length; i += perTx) {
    const chunk = ordered.slice(i, i + perTx)
    plans.push({
      index: plans.length,
      payouts: chunk,
      totalCsgn: chunk.reduce((sum, p) => sum + p.amountCsgn, 0),
    })
  }
  return plans
}

/* ─── Recovery ─── */

/**
 * What to do with a payout found in a non-terminal state at the start of a run —
 * i.e. the wreckage of a previous crash.
 *
 * `pending` never had a signature, so nothing was ever broadcast: it is safe to
 * sign fresh. `sending` DID get a signature recorded, so the transaction may or
 * may not have landed; the only correct move is to look it up on-chain and let
 * the cluster tell us. Never re-sign a `sending` payout with a new blockhash —
 * that creates a second, different transaction which could also land, and now
 * you've paid twice.
 */
export type RecoveryAction = 'resign' | 'check_chain' | 'skip'

export function recoveryAction(record: Pick<PayoutRecord, 'status' | 'signature'>): RecoveryAction {
  if (record.status === 'confirmed' || record.status === 'failed' || record.status === 'needs_review') return 'skip'
  if (record.status === 'sending' && record.signature) return 'check_chain'
  return 'resign'
}

/**
 * A stuck `sending` payout with no signature is a contradiction — the signature
 * is written before the status flips. It means a partial write, so treat it as
 * never-sent and re-sign. Broken out because it's the one case where the
 * conservative choice (do nothing) is the wrong one: doing nothing strands a
 * winner permanently.
 */
export const isInconsistent = (r: Pick<PayoutRecord, 'status' | 'signature'>): boolean =>
  r.status === 'sending' && !r.signature

/* ─── Reporting ─── */

export interface RunSummary {
  runId: string
  startedAt: string
  finishedAt?: string
  source: PayoutSource
  sourceId: string
  requested: number
  paid: number
  review: number
  skipped: number
  totalCsgn: number
  signatures: string[]
  errors: string[]
}

/** ET calendar day (YYYY-MM-DD) — the window the daily cap is measured over.
 *  ET, not UTC, because the network's day runs 3am–3am ET and a cap that resets
 *  in the middle of the CSGN Originals block is a cap that resets mid-game. */
export function etDayKey(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')}`
}
