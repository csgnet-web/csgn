import { describe, it, expect } from 'vitest'
import { sanitizeHandle, suggestUsername } from '../_shared/handles'

/**
 * The username rules are `^[a-zA-Z0-9_]{3,20}$`. Everything here is about
 * getting a provider's idea of a handle across that line without either
 * rejecting somebody at the door or inventing a name that is not theirs.
 */
describe('sanitizeHandle', () => {
  it('passes a handle that is already fine', () => {
    expect(sanitizeHandle('roblito')).toBe('roblito')
    expect(sanitizeHandle('Big_Dog_42')).toBe('Big_Dog_42')
  })

  it('drops the @ people paste with their handle', () => {
    expect(sanitizeHandle('@roblito')).toBe('roblito')
    expect(sanitizeHandle('@@roblito')).toBe('roblito')
  })

  it('turns dots, dashes and spaces into underscores rather than deleting them', () => {
    // "big.dog" is legible as "big_dog" and unrecognisable as "bigdog".
    expect(sanitizeHandle('big.dog')).toBe('big_dog')
    expect(sanitizeHandle('big-dog')).toBe('big_dog')
    expect(sanitizeHandle('big dog')).toBe('big_dog')
    expect(sanitizeHandle('big...dog')).toBe('big_dog')
  })

  it('strips anything the rules do not allow', () => {
    expect(sanitizeHandle('rob✨lito')).toBe('roblito')
    // Disallowed characters are removed, not treated as separators — what is
    // left of the person's own name is kept rather than truncated at the first
    // bad character.
    expect(sanitizeHandle('rob/lito?x=1')).toBe('roblitox1')
  })

  it('never leaves a leading or trailing underscore', () => {
    expect(sanitizeHandle('_roblito_')).toBe('roblito')
    expect(sanitizeHandle('.roblito.')).toBe('roblito')
  })

  it('truncates to the 20-character limit', () => {
    expect(sanitizeHandle('a'.repeat(40))).toHaveLength(20)
  })

  it('answers null when there is nothing usable left', () => {
    // Padding a two-character handle out to three would invent a name that
    // looks like theirs and is not — better to mint an obvious one instead.
    expect(sanitizeHandle('ab')).toBeNull()
    expect(sanitizeHandle('✨')).toBeNull()
    expect(sanitizeHandle('')).toBeNull()
    expect(sanitizeHandle('___')).toBeNull()
  })
})

describe('suggestUsername', () => {
  it('is stable for a seed, so a retried sign-up gets the same name', () => {
    expect(suggestUsername('open-id-123')).toBe(suggestUsername('open-id-123'))
  })

  it('walks to a different name on each salt', () => {
    const names = new Set([0, 1, 2, 3, 4].map((salt) => suggestUsername('open-id-123', salt)))
    expect(names.size).toBe(5)
  })

  it('always produces something the username rules accept', () => {
    for (let i = 0; i < 200; i++) {
      expect(suggestUsername(`seed-${i}`, i % 12)).toMatch(/^[a-zA-Z0-9_]{3,20}$/)
    }
  })
})
