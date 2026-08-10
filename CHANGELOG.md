# Changelog

The full history of CSGN, oldest first. Moved verbatim out of `README.md` on
2026-08-10 — see [`docs/decisions.md`](docs/decisions.md).

**The prose is untouched.** The only edit made during the move was repointing link
*targets* at the doc locations created by the same reorganisation, so that historical
entries still navigate. Where an entry's text names a path that has since moved, the text
is left as it was written — it is a record of what was true that week.

---

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
- Honest write-up of the **Twitch Turbo** question (Turbo only helps a session authenticated in the *embed's* context, which an OBS CEF source isn't by default — fragile to rely on) and a full **broadcast-graphics build plan** ([`docs/broadcast-graphics.md`](docs/design/broadcast-graphics.md)): code-driven lower thirds, bug/clock, crypto/headlines ticker, and the PIP whip-around (content square + 1–2 host side-screens), all Firestore-controlled the same way the intermission board and emergency override already are, with own-ingest RTMP as the "decentralized TV network" endgame

### v1.5 — July 2026
**Burn-free, treasury-first tokenomics + one consolidated strategy doc.**
- Removed the coin-spotlight **burn** mechanic entirely (`burnSpotlight` function, `spotlightBurn` client, `verifyCsgnBurn`). **CSGN is never burned** — the **Coin Jukebox** (pay SOL to spotlight a coin, TouchTunes-style) routes all proceeds to the **CSGN treasury**, which recycles them into distribution, creator payouts and liquidity
- Ticker/crypto upgrades: the dock chart is now the **last 24h** of price action (matches the 24h delta); the **Meme 100** is a live **power ranking** blending volume + market cap + social buzz + holder $CSGN votes, with a leaderboard card and a community pick; token voting is available from the **profile** as well as the Holder Zone
- All scattered planning docs (forward-strategy, business-spec, founder-readout, consultant-review, token-design-space, marketing-audit) consolidated into a single **[`docs/master-plan.md`](docs/archive/master-plan.md)** — since simplified and rewritten around the wedge (gaming × sports × crypto × trading for young men), the founder's show/league playbook, the burn-free treasury token model, and a 30-day production calendar

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
- Product direction logged: [`docs/master-plan.md` §11.8](docs/archive/master-plan.md) sketches the **"TV remote for crypto"** — a continuous token-as-weight vote over a curated 3–5-stream shortlist that forwards the winning stream live and accrues owed payouts to creators who can claim them once they make an account — with its owed-money and stream-rights risks named. Ideation only; the time-block schedule remains the shipping model

### v1.8 — July 2026
**Kick forwarding · mobile-first admin · a money-and-ecosystem strategy.**
- **Kick forwarding.** `/player` now forwards **Kick** channels (alongside Twitch and YouTube): a `kick.com` / `player.kick.com` URL is detected (`parseKickChannel`, unit-tested — it never claims a bare word, which stays a Twitch channel) and played as an override iframe via `buildKickSrc`. CSP `frame-src` gains `player.kick.com` + `kick.com`
- **Platform-aware admin assign.** The Schedule → Assign modal gains a **Twitch / Kick / YouTube** segmented picker: a username for Twitch/Kick (prefix shown, link built), a pasted watch/live link for YouTube. Editing a Kick/YouTube slot reopens on the right platform instead of a blank Twitch field
- **No more mobile zoom-and-strand.** A global `@media (pointer: coarse)` rule forces form controls to 16px on touch devices, so focusing a field never triggers iOS's auto-zoom (scoped to touch so desktop keeps its compact sizing); tap-highlight flash removed for an app feel. The assign modal and other admin dialogs were reworked for thumbs (bigger tap targets, `inputMode`, no autocapitalize) and a double-padding bug in three modals was fixed
- New **[`docs/ecosystem-strategy.md`](docs/archive/ecosystem-strategy.md)** — a final analysis plus the strategy to work in tandem with Ansem / Bullpen / Solana·Base·Octra projects (CSGN as the ecosystem's broadcast layer), a money-in-pocket-ASAP plan ranked by speed to cash, the **CSGN-for-Venues** play (ChiveTV × TouchTunes × cable), and a 30-day sprint

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
- **New [`docs/obs/README.md`](docs/ops/obs/README.md)** — the complete guide to every OBS asset: the layer stack (z-order), per-asset install settings and URL flags, an **Admin → what changes on air** map, troubleshooting, offline testing, and the design rules the assets are written to (standalone, dependency-free, quotable). `docs/obs-setup.md`'s scene table now includes the PIP + Now-Watching sources. Filenames intentionally unchanged — renaming would break existing OBS local-file paths
- **New [`docs/onchain-thesis.md`](docs/archive/onchain-thesis.md)** — full analysis of the project, website, X presence and the nightly-stream plan, plus the answer to *remote-control vs. time blocks*: the remote isn't the opposite of the slot model, it's the slot model with the block time shortened and allocation changed from booking to **continuous auction** — *screenspace* as the scarce resource. Ranks eight ways to make $CSGN a genuine programmatic primitive (airtime as an onchain asset · **Attention Hooks**, the direct Uniswap-v4 analogy · proof-of-broadcast from the live-minute log you already record · ticker-cell leases · and more), with the risks named
- Landing page: the empty hour now reads **"Open Slot"** in muted gray (a blank slate, not a shout), the claim button is compact, and Live Earnings shows a real **`$0.00` / `0.00 SOL`** meter instead of a dash. Admin's Right Now headline cap raised to **60 characters**

### v2.1 — July 2026
**Phantom connect fixed · Sign in with Phantom · the SocialFi Era 2 plan.**
- **Fixed Phantom registration.** Three independent client-side causes (the server's nonce → Ed25519 → replay-protected proof chain was already correct). ① **A cached address is not a connection** — `walletAddress` was seeded from localStorage and every caller did `walletAddress || connect()`, so a returning user skipped `connect()` and went straight to `signMessage()` on a provider never connected that session: the prompt never appeared and the flow died silently. ② **Legacy-only provider detection** — we read `window.solana`, a back-compat alias *any* wallet can claim, so with Solflare/Backpack installed we told users with Phantom running that Phantom wasn't detected; now prefers `window.phantom.solana`. ③ **No wait for injection**, which is late in in-app browsers. Plus real error messages (cancel ≠ failure), a **mobile deeplink** into Phantom's in-app browser instead of a dead end, silent `onlyIfTrusted` reconnect, and `accountChanged`/`disconnect` listeners. Unit-tested, including the multi-wallet case
- **Sign in with Phantom** on the login view — `loginWithPhantom` exchanges the existing (already-audited) `phantom_wallet` proof for a Firebase custom token via a new `createCustomToken` helper. Never creates or re-links accounts; an unlinked wallet 404s. *Needs one live smoke test against real Firebase credentials.*
- New **[`docs/socialfi-era2.md`](docs/archive/socialfi-era2.md)** — full agency consultation for the next SocialFi era: the market read (~8.2M daily active wallets in Q1 2026; the Era 1 → Era 2 rule change), CSGN's uncontested position (*everyone is rebuilding the feed; nobody is building the channel*), a **Privy analysis** with a segmented recommendation (Privy for viewers, Phantom for streamers — and cut the free funnel first), the founder promotion playbook (X formats, five Substack essays, how to behave in the Ansem stream room), the project's social verticals (Farcaster rated P1), a 90-day plan, metrics and kill criteria

### v2.2 — July 2026
**The campaign, locked.**
- New **[`docs/campaign.md`](docs/archive/campaign.md)** — the operating document that consolidates every strategy doc into one executable plan. Three pillars: **the room** (permissioned Ansem-room presence — be useful, never pitch, broadcast with attribution), **the show** (CFB 27 in three formats, with the online-dynasty league recruited first because it's 11 other people with a reason to post), and **the campaign** (own the vocabulary). Includes the two-person newsroom split with the production partner, the weekly publishing rhythm, the copy to use (bio, pinned post, talk track), a 30-day table, the scoreboard, and pre-committed kill criteria
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
- **[`docs/dry-run.md`](docs/ops/dry-run.md)** — the gated checklist that takes this
  from "tests pass" to "it moved money on mainnet and the books balanced",
  including the idempotency test that must never be skipped
- Docs consolidated: one tiered index, the v1 launch checklist folded into
  [`docs/env-setup.md`](docs/ops/env-setup.md)

### v1.16 — August 2026
**Sign-up that actually completes, one notice system, and discoverability.**

- **Twitch is now OPTIONAL at sign-up.** Phantom is the credential; Twitch is the
  broadcast permission and only gates *claiming a slot*. This is a correctness
  fix, not a convenience: Twitch's login page offers "Sign in with Apple", and
  Apple refuses OAuth inside embedded webviews (`disallowed_useragent`) — so a
  user arriving in Phantom's in-app browser literally could not finish sign-up.
  New `linkTwitch` function attaches the channel later, from anywhere
- **One `Notice` component** replaces five hand-rolled message shapes (amber card,
  red flex row, emerald pill, bare `<p className="text-red-300">`, inline span).
  Four tones that mean something, one layout, and **the action lives inside the
  notice** — a message telling you to do something with no way to do it is a
  complaint. `EmailNotice` and `TwitchNotice` are named exports so the two
  sentences that gate the product read identically everywhere
- **`claimEligibility`** — one pure, tested rule mirroring `claimSlot.ts`, so the
  UI names the ONE missing thing before the round trip. Previously an unlinked
  member pressed an enabled button and got *"Verified Phantom and Twitch are
  required"* — two requirements, no indication which was missing
- **Email removed from the profile.** It's a private credential and this page is
  the model for the public profile; its verification state stays in the notice,
  where it's actionable
- **Members to watch** — a discovery rail on the profile, backed by
  `publicProfiles` with an explicit server-side projection (`toPublicProfile` is
  the only place that decides what leaves the users collection — email and wallet
  are never in it). Ranked Twitch-linked first, because discovery is for finding
  someone to watch, not for ranking members by bag size
- **OBS quick start** — "on air in fifteen minutes": five browser sources, two
  checkboxes each, four encoder settings, and a symptom→fix table

### v1.17 — August 2026
**Sign up with a wallet. A real Meme 100 board. Profiles you can visit.**

- **Phantom is now a full sign-up, not just a sign-in.** One signature and a
  username gets you an account — no email, no password, no Twitch. Email is
  attached later from the profile and gates only *claiming a slot*; Twitch gates
  only *going on air*. The uid is derived from the wallet, so a double-submit
  resolves to the same account instead of a second one, and signing up with an
  already-registered wallet just signs you in
- **Slot buttons gray out when you can't claim.** An enabled button that always
  fails teaches people the site is broken rather than that they have one thing
  left to do. Disabled, locked, two-word reason, with the full sentence in one
  notice at the top of `/schedule`. The cards also stopped fighting themselves —
  a two-line all-caps slogan sat directly above an all-caps button saying nearly
  the same thing, with glows and press-scale on 84 cards at once
- **Meme 100 is a ranked board you pick from**, keyed by contract address rather
  than a typed ticker. Symbols collide ($BONK / BONK / Bonk were three rows);
  mints don't. Every card carries live price, market cap, 24h volume, 24h change
  and the CA itself with copy + chart links. The set is admin-curated, the data
  is enriched server-side from DexScreener, and the power score is published so
  the ordering can be checked against the numbers on the card
- **Public profiles at `/u/:username`**, built entirely from a server-side
  projection — the page cannot leak a private field because it never receives
  one. The discovery rail now samples randomly from a wider ranked pool (instead
  of showing the same six faces forever), has a shuffle button, is dismissable,
  and links to CSGN profiles rather than straight out to Twitch
- **Your email is back on your profile, and private by construction.** `/account`
  only ever renders your own profile and `toPublicProfile` has no email field at
  all, so it's visible to you and in no response another member can reach
- **`/about` rewritten** — plain language, every feature explained, including
  what the token actually does and how the profile votes work. No adjectives
  doing a fact's job

### v1.18 — August 2026
**On-chain Meme 100, sign-up back to email + wallet, and a backend cost pass.**

- **The Meme 100 seeds itself from on-chain activity.** DexScreener's boost and
  profile feeds supply candidate Solana mints; each is enriched from real pool
  state (deepest-liquidity pair wins) and must clear hard thresholds —
  **≥$25k liquidity, ≥$50k 24h volume, ≥24h old** — before it can reach the
  board. Those gates are the safety story: this list goes on air and is the
  ballot for a token-weighted vote, so without them a rug minted ninety seconds
  ago lands next to real coins and the vote legitimises it. An allowlist pins
  coins past the thresholds ($CSGN on its own board); a denylist still exists,
  because "cleared the numbers" isn't "happy to put on television". An empty
  result never overwrites a good board
- **Sign-up requires email, password and Phantom again**, with Twitch optional.
  Wallet-only registration is gone — it made mass registration far too cheap.
  Signing *in* with Phantom is unchanged
- **Backend hardening** ([`docs/backend-hardening.md`](docs/ops/backend-hardening.md)):
  - `publicProfiles` read **~72 documents per request** at a 60/min limit —
    4,320 reads a minute from one IP, from a public GET, using traffic no
    firewall would flag. Now cached per TTL with stampede protection; limit cut
    to 20/min
  - **Every outbound call now has a hard timeout.** Netlify bills wall clock, so
    a hung third party didn't fail fast — it burned the whole invocation and
    took everything else in that run with it
  - **Request bodies capped at 16KB**; malformed JSON returns 400 instead of
    500, and non-object bodies are rejected so handlers can destructure safely
  - New `_shared/cache.ts`: bounded TTL cache, single-flight, bounded fetch —
    with the rule that a failed load is never cached

### v1.19 — August 2026
**Sign-up down to one signature; a Twitch redirect that comes back where it left; X handled honestly.**

- **Sign-up is a wallet signature and a username.** No email, no password, no
  verification round trip. The credential was already the wallet — Phantom has
  always been mandatory (fees are paid to it) and `loginWithPhantom` has always
  let a returning holder in on a signature alone, so the email and password were
  a second, weaker key that went unused after the first sign-in. What they
  reliably did was cost accounts: three extra fields, a verification step that
  gated slot claims, and a Twitch redirect that came back demanding the password
  again because it's the one thing we refuse to persist
- **Signing up and signing in are the same button.** Prove the wallet; if it
  already has an account you're in, if it doesn't you pick a username. Nobody has
  to work out which form they needed first
- **Wallet-only registration is back, with the v1.18 objection actually
  answered.** It was pulled last release for a correct reason — a keypair is free
  and instant to generate, which made it a *weaker* toll than a verified email,
  not a stronger one. The toll is now the thing that can't be faked for free:
  the wallet must hold SOL or have signed at least one transaction
  (`isEstablishedWallet`). Funding and transacting thousands of wallets costs
  real money on a public ledger; a real Phantom user clears it instantly.
  Tunable via `CSGN_SIGNUP_MIN_LAMPORTS`; an unreachable RPC falls open and
  stamps the account `walletCheck: 'unavailable'` for audit, because this gate is
  anti-spam, not anti-fraud, and an outage must not lock the product
- **Email and password stay** — as a full sign-up path behind a disclosure, and
  unchanged for every account that already exists. And **`/account` can now
  actually add one to a wallet account** (`linkEmail` + Firebase
  `linkWithCredential`), which is what makes leaving email off the door honest
  rather than a one-way door: a seed phrase is the one credential nobody can
  reset for you, so the recovery path has to exist before it's needed. Additive —
  the wallet keeps signing you in exactly as before
- **Email verification no longer blocks a member who never gave an email.** The
  claim gate now checks it only on accounts that have one; the gates doing the
  real work are unchanged — a verified wallet to be paid into, a verified Twitch
  channel to put on air (`claimSlot.ts` + `slotModel.ts`, mirrored as always)
- **The Twitch redirect returns you to where you started.** It was hardcoded to
  come back to `/?auth=register`, so every Twitch round trip ended on the home
  page with the sign-up modal open. Mid-sign-up that was merely abrupt; linking
  Twitch from `/account` it was a **bug** — you landed on the home page being
  asked to join a network you were already in, and the code that completes the
  link never ran, so the link silently didn't happen. The destination and the
  intent now travel with the round trip (`lib/authReturn.ts`, same-origin paths
  only), failures route through the same landing page as successes so an error
  surfaces where you started, and on the wallet path there is nothing to re-enter
  on the way back
- **`/player` no longer tries to carry video from X — deliberately.** X's
  broadcast permalink can't be embedded at all (`frame-ancestors 'self'`), and
  the post embed that *can* be rendered starts muted with no unmute API for the
  parent page, so sound would depend on a human making an OBS **Interact** click
  every session. A 24/7 network that goes silent when nobody's watching the
  console is worse than one that doesn't try. **Take the streamer's original
  Twitch / Kick / YouTube feed**, which plays with audio and full live detection
- **X links are still recognised, so they fail visibly instead of silently.** An
  X URL reaching a slot (legacy data, a hand-edited URL, an emergency override)
  gets a branded "Live on X" card billing the streamer and the hour, rather than
  parsing as nothing and dropping the booked hour onto the intermission board.
  X is not offered as a bookable source, and both the assign modal and the
  per-slot stream-URL override warn the moment one is pasted. Rehearse the card
  with `/player?preview=x`; the reasoning is in
  [`docs/obs-setup.md`](docs/ops/obs-setup.md) §4b
- **Link previews exist.** This project gets shared by being pasted into X,
  Telegram and Discord, and every one of those paste-ins rendered as a bare blue
  URL: no `og:image`, no `og:url`, no `twitter:card`. There's now a real 1200×630
  card served from our own origin, full Open Graph + Twitter meta, a title and
  description that say what CSGN actually is, plus `robots.txt` and a sitemap
  (with `/player` excluded — an encoder surface with no navigation has no
  business ranking on a brand search)
- **Password managers can fill the sign-up form.** Not one input in the app had
  an `autoComplete` attribute, so autofill silently did nothing on the two forms
  that most needed it. Email, username and new/current password are all annotated
  now, along with `aria-label`s on the icon-only controls
- **Vendor code is split from app code.** Routes were already lazy, so the 785KB
  entry chunk was almost entirely libraries — meaning a one-line copy change
  re-shipped ~250KB gzipped of React, Firebase and Framer Motion with a fresh
  hash. They're separate chunks now, so a normal deploy invalidates the small app
  chunk and returning visitors keep the rest from cache. Same bytes on a cold
  visit; far fewer on every one after

### v1.20 — August 2026
- New **[`docs/design/the-denominator.md`](docs/design/the-denominator.md)** — **$CSGN as the asset other tokens are priced in.** Follows the StonkFun model (fixed supply, one-sided permanently-locked Raydium market, any custom quote token, reflections paid in the quote asset) demonstrated by MANLET × ANSEM, and identifies the differentiator nobody can copy: CSGN's quote asset is redeemable for television. A project that quotes in $CSGN has buyers who acquire airtime and holders whose reflections pay in expiring in-kind access rather than money — which is also the securities-safer version of the 2026 reflections meta. Adds **the Airtime Standard** (every price quoted in screen-seconds, making the token a unit of account), **show tokens** backed by a Proof-of-Broadcast-verified slot, a build order, and the risks stated before anyone signs up — reputational coupling above all. Explicitly refuses a second CSGN token. Three primary sources were unreachable from the authoring environment; the parameters that must be confirmed before building are listed rather than guessed
- **[`docs/design/the-grid.md`](docs/design/the-grid.md) §8.2 corrected.** The doc described $ANSEM as having "no product, no roadmap and no revenue" — accurate to June reporting, **no longer true**. It is building an on-chain liquidity and index layer for creator ecosystems (automated LP pods, a Bull Index staking vault distributing real trading fees, curated deployments, ATH around $450M). The retraction is left visible and the partner argument re-framed from "we'd be its first mechanism" to "a distribution layer offered to a liquidity layer". Also recorded: the token was **not** launched or endorsed by Ansem himself, which makes the disclosure rule load-bearing
- **New §12 in the-grid.md** — the Grid's rule (*a fixed resource, divided by the cap table, expiring daily*) applied to five more surfaces: ticker rotations, **the Chyron Question** (*"your bag asks the questions"* — the one to build, and nearly free since the Right Now rail is already a gated viewer-writable pipeline), Meme 100 seats, the credits, and the guest chair
- New **[`docs/show-bible.md`](docs/show-bible.md)** — the nightly 7 PM–3 AM block, hour by hour. Eight named segments alternating peak and recovery energy, a weekly grid with three interviews rather than seven, segment beats so no hour starts blank, and a **pre-committed burnout tripwire** (miss the 7 PM open three times in 30 days and the block contracts automatically). Documents the graphics that **do not exist and block interviews** — no guest lower third and, critically, **no take button**; the shipped lower thirds rotate on a fixed 3-minute timer — plus the interim workaround using `config/ticker.chyron`. Specifies `config/showControl`, a Control Room admin tab, and four browser sources, and the full **comic-book host rig**: ink line, halftone, panel borders that change by segment, mouth flap from mic amplitude, hotkey expressions and SFX lettering, driven locally for sub-100ms latency. Answers the dox question — no, with four conditions
- New **[`docs/x-playbook.md`](docs/x-playbook.md)** — the founder's account run as a system: a **70-minute daily budget** reconciled against a 56-hour streaming week, four follow/reply tiers with **procedures for building them rather than invented handles** (the CSGN Set from the ratings book doubles as Tier B), the **Scoreboard Reply** named as the single highest-leverage daily habit, six post formats with templates, timing built around an inverted schedule, a weekly scoreboard and pre-committed kill criteria
- **Path repair and one contradiction fixed.** Prose and code samples still pointing at `docs/obs/…` after the reorganisation now point at `docs/ops/obs/…`; archived docs left verbatim by the archive rule. `docs/ops/obs/README.md`'s quick-start table told operators to enable "Shutdown source when not visible" and "Refresh browser when scene becomes active", contradicting its own §4.1/§4.3/§4.4 and `obs-setup.md` — both must be off, and the table is corrected with a note

### v1.21 — August 2026
- New **[`docs/shows.md`](docs/shows.md)** — **the rundown bible.** THE OPEN beat by beat, the 8 PM rotation (Mailbag / three interviews a week, never seven / Film Room), and a **twelve-format segment library** deep enough to run cold on the worst night of the month. Defines the **clip beats** — 7:20, 11:15, 1:50, two clean minutes each — so three reels a day are a byproduct of the broadcast rather than a second job. Closes with how the information battle is actually won: never dunk without a number, publish the prediction record including the bad months, and be the scoreboard rather than another voice
- New **[`docs/design/graphics-package.md`](docs/design/graphics-package.md)** — the show's on-air look as **four mode-driven browser sources**, not sixteen files: `csgn-showbar` (the take-able lower third and guest ID that do not exist today), `csgn-fullframe` (twelve card modes including MATCHUP, TOP25, TIER and TALE OF THE TAPE), `csgn-bug` (bug + the missing ET clock + the referral lockup) and `csgn-clip` (the 9:16 kit). Brand tokens are quoted from source rather than invented, the broadcast palette wins where it forks from the web, and the package runs on a sub-second `onSnapshot` listener because a take button on a 6-second poll is not a take button. **Explicitly a separate system from the ticker** — different files, different control doc, no shared state
- **The Bullpen referral lockup ships with a permanent visible `REFERRAL` tag.** FTC guidance requires a clear and conspicuous disclosure near the link whenever money changes hands on a click; crypto endorsements draw heightened scrutiny; and "not financial advice" does not cure an undisclosed commission. It is the same standard the Coin Jukebox already enforces automatically with `PAID SPOTLIGHT`, and it is a compliance requirement rather than a design choice
- New **[`docs/design/ticker-football.md`](docs/design/ticker-football.md)** — the BottomLine's football upgrade. Football is currently a **two-field feature** (`{dd, redZone}` plus a possession side) against baseball's five data structures and two bespoke faces, while **rank, odds, timeouts, last play, line score and conference records all arrive on the ESPN endpoint already being called** and are discarded. Three real bugs documented: the possession dot shifts both team abbreviations ~23px every change of possession because it has no reserved slot; it never turns red in the red zone despite the file's own header comment saying it does; and a 60-game CFB Saturday locks the band for 7–11 minutes while `MAX_SECDOTS = 14` silently stops the progress row tracking past item 14. New situational data goes into the **130px of unused headroom** as a Situation Strip, because the status cell is already ~9px over its 92px box. Betting lines render as market context, never as picks
- New **[`docs/the-runup.md`](docs/the-runup.md)** — Aug 10 → Sep 5, with a correction: **college football does not start on Sep 5.** Week 0 is **Sat Aug 29** and Week 1 opens **Thu Sep 3**, so football is ~19 days out, not 26. The **AP Preseason Top 25 at noon ET on Aug 17** is the quarter's first hard graphics deadline, fantasy draft season runs Aug 23 – Sep 3, and August being the deadest month in American sports is the opening rather than the problem. Four weeks with tentpoles, build deadlines in date order, honest Sep 5 milestones and kill criteria
- **STONK / the denominator play is relegated, not cancelled.** Not a build this quarter — the host suggests it on air and viewers can launch tokens quoted against $CSGN themselves, so whether it happens is decided by popularity rather than by a roadmap. The design stands where it is
