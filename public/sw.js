/*
 * CSGN service worker — deliberately, aggressively boring.
 *
 * It exists for ONE reason: a browser will not treat a site as installable
 * without a service worker that has a fetch handler, and the site has to be
 * installable before it can register as a share target. That share target is
 * the whole point — it is what lets somebody hit Share in Instagram or TikTok
 * and drop a clip straight into CSGN instead of copying a URL, switching apps
 * and pasting.
 *
 * WHAT IT DOES NOT DO: cache anything. Not one byte.
 *
 * That is not laziness, it is the safest possible choice for this app. This is
 * a live television channel — every screen on it is a real-time read of what is
 * on air right now, and a service worker that serves a stale shell is how a
 * broadcast site starts showing yesterday's programme to somebody who cannot
 * clear it. The offline story here is "you are offline, there is no channel",
 * which is honest. If caching is ever added, it must be versioned, must never
 * cache index.html, and must have a kill switch.
 *
 * skipWaiting + claim mean a new deploy takes over immediately rather than
 * waiting for every tab to close — with no cache to invalidate, an instant
 * takeover carries none of the usual risk.
 */

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Delete anything a previous version of this file may have cached, so a
    // future mistake here is self-healing on the next deploy.
    const keys = await caches.keys()
    await Promise.all(keys.map((k) => caches.delete(k)))
    await self.clients.claim()
  })())
})

// Pass-through. Present because installability requires it, not because it does
// anything — never add a cache lookup to this handler without reading the note
// at the top of the file.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})
