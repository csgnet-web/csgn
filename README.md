# CSGN — Crypto Sports & Gaming Network

> The 24/7 crypto-native streaming network built on Solana. The ESPN and TMZ of crypto.
>
> **Open source under the [MIT licence](LICENSE).** Fork it, rebrand it, point the
> wallets at your own, and run your own network — see [CONTRIBUTING.md](CONTRIBUTING.md)
> § "Running your own node". The brand and the on-chain addresses are not part of
> the grant; everything else is.

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

### v1.4 — July 2026
**Faster "Now Live" + broadcast-graphics plan.**
- `/player` gains a **no-ads / Turbo fast-reveal mode** (`?noads=1` / `?turbo=1` on the OBS Browser Source URL): when the encoder's feed is ad-free, the preroll mask drops from 33s to ~2s and the "Now Live" curtain becomes a **deterministic 10-second countdown** (depleting ring + live `10 → 1` readout) instead of an indeterminate hold — a broadcast bumper, not a stall
- The safe 33s preroll-ad mask stays the **default**: fast-reveal is opt-in per source, because a 10s curtain over a feed that still plays a Twitch ad would leak the ad on-stream. `FeedGate`'s mask is now configurable (`createFeedGate(now, { prerollMaskMs })`); the fail-open reveal deadline, quality pin, stall-nudge and wedge-rebuild all still run behind the countdown
- `?debug=1` panel adds a **`reveal`** row (`no-ads · 10s countdown` vs `ad-mask · 33s`); `?preview=countdown` rehearses the bumper; the reveal deadline no longer strips the gate's rebuild power from a feed that actually confirmed
- Honest write-up of the **Twitch Turbo** question (Turbo only helps a session authenticated in the *embed's* context, which an OBS CEF source isn't by default — fragile to rely on) and a full **broadcast-graphics build plan** ([`docs/broadcast-graphics.md`](docs/broadcast-graphics.md)): code-driven lower thirds, bug/clock, crypto/headlines ticker, and the PIP whip-around (content square + 1–2 host side-screens), all Firestore-controlled the same way the intermission board and emergency override already are, with own-ingest RTMP as the "decentralized TV network" endgame

### v1.5 — July 2026
**Burn-free, treasury-first tokenomics + one consolidated strategy doc.**
- Removed the coin-spotlight **burn** mechanic entirely (`burnSpotlight` function, `spotlightBurn` client, `verifyCsgnBurn`). **CSGN is never burned** — the **Coin Jukebox** (pay SOL to spotlight a coin, TouchTunes-style) routes all proceeds to the **CSGN treasury**, which recycles them into distribution, creator payouts and liquidity
- Ticker/crypto upgrades: the dock chart is now the **last 24h** of price action (matches the 24h delta); the **Meme 100** is a live **power ranking** blending volume + market cap + social buzz + holder $CSGN votes, with a leaderboard card and a community pick; token voting is available from the **profile** as well as the Holder Zone
- All scattered planning docs (forward-strategy, business-spec, founder-readout, consultant-review, token-design-space, marketing-audit) consolidated into a single **[`docs/master-plan.md`](docs/master-plan.md)** — since simplified and rewritten around the wedge (gaming × sports × crypto × trading for young men), the founder's show/league playbook, the burn-free treasury token model, and a 30-day production calendar

### v1.6 — July 2026
**Programmed-vs-open, settled in one rule · a public treasury · $CSGN spends.**
- One shared `slotIdentity()` rule (pure, unit-tested) now decides *who's on an hour, what to call it, and whether it's a claimable open stage* — so the `/watch` headline, schedule strip, up-next list and offline board can't disagree. Fixes a live network show ("CSGN @ NITE") reading "THE STAGE IS OPEN" and a claimed hour ("csgnet") reading "Open Slot"
- `/player` never advertises a reserved **CSGN Originals** hour as claimable: the intermission billboard only features a genuinely open slot (shared `isSlotClaimable` rule), and a network hour gets its own **CSGN Originals** panel instead of the "Take This Slot" call-to-action
- New **`/treasury`** page — the public balance sheet that replaces burning: live on-chain SOL + $CSGN balances (valued off the shared token price), the treasury address (copy + Solscan), and the four published rules (no burn · 180-day hold · drip cap · stated purpose)
- **$CSGN is now a Coin Jukebox currency** alongside SOL. New server trust boundary `verifySplPayment` (pure + unit-tested: proves the treasury received the mint *and* the payer's balance dropped, defeating a co-sign attack); client `paySpotlightCsgn` (SPL transferChecked to the treasury); a SOL/$CSGN toggle in the Holder Zone and a `$CSGN` price field in Admin. Proceeds go to the treasury, never burned *(both on-chain payment paths still want one tiny mainnet dry-run before public promotion)*

### v1.7 — July 2026
**`/player` always resolves to the current hour · a last-call countdown · live-on-assign.**
- `/player` no longer **skips to the next slot when a streamer drops off live mid-hour.** The intermission open-stage billboard now resolves to the **current actual time slot** — the board only ever shows when nobody is live, so the hour on the clock is an open stage right now even if a dropped/no-show streamer is still nominally assigned to it. The revert lands on the *same correct time slot*, offered up "On Air Now — take it and go live immediately," instead of advertising the next slot's window. (A reserved CSGN Originals hour and an explicitly `completed` hour still fall through to the next open slot.)
- **STARTING_SOON is now two phases.** A just-claimed streamer who hasn't brought a feed up gets a calm "goes live shortly" card for **60 seconds**, then the card switches to a **120-second last-call countdown** (depleting ring + live `mm:ss`) warning "go live now or this stage opens for anyone to claim." If the countdown ends with still no feed, `/player` reverts to the open-to-claim intermission board **on the same current time slot**. The state-machine window (`STARTING_SOON_MAX_MS`) is now split into unit-tested `STARTING_SOON_QUIET_MS` + `STARTING_SOON_COUNTDOWN_MS`; a new precise deadline timer lands the revert exactly on zero (the 5s tick is now just a backstop). Rehearse it in OBS with `?preview=lastcall`
- **Admin: assigning the hour that's on the air right now sets it `live` immediately.** A new pure, unit-tested `assignmentStatus(slot, now)` decides the status at assign time — `live` for the current hour, `confirmed` for a future one, `completed` for a past one — so an admin dropping a streamer onto the live slot no longer waits up to a minute for the fee poller to promote `confirmed → live`
- Product direction logged: [`docs/master-plan.md` §11.8](docs/master-plan.md) sketches the **"TV remote for crypto"** — a continuous token-as-weight vote over a curated 3–5-stream shortlist that forwards the winning stream live and accrues owed payouts to creators who can claim them once they make an account — with its owed-money and stream-rights risks named. Ideation only; the time-block schedule remains the shipping model

### v1.8 — July 2026
**Kick forwarding · mobile-first admin · a money-and-ecosystem strategy.**
- **Kick forwarding.** `/player` now forwards **Kick** channels (alongside Twitch and YouTube): a `kick.com` / `player.kick.com` URL is detected (`parseKickChannel`, unit-tested — it never claims a bare word, which stays a Twitch channel) and played as an override iframe via `buildKickSrc`. CSP `frame-src` gains `player.kick.com` + `kick.com`
- **Platform-aware admin assign.** The Schedule → Assign modal gains a **Twitch / Kick / YouTube** segmented picker: a username for Twitch/Kick (prefix shown, link built), a pasted watch/live link for YouTube. Editing a Kick/YouTube slot reopens on the right platform instead of a blank Twitch field
- **No more mobile zoom-and-strand.** A global `@media (pointer: coarse)` rule forces form controls to 16px on touch devices, so focusing a field never triggers iOS's auto-zoom (scoped to touch so desktop keeps its compact sizing); tap-highlight flash removed for an app feel. The assign modal and other admin dialogs were reworked for thumbs (bigger tap targets, `inputMode`, no autocapitalize) and a double-padding bug in three modals was fixed
- New **[`docs/ecosystem-strategy.md`](docs/ecosystem-strategy.md)** — a final analysis plus the strategy to work in tandem with Ansem / Bullpen / Solana·Base·Octra projects (CSGN as the ecosystem's broadcast layer), a money-in-pocket-ASAP plan ranked by speed to cash, the **CSGN-for-Venues** play (ChiveTV × TouchTunes × cable), and a 30-day sprint

### v1.9 — July 2026
**Landing polish · ticker guardrails · PIP + permanent-bug OBS assets.**
- **Landing page (`/` = Watch) visual pass** (logic untouched): the "coming soon" games are now branded teaser cards (icon chip · SOON badge · title + subtitle) instead of flat gray blocks; the live-earnings readout is a defined stat chip that reads intentionally in both the live and empty states; the LIVE/OFFLINE status bar gains a pill + hairline border and a gradient live state. Verified with headless screenshots at desktop + mobile
- **"Right Now" ticker guardrails (admin):** each headline is now capped at `MAX_RIGHT_NOW_CHARS` (44) **while you type and on save**, so a line can't be made long enough to ellipsize on the OBS ticker (the on-air text size is unchanged — only the input logic). A live parsed **preview** renders each headline as its own labelled row with a character counter, so on a phone it's obvious which line is which and how close each is to the limit
- **New OBS asset `docs/obs/csgn-pip.html`** — one self-contained, dependency-free browser source that draws branded frames + labels + a corner bug around transparent windows for every common multi-source permutation (solo · duo · duo-stack · **pip corner** · **tri (1 focus + 2 even)** · tri-top · quad · spotlight), switchable with `?layout=` or the `1`–`9` keys. `?guide=1` prints each window's exact X/Y/W/H so OBS source transforms land pixel-true. Built as a "quotable module" to open-source
- **New OBS asset `docs/obs/csgn-nowwatching.html`** — a **permanent** (non-rotating) "Now Watching" lower-third bug that reads `config/ticker.nowLive` and is controlled from **Admin → Broadcast Control → Now Live**; never blank (falls back to a network default). Complements the rotating `csgn-lowerthirds.html`
- All OBS browser-source assets live in **`docs/obs/`**: `csgn-ticker.html`, `csgn-lowerthirds.html`, `csgn-pip.html` (new), `csgn-nowwatching.html` (new), plus `csgn-master.lua`

### v2.0 — July 2026
**Shared-primitive refactor · the OBS guide · the onchain thesis.**
- **Codebase optimization.** `toMillis` was copy-pasted into **five** files and two copies were missing the finite-check on the Firestore-`Timestamp` branch — a malformed stamp returned `NaN`, and since `NaN` loses *both* sides of every comparison, such a slot silently sorted into an arbitrary schedule position instead of being filtered out. Now one documented, unit-tested `toMillis` in `slotModel.ts`. `formatPrice`/`compact` (duplicated across the $CSGN panel, the on-air board and `/treasury` — surfaces that appear side by side in clips) collapse into a new tested `src/lib/format.ts`. Three dead `lib/player` exports resolved: `PLAYER_ALLOW` and `buildYouTubeSrc` are now *used* by `/player` (deleting two duplicated literals), and `buildTwitchSrc` — kept alive only by its own test — is gone, with a note explaining why Twitch is driven by the Embed JS API instead. Net: −5 duplicate implementations, +2 shared modules, 230 tests green
- **New [`docs/obs/README.md`](docs/obs/README.md)** — the complete guide to every OBS asset: the layer stack (z-order), per-asset install settings and URL flags, an **Admin → what changes on air** map, troubleshooting, offline testing, and the design rules the assets are written to (standalone, dependency-free, quotable). `docs/obs-setup.md`'s scene table now includes the PIP + Now-Watching sources. Filenames intentionally unchanged — renaming would break existing OBS local-file paths
- **New [`docs/onchain-thesis.md`](docs/onchain-thesis.md)** — full analysis of the project, website, X presence and the nightly-stream plan, plus the answer to *remote-control vs. time blocks*: the remote isn't the opposite of the slot model, it's the slot model with the block time shortened and allocation changed from booking to **continuous auction** — *screenspace* as the scarce resource. Ranks eight ways to make $CSGN a genuine programmatic primitive (airtime as an onchain asset · **Attention Hooks**, the direct Uniswap-v4 analogy · proof-of-broadcast from the live-minute log you already record · ticker-cell leases · and more), with the risks named
- Landing page: the empty hour now reads **"Open Slot"** in muted gray (a blank slate, not a shout), the claim button is compact, and Live Earnings shows a real **`$0.00` / `0.00 SOL`** meter instead of a dash. Admin's Right Now headline cap raised to **60 characters**

### v2.1 — July 2026
**Phantom connect fixed · Sign in with Phantom · the SocialFi Era 2 plan.**
- **Fixed Phantom registration.** Three independent client-side causes (the server's nonce → Ed25519 → replay-protected proof chain was already correct). ① **A cached address is not a connection** — `walletAddress` was seeded from localStorage and every caller did `walletAddress || connect()`, so a returning user skipped `connect()` and went straight to `signMessage()` on a provider never connected that session: the prompt never appeared and the flow died silently. ② **Legacy-only provider detection** — we read `window.solana`, a back-compat alias *any* wallet can claim, so with Solflare/Backpack installed we told users with Phantom running that Phantom wasn't detected; now prefers `window.phantom.solana`. ③ **No wait for injection**, which is late in in-app browsers. Plus real error messages (cancel ≠ failure), a **mobile deeplink** into Phantom's in-app browser instead of a dead end, silent `onlyIfTrusted` reconnect, and `accountChanged`/`disconnect` listeners. Unit-tested, including the multi-wallet case
- **Sign in with Phantom** on the login view — `loginWithPhantom` exchanges the existing (already-audited) `phantom_wallet` proof for a Firebase custom token via a new `createCustomToken` helper. Never creates or re-links accounts; an unlinked wallet 404s. *Needs one live smoke test against real Firebase credentials.*
- New **[`docs/socialfi-era2.md`](docs/socialfi-era2.md)** — full agency consultation for the next SocialFi era: the market read (~8.2M daily active wallets in Q1 2026; the Era 1 → Era 2 rule change), CSGN's uncontested position (*everyone is rebuilding the feed; nobody is building the channel*), a **Privy analysis** with a segmented recommendation (Privy for viewers, Phantom for streamers — and cut the free funnel first), the founder promotion playbook (X formats, five Substack essays, how to behave in the Ansem stream room), the project's social verticals (Farcaster rated P1), a 90-day plan, metrics and kill criteria

### v2.2 — July 2026
**The campaign, locked.**
- New **[`docs/campaign.md`](docs/campaign.md)** — the operating document that consolidates every strategy doc into one executable plan. Three pillars: **the room** (permissioned Ansem-room presence — be useful, never pitch, broadcast with attribution), **the show** (CFB 27 in three formats, with the online-dynasty league recruited first because it's 11 other people with a reason to post), and **the campaign** (own the vocabulary). Includes the two-person newsroom split with the production partner, the weekly publishing rhythm, the copy to use (bio, pinned post, talk track), a 30-day table, the scoreboard, and pre-committed kill criteria
- **The terminology play:** don't fight for "SocialFi" — it's a contested category with incumbents. Claim **StreamFi** and **Attention Capital Markets (ACM)** outright, define them once, and let SocialFi cite you for the words it was missing. Canonical definitions now ship on **`/about`** so the terms are citable, and are mirrored in the docs index
- New **[`docs/README.md`](docs/README.md)** — a docs index that makes the set navigable and states the supersession order (`master-plan` → `ecosystem-strategy` → `onchain-thesis` → `socialfi-era2` → **`campaign`**)

---

### v1.15 — August 2026
**Games, payouts, a ratings book — and the source opened.**

*(Version jumps 1.9 → 1.15 deliberately: this is the open-source release, and the
number marks it. Still well short of v2.)*

- **Squares** — weekly, pooled, provably fair. 10×10 board, entry fee per square,
  published rake, **500,000 $CSGN to the winner of a full board** (100 × 6,250
  less a 20% rake). A short board pays a short prize; a guarantee is opt-in per
  board and the top-up is reported, never hidden. Digits are drawn from a Solana
  blockhash sampled *after* entries close, through a PRNG anyone can re-implement
  and reproduce. The one paid game on the network — everything else stays free
- **Starting 5** — daily lineup game, free to enter, entries scale with $CSGN
  *held* (square-root curve, one free for everyone). One pick per market-cap tier
  plus a wildcard, a 1.5× captain, and contrarian leverage on gains only.
  **100,000 $CSGN for a perfect card (5/5)**, split across perfect cards or drawn
  by lottery; nobody perfect rolls the jackpot into tomorrow
- **The payout wallet** (`EftavCt6…V7Hmv`) — idempotency keys derived from what a
  payout is *for* and claimed with a CREATE the database refuses to repeat; the
  signature written to the ledger *before* broadcast so recovery re-sends an
  identical transaction the cluster deduplicates; per-payout/run/day caps; a
  solvency check that budgets token-account rent for first-time winners.
  `adminRunPayouts` is admin-only and **dry-run by default**
- **Game Control** (Admin → Broadcast Control) — `config/gameBanner` drives the
  strip beside LIVE/OFFLINE on `/watch`: game, headline, live countdown, rotating
  lines, with a preview rendered through the same resolver the page uses.
  `config/games` holds the Starting 5 purse/jackpot/prize-mode/lock hour and the
  weekly Squares day, hour, entry fee and rake
- **Profile rebuilt** — the old header floated an avatar over a gradient banner
  and collided with the name on narrow screens. Now flat surfaces, one accent,
  everything in normal flow: no negative margins, nothing absolutely positioned,
  so it cannot overlap at any width. New **Games** and **Holder Standing** panels
  carry the gamification, with honest zeroes until the settlement job exists
- **BottomLine** — the ticker gets ESPN-style **section dots** bottom-right (one
  pip per game in the league, drawing down as it rolls, resetting on the wipe),
  a **Meme 100 leaderboard** sized to be read from across a room rather than
  squinted at, **MLB games-back inline with the record**, and a detail face
  ("PROBABLE STARTERS") that fills the space it was given
- **Open source** — MIT, plus [`CONTRIBUTING.md`](CONTRIBUTING.md): how to run
  your own node, the rules this codebase actually keeps, and the broadcasting
  guidance (**X is the recommended output; use Restream if you also want Twitch**)
- **[`docs/dry-run.md`](docs/dry-run.md)** — the gated checklist that takes this
  from "tests pass" to "it moved money on mainnet and the books balanced",
  including the idempotency test that must never be skipped
- Docs consolidated: one tiered index, the v1 launch checklist folded into
  [`docs/env-setup.md`](docs/env-setup.md)

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

**MIT** — see [`LICENSE`](LICENSE).

The software is yours. The **name, logo and BottomLine marks** are not, and
neither are the **$CSGN mint, treasury and payout wallet** — those addresses are
published so anyone can audit what the network does with them, not so anyone can
act on their behalf. Fork it, rebrand it, use your own wallets.

Nothing in this repository is financial, legal or tax advice. The games move real
tokens to real people; get your own counsel before running them for anyone but
yourself.
