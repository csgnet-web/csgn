# Environment Setup

This project uses Vite, so any environment variable prefixed with `VITE_` is bundled into browser code. Treat those values as public client configuration, not backend secrets.

## Public frontend Firebase config

The frontend Firebase SDK requires these public values at build time:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

`VITE_FIREBASE_PROJECT_ID` is expected to appear in browser code because it is part of Firebase web client configuration. The unprefixed Firebase project id (`FIREBASE_PROJECT_ID`) is also not a secret; do not mark it secret or protected in Netlify.

Do not remove Firebase frontend config from `src/config/firebase.ts`. The app needs these public `VITE_FIREBASE_*` values to initialize Firebase Auth, Firestore, and Storage in the browser.

## Backend secrets

The actual backend secrets are:

```env
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
TWITCH_CLIENT_SECRET=
CSGN_PROOF_SIGNING_SECRET=
PAYOUT_WALLET_SECRET=
```

Keep these values server-side only. Do not prefix them with `VITE_`, do not import them from browser code, and do not commit real values.

### `PAYOUT_WALLET_SECRET` — the one that spends money

Base58 64-byte secret key for the official CSGN payout wallet
(`EftavCt6Tk2bzWJ9Dnz7cAvfa5RAnh8S9vZcrorV7Hmv`). Signs $CSGN transfers to game
winners. Leave it unset and payouts fail closed — `adminRunPayouts` reports
"payout wallet not configured" rather than silently paying nobody.

This is a **hot wallet**. Anyone who can deploy or read the build environment can
drain it, and no amount of secrets hygiene changes that for a key that has to sign
unattended. The mitigation is float, not secrecy:

- Keep only a few days of prize money in it; top up from the treasury on a
  schedule. **Never park the reserve here.**
- The caps in `config/payoutLimits` bound a *bug*. They do not bound a *thief* —
  only the balance does.
- Rotate on any suspicion and on every team change. Rotation is cheap: generate,
  fund, update the variable, drain the old one.
- This wallet must never hold LP tokens, mint authority, or anything whose loss
  is unrecoverable.

The loader asserts that the derived public key equals the published payout
address, so a wrong key is a startup error rather than transfers out of some other
wallet. See `netlify/functions/_shared/payoutWallet.ts` and
[`games-and-payouts.md`](games-and-payouts.md).

Optional, and worth setting before this runs at any volume:

```env
SOLANA_RPC_URL=
```

The public mainnet endpoint is the fallback and is fine at low volume; a payout
run over a large field wants a paid RPC.

`TWITCH_CLIENT_ID` can be treated as backend-only for architecture consistency, but it is not as sensitive as `TWITCH_CLIENT_SECRET`.

## Netlify environment variable classification

In Netlify, `FIREBASE_PROJECT_ID` should be a normal environment variable, not a secret/protected value. Firebase project IDs and Firebase web config values are public identifiers that may legitimately appear in frontend bundles.

Netlify secret scanning can fail after a successful build if a non-secret value such as `FIREBASE_PROJECT_ID` is mistakenly marked secret and that same value appears in browser code via `VITE_FIREBASE_PROJECT_ID` or `src/config/firebase.ts`.

If Netlify still flags the Firebase project id after unmarking `FIREBASE_PROJECT_ID` as secret/protected, use this fallback in Netlify environment variables:

```env
SECRETS_SCAN_OMIT_KEYS=FIREBASE_PROJECT_ID,VITE_FIREBASE_PROJECT_ID
```

Only omit these public project-id keys. Do not omit actual backend secrets from scanning.


---

# Deploy checklist

*(Folded in from the former `v1-launch-checklist.md`. Setup lives here;
**verification** — including the mainnet money test — lives in
[`dry-run.md`](dry-run.md).)*

## Netlify environment variables
- [ ] Frontend Vite variables are set: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.
- [ ] Backend-only function variables are set: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TWITCH_REDIRECT_URI`, `CSGN_ALLOWED_ORIGIN`, `CSGN_DEFAULT_STREAM_URL`, `CSGN_FALLBACK_STREAM_URL`, `CSGN_PROOF_SIGNING_SECRET`.
- [ ] `FIREBASE_PRIVATE_KEY` is stored with escaped newlines and no service-account JSON is committed.
- [ ] `CSGN_ALLOWED_ORIGIN` is the production origin, for example `https://csgn.fun`.

## Firebase setup
- [ ] Email/password sign-in is enabled in Firebase Authentication.
- [ ] Firestore rules are deployed and deny normal-user writes to trusted collections.
- [ ] The service account used by Netlify Functions can read/write Firestore and verify ID tokens.
- [ ] Seeded slot documents include `startTime`, `endTime`, `status`, and `isClaimable`.

## Twitch setup
- [ ] Twitch application redirect URI exactly matches `TWITCH_REDIRECT_URI` character-for-character; local should use `http://localhost:8888/.netlify/functions/twitchOAuthCallback` and production should use `https://csgn.fun/.netlify/functions/twitchOAuthCallback`.
- [ ] Twitch client ID/secret are backend-only Netlify variables.
- [ ] OAuth callback is reachable directly at `/.netlify/functions/twitchOAuthCallback` in local Netlify dev and production.
- [ ] `twitchOAuthCallback` never leaves the user on the function URL: it always redirects to `${CSGN_ALLOWED_ORIGIN}/auth/twitch/complete?handoffId=...` on success or `${CSGN_ALLOWED_ORIGIN}/?auth=register&twitchError=...` on failure.

## Twitch mobile OAuth test (Phantom on iPhone)
- [ ] Open CSGN in the Phantom mobile browser on an iPhone.
- [ ] Tap GET STARTED to open the register modal.
- [ ] Tap Connect Twitch (full-page redirect, no popup).
- [ ] Approve the Twitch authorization prompt.
- [ ] Confirm the browser returns to the app and never stays on `/.netlify/functions/twitchOAuthCallback`.
- [ ] Confirm the register modal reopens and shows Twitch connected with the Twitch username.
- [ ] Confirm Create Account can be completed without reconnecting Twitch.

## Local test checklist
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run Netlify dev with local environment variables.
- [ ] Confirm `/.netlify/functions/health` returns `{ ok: true }`.

## User acceptance test checklist
- [ ] Public visitors can open CSGN.fun and watch the network.
- [ ] GET STARTED opens the register modal.
- [ ] Registration requires email, username, password, confirm password, verified Phantom, and verified Twitch.
- [ ] Take Slot while logged out opens registration and resumes the pending claim after account creation.
- [ ] Verified users can claim no more than two future/live slots.

## Security test checklist
- [ ] Frontend cannot directly create trusted `users/{uid}` documents.
- [ ] Frontend cannot directly write `slots`, `config`, `public/currentBroadcast`, unique locks, OAuth states, Twitch OAuth results, Phantom challenges, or audit logs.
- [ ] `twitchOAuthResults` is backend-only (`allow read, write: if false;`) and `consumeTwitchOAuthResult` never returns Twitch access tokens or `TWITCH_CLIENT_SECRET`.
- [ ] User functions reject missing or invalid Firebase ID tokens.
- [ ] Admin functions reject non-admin users.
- [ ] Phantom verification fails if the challenge expires, is reused, or the signature is invalid.
- [ ] Twitch verification only succeeds through OAuth callback proof tokens.

## OBS test checklist
- [ ] `resolveCurrentBroadcast` writes `public/currentBroadcast` with the expected source priority.
- [ ] `/player` loads without requiring sign-in.
- [ ] `/player` renders the active Twitch stream fullscreen with no Firestore writes from the browser.
- [ ] Emergency override appears in `/player`, and clearing it returns to the active slot/fallback stream.

## Master-control test checklist (/player 24/7 logic — see docs/obs-setup.md)
- [ ] With no claimed slot, `/player` shows the animated intermission board (panels cycle every ~12s).
- [ ] Claim a slot without going live on Twitch → "Starting soon" card with the streamer's name; after 10 minutes → intermission.
- [ ] Streamer goes live → brand wipe → fullscreen feed with audio.
- [ ] Kill the streamer's OBS → "We'll be right back" card within seconds; after 120s → intermission; streamer returns → wipe back to LIVE automatically. **This is the money path — test end-to-end before launch.**
- [ ] Add an MP4 URL in Admin → Intermission VOD Playlist → intermission rotates board ↔ video without a reload; removing it reverts to board-only.
- [ ] YouTube emergency override renders as a plain iframe; clearing it returns to normal flow.
- [ ] Only one audio source at a time: feed audible only when LIVE, VOD audio only during intermission, cards silent.
- [ ] Inside OBS: Browser Source at 1920×1080 renders the board crisply, audio meters move on LIVE and VOD playback.

## X broadcast test checklist (OBS → X, no Restream)
- [ ] The CSGN X account (@CSGNet) has Media Studio Producer access; RTMPS URL + stream key are configured in OBS (Settings → Stream → Custom).
- [ ] Start OBS (capturing `/player`), go live from Media Studio, and confirm the broadcast post appears on @CSGNet.
- [ ] Paste the broadcast **post** URL (`https://x.com/CSGNet/status/...`) into Admin → "X Broadcast Post URL" → Push; `/watch` embeds the live broadcast within seconds without a reload.
- [ ] Confirm inline playback behavior of the embedded broadcast (may be click-to-play at X's discretion) on desktop and mobile.
- [ ] Pasting a raw `x.com/i/broadcasts/...` link shows the amber warning in Admin (not embeddable).
- [ ] Clear in Admin returns `/watch` to the branded offline panel with the @CSGNet link.
- [ ] With `platform.twitter.com` blocked (ad-blocker simulation), `/watch` shows the "Watch live on X" fallback panel after the timeout.

## Token stats test checklist
- [ ] `public/tokenStats` updates roughly every minute (written by `feePollerBackground`) even when no slot is live.
- [ ] TokenPanel on `/watch` and the header price chip show live price / market cap / 24h volume / 24h change.
- [ ] Stop the poller temporarily: the "updating…" staleness badge appears after ~3 minutes; with the doc missing/very stale, the one-shot client DexScreener fallback fills the panel.
- [ ] Copy-CA buttons (sidebar + footer) copy `GFV7fphvprMr1PYpYGPJort2QP7JJLEp3J1Buu7Zpump`.

## CSP verification (deploy preview — Vite dev serves no headers)
- [ ] Zero CSP violations in the console on `/watch` with a live X embed rendered.
- [ ] Google Fonts load (Inter / Space Grotesk / JetBrains Mono render, no fallback fonts).
- [ ] `/player` still embeds Twitch (and YouTube via `youtube-nocookie.com`) without violations.
- [ ] If X shifts syndication hosts, add the new domain to `frame-src`/`connect-src` in `netlify.toml`.

---

## Open-source deployments

Running your own network on this? Every variable above is yours to set, and
**the wallet addresses in the code are not environment variables** — they're
constants in `src/lib/slots.ts` and `netlify/functions/_shared/`. Change them or
you are funding someone else's treasury. See
[`../CONTRIBUTING.md`](../CONTRIBUTING.md) § "Running your own node".
