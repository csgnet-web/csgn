# Firestore Cost & Abuse-Resistance Runbook

How to finish rolling out — and later operate — the cost/security hardening
shipped in the `firestore-optimize-security` change. Everything in this file is
a **console or CLI action**; the code side is already in the repo.

## Threat model in one paragraph

The site is a static SPA on Netlify; browsers talk to Firestore directly using
the public API key. On Blaze pricing every document read is billable, so the
attack that matters is not "take the site down" (Netlify's CDN and Firestore
both absorb traffic floods) but **cost abuse**: a script hammering the
world-readable collections to run up the bill. Defenses are layered: rules cap
how many docs one query can return (≤150 for anonymous callers), App Check
blocks non-browser scripts entirely once enforced, budget alerts detect
anything that slips through, and the break-glass procedure stops it.

## Deploy order for this change

1. Merge the PR (code + rules + indexes land in the repo, nothing live yet).
2. `firebase deploy --only firestore:indexes` — then wait until the
   `slots (assignedUid ASC, startTime DESC)` index shows **Enabled** in
   Firebase console → Firestore → Indexes. The Dashboard's per-user query
   needs it (until then Dashboard shows an empty history — it fails soft).
3. Netlify deploy (auto on merge) — ships the bounded client queries and the
   optimized fee poller.
4. `firebase deploy --only firestore:rules` — **last**, after the Netlify
   deploy is live. Old cached SPA tabs still run unlimited queries, which the
   new rules deny; their existing catch blocks degrade gracefully, and a
   refresh fixes them.
5. Enable TTL policies (below).
6. Set up budget alerts and register App Check (below); enable App Check
   **enforcement** only after ~1 week of clean monitor-mode metrics.

## Budget alerts (do this first — it's the safety net)

Firestore has **no hard billing kill switch**; alerts + the break-glass
procedure are the backstop.

1. [GCP console](https://console.cloud.google.com/billing) → Billing →
   **Budgets & alerts** → Create budget, scoped to this Firebase project.
2. Set a monthly amount you'd tolerate (e.g. $25) with threshold alerts at
   **50% / 90% / 100%**, emailing the billing admins.
3. Firebase console → **Usage and billing** → Details & settings: set the
   usage alert there too (redundant channel, same signal).

### Break-glass: something is running up the bill right now

In escalating order — each step is reversible:

1. **Enable App Check enforcement** for Firestore (if not already enforced) —
   Firebase console → App Check → Firestore → Enforce. Kills all non-app
   traffic immediately; legit browsers keep working.
2. **Deny public reads**: edit `firestore.rules`, change `slots`/`public`/
   `config` `allow get`/`allow list` to `if false`, then
   `firebase deploy --only firestore:rules`. Site degrades to fallbacks
   (schedule/queue go empty, token stats fall back to DexScreener) but the
   bleeding stops within a minute. Revert the edit to restore.
3. **Disable the web app's API key** (Google Cloud console → APIs &
   Credentials) — full outage for the SPA, zero Firestore traffic.

Netlify functions use the service account, not the API key, and bypass rules —
the fee poller and claim flow keep running through all three steps.

## App Check rollout (blocks scripted abuse of the public key)

Code is already shipped and dormant — it activates when the env var is set.

1. Firebase console → **App Check** → Apps → register the web app with the
   **reCAPTCHA v3** provider. This creates/uses a reCAPTCHA v3 site key bound
   to your production domain(s); add any preview domains you care about.
2. Netlify → Site settings → Environment variables: set
   `VITE_FIREBASE_APPCHECK_SITE_KEY` to the site key. Redeploy.
3. **Monitor mode** (~1 week): App Check → Firestore shows the share of
   verified vs unverified requests. Expect verified to approach 100% as old
   cached tabs refresh. Do not enforce while legit traffic shows unverified.
4. **Enforce**: App Check → Firestore → Enforce. From now on, requests
   without a valid attestation are rejected before they bill any reads.
   (Optionally enforce for Auth and Storage later.)
5. Local dev after enforcement: run with
   `VITE_FIREBASE_APPCHECK_SITE_KEY` set; in dev mode the SDK logs a **debug
   token** to the browser console on first run — register it under App Check
   → Apps → Manage debug tokens, or pin one via
   `VITE_FIREBASE_APPCHECK_DEBUG_TOKEN`.

Rollback: toggle enforcement off in the console (instant), or unset the env
var to disable App Check in the client entirely.

## TTL policies (stop unbounded collection growth)

TTL cannot be deployed via `firebase.json` — it is a per-collection-group
field setting, managed only via gcloud or the console. Run once:

```sh
gcloud firestore fields ttls update expiresAt --collection-group=phantomChallenges  --enable-ttl --database='(default)'
gcloud firestore fields ttls update expiresAt --collection-group=oauthStates        --enable-ttl --database='(default)'
gcloud firestore fields ttls update expiresAt --collection-group=twitchOAuthResults --enable-ttl --database='(default)'
gcloud firestore fields ttls update expiresAt --collection-group=auth_events        --enable-ttl --database='(default)'
gcloud firestore fields ttls update expiresAt --collection-group=rateLimits         --enable-ttl --database='(default)'
```

Verify with `gcloud firestore fields ttls list --database='(default)'`.

Notes:
- Every creation site already writes `expiresAt` (challenges/oauth docs:
  minutes; `rateLimits`: 24h; `auth_events`: 90 days).
- TTL deletion is **best-effort** (typically within 24h of expiry). It is a
  cost/hygiene mechanism, not a security one — the code-level `expiresAt`
  checks in the auth flows remain the real enforcement.
- Docs created before this change have no `expiresAt` and will never be
  TTL-deleted; delete old ones once by hand in the console if you want a
  clean slate.
- `slots` history is intentionally **not** TTL'd — completed slots are the
  creator-fee payment records.

## What healthy looks like (Query Insights / monitoring)

The three expensive fingerprints before this change, and what to expect after:

| Fingerprint | Was | Cause | Healthy after |
|---|---|---|---|
| `/slots startTime range LIMIT 5` | ~919K reads/30d | fee poller ran it 5×/min | **gone** (derived from the lifecycle query) |
| `/slots startTime range LIMIT 118` | ~50K reads/day | sweep timer reset on every cold start | ≤ ~96 runs/day, most short-circuited by a 1-read COUNT |
| `/slots startTime range LIMIT 20` | ~8.8K reads/day | lifecycle advance, 1×/min | unchanged (~4 docs/min) — this is the poller's one range query |

Ongoing checks (weekly at first, then monthly):

- **Query Insights**: total server-side reads should sit around ~13–16K/day.
  Any new unbounded fingerprint (no LIMIT, or LIMIT > 150 outside admin use)
  is a regression — find the call site.
- **Per-visitor cost**: initial page load reads ~100 slot docs (the shared
  listener) + 2 single docs; `/schedule` must NOT add a second slots listener.
- **App Check metrics**: a spike in *unverified* requests after enforcement =
  someone probing with the raw API key (they're being rejected — good).
- **rateLimits doc count** (Firestore console): should stay flat once TTL is
  on; growth means the TTL policy isn't active.
- **Budget alert emails**: any 50% alert earlier in the month than usual
  deserves a Query Insights look the same day.

## Residual risk, stated plainly

With rules caps + App Check enforced + alerts: a sophisticated attacker
willing to farm real reCAPTCHA attestations can still generate bounded,
billable reads (≤150 docs per request, at captcha-farming cost to them) until
you notice and pull a break-glass lever. That is dollars of exposure, not
thousands. The architecture that eliminates even that (serving public data
from a CDN-cached endpoint and denying anonymous Firestore reads entirely)
trades away realtime updates and is documented as a future option — revisit if
App Check metrics ever show sustained verified-but-abusive traffic.
