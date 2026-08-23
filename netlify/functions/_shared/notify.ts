/**
 * TELLING THE MP, WITH THE TAB CLOSED.
 *
 * ── The problem this fixes ─────────────────────────────────────────────────
 *
 * The operator alerts were already computed every minute and published to
 * `public/operatorAlerts`, and the admin board raised desktop notifications
 * from them. That works exactly as long as somebody has the board open in a
 * focused browser — which is to say, it works while you are already watching,
 * and is silent the rest of the time. A channel that only runs while somebody
 * stares at a board does not run 24 hours.
 *
 * So the same alerts go out over a webhook: Discord, Slack, or anything that
 * accepts a JSON POST. One environment variable, no infrastructure, works on a
 * phone, and survives the laptop being shut.
 *
 * ── Why a webhook and not push ─────────────────────────────────────────────
 *
 * Web push needs VAPID keys, a service worker that handles `push`, a
 * subscription store, and a way to re-subscribe when the browser rotates the
 * endpoint. That is a week of work and a permanent maintenance surface, to
 * reach one person. A Discord webhook is a URL in an env var and reaches the
 * same person on every device they own, including the one in their pocket.
 *
 * ── The rule that keeps notifications ON ───────────────────────────────────
 *
 * **Never send the same thing twice.** An alert fires every minute for as long
 * as the condition holds, so a naive relay sends "somebody is live" sixty times
 * an hour and gets muted by lunchtime. State is kept per alert kind + subject,
 * and a repeat is dropped until the condition CLEARS and returns.
 */

import { fetchJson } from './cache'
import { getDoc, writeDoc } from './firebaseAdmin'

export const NOTIFY_STATE_PATH = 'config/operatorNotify'

/** A condition that stays true is not news. Re-send only after it has been
 *  quiet this long, so a genuinely persistent problem still nags eventually. */
export const RENOTIFY_AFTER_MS = 60 * 60 * 1000

export interface NotifyAlert {
  kind: string
  severity: 'critical' | 'action' | 'info'
  message: string
  uid?: string
  username?: string
}

/** What has already been sent: key → ISO timestamp of the last send. */
export type NotifyState = Record<string, string>

/** Identity of an alert for dedupe purposes. Kind alone is too coarse — "pick a
 *  streamer" about a different person IS news — and including the message text
 *  is too fine, because the viewer count in it changes every minute. */
export function alertKey(alert: NotifyAlert): string {
  return `${alert.kind}:${alert.uid ?? alert.username ?? '-'}`
}

/**
 * Which of these alerts are actually worth sending right now.
 *
 * Pure, so the thing standing between the MP and sixty notifications an hour is
 * tested rather than hoped for.
 */
export function alertsToSend(
  alerts: NotifyAlert[],
  state: NotifyState,
  nowMs = Date.now(),
  minSeverity: NotifyAlert['severity'] = 'action',
): NotifyAlert[] {
  const rank: Record<NotifyAlert['severity'], number> = { critical: 0, action: 1, info: 2 }
  const bar = rank[minSeverity]
  return alerts.filter((a) => {
    if (rank[a.severity] > bar) return false
    const last = Date.parse(state[alertKey(a)] ?? '')
    if (!Number.isFinite(last)) return true
    return nowMs - last >= RENOTIFY_AFTER_MS
  })
}

/**
 * Drop keys for conditions that have cleared, so the same alert can fire again
 * the next time it genuinely happens.
 *
 * Without this, an alert sent once would be suppressed for a full hour even
 * after the situation resolved and recurred — which is precisely when the MP
 * most needs to hear about it.
 */
export function pruneState(state: NotifyState, current: NotifyAlert[], nowMs = Date.now()): NotifyState {
  const live = new Set(current.map(alertKey))
  const next: NotifyState = {}
  for (const [key, at] of Object.entries(state)) {
    const ms = Date.parse(at)
    // Keep a key only while its condition is still true and still recent. An
    // entry older than the re-notify window is dead weight either way.
    if (live.has(key) && Number.isFinite(ms) && nowMs - ms < RENOTIFY_AFTER_MS) next[key] = at
  }
  return next
}

const SEVERITY_MARK: Record<NotifyAlert['severity'], string> = {
  critical: '🔴',
  action: '🟡',
  info: '⚪',
}

/**
 * One message for the whole batch rather than one per alert.
 *
 * Three notifications arriving together is three buzzes for one situation, and
 * the situation is what the MP is acting on.
 */
export function formatMessage(alerts: NotifyAlert[], siteUrl: string): string {
  if (alerts.length === 0) return ''
  const lines = alerts.map((a) => `${SEVERITY_MARK[a.severity]} ${a.message}`)
  const board = siteUrl ? `\n${siteUrl.replace(/\/+$/, '')}/admin` : ''
  return `**CSGN — Master Control**\n${lines.join('\n')}${board}`
}

/**
 * Send a batch and record what was sent. Returns how many went out.
 *
 * Best-effort throughout: this is called from the scheduled poller, and a
 * webhook being down must never fail a run that is also accruing fees and
 * advancing the schedule.
 */
export async function notifyOperator(alerts: NotifyAlert[], nowMs = Date.now()): Promise<number> {
  const url = (process.env.OPERATOR_WEBHOOK_URL || '').trim()
  if (!url || !/^https:\/\//.test(url)) return 0

  let state: NotifyState = {}
  try {
    state = (await getDoc<{ sent?: NotifyState }>(NOTIFY_STATE_PATH))?.sent ?? {}
  } catch {
    // An unreadable state doc means we might repeat a notification. That is a
    // far better failure than staying silent about dead air.
  }

  const due = alertsToSend(alerts, state, nowMs)
  if (due.length === 0) {
    // Still prune, so a cleared condition can fire again next time.
    const pruned = pruneState(state, alerts, nowMs)
    if (Object.keys(pruned).length !== Object.keys(state).length) {
      await writeDoc(NOTIFY_STATE_PATH, { sent: pruned, updatedAt: new Date(nowMs).toISOString() }).catch(() => {})
    }
    return 0
  }

  const content = formatMessage(due, process.env.CSGN_ALLOWED_ORIGIN || '')
  // Discord and Slack disagree about the field name and both ignore the other's,
  // so sending both makes one payload work on either without configuration.
  const ok = await fetchJson<unknown>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, text: content }),
    timeoutMs: 5_000,
  })
  // fetchJson returns null on a non-2xx OR on an empty body, and Discord answers
  // 204 with no body — so a null here is not evidence of failure and must not
  // stop the state being recorded. Recording it is what prevents a retry storm.
  void ok

  const sent: NotifyState = { ...pruneState(state, alerts, nowMs) }
  const stamp = new Date(nowMs).toISOString()
  for (const a of due) sent[alertKey(a)] = stamp
  await writeDoc(NOTIFY_STATE_PATH, { sent, updatedAt: stamp }).catch(() => {})

  return due.length
}
