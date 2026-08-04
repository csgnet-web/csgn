// Where a full-page OAuth redirect should land the user when it comes back.
//
// Twitch verification is a full-page redirect (never a popup — Twitch's login
// offers "Sign in with Apple", and Apple refuses OAuth inside popups and
// embedded webviews, which is most of our mobile traffic). The cost of a
// redirect is that the browser forgets everything, including WHY the user left.
//
// Before this existed, the return was hardcoded to `/?auth=register`, so every
// Twitch round trip ended on the home page with the sign-up modal open. For
// someone signing up that was merely abrupt — they'd started somewhere else,
// like /schedule mid-claim, and got moved. For someone linking Twitch from
// /account it was a bug: they landed on the home page being asked to join a
// network they were already a member of, and the code on /account that
// completes the link never ran, so the link silently didn't happen.
//
// So the destination is recorded before leaving and read on the way back. It is
// deliberately just a path and an intent — never a full URL — so a tampered
// value can only ever bounce someone around this app.

export const AUTH_RETURN_KEY = 'csgn:authReturn'

export interface AuthReturn {
  /** In-app path (with query/hash) to come back to, e.g. "/schedule". */
  path: string
  /** Why we left: finish a sign-up, or attach Twitch to an existing account. */
  intent: 'signup' | 'link'
}

const DEFAULT_RETURN: AuthReturn = { path: '/', intent: 'signup' }

/**
 * Same-origin, absolute-path only. A stored value is attacker-influencable in
 * principle (anything in sessionStorage is), and it is handed straight to
 * `navigate()`, so anything that could become another origin — a scheme, a
 * protocol-relative `//host`, a backslash Chrome normalises to `/` — is thrown
 * away in favour of the default rather than trusted.
 */
function safePath(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_RETURN.path
  const path = value.trim()
  if (!path.startsWith('/')) return DEFAULT_RETURN.path
  if (path.startsWith('//') || path.startsWith('/\\')) return DEFAULT_RETURN.path
  if (path.includes('\\')) return DEFAULT_RETURN.path
  return path
}

export function storeAuthReturn(value: AuthReturn): void {
  try {
    sessionStorage.setItem(AUTH_RETURN_KEY, JSON.stringify({
      path: safePath(value.path),
      intent: value.intent === 'link' ? 'link' : 'signup',
    }))
  } catch {
    /* sessionStorage unavailable — the default return still works */
  }
}

/**
 * Read-once: the destination is consumed on arrival so a later refresh of the
 * landing page can't bounce the user a second time. Always returns something
 * usable, so callers never have to write a fallback of their own.
 */
export function takeAuthReturn(): AuthReturn {
  try {
    const raw = sessionStorage.getItem(AUTH_RETURN_KEY)
    sessionStorage.removeItem(AUTH_RETURN_KEY)
    if (!raw) return DEFAULT_RETURN
    const parsed = JSON.parse(raw) as Partial<AuthReturn>
    return {
      path: safePath(parsed.path),
      intent: parsed.intent === 'link' ? 'link' : 'signup',
    }
  } catch {
    clearAuthReturn()
    return DEFAULT_RETURN
  }
}

export function clearAuthReturn(): void {
  try {
    sessionStorage.removeItem(AUTH_RETURN_KEY)
  } catch {
    /* sessionStorage unavailable — ignore */
  }
}

/**
 * Build the URL to return to, re-attaching the flow's query params to whatever
 * path the user came from. `?auth=register` is what reopens the sign-up modal
 * (Header watches for it), so it belongs on the sign-up return and nowhere else
 * — a member linking Twitch from /account must not be asked to sign up again.
 */
export function buildReturnUrl(ret: AuthReturn, params: Record<string, string>): string {
  const [rawPath, rawQuery = ''] = ret.path.split('#')[0].split('?')
  const query = new URLSearchParams(rawQuery)
  if (ret.intent === 'signup') query.set('auth', 'register')
  for (const [key, value] of Object.entries(params)) query.set(key, value)
  const search = query.toString()
  return search ? `${rawPath}?${search}` : rawPath
}
