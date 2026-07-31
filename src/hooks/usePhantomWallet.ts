import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Phantom wallet connection.
 *
 * The failure modes this is written against, all of which broke registration:
 *
 *  1. **`window.solana` is the legacy injection.** Phantom's current, documented
 *     entry point is `window.phantom.solana`. `window.solana` is a
 *     backwards-compat alias that *any* wallet extension may claim — with
 *     Solflare/Backpack installed it can be someone else's provider, whose
 *     `isPhantom` is false, so we'd report "Phantom not detected" to a user who
 *     has Phantom installed and running.
 *  2. **Injection is asynchronous.** The provider may not exist yet on first
 *     paint (and is noticeably late inside in-app browsers), so a single
 *     synchronous read at click time can miss a wallet that is about to appear.
 *  3. **A cached address is not a connection.** The old hook seeded its address
 *     from localStorage and callers did `walletAddress || connect()` — so a
 *     returning user skipped `connect()` entirely and went straight to
 *     `signMessage()` on a provider that was never connected this session. The
 *     signature prompt never appeared and the flow died silently. localStorage
 *     is now a *display hint only*; `ensureConnected()` is what callers use.
 *  4. **Every error looked the same.** A user tapping "cancel" got the same
 *     message as a missing extension, so nobody could self-diagnose.
 *  5. **Mobile browsers had no path at all.** Safari/Chrome on a phone have no
 *     extension; the only way in is Phantom's in-app browser, so we now offer a
 *     deeplink instead of a dead end.
 */

interface PhantomProvider {
  isPhantom?: boolean
  isConnected?: boolean
  publicKey?: { toString: () => string } | null
  connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString: () => string } }>
  disconnect: () => Promise<void>
  signMessage?: (message: Uint8Array, encoding?: 'utf8') => Promise<{ signature: Uint8Array }>
  on?: (event: string, handler: (...args: unknown[]) => void) => void
  off?: (event: string, handler: (...args: unknown[]) => void) => void
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void
}

declare global {
  interface Window {
    solana?: PhantomProvider
    phantom?: { solana?: PhantomProvider }
  }
}

const STORAGE_KEY = 'csgn_wallet_address'
/** How long to wait for the extension to inject before declaring it absent. */
const PROVIDER_WAIT_MS = 3_000
const PROVIDER_POLL_MS = 100

/** Phantom's own provider, wherever it lives. Never returns another wallet. */
export function getPhantomProvider(): PhantomProvider | null {
  if (typeof window === 'undefined') return null
  const modern = window.phantom?.solana
  if (modern?.isPhantom) return modern
  const legacy = window.solana
  if (legacy?.isPhantom) return legacy
  return null
}

/** Resolve once Phantom has injected, or null if it never shows up. */
async function waitForProvider(timeoutMs = PROVIDER_WAIT_MS): Promise<PhantomProvider | null> {
  const immediate = getPhantomProvider()
  if (immediate) return immediate
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve) => {
    const tick = () => {
      const provider = getPhantomProvider()
      if (provider) return resolve(provider)
      if (Date.now() >= deadline) return resolve(null)
      setTimeout(tick, PROVIDER_POLL_MS)
    }
    setTimeout(tick, PROVIDER_POLL_MS)
  })
}

/** True on a phone/tablet browser, where an extension can never exist. */
function isMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent)
}

/**
 * Phantom's universal link, which reopens the current page inside Phantom's
 * in-app browser — the only place a mobile user can approve a signature.
 */
export function phantomDeeplink(): string {
  const url = typeof window !== 'undefined' ? window.location.href : 'https://csgn.fun'
  const ref = typeof window !== 'undefined' ? window.location.origin : 'https://csgn.fun'
  return `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(ref)}`
}

/** Phantom rejections carry code 4001 — that's a cancel, not a failure. */
function isUserRejection(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const code = (err as { code?: unknown }).code
  const message = String((err as { message?: unknown }).message ?? '')
  return code === 4001 || /user rejected|user denied|request rejected/i.test(message)
}

function bytesToBase58(bytes: Uint8Array): string {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  const digits = [0]
  for (const byte of bytes) {
    let carry = byte
    for (let i = 0; i < digits.length; i++) {
      const value = digits[i] * 256 + carry
      digits[i] = value % 58
      carry = Math.floor(value / 58)
    }
    while (carry) { digits.push(carry % 58); carry = Math.floor(carry / 58) }
  }
  for (const byte of bytes) { if (byte === 0) digits.push(0); else break }
  return digits.reverse().map((digit) => alphabet[digit]).join('')
}

export function usePhantomWallet() {
  // Seeded from storage for instant UI only — never treated as "connected".
  const [walletAddress, setWalletAddress] = useState<string | null>(() =>
    typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null,
  )
  const [balance, setBalance] = useState<number | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** True when Phantom can't be reached on this device — surfaces the deeplink. */
  const [needsPhantom, setNeedsPhantom] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const fetchBalance = useCallback(async (address: string) => {
    try {
      const response = await fetch('https://api.mainnet-beta.solana.com', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [address] }) })
      const data = await response.json()
      if (mountedRef.current) setBalance((data?.result?.value ?? 0) / 1_000_000_000)
    } catch { if (mountedRef.current) setBalance(null) }
  }, [])

  const adopt = useCallback((address: string) => {
    setWalletAddress(address)
    try { localStorage.setItem(STORAGE_KEY, address) } catch { /* private mode */ }
    void fetchBalance(address)
  }, [fetchBalance])

  const forget = useCallback(() => {
    setWalletAddress(null)
    setBalance(null)
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* private mode */ }
  }, [])

  /**
   * Guarantee a LIVE connection and return the address. This — not the cached
   * `walletAddress` — is what callers must use before signing. Reconnecting an
   * already-approved wallet is silent (no prompt), so calling it is cheap.
   */
  const ensureConnected = useCallback(async (): Promise<string | null> => {
    setError(null)
    setNeedsPhantom(false)
    setIsConnecting(true)
    try {
      const provider = await waitForProvider()
      if (!provider) {
        setNeedsPhantom(true)
        setError(
          isMobileBrowser()
            ? 'Open this page in the Phantom app browser to connect your wallet.'
            : 'Phantom not detected. Install the Phantom extension, then reload this page.',
        )
        return null
      }
      // Already live this session — reuse it rather than re-prompting.
      if (provider.isConnected && provider.publicKey) {
        const address = provider.publicKey.toString()
        adopt(address)
        return address
      }
      const result = await provider.connect()
      const address = result.publicKey.toString()
      adopt(address)
      return address
    } catch (err) {
      setError(isUserRejection(err)
        ? 'Connection request cancelled in Phantom. Tap Connect and approve to continue.'
        : 'Phantom could not connect. Unlock the wallet and try again.')
      return null
    } finally {
      if (mountedRef.current) setIsConnecting(false)
    }
  }, [adopt])

  /**
   * Sign a message, connecting first if needed. Returns a base58 signature.
   * Signing always goes through `ensureConnected()`, which is the fix for the
   * silent dead-end: a cached address can no longer send us to a provider that
   * was never connected this session.
   */
  const signMessage = useCallback(async (message: string): Promise<string | null> => {
    setError(null)
    const address = await ensureConnected()
    if (!address) return null
    const provider = getPhantomProvider()
    if (!provider?.signMessage) {
      setError('This Phantom version cannot sign messages. Update Phantom and try again.')
      return null
    }
    try {
      const encoded = new TextEncoder().encode(message)
      const result = await provider.signMessage(encoded, 'utf8')
      return bytesToBase58(result.signature)
    } catch (err) {
      setError(isUserRejection(err)
        ? 'Signature declined in Phantom. Approve the request to verify you own this wallet.'
        : 'Phantom could not sign the message. Unlock the wallet and try again.')
      return null
    }
  }, [ensureConnected])

  const disconnect = useCallback(async () => {
    const provider = getPhantomProvider()
    try { if (provider) await provider.disconnect() } catch { /* already gone */ }
    forget()
  }, [forget])

  // Silent reconnect: if the user already trusted this site, Phantom hands the
  // key back without a prompt, so returning users are connected before they
  // click anything. A rejection here is normal and must stay silent.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const provider = await waitForProvider()
      if (!provider || cancelled) return
      try {
        const result = await provider.connect({ onlyIfTrusted: true })
        if (!cancelled) adopt(result.publicKey.toString())
      } catch { /* not previously trusted — wait for an explicit click */ }
    })()
    return () => { cancelled = true }
  }, [adopt])

  // Follow the wallet: switching accounts in Phantom must not leave a stale
  // address on screen (or, worse, in a signature request).
  useEffect(() => {
    const provider = getPhantomProvider()
    if (!provider?.on) return
    const onAccountChanged = (...args: unknown[]) => {
      const key = args[0] as { toString: () => string } | null | undefined
      if (key) adopt(key.toString())
      else forget()
    }
    const onDisconnect = () => forget()
    provider.on('accountChanged', onAccountChanged)
    provider.on('disconnect', onDisconnect)
    return () => {
      const off = provider.off ?? provider.removeListener
      off?.call(provider, 'accountChanged', onAccountChanged)
      off?.call(provider, 'disconnect', onDisconnect)
    }
  }, [adopt, forget])

  useEffect(() => { if (walletAddress) void fetchBalance(walletAddress) }, [walletAddress, fetchBalance])

  return {
    walletAddress,
    balance,
    isConnecting,
    error,
    /** Phantom is unreachable here — show the deeplink / install prompt. */
    needsPhantom,
    deeplink: phantomDeeplink(),
    isMobile: isMobileBrowser(),
    /** Preferred entry point: guarantees a live connection. */
    connect: ensureConnected,
    ensureConnected,
    disconnect,
    signMessage,
    refreshBalance: () => walletAddress && fetchBalance(walletAddress),
  }
}
