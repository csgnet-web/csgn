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
