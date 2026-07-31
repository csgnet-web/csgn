/**
 * Provider-resolution tests. This is the logic that broke registration: with a
 * second wallet extension installed, `window.solana` is not Phantom, and the
 * old code reported "Phantom not detected" to users who had Phantom running.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { getPhantomProvider, phantomDeeplink } from './usePhantomWallet'

type W = typeof globalThis & { solana?: unknown; phantom?: unknown }
const w = globalThis as W

afterEach(() => {
  delete w.solana
  delete w.phantom
})

const phantomLike = (tag: string) => ({ isPhantom: true, tag, connect: async () => ({ publicKey: { toString: () => 'addr' } }), disconnect: async () => {} })
const otherWallet = { isPhantom: false, tag: 'solflare', connect: async () => ({ publicKey: { toString: () => 'other' } }), disconnect: async () => {} }

describe('getPhantomProvider', () => {
  it('prefers the modern window.phantom.solana injection', () => {
    w.phantom = { solana: phantomLike('modern') }
    w.solana = phantomLike('legacy')
    expect((getPhantomProvider() as { tag?: string })?.tag).toBe('modern')
  })

  it('falls back to the legacy window.solana when it really is Phantom', () => {
    w.solana = phantomLike('legacy')
    expect((getPhantomProvider() as { tag?: string })?.tag).toBe('legacy')
  })

  // The multi-wallet bug: another extension claims window.solana, so isPhantom
  // is false there — but Phantom is present under window.phantom.solana.
  it('ignores a non-Phantom wallet squatting on window.solana', () => {
    w.solana = otherWallet
    w.phantom = { solana: phantomLike('modern') }
    expect((getPhantomProvider() as { tag?: string })?.tag).toBe('modern')
  })

  it('returns null when only a non-Phantom wallet is present', () => {
    w.solana = otherWallet
    expect(getPhantomProvider()).toBeNull()
  })

  it('returns null when no wallet is installed', () => {
    expect(getPhantomProvider()).toBeNull()
  })

  it('is not fooled by a window.phantom without a solana provider', () => {
    w.phantom = {}
    expect(getPhantomProvider()).toBeNull()
  })
})

describe('phantomDeeplink', () => {
  it('builds a Phantom universal link that reopens this page in-app', () => {
    const link = phantomDeeplink()
    expect(link.startsWith('https://phantom.app/ul/browse/')).toBe(true)
    expect(link).toContain(encodeURIComponent(window.location.href))
    expect(link).toContain('ref=')
  })
})
