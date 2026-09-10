import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  introAllowedOn, shouldShowIntro, hasSeenIntro, markIntroSeen, resetIntro, FIRST_RUN_KEY,
} from './firstRun'

beforeEach(() => { localStorage.clear() })
afterEach(() => { vi.restoreAllMocks() })

/**
 * The denylist is the safety property. `/player` is an OBS browser source — a
 * sheet over it goes out on television, which is a broadcast incident rather
 * than a styling bug.
 */
describe('introAllowedOn', () => {
  it('never covers a broadcast surface', () => {
    expect(introAllowedOn('/player')).toBe(false)
    expect(introAllowedOn('/oldplayer')).toBe(false)
    // Query strings arrive on these constantly (?rehearse, ?noads, ?debug).
    expect(introAllowedOn('/PLAYER')).toBe(false)
  })

  it('never interrupts a flow already in motion', () => {
    expect(introAllowedOn('/share')).toBe(false)
    expect(introAllowedOn('/auth/tiktok')).toBe(false)
    expect(introAllowedOn('/auth/twitch/complete')).toBe(false)
    expect(introAllowedOn('/admin')).toBe(false)
  })

  it('allows the pages a stranger actually lands on', () => {
    for (const path of ['/', '/watch', '/schedule', '/studio', '/participate', '/account', '/about', '/u/roblito']) {
      expect(introAllowedOn(path), path).toBe(true)
    }
  })

  it('does not match a route that merely starts with the same letters', () => {
    // `/players-guide` is not `/player`.
    expect(introAllowedOn('/players-guide')).toBe(true)
    expect(introAllowedOn('/sharesheet')).toBe(true)
  })

  it('is safe on nonsense', () => {
    expect(introAllowedOn('')).toBe(true)
    expect(introAllowedOn(undefined as unknown as string)).toBe(true)
  })
})

describe('hasSeenIntro', () => {
  it('is false before, true after', () => {
    expect(hasSeenIntro()).toBe(false)
    markIntroSeen()
    expect(hasSeenIntro()).toBe(true)
    expect(localStorage.getItem(FIRST_RUN_KEY)).toBe('1')
  })

  it('resets', () => {
    markIntroSeen()
    resetIntro()
    expect(hasSeenIntro()).toBe(false)
  })

  it('reads a throwing storage as SEEN, not unseen', () => {
    // Private mode. Getting this wrong the other way puts a full-screen sheet
    // over the channel on every single page load for that person.
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    expect(hasSeenIntro()).toBe(true)
  })

  it('survives a storage that refuses to write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied') })
    expect(() => markIntroSeen()).not.toThrow()
    expect(() => resetIntro()).not.toThrow()
  })
})

describe('shouldShowIntro', () => {
  const ask = (over: Partial<{ pathname: string; search: string; signedIn: boolean }> = {}) =>
    shouldShowIntro({ pathname: '/watch', search: '', signedIn: false, ...over })

  it('shows to a stranger on their first visit', () => {
    expect(ask()).toBe(true)
  })

  it('does not show twice', () => {
    markIntroSeen()
    expect(ask()).toBe(false)
  })

  it('never shows to a member', () => {
    // They have already been told — by having done it.
    expect(ask({ signedIn: true })).toBe(false)
  })

  it('never shows on a broadcast surface, whatever else is true', () => {
    expect(ask({ pathname: '/player' })).toBe(false)
    expect(ask({ pathname: '/player', search: '?intro=1' })).toBe(false)
    expect(ask({ pathname: '/oldplayer', search: '?intro=1', signedIn: false })).toBe(false)
  })

  it('reopens on ?intro=1, even for a member who has seen it', () => {
    // The operator checking a copy change, and the person who dismissed it by
    // accident and has no other way back.
    markIntroSeen()
    expect(ask({ search: '?intro=1' })).toBe(true)
    expect(ask({ search: '?intro=1', signedIn: true })).toBe(true)
  })
})
