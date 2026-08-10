# CSGN — Crypto Sports & Gaming Network

> The 24/7 crypto-native streaming network built on Solana. The ESPN and TMZ of crypto.
>
> **Open source under the [MIT licence](LICENSE).** Fork it, rebrand it, point the
> wallets at your own, and run your own network — see [CONTRIBUTING.md](CONTRIBUTING.md)
> § "Running your own node". The brand and the on-chain addresses are not part of
> the grant; everything else is.

CSGN runs a real schedule: **twelve two-hour blocks a day**. 7 PM – 3 AM ET is programmed
(CSGN Originals); **every other hour is claimable by anyone**. Streamers earn real trading
fee revenue — calculated per market-cap tier against live DexScreener data — simply by
going live on the network.

**Blockspace for attention. A 24/7 channel where the hour is the asset.**

---

## Where things are

| I want to… | Open |
|---|---|
| Know what we're doing this quarter | [`docs/plan.md`](docs/plan.md) |
| Understand what the token actually does | [`docs/design/token-economics.md`](docs/design/token-economics.md) |
| Understand how the channel programs itself | [`docs/design/the-grid.md`](docs/design/the-grid.md) |
| Ship code / run my own node | [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| Put it on air | [`docs/ops/obs/README.md`](docs/ops/obs/README.md) |
| Prove it works before it pays anyone | [`docs/ops/dry-run.md`](docs/ops/dry-run.md) |
| Read the full version history | [`CHANGELOG.md`](CHANGELOG.md) |

Everything else is indexed in [`docs/README.md`](docs/README.md).

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

## Getting Started

```bash
npm install
cp .env.example .env    # Fill in your Firebase web config
npm run dev             # Start dev server at localhost:5173
```

Before finishing any change:

```bash
npx eslint src/ && npx tsc -b && npx vitest run && npm run build
```

---

## Environment Variables

Frontend keys use the Vite `VITE_` prefix and are safe to expose — they identify the app,
not a secret; Firestore rules and server-side admin credentials are the actual access
controls. Backend keys are Netlify-environment only and must **never** carry `VITE_`.

**[`docs/ops/env-setup.md`](docs/ops/env-setup.md) is the complete reference** — every
variable, which are secret, the payout-wallet key policy, and the deploy checklist.

---

## Pages

| Route | Description |
|---|---|
| `/`, `/watch` | The channel — live X broadcast embed, $CSGN token panel, today's schedule |
| `/schedule` | 7-day board; claim an open hour (`/queue`, `/apply` redirect here) |
| `/about` | What CSGN is, in plain language |
| `/participate`, `/vote` | The Holder Zone — votes, the ticker rail, the Coin Jukebox |
| `/treasury` | Live on-chain treasury balances and the four published rules |
| `/account` | Your dashboard — slots, earnings, holdings, game record |
| `/u/:username` | Public profile (server-side projection; cannot leak wallet or email) |
| `/admin` | Broadcast Control — slots, ticker, Game Control, fees, payouts |
| `/player` | **Master Control** — the OBS-ready broadcast state machine |
| `/terms` | Terms of service |

---

## Deployment

Push to `main` → auto-deploys on Netlify. Build: `npm run build` → `dist/`.

`FIREBASE_PROJECT_ID` appears in browser code and is not a secret. If Netlify secret
scanning flags it:

```env
SECRETS_SCAN_OMIT_KEYS=FIREBASE_PROJECT_ID,VITE_FIREBASE_PROJECT_ID
```

---

## Architecture — broadcast flow (OBS → X, no Restream)

```
Slot streamers → their own Twitch / Kick / YouTube channels
  claimSlot → channel URL → resolveCurrentBroadcast → public/currentBroadcast

CSGN operator machine (docs/ops/obs-setup.md):
  /player = MASTER CONTROL — a state machine (src/lib/masterControl.ts), not an iframe:
    LIVE            streamer's feed fullscreen, audio on
    STARTING_SOON   slot claimed, not live yet → branded card (max 10 min)
    BRB             feed dropped → grace card 120s; auto-cuts back on reconnect
    INTERMISSION    VOD playlist (config/vodPlaylist) rotating with the animated board
    OVERRIDE        emergency non-Twitch URL
    + CSGN brand wipe on every state change
  → OBS Browser Source (1920×1080, one scene, zero OBS logic)
  → RTMPS → X Media Studio Producer → live on @CSGNet
```

X embeds a **post** by status ID — raw `x.com/i/broadcasts/…` links are not embeddable,
and the Admin field validates this. Viewers chat in the broadcast post's replies.

## Architecture — live fee + token stats

```
Every 60 seconds (Netlify cron → feePollerBackground):
  4 × DexScreener polls at t=0/15/30/45s
    → public/tokenStats
    → creator-fee calculation against the 25-tier pump.fun schedule
    → slots/{id}.creatorFees   (streamer takes 30% of the creator fee)
    → slots/{id}.streamActivity (verified Twitch live-minutes, 1/min)
```

Full detail: [`docs/ops/backend-hardening.md`](docs/ops/backend-hardening.md) for the cost
and caching posture, [`docs/ops/security-audit.md`](docs/ops/security-audit.md) for what
was found and fixed.

---

## The published addresses

| | |
|---|---|
| $CSGN mint | `GFV7fphvprMr1PYpYGPJort2QP7JJLEp3J1Buu7Zpump` |
| Treasury | `CSGNUgUpBqTNM7EBZSMeA5jzPLFNR2hELhLjbHLpbEY4` |
| Payout wallet | `EftavCt6Tk2bzWJ9Dnz7cAvfa5RAnh8S9vZcrorV7Hmv` |

Nothing is ever burned. Everything the network receives goes to a public treasury under
four published rules — see [`/treasury`](https://csgn.tv/treasury) and
[`docs/design/token-economics.md`](docs/design/token-economics.md).

---

## License

MIT — see [`LICENSE`](LICENSE). The brand and the on-chain addresses are excluded from
the grant; everything else is yours to fork.
