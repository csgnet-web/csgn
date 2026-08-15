import { describe, it, expect, afterEach } from 'vitest'
import { androidIntentUrl, isAndroid, isEmbeddedBrowser, isIOS, systemBrowserHref, systemBrowserName } from './webview'

const AUTH_URL = 'https://id.twitch.tv/oauth2/authorize?client_id=abc&state=xyz&scope=user%3Aread%3Aemail'

/** Real user agents, because this module exists to read real user agents. */
const UA = {
  phantomIOS: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Phantom/25.10.0',
  safariIOS: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  androidWebView: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  desktopChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  xApp: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Twitter for iPhone',
}

function setAgent(value: string, extra: { maxTouchPoints?: number } = {}) {
  Object.defineProperty(window.navigator, 'userAgent', { value, configurable: true })
  Object.defineProperty(window.navigator, 'maxTouchPoints', { value: extra.maxTouchPoints ?? 0, configurable: true })
}

afterEach(() => {
  setAgent(UA.desktopChrome)
  delete (window as { phantom?: unknown }).phantom
})

describe('platform detection', () => {
  it('reads iPhone and Android from the agent', () => {
    setAgent(UA.safariIOS)
    expect(isIOS()).toBe(true)
    expect(isAndroid()).toBe(false)
    setAgent(UA.androidChrome)
    expect(isAndroid()).toBe(true)
    expect(isIOS()).toBe(false)
  })

  it('catches iPadOS, which lies and calls itself a Mac', () => {
    setAgent(UA.desktopChrome, { maxTouchPoints: 5 })
    expect(isIOS()).toBe(true)
    setAgent(UA.desktopChrome, { maxTouchPoints: 0 })
    expect(isIOS()).toBe(false)
  })
})

describe('isEmbeddedBrowser', () => {
  it('is true inside Phantom on iOS — the case this whole flow exists for', () => {
    setAgent(UA.phantomIOS)
    expect(isEmbeddedBrowser()).toBe(true)
  })

  it('is true when Phantom injects a provider on a phone, agent string or not', () => {
    // A phone cannot have a browser extension, so an injected provider can only
    // mean the wallet's own in-app browser.
    setAgent(UA.safariIOS)
    ;(window as { phantom?: unknown }).phantom = { solana: {} }
    expect(isEmbeddedBrowser()).toBe(true)
  })

  it('is true in the X in-app browser and in an Android WebView', () => {
    setAgent(UA.xApp)
    expect(isEmbeddedBrowser()).toBe(true)
    setAgent(UA.androidWebView)
    expect(isEmbeddedBrowser()).toBe(true)
  })

  it('is false in the browsers where Twitch sign-in actually works', () => {
    setAgent(UA.safariIOS)
    expect(isEmbeddedBrowser()).toBe(false)
    setAgent(UA.androidChrome)
    expect(isEmbeddedBrowser()).toBe(false)
    setAgent(UA.desktopChrome)
    expect(isEmbeddedBrowser()).toBe(false)
  })
})

describe('androidIntentUrl', () => {
  it('keeps the query intact and carries a fallback for phones without Chrome', () => {
    const intent = androidIntentUrl(AUTH_URL)
    expect(intent.startsWith('intent://id.twitch.tv/oauth2/authorize?client_id=abc&state=xyz')).toBe(true)
    expect(intent).toContain('scheme=https')
    expect(intent).toContain('package=com.android.chrome')
    expect(intent).toContain(`S.browser_fallback_url=${encodeURIComponent(AUTH_URL)}`)
    expect(intent.endsWith(';end')).toBe(true)
  })

  it('drops any fragment from the intent path — `#Intent;…;end` IS the fragment', () => {
    const intent = androidIntentUrl('https://example.com/a?b=1#frag')
    expect(intent.split('#')[0]).toBe('intent://example.com/a?b=1')
    // The fallback still carries the whole original URL, encoded, so a phone
    // without Chrome loads exactly what was asked for.
    expect(intent).toContain(encodeURIComponent('https://example.com/a?b=1#frag'))
  })
})

describe('systemBrowserHref', () => {
  it('uses the Safari scheme on iOS and the intent scheme on Android', () => {
    setAgent(UA.phantomIOS)
    expect(systemBrowserHref(AUTH_URL)).toBe(`x-safari-${AUTH_URL}`)
    expect(systemBrowserName()).toBe('Safari')

    setAgent(UA.androidWebView)
    expect(systemBrowserHref(AUTH_URL).startsWith('intent://')).toBe(true)
    expect(systemBrowserName()).toBe('Chrome')
  })

  it('leaves a desktop URL alone', () => {
    setAgent(UA.desktopChrome)
    expect(systemBrowserHref(AUTH_URL)).toBe(AUTH_URL)
  })
})
