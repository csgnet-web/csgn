# CSGN v1 Launch Checklist

## Netlify environment variables
- [ ] Frontend Vite variables are set: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_RESTREAM_CHAT_URL`.
- [ ] Backend-only function variables are set: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TWITCH_REDIRECT_URI`, `CSGN_ALLOWED_ORIGIN`, `CSGN_DEFAULT_STREAM_URL`, `CSGN_FALLBACK_STREAM_URL`, `CSGN_PROOF_SIGNING_SECRET`.
- [ ] `FIREBASE_PRIVATE_KEY` is stored with escaped newlines and no service-account JSON is committed.
- [ ] `CSGN_ALLOWED_ORIGIN` is the production origin, for example `https://csgn.fun`.

## Firebase setup
- [ ] Email/password sign-in is enabled in Firebase Authentication.
- [ ] Firestore rules are deployed and deny normal-user writes to trusted collections.
- [ ] The service account used by Netlify Functions can read/write Firestore and verify ID tokens.
- [ ] Seeded slot documents include `startTime`, `endTime`, `status`, and `isClaimable`.

## Twitch setup
- [ ] Twitch application redirect URI exactly matches `TWITCH_REDIRECT_URI` character-for-character; production should use `https://csgn.fun/auth/twitch/callback` unless the Netlify env var is intentionally set to another callback URL.
- [ ] Twitch client ID/secret are backend-only Netlify variables.
- [ ] OAuth callback is reachable at `/auth/twitch/callback`, which Netlify rewrites to `/.netlify/functions/twitchOAuthCallback`.

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
- [ ] Frontend cannot directly write `slots`, `config`, `public/currentBroadcast`, unique locks, OAuth states, Phantom challenges, or audit logs.
- [ ] User functions reject missing or invalid Firebase ID tokens.
- [ ] Admin functions reject non-admin users.
- [ ] Phantom verification fails if the challenge expires, is reused, or the signature is invalid.
- [ ] Twitch verification only succeeds through OAuth callback proof tokens.

## OBS test checklist
- [ ] `resolveCurrentBroadcast` writes `public/currentBroadcast` with the expected source priority.
- [ ] `/player` loads without requiring sign-in.
- [ ] `/player` renders the active Twitch stream fullscreen with no Firestore writes from the browser.
- [ ] Emergency override appears in `/player`, and clearing it returns to the active slot/fallback stream.
