import { describe, it, expect, beforeEach } from 'vitest'
import { storeAuthReturn, takeAuthReturn, clearAuthReturn, buildReturnUrl, AUTH_RETURN_KEY } from './authReturn'

beforeEach(() => sessionStorage.clear())

describe('storeAuthReturn / takeAuthReturn', () => {
  it('round-trips a path and intent', () => {
    storeAuthReturn({ path: '/schedule', intent: 'signup' })
    expect(takeAuthReturn()).toEqual({ path: '/schedule', intent: 'signup' })
  })

  it('consumes the value so a refresh of the landing page cannot bounce twice', () => {
    storeAuthReturn({ path: '/account', intent: 'link' })
    expect(takeAuthReturn().path).toBe('/account')
    expect(takeAuthReturn()).toEqual({ path: '/', intent: 'signup' })
  })

  it('falls back to the home sign-up when nothing was stored', () => {
    expect(takeAuthReturn()).toEqual({ path: '/', intent: 'signup' })
  })

  it('survives a corrupted entry instead of throwing at the user', () => {
    sessionStorage.setItem(AUTH_RETURN_KEY, '{not json')
    expect(takeAuthReturn()).toEqual({ path: '/', intent: 'signup' })
  })

  it('clearAuthReturn removes the entry', () => {
    storeAuthReturn({ path: '/schedule', intent: 'signup' })
    clearAuthReturn()
    expect(sessionStorage.getItem(AUTH_RETURN_KEY)).toBeNull()
  })

  // The stored path is handed straight to navigate(), so anything that could
  // resolve to another origin has to degrade to the default rather than be
  // trusted. Backslashes are in here because Chrome normalises them to slashes,
  // which turns "/\evil.com" into a protocol-relative URL.
  it('refuses any path that could leave this origin', () => {
    for (const path of [
      'https://evil.example/steal',
      '//evil.example/steal',
      '/\\evil.example',
      '\\\\evil.example',
      'javascript:alert(1)',
      'schedule',
    ]) {
      storeAuthReturn({ path, intent: 'signup' })
      expect(takeAuthReturn().path).toBe('/')
    }
  })

  it('normalises an unknown intent to signup', () => {
    sessionStorage.setItem(AUTH_RETURN_KEY, JSON.stringify({ path: '/schedule', intent: 'whatever' }))
    expect(takeAuthReturn().intent).toBe('signup')
  })
})

describe('buildReturnUrl', () => {
  it('adds ?auth=register to a sign-up return so the modal reopens', () => {
    const url = buildReturnUrl({ path: '/schedule', intent: 'signup' }, { twitch: 'connected' })
    expect(url).toBe('/schedule?auth=register&twitch=connected')
  })

  // The bug this whole module exists for: a member linking Twitch from /account
  // was returned to the home page and asked to create an account they had.
  it('never adds ?auth=register to a link return', () => {
    const url = buildReturnUrl({ path: '/account', intent: 'link' }, { twitch: 'connected' })
    expect(url).toBe('/account?twitch=connected')
    expect(url).not.toContain('auth=register')
  })

  it('keeps query params the user already had on the page', () => {
    const url = buildReturnUrl({ path: '/schedule?day=2', intent: 'signup' }, { twitch: 'connected' })
    expect(url).toContain('day=2')
    expect(url).toContain('auth=register')
  })

  it('drops any hash rather than carrying it through the redirect', () => {
    expect(buildReturnUrl({ path: '/about#fees', intent: 'link' }, {})).toBe('/about')
  })

  it('carries an error code back to wherever the user started', () => {
    expect(buildReturnUrl({ path: '/account', intent: 'link' }, { twitchError: 'duplicate_twitch' }))
      .toBe('/account?twitchError=duplicate_twitch')
  })
})
