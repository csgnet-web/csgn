import { describe, expect, it } from 'vitest'
import { emailKey, normalizeEmail, normalizeUsername, usernameKey } from '../_shared/validators'
import { parseJson, MAX_BODY_BYTES } from '../_shared/http'

describe('validators', () => {
  it('normalizes email', () => {
    expect(normalizeEmail('  USER@Example.COM  ')).toBe('user@example.com')
  })

  it('validates username', () => {
    expect(normalizeUsername('CSGN_User42')).toBe('CSGN_User42')
    expect(usernameKey('CSGN_User42')).toBe('csgn_user42')
  })

  it('rejects invalid usernames', () => {
    expect(() => normalizeUsername('ab')).toThrow(/username/i)
    expect(() => normalizeUsername('bad-name')).toThrow(/username/i)
    expect(() => normalizeUsername('this_username_is_way_too_long')).toThrow(/username/i)
  })

  it('hashes email keys deterministically', () => {
    expect(emailKey('USER@example.com')).toBe(emailKey(' user@example.com '))
  })
})

/* ─── Request-body guards ─── */

describe('parseJson is bounded and never 500s on junk', () => {
  const event = (body: string | null) =>
    ({ httpMethod: 'POST', headers: {}, body }) as Parameters<typeof parseJson>[0]

  it('parses a normal object body', () => {
    expect(parseJson(event('{"slotId":"abc"}'))).toEqual({ slotId: 'abc' })
  })

  it('treats a missing body as empty rather than an error', () => {
    expect(parseJson(event(null))).toEqual({})
    expect(parseJson(event(''))).toEqual({})
  })

  it('REFUSES an oversized body — the cheapest possible DoS is making us parse megabytes', () => {
    const huge = JSON.stringify({ pad: 'x'.repeat(MAX_BODY_BYTES) })
    expect(() => parseJson(event(huge))).toThrow(/too large/i)
    try { parseJson(event(huge)) } catch (e) {
      expect((e as { status: number }).status).toBe(413)
    }
  })

  it('returns 400 on malformed JSON, not 500 — junk input is not an outage', () => {
    try { parseJson(event('{not json')) } catch (e) {
      expect((e as { status: number }).status).toBe(400)
      expect((e as { code: string }).code).toBe('invalid_json')
    }
  })

  it('rejects a body that is not an OBJECT, so handlers can destructure safely', () => {
    // Every handler does `const { x } = parseJson(event)`. `null.x` is a 500
    // with a stack trace; this turns all four shapes into one clean 400.
    for (const body of ['null', '[1,2,3]', '"a string"', '42']) {
      try {
        parseJson(event(body))
        throw new Error(`expected ${body} to be rejected`)
      } catch (e) {
        expect((e as { status: number }).status).toBe(400)
      }
    }
  })
})
