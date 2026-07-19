# CSGN Internal Operating Spec & 30-Day Plan

> Owner: founder-operator (solo). Status: working document, July 2026.
> Ground rule for this doc: anything marked **Built** is verified against this repo
> (file paths cited). Everything else is **Planned** and says so. No hype filler.

---

## 1. Core Strategy (one page)

**Thesis.** CSGN is the 24/7 crypto-native broadcast network — the ESPN and TMZ of
crypto — streamed to X via a single OBS encoder capturing `/player`. Content creates
trading volume; the on-chain fee engine routes a share of that volume to whoever is on
screen. No other platform ties streamer pay to on-chain mechanics this directly.

**The flywheel.**

```
Programming → Attention → $CSGN volume → On-chain creator fees → Creators want slots
     ▲                                                                    │
     └──────────────── more/better programming ◄──────────────────────────┘
```

Every turn of the wheel starts with programming. That is why the operating priority is
content cadence, not marketplace mechanics.

**Anchor tenant first.** The creator slot marketplace opens only after CSGN's own
stream has an audience. Reasons:

- A marketplace with no viewers is a dead mall — creators who claim a slot and stream
  to zero never come back. The founder's own show is the anchor tenant that makes the
  real estate worth claiming.
- The repo already reflects this: every slot currently instantiates as **CEO Creator**
  (curated, admin-assigned). The quadratic auction machinery (`placeBid`,
  `getMinimumBid`, `resolveAuction`) is **built but switched off** — a one-line revert
  flagged as an operator directive in `src/lib/slots.ts`. Reopening auctions is a
  decision gate (Section 4), not an engineering project.
- Solo-founder math: one person cannot simultaneously bootstrap supply (creators) and
  demand (viewers). Grow demand with owned content; supply follows the fee checks.

**What is already true in this repo (Built).**

| Capability | Where |
|---|---|
| 24/7 master-control state machine (LIVE / STARTING_SOON / BRB / INTERMISSION / OVERRIDE), unit-tested pure reducer | `src/lib/masterControl.ts`, `src/pages/Player.test.tsx` |
| Server-verified live detection (Twitch Helix, once/min) that rescues flaky embed events | `masterControl.ts` (`serverLiveSignal`), fee poller |
| Intermission VOD rotation + animated network board with "claim this slot" billboard | `src/components/player/VodRotator.tsx`, `IntermissionBoard.tsx` |
| Brand wipe on every state change | `src/components/ui/WipeOverlay.tsx` |
| Slot grid (12×2h/day, ET, DST-aware), claims, admin assignment, CEO Creator branding | `src/lib/slots.ts` |
| Creator fee engine: PumpSwap 25-tier market-cap schedule, DexScreener-backed, Helix live-minute verification, admin payout workflow | fee poller + `CreatorFees`/`StreamActivity` in `slots.ts` |
| $CSGN token (Solana, pump.fun mint `GFV7…pump`), live token panel + tokenStats pipeline (4 DexScreener calls/min, scale-invariant) | README, `LiveSlotContext` |
| OBS→X broadcast stack, preroll-ad shield, sports+crypto ticker band | `docs/obs-setup.md`, `docs/obs/csgn-ticker.html` |

**Operating constraint.** One founder-operator. Every plan line below must be
executable by one person on a nightly-show schedule. Anything that can't be is cut or
automated.

---

## 2. Content Operation

### 2.1 Flagship: the nightly 8pm ET show

Crypto/entertainment whip-around, live nightly at 8:00 PM ET on the existing CEO block
(7 PM–3 AM slots). Presented either on-camera or via a **V-tuber persona** — decide by
end of week 1 and do not switch after; the persona is a brand asset only if consistent.
V-tuber upside: no face-cam fatigue, mask-friendly for a founder also running admin,
strong fit with the 18–34 crypto-Twitter demo. Cost: rig setup time in week 1.

Standing rundown (60–90 min, built for clipping):

| Beat | Length | Notes |
|---|---|---|
| Cold open: the day's #1 story | 3–5 min | Written punchy; this is the clip |
| Market whip-around | 10–15 min | Ticker band on screen; $CSGN panel beat |
| Drama desk (TMZ segment) | 10–15 min | Sourced from newsroom Discord (2.3) |
| Guest / space raid / reply-section review | 15–30 min | Flexible middle |
| "The stage is open" | 2 min | On-air pitch of tomorrow's open slots |
| Sign-off + up next | 2 min | Hands off to VOD wheel (Section 3) |

Every segment boundary is a natural clip cut. The rundown is the clip engine's input
format, not just a show plan.

### 2.2 VOD pipeline: ~10 informal hours → ~2 strong hours

- Founder streams ~10 additional informal hours/week (games, markets, hangouts).
- Founder edits natively himself, cutting those down to **~2 strong hours of VOD per
  week**. These 2 hours are the network's rerun inventory (Section 3 tiers) — treat
  them as produced assets: titled, thumbnailed, tagged with series.
- **AI clip engine (planned, week 1):** AI tools cut short-form clips from flagship +
  informal streams; founder approves and distributes to **X, TikTok, YouTube Shorts,
  Instagram Reels**. Operating cadence commitment (a floor we set, not a market
  number): at least 1 clip/day cross-posted to all four, clustered around 8pm ET and
  US lunchtime. X clips always link the live broadcast post; all clips end on the
  claim-a-slot CTA frame.
- Weekly batch rhythm: edit Sunday/Monday daytime (lightest news days), bank the 2 VOD
  hours + a clip buffer so the pipeline survives a heavy news week.

### 2.3 Newsroom Discord (planned, week 2)

Purpose: be early on every story, drama, and reply-section moment relevant to an 18–34
male crypto-Twitter demo, across crypto / sports / entertainment / gaming. The Discord
is both a tip line and the first community surface.

| Channel | Feed |
|---|---|
| `#wire-crypto`, `#wire-sports`, `#wire-ent`, `#wire-gaming` | Bot-piped RSS/X keyword feeds per vertical |
| `#breaking` | Human-flagged "this goes on air tonight" — founder + trusted mods |
| `#drama-desk` | Screenshots, reply-section finds, CT beef tracking |
| `#clips` | Auto-post of every published clip (members amplify) |
| `#show-rundown` | Tonight's rundown draft; members react-vote segments |
| `#stage-door` | Slot-claim interest → funnels to csgn.fun/queue |

Automation: standard webhook/RSS bots on day one; alerting keyed to velocity (an
account the desk tracks posting + engagement spike) rather than volume. Recruit 2–3
volunteer mods from earliest actives; the Discord is how a solo founder gets a
newsroom without payroll.

### 2.4 Weekly output contract (the founder's non-negotiables)

7 flagship shows, 2 strong VOD hours banked, ≥7 clips distributed, 1 rundown/day in
Discord. Everything else flexes around these four.

---

## 3. The 24/7 VOD Broadcast System — Product Spec

**Vision (founder, formalized).** VOD is critical for any channel. CSGN gets a backend
VOD system that prioritizes the most critical content, allows scheduling, runs a
shuffle algorithm over a rerun class, and a frontend broadcast logic that breaks in and
out of VOD as needed — a streamer claiming a block cuts in; a streamer going offline 5+
minutes returns the network to the previous VOD **with position memory**; viewers are
told clearly what is happening via branded transitions at **every** state change; and
the "Claim Here" screen periodically reigns supreme for ~15 minutes, more often
overnight. Specials (the National Anthem nightly at 3:59–4:00 AM ET) and, over time,
series-aware programming make CSGN entertaining even if nothing else were broadcast.
The founder's 24/7 VOD schedule lives in his admin console; the break-in/out logic
lives in the broadcast system and is visually handled in all scenarios.

**Design principles.** (1) LIVE always outranks VOD — the machine's existing contract.
(2) The viewer always knows what is happening — a labeled transition at every change.
(3) Restart-proof: OBS hard-reloads `/player` (watchdog script reloads the source
every ~12h per `docs/obs-setup.md` §8), so **all program state persists in Firestore,
never in component memory**. (4) Never a dead screen — on any error, fall through to
the shuffle pool, then the board (VodRotator's auto-advance ethos, kept).

### 3.1 Content tiers

| Tier | What | Scheduling | Examples |
|---|---|---|---|
| **Priority / Scheduled** | Must-air at a set time | Fixed grid entries | Flagship replay block, event coverage |
| **Series** | Episodic sets aired in order | Grid entries pointing at a series, auto-advancing episodes | Flagship archive, informal game-stream series |
| **Rerun shuffle pool** | Evergreen strong cuts | Fills all unscheduled time via seeded shuffle with a no-repeat window (don't re-air an item within N hours; N admin-tunable) | The weekly 2 strong hours, promos |
| **Specials** | Fixed-time cues | Clock-triggered, preempt VOD (never a live streamer) | **National Anthem 3:59–4:00 AM ET nightly** |
| **Claim takeover** | "Claim Here" billboard reigns alone | ~15 min windows (founder spec), frequency weighted per daypart, heavier overnight | OpenStagePanel, fullscreen |

### 3.2 Data model (Planned — all new Firestore docs, same patterns as existing config docs)

- `vod/items/{id}` — `{url, title, tier, seriesId?, episode?, durationSec, active}`
- `config/vodSchedule` — the week grid: `[{day, startET, endET, entry}]` where entry is
  an itemId, a seriesId, `shuffle`, or `takeover`. ET/DST math reuses the proven
  `etToUTC` helpers in `src/lib/slots.ts`.
- `playback/vodState` — server-persisted playhead: `{itemId, positionSec, updatedAt,
  interruptedBy?}`. Written on interval while a VOD plays and on every break-in.
- `config/vodProgramming` — knobs: shuffle no-repeat window, takeover duration
  (default 15 min) and per-daypart frequency (proposed defaults: once per 2h daytime,
  once per hour in the overnight block — admin-tunable, not gospel), specials list.
- Series pointers — `{seriesId: lastAiredEpisode}` for auto-advance.

### 3.3 Admin console (Planned)

Extend the existing Admin **Intermission VOD Playlist** editor (`src/pages/Admin.tsx`,
`config/vodPlaylist`) into a VOD tab: item library CRUD, week schedule grid (mirroring
the slot-template mental model admins already have), specials list, takeover knobs, and
a "what's on now / next" preview. Same `setDoc` + `onSnapshot` control pattern as the
emergency override and current playlist — no new infrastructure.

### 3.4 Break-in / break-out state logic (extension of `masterControl.ts`)

The five master states are untouched. The VOD system is a **Program Director** module
that decides what INTERMISSION renders — a pure, unit-testable function
`(nowMs, schedule, playhead, pool, seriesPointers, config) → ProgramDecision`, in the
same style as the `masterControl` reducer and `feedGate`. Master control decides *if*
we're in network programming; the Program Director decides *what* the programming is.

| Scenario | Today (Built) | Target behavior (Planned delta) |
|---|---|---|
| Streamer claims a block while VOD is running | `BROADCAST_CHANGED (source: slot)` → STARTING_SOON card (max 10 min) → LIVE on any of four live signals | Same transition, plus: persist playhead with `interruptedBy: slotId` on INTERMISSION exit; transition slate names the incoming streamer |
| Streamer offline 5+ min mid-slot | LIVE → BRB card (120s grace) → INTERMISSION restarts the rotation from scratch | Keep 120s BRB card; minutes 2–5 hold on the board with a "{name} will be right back" line; at **5 min offline** (founder spec) resume the interrupted VOD **at its saved position** under a "Resuming: {title}" slate. Reconnect at any point cuts straight back via existing PLAYER_ONLINE / Helix rescue (Built) |
| Every state change | Brand wipe (`WipeOverlay`) fires on master-state changes | Also fire on intra-INTERMISSION program changes (VOD→VOD, VOD→takeover, VOD→special), each with a labeled slate saying what's happening — the founder's explicit requirement |
| "Claim Here" takeover | OpenStagePanel alternates in the board carousel (~half of intermission screen time) | Scheduled exclusive windows: the billboard reigns alone ~15 min, more often overnight; schedule grid emits `takeover` entries |
| Special at a fixed time | Nothing | Clock cue preempts any VOD at its time (Anthem 3:59 AM ET). LIVE always wins: if a streamer is live, the special is skipped and logged — consistent with the repo's "no interference over a LIVE feed" rule |
| Series episode ends | VodRotator advances sequentially, index lost on reload | Program Director advances the series pointer in Firestore; next boot resumes the right episode |

**Critical implementation note:** today's `VodRotator` keeps its index in React state —
an OBS reload restarts the rotation and forgets position. Position memory is only real
if the playhead lives in `playback/vodState` (see recommendation R1, Section 4).

### 3.5 Phased build (each phase shippable; phases 1–3 need no new backend services)

| Phase | Ships | Exists today (Built) | New |
|---|---|---|---|
| **1 — Scheduled playlist + resume** | Item library, week grid, playhead persistence, resume-after-interrupt, labeled transition slates | `VodRotator`, `config/vodPlaylist` + Admin editor, `WipeOverlay`, `LiveSlotContext`, masterControl INTERMISSION + STARTING_SOON handoff, BRB grace | `vod/items`, `config/vodSchedule`, `playback/vodState`, Program Director v1, slate components |
| **2 — Shuffle pool + specials** | Seeded no-repeat shuffle for the rerun class; fixed-time specials incl. National Anthem (DST-aware) | ET/DST helpers in `slots.ts`; clock TICK plumbing in `/player` | Shuffle algorithm + last-aired tracking, specials cue engine, `config/vodProgramming` |
| **3 — Series programming + claim takeovers** | Series auto-advance, flagship/informal series strips, exclusive ~15-min "Claim Here" windows weighted overnight, program-aware "Up Next" board panels | `IntermissionBoard` OpenStagePanel + Up Next panels, slot grid dayparts | Series pointers, takeover scheduler + weights, board integration |

**Acceptance tests (phase 1):** kill the OBS browser source mid-VOD → on reload,
`/player` resumes the same item within a few seconds of the saved position; claim a
slot mid-VOD → STARTING_SOON slate names the streamer and the playhead is saved; take
the streamer offline → BRB at 0–2 min, return messaging 2–5 min, VOD resumed at 5 min
with slate; streamer reconnects at minute 7 → cut back to LIVE, playhead re-saved.

---

## 4. 30-Day Plan

Two tracks. **Track A is the base case and runs regardless.** Track B is additive —
everything in A plus the Ansem partnership motion. One founder executes both only
because B is mostly conversations and config, not builds.

### Track A — Without Ansem (base case)

| Week | Ship |
|---|---|
| **1** | Flagship live nightly at 8pm ET from day 1 (V-tuber decision made day 1–2). Clip engine live: AI cutting + founder approval + 4-platform distribution at the daily floor. OBS/X per-session ritual tightened (`docs/obs-setup.md` §4). Ticker band on air. Baselines captured for every KPI |
| **2** | Newsroom Discord launched (channels + bots per 2.3), promoted on-air nightly. VOD Phase 1 build (item library, schedule grid, playhead persistence). First 2 strong VOD hours banked and tagged |
| **3** | **VOD wheel v1 on air** (Phase 1 live: scheduled blocks + resume + slates). Graphics polish: Bug + clock overlay, then lower thirds — phases 1–2 of `docs/broadcast-graphics.md`, the two highest "looks pro per hour of work" items. Recruit 2–3 Discord mods |
| **4** | VOD Phase 2 (shuffle pool + National Anthem special). Growth-loop review against baselines; double down on the clip formats that moved followers. First curated guest slots (CEO-assigned) to rehearse the marketplace motion. Day-30 gate review (below) |

### Track B — With Ansem (additive)

Pitch: **"ANSEM on CSGN"** — a co-branded **12-hour/day daypart** (six contiguous
2-hour slots in the existing grid), structured as a **90-day pilot**: defined windows,
content standards, mutual promotion, clip rights, and exit terms in writing. $ANSEM
(Solana, live DexScreener pair) gets ticker presence and an on-air coin spotlight;
holders get **utility/access only** — badges, gated slot claims, gated segments/AMAs.
**No holder payouts, no revenue share, nothing yield-like, without securities counsel.**

| Week | Additive moves |
|---|---|
| **1** | Pitch sent (DM + one-pager). The pitch's proof is the working product: live network, fee engine, slot grid, ticker |
| **2** | Pilot terms negotiated and papered lightweight: daypart windows, standards (what gets a channel cut), promo cadence both ways, clip rights (CSGN clips freely from daypart content; Ansem side reciprocal), 90-day term, either-party exit |
| **3** | Integration: $ANSEM added to the ticker's curated rotation (file-level `CONFIG` edit in `docs/obs/csgn-ticker.html` — hours, not days) and a dedicated spotlight segment. The **admin-driven Firestore coin spotlight** is Planned (the ticker phase of `docs/broadcast-graphics.md` §5/§7) — this deal is its forcing function. $ANSEM stats panel follows the existing `tokenStats` poller pattern (second pair poll — Planned). Dry-run the daypart with slates + lower thirds |
| **4** | Daypart live. Co-marketing: cross-announcements, clip exchange, holders' first gated segment. Pilot KPIs reported weekly to both sides |

### Decision gates

| Gate | When | Rule |
|---|---|---|
| **G1 — Ansem reply** | Day 14 | No reply → proceed pure Track A **and** pitch 2–3 alternative CT personalities the identical daypart template. The template (windows/standards/promo/clip-rights/exit + ticker/spotlight/slot rails) is the asset; the name is swappable |
| **G2 — VOD v1 scope** | Day 21 | Phase 1 not shippable → cut to resume-only (playhead persistence + slates), defer the grid a week. Resume is the viewer-trust feature; never ship the grid without it |
| **G3 — Marketplace** | Day 30 | Auctions stay OFF (the `slots.ts` toggle stays on forced-CEO) unless live-concurrent and claim-interest baselines from W1–W2 clear thresholds set at this review. No threshold, no marketplace |
| **G4 — Anthem/specials** | With Phase 2 only | Don't hand-schedule specials before the cue engine exists; one-off manual stunts OK |

### Weekly KPI grid (all measurable by one person: X analytics, X Media Studio, Discord insights, Admin panel/Firestore)

| KPI | Source | W1 | W2 | W3 | W4 |
|---|---|---|---|---|---|
| Flagship shows shipped | Calendar | 7/7 | 7/7 | 7/7 | 7/7 |
| Strong VOD hours banked | Edit log | 2 | 2 | 2 | 2 |
| Clips posted (all platforms) | Platform dashboards | ≥7 (floor) | ≥7 | ≥7, best-format weighted | ≥7 |
| @CSGNet follower delta | X analytics | baseline | > W1 | > W2 | > W3 |
| Live concurrents (peak / median) | Media Studio | baseline | > W1 | > W2 | > W3 |
| Discord members / weekly actives | Discord insights | — | baseline | > W2 | > W3 |
| Slot claims by non-founder streamers | Admin / Firestore slots | track | track | ≥1 curated guest | ≥2, feeds G3 |
| (Track B) pilot milestones | This doc | pitch sent | terms agreed | integration live | daypart live |

Baseline-relative targets are deliberate: with no audience history, invented absolute
targets would be theater. Week 1 exists to make weeks 2–4 honest.

### The three sharpest calls in this plan

- **R1 — Persist the playhead server-side or don't ship VOD v1.** The encoder
  hard-reloads `/player` by design; component-state position memory is fake memory.
  `playback/vodState` in Firestore (the same pattern as every other CSGN control doc)
  is what makes "resuming previous VOD" a promise the network keeps.
- **R2 — The daypart template is the asset, not the Ansem name.** Utility-only, 90-day
  pilot, on rails that already exist (slots, ticker config, tokenStats pattern,
  override). Marginal integration cost ≈ config; exit cost ≈ zero code debt. If G1
  fires, the same paper goes to the next 2–3 personalities within days.
- **R3 — Keep auctions off and spend everything on clips.** The marketplace toggle is
  one line; flipping it early would burn arriving creators on empty rooms. The 2
  strong VOD hours → daily clips → claim-CTA loop is the only scalable top-of-funnel
  a solo founder has, and overnight "Claim Here" takeovers turn dead air into the
  marketplace's own ad inventory.

---

## 5. Risks & Mitigations

| Risk | Why real | Mitigation |
|---|---|---|
| **Solo-founder cadence** — one illness/burnout week breaks "nightly" | Everything routes through one person | The VOD system *is* the mitigation: the network stays alive and on-brand unmanned. Batch edit days; clip buffer banked; rundown template cuts prep; V-tuber option reduces on-camera fatigue; Discord mods absorb newsroom load |
| **Platform dependency** — X (broadcast + audience), Twitch (embeds/ads), pump.fun/DexScreener/CoinGecko (data), Netlify/Firebase (infra) | Any one can change terms overnight | Multi-platform clip distribution builds off-X audience; Discord is the owned fallback surface; own-ingest RTMP is the documented endgame (`docs/broadcast-graphics.md` §4) removing the Twitch ad/embed surface; data sources already server-proxied behind one poller, swappable in one place |
| **Token / legal** — $CSGN and any partner token invite securities scrutiny | Fee flows + token promotion on a broadcast | Streamer creator fees are payment for services rendered on-screen — keep that framing tight. Holder benefits stay **utility/access only**; no payouts, rev-share, or yield language without counsel — hard line in every partner term sheet. On-air disclosure norms for held/partner tokens (TMZ energy, not investment advice) |
| **Cold start** — no audience, no claimants, empty-room risk | Every network starts at zero | Anchor-tenant strategy (Section 1); auctions gated behind G3; curated CEO guest slots rehearse supply; takeover windows + every clip's claim CTA keep the funnel filled before the marketplace opens |
| **Broadcast integrity** — ads/dead frames/frozen feeds on a 24/7 unattended encoder | Reputation is the product | Largely Built: FeedGate preroll shield, quality pin, wedge rebuild, Helix ground truth, watchdog reload (`docs/obs-setup.md`); VOD spec adds never-dead-screen fallbacks and restart-proof state |
| **Partner-content brand safety** | A 12h co-branded daypart airs content CSGN doesn't produce | Content standards + immediate-cut rights in the pilot paper; emergency OVERRIDE state (Built) is the kill switch; clip rights let CSGN control the highlight narrative |

---

*Cross-references: `README.md` (product + changelog), `src/lib/masterControl.ts`,
`src/lib/slots.ts`, `src/components/player/VodRotator.tsx` / `IntermissionBoard.tsx`,
`docs/obs-setup.md`, `docs/broadcast-graphics.md`.*
