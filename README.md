# CSGN — Crypto Sports & Gaming Network

**CSGN is the sports network for the internet economy:** a 24/7 autonomous channel covering sports, crypto markets, and gaming as sport, with community programming and connected-creator takeovers.

## Start here

| Need | Document |
|---|---|
| Product, business, programming, growth, gaps, and roadmap | [`docs/master-plan.md`](docs/master-plan.md) |
| Build the AI anchors and put the autonomous channel on air | [`docs/autonomy-runbook.md`](docs/autonomy-runbook.md) |
| Configure the existing ticker/lower-thirds and OBS stack | [`docs/obs/README.md`](docs/obs/README.md) |
| Configure environment variables and deployment | [`docs/env-setup.md`](docs/env-setup.md) |
| Operate security, costs, and incidents | [`docs/ops-cost-security-runbook.md`](docs/ops-cost-security-runbook.md) |
| Contribute or run another node | [`CONTRIBUTING.md`](CONTRIBUTING.md) |

Do not use the remaining narrow technical references as competing product plans. The Master Plan is authoritative.

## What exists

- `/watch`: viewer-facing channel.
- `/player`: current live/community master-control playback.
- `/autoplayer`: autonomous CSGN 30 and two-anchor OBS source.
- `/admin`: network administration; **Autopilot** is the daily operating tab.
- Permanent OBS graphics for scores, crypto prices, Coin Spotlight, token highlighting, Right Now Rail, now/next, PIP, and HUD.
- Phantom/Firebase accounts, public profiles, Twitch OAuth and forwarding consent.
- TikTok OAuth/import, clip submission, moderation, and weighted airtime scheduling.
- Connected-Twitch live roster, recommendations, takeover controls, and airtime history.
- $CSGN participation, token voting, Coin Spotlight, Right Now messages, treasury, and creator-fee tooling.

## Current product boundary

The autonomous UI is a demonstrable playout surface, not yet an unattended production network. Before claiming 24/7 autonomy, the repository still needs the server-side package queue and render worker, licensed live data, a single AUTO/TikTok/Twitch/OWNER/SAFE director, automated QC/health failover, and Discord newsroom automation. The exact order is in the [Master Plan](docs/master-plan.md#10-roadmap-from-here) and [Autonomy Runbook](docs/autonomy-runbook.md#8-the-exact-remaining-engineering-order).

## Local development

```bash
npm install
cp .env.example .env
npm run dev
```

Required Firebase and backend configuration is documented in [`docs/env-setup.md`](docs/env-setup.md).

### Checks

```bash
npm run lint
npm test
npm run build
```

## Stack

React 19, TypeScript, Vite, Tailwind CSS, Firebase Auth/Firestore/Storage, Netlify Functions, Solana/Phantom, Twitch, TikTok, DexScreener, OBS browser sources, and static HTML broadcast graphics.

## Broadcast preview

Open:

```text
/autoplayer?preview=1&demoVoice=1&segment=lead
```

Use browser speech only for rehearsal. Production packages use licensed, pre-rendered audio and the existing permanent lower-third as a separate OBS layer.

## License

Code is available under the [MIT License](LICENSE). CSGN branding, wallets, media, talent likeness/voice, and third-party content rights are not granted by that license.
