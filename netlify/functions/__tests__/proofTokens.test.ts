import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { createProofToken, verifyProofToken } from '../_shared/proofTokens'

beforeEach(() => { process.env.CSGN_PROOF_SIGNING_SECRET = 'unit-test-secret-at-least-16-chars' })
afterEach(() => { vi.useRealTimers() })

describe('proofTokens', () => {
  it('verifies a valid token', () => {
    const token = createProofToken('phantom_wallet', { walletAddress: 'abc' }, 60)
    expect(verifyProofToken(token, 'phantom_wallet')).toMatchObject({ type: 'phantom_wallet', walletAddress: 'abc' })
  })

  it('fails an expired token', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const token = createProofToken('phantom_wallet', { walletAddress: 'abc' }, 1)
    vi.setSystemTime(new Date('2026-01-01T00:00:02Z'))
    expect(() => verifyProofToken(token, 'phantom_wallet')).toThrow(/expired/i)
  })

  it('fails the wrong token type', () => {
    const token = createProofToken('twitch_account', { twitchUserId: '123' }, 60)
    expect(() => verifyProofToken(token, 'phantom_wallet')).toThrow(/wrong proof token type/i)
  })

  it('fails a tampered token', () => {
    const token = createProofToken('phantom_wallet', { walletAddress: 'abc' }, 60)
    const parts = token.split('.')
    parts[1] = Buffer.from(JSON.stringify({ type: 'phantom_wallet', walletAddress: 'def', exp: 9999999999, iat: 1, jti: 'x' })).toString('base64url')
    expect(() => verifyProofToken(parts.join('.'), 'phantom_wallet')).toThrow(/invalid proof token/i)
  })
})
