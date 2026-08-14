import { describe, it, expect } from 'vitest'
import { isValidUsername, suggestUsername } from './username'

const WALLETS = [
  '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
  'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
  '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
  'So11111111111111111111111111111111111111112',
]

describe('suggestUsername', () => {
  it('always produces a name the server will accept', () => {
    for (const wallet of WALLETS) {
      const name = suggestUsername(wallet)
      expect(isValidUsername(name), `${wallet} -> ${name}`).toBe(true)
    }
  })

  it('is stable for a wallet, so backing out and retrying shows the same name', () => {
    expect(suggestUsername(WALLETS[0])).toBe(suggestUsername(WALLETS[0]))
  })

  it('gives different wallets different names', () => {
    const names = new Set(WALLETS.map(suggestUsername))
    expect(names.size).toBe(WALLETS.length)
  })

  it('still returns something valid for an empty seed', () => {
    expect(isValidUsername(suggestUsername(''))).toBe(true)
  })
})

describe('isValidUsername', () => {
  it('matches the server rule: 3-20 of letters, numbers and underscores', () => {
    expect(isValidUsername('ab')).toBe(false)
    expect(isValidUsername('abc')).toBe(true)
    expect(isValidUsername('a'.repeat(21))).toBe(false)
    expect(isValidUsername('has space')).toBe(false)
    expect(isValidUsername('has-dash')).toBe(false)
    expect(isValidUsername('Under_score9')).toBe(true)
  })

  it('ignores surrounding whitespace, matching what the form submits', () => {
    expect(isValidUsername('  NeonTicker01  ')).toBe(true)
  })
})
