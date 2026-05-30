# CSGN — Crypto Sports & Gaming Network

The 24/7 crypto-native streaming network built on Solana. The ESPN and TMZ of crypto.

## Tech Stack

- **React 19** + TypeScript
- **Vite** for fast builds
- **Tailwind CSS v4** for styling
- **Firebase** (Auth + Firestore) for user accounts and data
- **Framer Motion** for animations
- **React Router v7** for routing
- **Netlify** for hosting

## Getting Started

```bash
npm install
cp .env.example .env    # Add your public Firebase web config
npm run dev             # Start dev server at localhost:5173
```

## Firebase Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication** (Email/Password + Google)
3. Enable **Cloud Firestore**
4. Copy your public Firebase web config values into `.env`

## Environment Variables

See [`docs/env-setup.md`](docs/env-setup.md) for detailed local and Netlify environment variable guidance.

Public frontend Firebase config values are required by the browser app and are safe to expose through Vite's `VITE_` prefix:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

`VITE_FIREBASE_PROJECT_ID` is expected to appear in browser code, and `FIREBASE_PROJECT_ID` is not a secret. Do not mark `FIREBASE_PROJECT_ID` secret/protected in Netlify. If Netlify secret scanning still flags the public project id after correcting that classification, set:

```env
SECRETS_SCAN_OMIT_KEYS=FIREBASE_PROJECT_ID,VITE_FIREBASE_PROJECT_ID
```

Actual backend secrets must stay server-side only and must never be exposed through `VITE_` variables or frontend code:

```env
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
TWITCH_CLIENT_SECRET=
CSGN_PROOF_SIGNING_SECRET=
```

`TWITCH_CLIENT_ID` can be treated as backend-only for architecture consistency, but it is not as sensitive as `TWITCH_CLIENT_SECRET`.

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page with hero, features, content pillars, CTAs |
| `/watch` | Live stream viewer with schedule sidebar and chat |
| `/schedule` | Full broadcast schedule with 3-tier slot system |
| `/apply` | Streamer application form (requires auth) |
| `/about` | About CSGN, team, roadmap, vision |
| `/tokenomics` | Token economics, fee-split model, revenue streams |
| `/dashboard` | User profile, application status, streamer stats |
| `/admin` | Admin panel for managing applications, streamers, schedule |

## Deployment

Deployed on Netlify. Push to `main` to auto-deploy. Netlify secret scanning can fail after a successful build if a public value like `FIREBASE_PROJECT_ID` is mistakenly classified as a secret; see [`docs/env-setup.md`](docs/env-setup.md) before changing Firebase environment variable visibility.

```bash
npm run build   # Outputs to dist/
```

## License

Proprietary — CSGN, Crypto Sports & Gaming Network
