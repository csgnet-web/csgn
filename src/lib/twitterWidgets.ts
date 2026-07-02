/**
 * Singleton loader for X's widgets.js (platform.twitter.com).
 * The script is injected once; concurrent callers share one promise.
 * Rejects if the script fails to load (offline, ad blocker) so callers
 * can show a fallback instead of hanging.
 */

export interface Twttr {
  widgets: {
    createTweet: (
      id: string,
      container: HTMLElement,
      options?: Record<string, unknown>,
    ) => Promise<HTMLElement | undefined>
  }
  ready: (cb: (twttr: Twttr) => void) => void
}

declare global {
  interface Window {
    twttr?: Twttr & { _e?: Array<(twttr: Twttr) => void> }
  }
}

const WIDGETS_SRC = 'https://platform.twitter.com/widgets.js'

let loaderPromise: Promise<Twttr> | null = null

export function loadTwitterWidgets(): Promise<Twttr> {
  if (loaderPromise) return loaderPromise

  loaderPromise = new Promise<Twttr>((resolve, reject) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      reject(new Error('twitter widgets: no DOM'))
      return
    }

    // Official async shim: queue ready callbacks until widgets.js initializes.
    const existing = window.twttr
    if (existing?.ready) {
      existing.ready((t) => resolve(t))
      return
    }

    const stub = {
      _e: [] as Array<(twttr: Twttr) => void>,
      ready(cb: (twttr: Twttr) => void) {
        stub._e.push(cb)
      },
    }
    window.twttr = stub as unknown as Window['twttr']
    stub.ready((t) => resolve(t))

    const script = document.createElement('script')
    script.src = WIDGETS_SRC
    script.async = true
    script.onerror = () => {
      loaderPromise = null // allow retry on a later mount
      reject(new Error('twitter widgets: script failed to load'))
    }
    document.head.appendChild(script)
  })

  return loaderPromise
}
