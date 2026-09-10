/**
 * FETCH THE NEXT PAGE BEFORE THEY ASK FOR IT.
 *
 * ── The gap this closes ────────────────────────────────────────────────────
 *
 * Every route in this app is a lazy chunk, which is right — a visitor who never
 * opens /admin should never download it. The cost is that every FIRST visit to
 * a route pays a network round trip before anything renders, and what fills
 * that gap is `<Loading />`: a pulsing logo and a spinner. On a phone on a
 * middling connection that is most of a second of spinner between tapping a tab
 * and seeing the page, and it is the single most "slow" thing about the app,
 * because it happens on exactly the taps a new user makes first.
 *
 * The fix is not to stop splitting. It is to notice that a person's intent is
 * legible about 200–300ms before their tap lands: the pointer moves onto the
 * link, or the finger touches down. That is enough time to have the chunk in
 * cache by the time the router asks for it, and the page then renders on the
 * same frame as the tap.
 *
 * ── Why this is a module and not an import in a component ──────────────────
 *
 * The prefetch must be the SAME dynamic import specifier the route uses, or the
 * bundler emits two chunks and the prefetch warms the wrong one. So the route
 * table lives here, one entry per lazy route, and `App.tsx` builds its
 * `lazy()` calls from it. One list, one specifier, no drift.
 */

/**
 * Every lazily-loaded route, by path.
 *
 * The value is the import thunk itself, so `lazy(ROUTES['/watch'])` and
 * `prefetchRoute('/watch')` are provably the same chunk. Static string literals
 * throughout — a dynamic import built from a variable is invisible to the
 * bundler and would silently stop code-splitting.
 */
export const ROUTE_CHUNKS = {
  '/': () => import('@/pages/Watch'),
  '/watch': () => import('@/pages/Watch'),
  '/schedule': () => import('@/pages/Schedule'),
  '/about': () => import('@/pages/About'),
  '/account': () => import('@/pages/Dashboard'),
  '/participate': () => import('@/pages/Participate'),
  '/vote': () => import('@/pages/Participate'),
  '/treasury': () => import('@/pages/Treasury'),
  '/studio': () => import('@/pages/Studio'),
  '/admin': () => import('@/pages/Admin'),
  '/terms': () => import('@/pages/Terms'),
  '/privacy': () => import('@/pages/Privacy'),
  '/share': () => import('@/pages/Share'),
} as const

export type PrefetchablePath = keyof typeof ROUTE_CHUNKS

/** Chunks already asked for. A dynamic import is cached by the browser anyway,
 *  but calling it repeatedly still costs a promise and a module-registry lookup
 *  on every pointer move across a nav bar. */
const warmed = new Set<string>()

/**
 * Start loading the chunk for a path. Safe to call constantly — it is a no-op
 * after the first call per path, it never throws, and a failure is deliberately
 * silent: this is an optimisation, and a prefetch that fails must leave the
 * real navigation to produce the real error.
 */
export function prefetchRoute(path: string): void {
  // `/u/someone` and friends are not in the table; a miss is not a problem.
  const key = path.split('?')[0].replace(/\/+$/, '') || '/'
  if (warmed.has(key)) return
  const load = ROUTE_CHUNKS[key as PrefetchablePath]
  if (!load) return
  warmed.add(key)
  void load().catch(() => {
    // Offline, or a stale chunk hash after a deploy. Let the real navigation
    // deal with it — and allow a retry, since the failure may be transient.
    warmed.delete(key)
  })
}

/**
 * The props to spread onto a link so it warms itself.
 *
 * `pointerenter` covers a mouse (the pointer arrives well before the click).
 * `touchstart` covers a phone, where there is no hover at all but there is
 * still ~100ms between the finger landing and the tap resolving. `focus` covers
 * a keyboard, where tabbing to a link precedes activating it.
 *
 * Deliberately NOT `pointerdown` alone: by then the navigation is already
 * happening and the prefetch saves nothing.
 */
export function prefetchProps(path: string) {
  const warm = () => prefetchRoute(path)
  return { onPointerEnter: warm, onTouchStart: warm, onFocus: warm }
}
