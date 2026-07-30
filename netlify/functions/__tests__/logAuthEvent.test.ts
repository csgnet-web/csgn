import { describe, it, expect } from 'vitest'
import { normalizeAuthEvent, AUTH_EVENT_KINDS } from '../logAuthEvent'

describe('AUTH_EVENT_KINDS', () => {
  it('covers the pre-session events that a rules-gated client write used to drop', () => {
    // These fire BEFORE the user is authenticated — the whole reason logging moved
    // server-side. If any goes missing, failed sign-ups become invisible again.
    for (const kind of ['signin-start', 'signin-failure', 'signup-email-start', 'signup-email-failure']) {
      expect(AUTH_EVENT_KINDS).toContain(kind)
    }
  })
})

describe('normalizeAuthEvent', () => {
  it('accepts a known kind and passes through the optional fields', () => {
    const ev = normalizeAuthEvent({
      kind: 'signup-email-failure',
      uid: 'abc123',
      twitchUsername: 'degen',
      errorMessage: 'auth/email-already-in-use',
      ua: 'Mozilla/5.0',
    })
    expect(ev.kind).toBe('signup-email-failure')
    expect(ev.uid).toBe('abc123')
    expect(ev.twitchUsername).toBe('degen')
    expect(ev.errorMessage).toBe('auth/email-already-in-use')
    expect(ev.ua).toBe('Mozilla/5.0')
  })

  it('logs a pre-session event with no uid (the case the old rule rejected)', () => {
    const ev = normalizeAuthEvent({ kind: 'signup-email-start' })
    expect(ev.kind).toBe('signup-email-start')
    expect(ev.uid).toBeNull()
    expect(ev.errorMessage).toBeNull()
  })

  it('rejects an unknown or missing kind', () => {
    expect(() => normalizeAuthEvent({ kind: 'drop-table' })).toThrow()
    expect(() => normalizeAuthEvent({})).toThrow()
    expect(() => normalizeAuthEvent({ kind: 42 })).toThrow()
  })

  it('clamps oversized fields so one client cannot bloat the audit log', () => {
    const ev = normalizeAuthEvent({
      kind: 'signin-failure',
      errorMessage: 'x'.repeat(5000),
      ua: 'u'.repeat(5000),
      twitchUsername: 'n'.repeat(500),
    })
    expect(ev.errorMessage).toHaveLength(500)
    expect(ev.ua).toHaveLength(300)
    expect(ev.twitchUsername).toHaveLength(80)
  })

  it('drops malformed optional values instead of throwing', () => {
    const ev = normalizeAuthEvent({ kind: 'signin-start', uid: { nope: true }, errorMessage: 123, twitchUsername: '   ' })
    expect(ev.uid).toBeNull()
    expect(ev.errorMessage).toBeNull()
    expect(ev.twitchUsername).toBeNull()
  })
})
