/**
 * OPERATOR CONTROL over the auto-written rail: look at it, try it, run it, or
 * switch it off.
 *
 * A thing that writes on a live broadcast every two hours, unsupervised, needs
 * exactly three affordances and this is all of them:
 *
 *   status  — is it on, when did it last run, what did it say, what went wrong
 *   dry     — write lines and show them WITHOUT putting them on air
 *   run     — do it now, outside the cadence
 *   toggle  — off, and back on
 *
 * The dry run is the important one. It is the difference between switching on a
 * writer you have read and switching on a writer you have not, and it costs one
 * model call.
 */
import { requireAdminUser } from './_shared/auth'
import { auditLog } from './_shared/audit'
import { badRequest } from './_shared/errors'
import { getDoc, writeDoc } from './_shared/firebaseAdmin'
import { json, parseJson, requireMethod, withHttp } from './_shared/http'
import { checkRateLimit, clientIp } from './_shared/rateLimit'
import { railWriterConfigured, railModel } from './_shared/railWriter'
import { xConfigured, railQuery } from './_shared/xFeed'
import { readRail } from './_shared/rightNow'
import { runRailPass, RAIL_STATE_PATH } from './rightNowBackground'

type Body = { action?: unknown; enabled?: unknown }

export const handler = withHttp(async (event) => {
  requireMethod(event, 'POST')
  const admin = await requireAdminUser(event)
  // Tighter than most admin endpoints: two of these actions spend money.
  await checkRateLimit(clientIp(event), 'adminRightNow', 10)

  const body = parseJson<Body>(event)
  const action = String(body.action ?? 'status')

  const state = await getDoc<Record<string, unknown>>(RAIL_STATE_PATH)
  const ticker = await getDoc<{ rightNow?: unknown }>('config/ticker')
  const config = {
    // `enabled` is absent until somebody toggles it, and absent means ON — the
    // schedule is the decision, and a feature that needs a second switch flipped
    // after deploy is a feature that stays off by accident.
    enabled: state?.enabled !== false,
    // What is actually wired up, so "it is not running" is diagnosable from the
    // panel rather than from Netlify's environment page.
    hasModelKey: railWriterConfigured(),
    model: railModel(),
    hasX: xConfigured(),
    xQuery: xConfigured() ? railQuery() : '',
    lastRunAt: String(state?.lastRunAt ?? ''),
    lastError: String(state?.lastError ?? ''),
    lastSource: String(state?.lastSource ?? ''),
    lastAccepted: Number(state?.lastAccepted ?? 0),
    lastRejected: Number(state?.lastRejected ?? 0),
    lastLines: Array.isArray(state?.lastLines) ? state.lastLines : [],
  }

  if (action === 'status') {
    return json(200, { ok: true, config, rail: readRail(ticker?.rightNow) })
  }

  if (action === 'toggle') {
    const enabled = body.enabled === true
    await writeDoc(RAIL_STATE_PATH, { enabled, updatedAt: new Date().toISOString() }, { merge: true })
    await auditLog('adminRightNow', admin.uid, { action: 'toggle', enabled })
    return json(200, { ok: true, config: { ...config, enabled }, rail: readRail(ticker?.rightNow) })
  }

  if (action === 'dry' || action === 'run') {
    const dryRun = action === 'dry'
    // `force` on both: an operator pressing the button means now, and the
    // cadence guard exists to stop an unattended caller, not them.
    const result = await runRailPass({ force: true, dryRun })
    await auditLog('adminRightNow', admin.uid, { action, written: result.written ?? 0, source: result.source ?? '' })
    const after = dryRun ? ticker?.rightNow : (await getDoc<{ rightNow?: unknown }>('config/ticker'))?.rightNow
    return json(200, { ok: true, result, config, rail: readRail(after) })
  }

  throw badRequest("Action must be 'status', 'dry', 'run' or 'toggle'.", 'bad_action')
})
