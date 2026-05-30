import { describe, expect, it } from 'vitest'
import { emailKey, normalizeEmail, normalizeUsername, usernameKey } from '../_shared/validators'

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
