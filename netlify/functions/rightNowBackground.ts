/**
 * THE RIGHT NOW RAIL, ON A TIMER.
 *
 * Every two hours: read what crypto is talking about, have a model write a few
 * short lines about it, vet every one of them in code, and merge them onto
 * `config/ticker.rightNow` without touching a single holder's paid line.
 *
 * ── Why two hours ──────────────────────────────────────────────────────────
 *
 * The rail leads every rotation of the ticker, so a viewer sees it repeatedly
 * within a few minutes. Rewriting it every ten minutes would not make the
 * channel feel live, it would make it feel like it was talking to itself.
 * Two hours is roughly the interval at which a returning viewer notices the
 * rail has moved on — and it is twelve model calls a day rather than a hundred
 * and forty-four.
 *
 * ── Why this function guards itself ────────────────────────────────────────
 *
 * The same reasoning as `feePollerBackground.ts`, and it matters more here:
 * Netlify serves every function at /.netlify/functions/<name>, scheduled ones
 * included, so "it's a cron job" is not access control — and each invocation
 * of THIS one spends money at two vendors. Two independent controls:
 *
 *   1. netlify.toml returns 404 for the public path. The scheduler invokes
 *      internally and never crosses the CDN.
 *   2. The interval guard below. A caller who gets past (1) still cannot make
 *      this run more often than its cadence: a run that starts too soon after
 *      the last one exits before it has called anybody.
 *
 * It skips rather than throwing, for the same reason the fee poller does — a
 * guard that can fail the real scheduled run is a self-inflicted outage.
 *
 * ── Failure is silence, never a wrong rail ─────────────────────────────────
 *
 * Every failure path leaves the rail exactly as it was. X down, the model
 * declining, nothing surviving the vet — all of them end with the previous
 * lines still on screen, which on a live broadcast is the right answer to every
 * one of those questions.
 */
import { getDoc, writeDoc } from './_shared/firebaseAdmin'
import { containsProfanity } from './_shared/profanity'
import { fetchXPosts, marketMaterial, xConfigured, type MarketCoin } from './_shared/xFeed'
import { railWriterConfigured, writeRailLines } from './_shared/railWriter'
import {
  mergeRail, readRail, vetLines, tickersInMaterial, MAX_AI_ITEMS, MAX_RAIL_ITEMS,
  type RailItem, type RailSource,
} from './_shared/rightNow'

export const RAIL_STATE_PATH = 'config/rightNowAuto'

/** The cadence, and the floor the guard enforces. Kept a few minutes under two
 *  hours so a scheduler that fires slightly early is never skipped. */
const RUN_INTERVAL_MS = 115 * 60 * 1000

/** How many posts to read. Raw material for four lines. */
const X_POSTS = 25

interface RailState {
  /** ISO of the last run that actually called anybody. */
  lastRunAt?: string
  enabled?: boolean
  lastError?: string
  lastModel?: string
  lastAccepted?: number
  lastRejected?: number
  lastSource?: string
}

export interface RailRunResult {
  ran: boolean
  skipped?: string
  written?: number
  source?: 'x' | 'market' | 'none'
  accepted?: RailItem[]
  rejected?: Array<{ text: string; reason: string }>
  model?: string
  error?: string
}

/**
 * Gather this run's raw material.
 *
 * X first when it is configured and answering; the channel's own market board
 * otherwise. The board is not a consolation prize — "what moved today" is most
 * of what the timeline is talking about anyway, and it costs one document read
 * against a bill the channel is already paying.
 */
async function gatherSources(): Promise<{ sources: RailSource[]; source: 'x' | 'market' | 'none' }> {
  const posts = await fetchXPosts(X_POSTS)
  if (posts && posts.length > 0) {
    return { sources: posts.map((post) => ({ kind: 'x' as const, text: post.text })), source: 'x' }
  }

  const board = await getDoc<{ coins?: MarketCoin[] }>('public/memeBoard')
  const lines = marketMaterial(Array.isArray(board?.coins) ? board.coins : [])
  if (lines.length > 0) {
    return { sources: lines.map((text) => ({ kind: 'market' as const, text })), source: 'market' }
  }
  // Nothing to work from. The model is still asked — with an empty material
  // block and an instruction not to invent news — because a channel that says
  // something general about crypto beats a rail frozen since yesterday.
  return { sources: [], source: 'none' }
}

/**
 * One pass. Exported and callable directly so the admin panel can dry-run it
 * (`{ dryRun: true }` does everything except the write) and force a run outside
 * the cadence.
 */
export async function runRailPass({ force = false, dryRun = false } = {}): Promise<RailRunResult> {
  const state = await getDoc<RailState>(RAIL_STATE_PATH)

  // Switched off from the admin panel. Checked before the interval so an
  // operator turning it off takes effect on the very next tick.
  if (state?.enabled === false) return { ran: false, skipped: 'disabled' }

  if (!railWriterConfigured()) return { ran: false, skipped: 'no_api_key' }

  if (!force) {
    const last = Date.parse(state?.lastRunAt || '')
    if (Number.isFinite(last) && Date.now() - last < RUN_INTERVAL_MS) {
      return { ran: false, skipped: 'too_soon' }
    }
  }

  const { sources, source } = await gatherSources()
  const written = await writeRailLines(sources, MAX_AI_ITEMS)

  const ticker = await getDoc<{ rightNow?: unknown }>('config/ticker')
  const existing = readRail(ticker?.rightNow)
  // Holders own their lines; the AI writes into whatever is left.
  const holderCount = existing.filter((item) => item.tag === 'HOLDER').length
  const room = Math.max(0, Math.min(MAX_AI_ITEMS, MAX_RAIL_ITEMS - holderCount))

  // A line may only name a coin the MATERIAL named. Derived from the same array
  // handed to the model, so the two cannot disagree — and so a post written to
  // be quoted cannot walk a ticker onto a television chyron.
  const { accepted, rejected } = vetLines(
    written.candidates, containsProfanity, existing, room, tickersInMaterial(sources),
  )

  if (accepted.length === 0) {
    // Nothing survived, or nothing was written. Leave the rail alone and record
    // why, so a run of empty passes is visible rather than silent.
    const error = written.error || (written.candidates.length > 0 ? 'every line was rejected' : 'no lines written')
    if (!dryRun) {
      await writeDoc(RAIL_STATE_PATH, {
        lastRunAt: new Date().toISOString(),
        lastError: error,
        lastModel: written.model,
        lastAccepted: 0,
        lastRejected: rejected.length,
        lastSource: source,
      }, { merge: true })
    }
    return { ran: !dryRun, written: 0, source, accepted: [], rejected, model: written.model, error }
  }

  const next = mergeRail(existing, accepted)

  if (dryRun) {
    return { ran: false, skipped: 'dry_run', written: accepted.length, source, accepted, rejected, model: written.model }
  }

  await writeDoc('config/ticker', { rightNow: next, updatedAt: new Date().toISOString() }, { merge: true })
  await writeDoc(RAIL_STATE_PATH, {
    lastRunAt: new Date().toISOString(),
    lastError: '',
    lastModel: written.model,
    lastAccepted: accepted.length,
    lastRejected: rejected.length,
    lastSource: source,
    // Kept so the panel can show what the model actually said last time without
    // reading the ticker and guessing which lines were its.
    lastLines: accepted,
  }, { merge: true })

  console.log(
    `[rightNow] ${accepted.length} line(s) from ${source}${written.usage ? ` · ${written.usage.inputTokens}in/${written.usage.outputTokens}out` : ''}`
    + (rejected.length > 0 ? ` · rejected ${rejected.map((r) => r.reason).join(', ')}` : ''),
  )

  return { ran: true, written: accepted.length, source, accepted, rejected, model: written.model }
}

export const handler = async (): Promise<{ statusCode: number; body: string }> => {
  try {
    const result = await runRailPass()
    return { statusCode: 200, body: JSON.stringify(result) }
  } catch (err) {
    // A scheduled function that throws is retried; there is nothing here worth
    // retrying, and the rail is unchanged either way.
    console.error('[rightNow] pass failed:', err)
    return { statusCode: 200, body: JSON.stringify({ ran: false, error: 'failed' }) }
  }
}

/** The X integration's state, for the admin panel's benefit. */
export const railStatus = () => ({ x: xConfigured(), model: railWriterConfigured() })
