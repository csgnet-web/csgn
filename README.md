# CSGN — Crypto Sports & Gaming Network

> The 24/7 crypto-native streaming network built on Solana. The ESPN and TMZ of crypto.

Streamers earn real trading fee revenue — calculated per market-cap tier, backed by live DexScreener data — simply by going live on CSGN. No other platform ties streamer compensation directly to on-chain mechanics at this level of precision.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v4 + Framer Motion |
| Routing | React Router v7 |
| Auth & DB | Firebase (Auth + Firestore) |
| Functions | Netlify Serverless Functions |
| Hosting | Netlify (auto-deploy from `main`) |
| Blockchain | Solana (Phantom wallet, SPL token) |
| Market Data | DexScreener API |

---

## Changelog

### v0.1 — November 2025
Business plan conceived. CSGN defined as the ESPN/TMZ of crypto: a 24/7 streaming platform where on-chain fee revenue flows directly to the streamer on screen. Core thesis: content creates trading volume; streamers should capture their proportional share.

### v0.2 — February 2026
Initial code scaffold. React 19 + Vite + Firebase. Landing page, auth modal, account system, Solana wallet placeholder. First commit on Feb 24, 2026.

### v0.3 — March 2026
Live fee tracking (DexScreener-backed), ET timezone scheduling, automatic stream detection, admin panel for slot management and emergency override, OBS-ready `/player` route. Fee tier model implemented against PumpSwap's 25-tier market-cap schedule.

### v0.4 — April 2026
Twitch OAuth 2.0 registration flow. Phantom wallet Ed25519 signature verification. Slot pre-emption for registered streamers. Quadratic auction scaffolding. Multi-factor account creation: Phantom + Twitch + email. `/player` made public for OBS capture.

### v0.5 — May 2026
Simplified v1 flow. Mobile full-page Twitch OAuth redirect (replaces popup, works in Phantom iOS browser). In-progress form draft persisted across redirect. Slot claiming with server-side race-condition protection. Footer removed. Up Next display fixed.

### v1.0 — June 2026
**Production release.**
- Server-side fee polling: DexScreener calls never touch the browser — one Netlify scheduled background function polls 4×/minute, writes to Firestore, all clients read via a single snapshot listener
- Universal `LiveSlotContext`: 2 Firestore listeners per browser session regardless of how many components need slot data
- Login ↔ Register seamless modal switching
- Rate limiting on all API endpoints (Firestore-backed, per-IP)
- Security hardening: CORS locked to configured origin, hardcoded Firebase config removed, password no longer stored in sessionStorage, email verification enforced at slot claim, `auth_events` restricted to authenticated users, CSP headers added, proof token secret minimum raised to 32 characters

### v1.1 — July 2026
**X-exclusive broadcast + crypto redesign.**
- CSGN's output stream moves exclusively to X: OBS (capturing `/player`) streams directly to X Media Studio via RTMPS — Restream removed entirely (player iframe + CSP entry)
- `/watch` embeds the live X broadcast post (widgets.js `createTweet`, dark theme) with a branded offline panel and an ad-blocker-proof "Watch live on X" fallback; admin pastes the broadcast post URL once per OBS session (validated — raw `/i/broadcasts/` links flagged)
- Twitch chat sidebar replaced with a live $CSGN token panel: price, 24h change, market cap, volume, liquidity, copy-CA, DexScreener/pump.fun links, "Join the chat on X"
- New `public/tokenStats` doc written by the fee poller every minute (24/7, active slot or not); third `LiveSlotContext` listener; live price chip in the header
- Fixed server fee poller polling the wrong token mint (now `GFV7…pump`, matching `src/lib/slots.ts`)
- CSP rewritten: X widget domains added, Restream dropped, Google Fonts and YouTube `/player` embeds unblocked (both were latent CSP violations)
- Footer reworked (@CSGNet, token CA strip, market links) and mounted on content pages; dead legacy pages removed (`Home`, `Tokenomics`, `Apply`)
- Slot streamers still stream to their own Twitch channels; account system (email + Phantom + Twitch, under a minute) unchanged
- `/player` rebuilt as Master Control: a unit-tested state machine (LIVE / STARTING_SOON / BRB / INTERMISSION / OVERRIDE) driven by Twitch embed JS-API online/offline events — BRB grace, auto-return on reconnect, admin-managed intermission VOD playlist, animated network board, brand wipes; OBS reduced to a single browser-source scene (docs/obs-setup.md)

### v1.2 — July 2026
**Slot-schema sync + `/player` auto-switching.**
- `/player` now derives its broadcast live from the shared slot data + emergency override instead of a server-written `currentBroadcast` doc — an admin changing a slot's stream URL/status (or the clock rolling into a new slot) switches the player automatically, no round-trip
- Unified the slot status vocabulary end-to-end: server claim now writes `confirmed` (was `claimed`); `resolveCurrentBroadcast` and the fee poller read `confirmed`/`live` + `streamUrl` (were `claimed` + `twitchChannelUrl`, which never matched — the root cause of `/player` not reacting)
- Fee poller (runs every minute) now also advances slot lifecycle: `confirmed → live` when the slot's start arrives, `→ completed` once it ends — so admin, `/schedule`, `/queue` and `/player` always agree
- Slot schema cleanup: removed the `description` field entirely; `/watch` title reads the slot's display name/stream title; the OFFLINE→LIVE flip now tracks the current slot becoming `confirmed`/`live`
- `/schedule` Today column shows only what's left today (live slot on top, highlighted); `/watch` on mobile moves Today's Schedule above the $CSGN panel and shrinks the rotating banner so it no longer overlaps the LIVE/OFFLINE label
- $CSGN panel replaces "updating…" with a freshness dot + "Last Updated: Nm ago" (green ≤5 min, yellow beyond); "Play Starting 5" is now a Coming-Soon button like Squares
- Admin panel realigned with the live app: Applications removed, Overview stats reworked (live/confirmed now, slots loaded), assign modal edits Stream Title, Auth Events retained

### v1.3 — July 2026
**Playback reliability + verifiable slot activity.**
- `/player` always keeps the Twitch feed playing (calls `play()` on state change and on ONLINE) and unmutes at full volume in LIVE — OBS never captures a paused/silent frame
- $CSGN price is now driven purely by the server-written `public/tokenStats` doc + the single LiveSlotContext listener; removed the per-client DexScreener fallback so no client wastes API quota, and the "Last Updated" dot honestly reflects the server doc's age
- Fee poller now samples Twitch Helix once a minute for the active slot's channel and logs live timestamps to a new per-slot `streamActivity` field (channel, first/last live, live-minute count, per-minute checkpoints) — admins can confirm a slot was really streaming vs. "technically claimed" during intermission (uses the existing `TWITCH_CLIENT_ID`/`TWITCH_CLIENT_SECRET`)
- Admin Creator Fees shows each slot's live-activity log; `/account` Creator Fee History is paginated 10-per-page (newest first, back-arrow to older) and surfaces the same live-minute summary
- Rotating `/watch` banner gains right padding so lines like "SQUARES COMING SOON" are no longer clipped; `/queue` "CEO Creator Slots" renamed to "Open Slots"

---

## Getting Started

```bash
npm install
cp .env.example .env    # Fill in your Firebase web config
npm run dev             # Start dev server at localhost:5173
```

---

## Environment Variables

### Frontend (`.env` — Vite `VITE_` prefix)

These are required at startup. The app throws a clear error if any are missing:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=   # optional
```

Firebase public config values are safe to expose through `VITE_` — they identify your app, not a secret. Firestore security rules and server-side admin credentials are the actual access controls.

### Backend (Netlify environment — server-side only, never `VITE_`)

```env
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=
TWITCH_REDIRECT_URI=
CSGN_ALLOWED_ORIGIN=          # e.g. https://csgn.tv — required for CORS
CSGN_PROOF_SIGNING_SECRET=    # must be ≥ 32 characters
CSGN_DEFAULT_STREAM_URL=
CSGN_FALLBACK_STREAM_URL=
```

See [`docs/env-setup.md`](docs/env-setup.md) for Netlify-specific setup guidance.

---

## Pages

| Route | Description |
|---|---|
| `/` | Live stream viewer (alias for `/watch`) |
| `/watch` | Embedded X broadcast, $CSGN token panel, earnings display, today's schedule |
| `/schedule` | Full 7-day broadcast schedule |
| `/queue` | Open slots available to claim |
| `/about` | About CSGN, mission, vision |
| `/account` | User dashboard — application status, streamer stats |
| `/admin` | Admin panel — slot management, fee overrides |
| `/player` | OBS-ready iframe player for broadcast capture |
| `/terms` | Terms of service |

---

## Deployment

Push to `main` → auto-deploys on Netlify. Build command: `npm run build` → output to `dist/`.

`FIREBASE_PROJECT_ID` appears in browser code and is not a secret. If Netlify secret scanning flags it:

```env
SECRETS_SCAN_OMIT_KEYS=FIREBASE_PROJECT_ID,VITE_FIREBASE_PROJECT_ID
```

---

## Architecture: Broadcast Flow (OBS → X, no Restream)

```
Slot streamers → their own Twitch channels
  claimSlot → twitchChannelUrl → resolveCurrentBroadcast → public/currentBroadcast

CSGN operator machine (see docs/obs-setup.md):
  /player = MASTER CONTROL — a state machine (src/lib/masterControl.ts), not a dumb iframe:
    LIVE            streamer's feed fullscreen, audio on (Twitch embed JS API events)
    STARTING_SOON   slot claimed, not live yet → branded card (max 10 min)
    BRB             feed dropped → grace card 120s; auto-cuts back on reconnect
    INTERMISSION    admin VOD playlist (config/vodPlaylist) rotating with the animated board
    OVERRIDE        emergency non-Twitch URL (YouTube iframe)
    + CSGN brand wipe on every state change
  → OBS Browser Source (1920×1080, one scene, zero OBS logic)
  → RTMPS → X Media Studio Producer → live on @CSGNet

Admin panel:
  paste the broadcast post URL (https://x.com/CSGNet/status/…) once per OBS session
  → config/liveStream → /watch embeds the live X post (widgets.js createTweet)
  → Clear → /watch shows the branded offline panel
```

Note: X embeds a **post** by status ID — raw `x.com/i/broadcasts/…` links are not embeddable; the Admin field validates this. Viewers chat in the broadcast post's replies ("Join the chat on X" in the sidebar).

## Architecture: Live Fee + Token Stats Data Flow

```
Every 60 seconds (Netlify cron → feePollerBackground):
  ├── Poll 1 (t=0s):   DexScreener API → write public/tokenStats + calculate fees → write Firestore
  ├── Poll 2 (t=15s):  DexScreener API → calculate fees → write Firestore
  ├── Poll 3 (t=30s):  DexScreener API → calculate fees → write Firestore
  └── Poll 4 (t=45s):  DexScreener API → calculate fees → write Firestore
  (tokenStats is written every invocation, even with no active slot — price flows 24/7)

Browser (any number of concurrent users):
  LiveSlotContext (mounted once at app root)
  ├── onSnapshot(config/liveStream)   ← 1 listener: admin override (X broadcast post URL)
  ├── onSnapshot(public/tokenStats)   ← 1 listener: $CSGN price/mcap/volume
  └── subscribeToSlots(-3h..+8d, limit 120)  ← 1 listener: all slot data + creatorFees (shared by /schedule too)

  Watch.tsx, Header, Dashboard.tsx → useLiveSlot() → reads context → zero Firestore reads
```

**Key invariant:** DexScreener is called exactly 4 times per minute regardless of how many users are connected. A million concurrent viewers = same 4 API calls/minute as 1 viewer. (Exception: if `public/tokenStats` is missing or >10 min stale, TokenPanel makes a single one-shot client fetch as a fallback — never a polling loop.)

---

## Senior Engineer Plan: Database Efficiency

### Current Firestore Read Budget (per browser session, v1.0)

| Subscription | Mounted by | Lifetime | Type |
|---|---|---|---|
| `onSnapshot(config/liveStream)` | LiveSlotContext | App lifetime | Persistent |
| `subscribeToSlots(-3h..+8d, limit 120)` | LiveSlotContext | App lifetime | Persistent (shared by `/schedule`) |
| `getDoc(users/{uid})` | AuthContext | On login | One-time |
| `fetchSlotsByAssignee(uid, 50)` | Dashboard | On mount | One-time, indexed |
| `fetchSlots(visible week, limit 120)` | Queue | On mount / week flip | One-time |
| `getDoc/writeDoc` per API call | Rate limiter | Per request | Server-side (in-memory pre-filter blocks floods before Firestore I/O) |

All client `slots` queries carry a required `limit` (enforced by the
`fetchSlots`/`subscribeToSlots` signatures **and** by `firestore.rules`, which
denies anonymous list queries without `limit <= 150`). Operational rollout and
monitoring live in [`docs/ops-cost-security-runbook.md`](docs/ops-cost-security-runbook.md).

### v1.1 Efficiency Roadmap

1. ~~**Dashboard pagination**~~ — done: indexed `fetchSlotsByAssignee(uid, 50)` query (composite index in `firestore.indexes.json`).
2. **Admin N+1** — Admin panel makes sequential `getDocs()` calls. Batch with `Promise.all()` for parallel fetches.
3. **Firestore offline persistence** — Enable in `firebase.ts` (`enableIndexedDbPersistence`) to eliminate re-reads on reconnect and serve cached data on cold start.
4. ~~**Schedule subscription dedup**~~ — done: `/schedule` renders from the shared `LiveSlotContext` listener; no second subscription.
5. **Rate limiter upgrade** — Replace Firestore-based counters with Upstash Redis for lower latency and lower cost at high API call volume. (Interim: per-container in-memory pre-filter stops blocked floods from billing Firestore ops.)
6. **`_feeState` transaction safety** — `feePollerBackground` writes `_feeState` optimistically. Use Firestore transactions (`beginTransaction/commitWrites`) for atomic read-modify-write to prevent rare race conditions between overlapping cron invocations.

---

## Security Audit

**Overall score: 74/100 (B) — as of v1.0**

| Domain | Score | Status |
|---|---|---|
| Authentication | 85/100 | HMAC proof-of-ownership model; email verification enforced at slot claim |
| Authorization | 87/100 | Firestore rules solid; admin check on every privileged request |
| API Security | 80/100 | Rate limiting on all endpoints; CORS locked to configured origin |
| Data Protection | 75/100 | Password not in sessionStorage; no hardcoded Firebase config |
| Input Validation | 77/100 | Regex validators on all inputs; proof token secret ≥ 32 chars |
| Monitoring | 48/100 | CSP headers active; budget alerts + App Check rollout documented in `docs/ops-cost-security-runbook.md` |

### Remaining Items (v1.1)

| Priority | Item | Action |
|---|---|---|
| High | Firestore TTL policies | Code ships `expiresAt` everywhere; run the one-time gcloud commands in `docs/ops-cost-security-runbook.md` |
| High | App Check enforcement | Register app + set `VITE_FIREBASE_APPCHECK_SITE_KEY`, monitor ~1 week, then enforce (runbook) |
| High | Billing budget alerts | GCP Budgets & alerts at 50/90/100% (runbook) |
| Medium | Password reset flow | Implement Firebase `sendPasswordResetEmail` |
| Medium | Failed auth alerting | Log and alert on N consecutive 401s from a single IP |
| Low | Upstash Redis rate limiter | Replace Firestore-based counters for lower latency |

### Notes on Current Design Decisions

**CORS empty string default:** If `CSGN_ALLOWED_ORIGIN` is not set in the Netlify environment, CORS headers return an empty origin, which browsers treat as a non-match — effectively denying all cross-origin requests. This is the secure fail-closed default.

**Firestore rate limiter:** Adds 1 read + 1 write per API call (stored at `rateLimits/{sha256(ip:endpoint)}`). At low traffic this is negligible. At high concurrency, upgrade to Upstash Redis.

**`auth_events` write restriction:** Only signed-in users can create audit events. This prevents log spam from unauthenticated actors. Note: the Firebase client SDK is used for this write, so the user must have a valid Firebase session.

---

## v1.0 Technical Sign-off Checklist

- [x] Multi-factor registration (Phantom wallet + Twitch OAuth + email/password)
- [x] Real-time slot claiming with server-side race-condition protection
- [x] Server-side live earnings — 4 DexScreener calls/minute, server only, scale-invariant
- [x] Universal `LiveSlotContext` — 2 Firestore listeners per browser session
- [x] Rate limiting on all auth/claim API endpoints
- [x] CORS origin locked — defaults to deny when env var missing
- [x] Hardcoded Firebase config removed — fails fast on misconfiguration
- [x] Password not stored in sessionStorage during OAuth redirect
- [x] Email verification required before slot claim (`email_verified` JWT claim)
- [x] `auth_events` writes restricted to authenticated users
- [x] Content-Security-Policy header on all responses
- [x] Login ↔ Register seamless modal switching
- [x] Proof token secret minimum: 32 characters
- [x] All client slot queries bounded (`limit` required by API signature + firestore.rules query cap)
- [x] Dashboard slot pagination — indexed `fetchSlotsByAssignee(uid, 50)`
- [x] `expiresAt` written on all ephemeral docs (rate limits, auth events, challenges, OAuth states)
- [ ] Firestore TTL policies — one-time gcloud commands (see `docs/ops-cost-security-runbook.md`)
- [ ] App Check enforcement — console rollout after monitor period (runbook)
- [ ] Billing budget alerts — GCP console (runbook)
- [ ] Password reset flow — v1.1
- [ ] Upstash Redis rate limiting — v1.1

---

## License

Proprietary — CSGN, Crypto Sports & Gaming Network. All rights reserved.
