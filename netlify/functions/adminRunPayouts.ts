/**
 * ADMIN: run a payout for a settled game.
 *
 * The live wiring of payoutRunner's injected I/O to Firestore and the payout
 * wallet (EftavCt6Tk2bzWJ9Dnz7cAvfa5RAnh8S9vZcrorV7Hmv). All the interesting
 * rules live in _shared/payouts.ts and _shared/payoutRunner.ts, under test; this
 * file is deliberately boring plumbing.
 *
 * Admin-only, and DRY RUN BY DEFAULT. You have to pass `dryRun: false` to move a
 * token. That default is not politeness — an endpoint that pays by default is
 * one fat-fingered curl away from an incident, and the dry run returns the exact
 * batch, the solvency check and the review queue, which is what you wanted to
 * look at first anyway.
 *
 * POST { source, sourceId, dryRun?: boolean }
 *   source    'squares' | 'starting5'
 *   sourceId  the board id or slate id to settle
 *
 * The winner list is NOT accepted from the caller. It is recomputed here from
 * the stored game document, because a payout endpoint that pays whoever the
 * request body names is not a payout endpoint, it's a withdrawal endpoint.
 */

import { requireAdminUser } from './_shared/auth'
import { badRequest, conflict, notFound } from './_shared/errors'
import { json, parseJson, requireMethod, withHttp } from './_shared/http'
import { requireString } from './_shared/validators'
import { checkRateLimit, clientIp } from './_shared/rateLimit'
import {
  getDoc, writeDoc, createWrite, commitWrites, queryCollection, fieldFilter,
} from './_shared/firebaseAdmin'
import { auditLog } from './_shared/audit'
import {
  resolveLimits, etDayKey, type PayoutRecord, type PayoutSource, type RunSummary,
} from './_shared/payouts'
import {
  runPayouts, squaresPayoutRequests, startingFivePayoutRequests, type RunnerDeps,
} from './_shared/payoutRunner'
import {
  isPayoutConfigured, payoutWalletBalances, findMissingTokenAccounts,
  signPayoutTransaction, broadcastPayoutTransaction, signatureOutcome,
} from './_shared/payoutWallet'
import { settleBoard, type SquaresBoard } from '../../src/lib/games/squares'
import { settleSlate, type Slate, type Lineup, type PriceSnapshot } from '../../src/lib/games/startingFive'

type Body = { source?: string; sourceId?: string; dryRun?: boolean }

const SOURCES: PayoutSource[] = ['squares', 'starting5']

/* ─── Firestore-backed runner deps ─── */

/**
 * `sourceGroup` is the board/slate id on its own. A payout's own `sourceId`
 * carries a period or rank suffix (`slate-1:rank1:Wallet…`) so each winner gets
 * a distinct idempotency key — which means it can't be queried on to find every
 * payout for one game. The un-suffixed group is stored alongside it purely so
 * `loadExisting` has something indexable to filter by.
 */
function makeDeps(sourceGroup: string): RunnerDeps {
  return {
    claimLedgerEntry: async (record) => {
      try {
        // currentDocument.exists === false → CREATE. Firestore rejects a second
        // write to the same id, which is the whole double-payment guarantee.
        await commitWrites([createWrite(`payouts/${record.id}`, { ...record, sourceGroup })])
        return true
      } catch {
        return false
      }
    },

    updateLedgerEntry: async (id, patch) => {
      await writeDoc(`payouts/${id}`, { ...patch, updatedAt: new Date().toISOString() }, { merge: true })
    },

    loadExisting: async (source, sourceId) => {
      // Ledger ids are prefixed `source:sourceId…`, but a Firestore prefix scan
      // needs an indexed field, so the source pair is stored on the doc too.
      const rows = await queryCollection('payouts', [
        fieldFilter('source', 'EQUAL', source),
        fieldFilter('sourceGroup', 'EQUAL', sourceId),
      ], [], 500)
      return rows.map((r) => r.data as unknown as PayoutRecord)
    },

    spentToday: async (dayKey) => {
      const doc = await getDoc<{ totalCsgn?: number }>(`payoutDays/${dayKey}`)
      return Number(doc?.totalCsgn ?? 0)
    },

    limits: async () => resolveLimits(await getDoc('config/payoutLimits')),

    balances: payoutWalletBalances,
    missingTokenAccounts: (wallets) => findMissingTokenAccounts(wallets),

    sign: async (plan) => {
      const signed = await signPayoutTransaction(plan)
      return { signature: signed.signature, send: () => broadcastPayoutTransaction(signed) }
    },

    signatureOutcome,

    writeRunSummary: async (summary: RunSummary) => {
      await writeDoc(`payoutRuns/${summary.runId.replace(/[/:]/g, '_')}`, { ...summary })
      if (summary.totalCsgn > 0 && summary.paid > 0) {
        const dayKey = etDayKey(new Date(summary.startedAt))
        const prior = await getDoc<{ totalCsgn?: number; runs?: number }>(`payoutDays/${dayKey}`)
        await writeDoc(`payoutDays/${dayKey}`, {
          totalCsgn: Number(prior?.totalCsgn ?? 0) + summary.totalCsgn,
          runs: Number(prior?.runs ?? 0) + 1,
          updatedAt: new Date().toISOString(),
        }, { merge: true })
      }
    },

    now: () => new Date(),
  }
}

/* ─── Recomputing the winners from stored state ─── */

async function squaresRequests(boardId: string) {
  const board = await getDoc<SquaresBoard & { scores?: Record<string, { x: number; y: number }> }>(`squaresBoards/${boardId}`)
  if (!board) throw notFound('No such squares board.')
  if (board.status === 'open') throw conflict('Draw the board before paying it out.', 'not_drawn')
  const settled = settleBoard(board, board.scores ?? {})
  return { requests: squaresPayoutRequests(boardId, settled.results), settled }
}

async function startingFiveRequests(slateId: string) {
  const slate = await getDoc<Slate & { settlePrices?: PriceSnapshot }>(`slates/${slateId}`)
  if (!slate) throw notFound('No such slate.')
  if (!slate.settlePrices) throw conflict('This slate has no settle prices yet.', 'not_settled')

  const rows = await queryCollection('lineups', [fieldFilter('slateId', 'EQUAL', slateId)], [], 1000)
  const lineups = rows.map((r) => r.data as unknown as Lineup)
  const settled = settleSlate(slate, lineups, slate.settlePrices)
  return { requests: startingFivePayoutRequests(slateId, settled.payouts), settled }
}

/* ─── Handler ─── */

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  const admin = await requireAdminUser(event)
  await checkRateLimit(clientIp(event), 'adminRunPayouts', 10)

  const body = parseJson<Body>(event)
  const source = requireString(body.source, 'source') as PayoutSource
  if (!SOURCES.includes(source)) throw badRequest('Unknown payout source.', 'bad_source')
  const sourceId = requireString(body.sourceId, 'sourceId')

  // Pay only when explicitly told to. Anything else is a dry run.
  const dryRun = body.dryRun !== false

  if (!dryRun && !isPayoutConfigured()) {
    throw conflict('The payout wallet is not configured on this deploy.', 'payout_wallet_unconfigured')
  }

  const { requests } = source === 'squares'
    ? await squaresRequests(sourceId)
    : await startingFiveRequests(sourceId)

  const result = await runPayouts(makeDeps(sourceId), { source, sourceId, requests, dryRun })

  if (!dryRun) {
    await auditLog('payout_run', admin.uid, {
      source, sourceId, paid: result.paid, totalCsgn: result.totalCsgn,
      review: result.review.length, errors: result.errors.length,
    })
  }

  return json(200, {
    ok: result.errors.length === 0,
    dryRun,
    ...result,
    // Records carry a wallet each; trim to what an admin panel needs.
    review: result.review.map((r) => ({ id: r.id, wallet: r.wallet, amountCsgn: r.amountCsgn, reason: r.failureReason })),
  })
})
