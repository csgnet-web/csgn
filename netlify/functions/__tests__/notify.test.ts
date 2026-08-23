import { describe, it, expect } from 'vitest'
import {
  alertsToSend, pruneState, alertKey, formatMessage, RENOTIFY_AFTER_MS,
  type NotifyAlert, type NotifyState,
} from '../_shared/notify'

/**
 * The whole value of a notifier is that it is still switched on in a month.
 * These tests are about the one thing that decides that: never sending the same
 * thing twice. An alert fires every minute for as long as its condition holds,
 * so a naive relay sends sixty messages an hour and gets muted by lunchtime.
 */

const NOW = Date.parse('2026-08-20T18:00:00.000Z')
const ago = (ms: number) => new Date(NOW - ms).toISOString()

const a = (over: Partial<NotifyAlert> = {}): NotifyAlert => ({
  kind: 'pick_a_streamer', severity: 'action', message: 'somebody is live', uid: 'u1', ...over,
})

describe('alertKey', () => {
  // Kind alone is too coarse: "pick a streamer" about a DIFFERENT person is
  // news. The message is too fine: the viewer count in it changes every minute.
  it('is the kind and the subject, not the message', () => {
    expect(alertKey(a({ message: '5 watching' }))).toBe(alertKey(a({ message: '9 watching' })))
    expect(alertKey(a({ uid: 'u1' }))).not.toBe(alertKey(a({ uid: 'u2' })))
    expect(alertKey(a({ kind: 'on_air_dropped' }))).not.toBe(alertKey(a({ kind: 'pick_a_streamer' })))
  })

  it('falls back to the username, then to a placeholder', () => {
    expect(alertKey({ kind: 'k', severity: 'info', message: 'm', username: 'bob' })).toBe('k:bob')
    expect(alertKey({ kind: 'k', severity: 'info', message: 'm' })).toBe('k:-')
  })
})

describe('alertsToSend', () => {
  it('sends something never seen before', () => {
    expect(alertsToSend([a()], {}, NOW)).toHaveLength(1)
  })

  // The one that matters.
  it('does not send the same condition again a minute later', () => {
    const state: NotifyState = { [alertKey(a())]: ago(60_000) }
    expect(alertsToSend([a()], state, NOW)).toEqual([])
  })

  it('nags again once the re-notify window has passed', () => {
    const state: NotifyState = { [alertKey(a())]: ago(RENOTIFY_AFTER_MS + 1000) }
    expect(alertsToSend([a()], state, NOW)).toHaveLength(1)
  })

  it('sends the same kind about a different person', () => {
    const state: NotifyState = { [alertKey(a({ uid: 'u1' }))]: ago(60_000) }
    expect(alertsToSend([a({ uid: 'u2' })], state, NOW)).toHaveLength(1)
  })

  // Info is for the board, not for a phone at 3 AM.
  it('holds info-level alerts back by default', () => {
    const alerts = [a({ severity: 'info', kind: 'long_shift' }), a({ severity: 'critical', kind: 'on_air_dropped' })]
    expect(alertsToSend(alerts, {}, NOW).map((x) => x.kind)).toEqual(['on_air_dropped'])
  })

  it('can be opened up to info when asked', () => {
    expect(alertsToSend([a({ severity: 'info' })], {}, NOW, 'info')).toHaveLength(1)
  })

  it('sends on an unreadable stored timestamp rather than staying silent', () => {
    expect(alertsToSend([a()], { [alertKey(a())]: 'nonsense' }, NOW)).toHaveLength(1)
  })
})

describe('pruneState', () => {
  // Without this, an alert sent once is suppressed for a full hour even after
  // the situation resolved and recurred — precisely when it matters most.
  it('forgets a condition that has cleared', () => {
    const state: NotifyState = { [alertKey(a())]: ago(60_000) }
    expect(pruneState(state, [], NOW)).toEqual({})
  })

  it('keeps a condition that is still true', () => {
    const state: NotifyState = { [alertKey(a())]: ago(60_000) }
    expect(Object.keys(pruneState(state, [a()], NOW))).toHaveLength(1)
  })

  it('drops entries older than the re-notify window either way', () => {
    const state: NotifyState = { [alertKey(a())]: ago(RENOTIFY_AFTER_MS + 1) }
    expect(pruneState(state, [a()], NOW)).toEqual({})
  })

  it('drops an unparseable entry', () => {
    expect(pruneState({ 'k:-': 'nonsense' }, [{ kind: 'k', severity: 'action', message: 'm' }], NOW)).toEqual({})
  })

  // A cleared-then-recurred condition must be sendable again.
  it('lets a resolved condition fire again when it comes back', () => {
    const sent: NotifyState = { [alertKey(a())]: ago(60_000) }
    const afterClear = pruneState(sent, [], NOW)
    expect(alertsToSend([a()], afterClear, NOW)).toHaveLength(1)
  })
})

describe('formatMessage', () => {
  it('puts the whole batch in one message', () => {
    const msg = formatMessage([a({ message: 'one' }), a({ message: 'two', severity: 'critical' })], 'https://csgn.fun')
    expect(msg).toContain('one')
    expect(msg).toContain('two')
    expect(msg.split('\n').filter((l) => l.trim()).length).toBe(4) // title, two alerts, link
  })

  it('marks severity so a red one is readable at a glance', () => {
    expect(formatMessage([a({ severity: 'critical' })], '')).toContain('🔴')
    expect(formatMessage([a({ severity: 'action' })], '')).toContain('🟡')
  })

  it('links straight to the board', () => {
    expect(formatMessage([a()], 'https://csgn.fun/')).toContain('https://csgn.fun/admin')
  })

  it('is empty for an empty batch', () => {
    expect(formatMessage([], 'https://csgn.fun')).toBe('')
  })
})
