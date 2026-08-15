/**
 * Which browser are we actually in — and can we get out of it?
 *
 * This exists because of one concrete failure, reported from the only entry
 * point that matters to us: a user taps "Connect Twitch" inside Phantom's
 * in-app browser, Twitch's login page loads, they tap "Continue with Google"
 * (or Apple, or Amazon) and get **"Something went wrong."**
 *
 * That is not a bug in our OAuth. It is Google's policy, enforced deliberately:
 * identity providers refuse to authenticate inside an app's embedded webview
 * because the host app can read the page. Google returns `disallowed_useragent`,
 * Apple refuses outright, and Twitch renders the generic error it gets back.
 * There is no header, no flag and no client setting that turns this off — the
 * only fix is to not be in a webview when the login happens.
 *
 * A webview also has its own cookie jar, isolated from Safari and Chrome. So
 * even a user who is signed into Twitch on their phone arrives at a logged-out
 * login page. Moving the hop to the system browser fixes both problems at once:
 * the federated buttons work, and the Twitch session that already exists there
 * usually makes the whole round trip a zero- or one-tap redirect.
 *
 * What this module does NOT claim: there is no way to hand an OAuth
 * authorization to the native Twitch *app*. Twitch publishes no deep link for
 * `id.twitch.tv/oauth2/authorize`, and iOS universal links don't cover it. The
 * system browser is the closest thing to "already signed in" that exists, and
 * it is what we target.
 */

function ua(): string {
  return typeof navigator === 'undefined' ? '' : navigator.userAgent || ''
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  if (/iPhone|iPad|iPod/i.test(ua())) return true
  // iPadOS 13+ reports a desktop Mac user agent; touch points give it away.
  return /Macintosh/.test(ua()) && (navigator.maxTouchPoints || 0) > 1
}

export function isAndroid(): boolean {
  return /Android/i.test(ua())
}

export function isMobile(): boolean {
  return isIOS() || isAndroid()
}

/**
 * In-app browsers that identify themselves. Phantom is the one we care about,
 * but every wallet and social app on this list ships the same WKWebView /
 * Android WebView with the same federated-login problem, and a user arriving
 * from a link in X or Instagram hits it identically.
 */
const NAMED_WEBVIEW = /\b(Phantom|Solflare|Backpack|Trust|MetaMask|Coinbase(Browser|Wallet)|FBAN|FBAV|FB_IAB|Instagram|Line|MicroMessenger|TikTok|Snapchat|LinkedInApp|Twitter|GSA)\b/i

/** True when a Phantom provider is injected on a phone — extensions cannot
 *  exist on mobile, so an injected provider means the in-app browser. */
export function isPhantomInAppBrowser(): boolean {
  if (typeof window === 'undefined' || !isMobile()) return false
  const w = window as { phantom?: { solana?: unknown }; solana?: unknown }
  return Boolean(w.phantom?.solana || w.solana)
}

/**
 * True when this page is inside an app's embedded webview rather than a real
 * browser. Three independent signals, because no single one is reliable:
 *
 *  1. The app names itself in the user agent (most do).
 *  2. Android WebView appends the `; wv)` token — that one is definitive.
 *  3. On iOS, Safari's UA ends in `Safari/…` and WKWebView's does not.
 *
 * Plus the Phantom-provider tell above, which needs no user-agent string at all.
 * False positives cost a user one extra tap on a link that also works in place;
 * false negatives cost them a dead end. The bias is deliberate.
 */
export function isEmbeddedBrowser(): boolean {
  if (typeof window === 'undefined') return false
  const s = ua()
  if (!s) return false
  if (isPhantomInAppBrowser()) return true
  if (NAMED_WEBVIEW.test(s)) return true
  if (isAndroid() && /;\s*wv\)/.test(s)) return true
  if (isIOS() && /AppleWebKit/.test(s) && !/Safari\//.test(s) && !/CriOS|FxiOS|EdgiOS/.test(s)) return true
  return false
}

/**
 * An `intent://` URL that hands the link to Android's default browser.
 *
 * `S.browser_fallback_url` is what keeps this from being a dead end: if Chrome
 * isn't installed the webview loads the plain URL in place instead of failing
 * silently. The fragment is dropped because `#Intent;…;end` *is* the fragment —
 * an OAuth authorize URL has no hash of its own, and if one ever appeared it
 * would corrupt the intent rather than travel with the link.
 */
export function androidIntentUrl(url: string): string {
  const u = new URL(url)
  const scheme = u.protocol.replace(':', '')
  const rest = `${u.host}${u.pathname}${u.search}`
  return [
    `intent://${rest}#Intent`,
    `scheme=${scheme}`,
    'action=android.intent.action.VIEW',
    'package=com.android.chrome',
    `S.browser_fallback_url=${encodeURIComponent(url)}`,
    'end',
  ].join(';')
}

/**
 * The href to put on a link that should escape to the device's real browser.
 *
 * Deliberately an href rather than a scripted navigation: a scheme handoff is
 * far more likely to be honoured when it comes from a real tap, and a user who
 * chose to leave is not surprised to find themselves in Safari. Callers must
 * still render a plain copyable URL alongside it — `x-safari-https://` is an
 * Apple scheme with no specification behind it, and if a host app declines to
 * hand it off nothing at all happens on screen.
 */
export function systemBrowserHref(url: string): string {
  if (isAndroid()) return androidIntentUrl(url)
  if (isIOS()) return `x-safari-${url}`
  return url
}

/** Programmatic escape, for the cases where there is no link to tap. */
export function openInSystemBrowser(url: string): void {
  if (typeof window === 'undefined') return
  if (isAndroid() || isIOS()) {
    window.location.href = systemBrowserHref(url)
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

/** Human name for the browser we'd be sending someone to. Used in copy. */
export function systemBrowserName(): string {
  if (isIOS()) return 'Safari'
  if (isAndroid()) return 'Chrome'
  return 'your browser'
}
