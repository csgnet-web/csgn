# CSGN v1 Launch Checklist

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
