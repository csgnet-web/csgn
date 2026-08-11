# Decision log

**Append-only.** One row per decision that changed the shape of the product, the token,
the money, or the documentation. Newest at the bottom.

The rule: **never edit a past entry.** If a decision is reversed, append the reversal with
a pointer back. A log you can rewrite is not a log — and this file exists so that
superseding a document costs one line instead of an archaeology session.

**What belongs here:** anything that would make a future reader ask *"why is it like
this?"* — a mechanism chosen over an alternative, a number set, a doc superseded, a dial
moved, a risk knowingly accepted. **What doesn't:** ordinary shipping. That is
[`../CHANGELOG.md`](../CHANGELOG.md).

**Format:** `YYYY-MM-DD · area · the decision · where it lives.`

---

## 2026-08

**2026-08-10 · docs · The repository is reorganised into plan / design / ops / archive.**
Twenty documents and ~7,300 lines had grown four separate claims to being authoritative.
Now: [`plan.md`](plan.md) is the operating document, [`design/`](design) holds the specs,
[`ops/`](ops) holds the runbooks, and [`archive/`](archive) holds everything superseded,
verbatim, with a header saying what replaced it. Everything moved with `git mv` so history
follows the file. Nothing was deleted, merged or rewritten.
→ [`archive/README.md`](archive/README.md)

**2026-08-10 · docs · The changelog moves out of `README.md` into `CHANGELOG.md`.**
The root README was 588 lines, of which ~335 were version history, which meant the file
that introduces the project buried the introduction. Moved verbatim; README rebuilt at
~160 lines.
→ [`../CHANGELOG.md`](../CHANGELOG.md)

**2026-08-10 · token · The token's problem is re-diagnosed as spend-side, not
under-utilised.** Adding uses for $CSGN was making the velocity problem worse, not better.
The fix is a change of kind: **ration by stock, don't price by flow.** This supersedes
`master-plan.md` §5 and `onchain-thesis.md` §6 on token design.
→ [`design/token-economics.md`](design/token-economics.md) §1

**2026-08-10 · product · The 16 open hours (3 AM – 7 PM ET) are allocated 1:1 to $CSGN
supply share, daily.** 57,600 seconds; 1% of supply programs 576 of them. Holders become
Producers and fill their seconds with video. This is simultaneously the token mechanism
and the answer to an empty schedule. The 7 PM – 3 AM Originals block is untouched.
→ [`design/the-grid.md`](design/the-grid.md)

**2026-08-10 · product · Live always supplants the Grid, and supplanted seconds roll
over.** The Grid is the floor of the schedule, never the ceiling. Claiming a slot displaces
programming rather than filling a hole, and Producers are made whole (capped at 2×) so the
two halves of the network are never set against each other.
→ [`design/the-grid.md`](design/the-grid.md) §3

**2026-08-10 · product · Quality is enforced by a ratings ladder, not by an editor.**
*Ownership buys you minutes; ratings buy you primetime.* Supply share sets how many
seconds you get; trailing CSGN Share sets which daypart they land in. A whale with bad
content self-relegates to 4 AM without anyone making a judgement call. The ladder stays
off until there are four weeks of share data.
→ [`design/the-grid.md`](design/the-grid.md) §4

**2026-08-10 · growth · The 50-contributor bar becomes a public countdown — the Charter
50.** The cold-start problem is converted into the campaign's narrative arc. Permanent
badge, permanent credit, unbuyable after the fiftieth.
→ [`design/the-grid.md`](design/the-grid.md) §5, [`plan.md`](plan.md) §1.2

**2026-08-10 · product · Community video is links first; uploads wait for Charter 50.**
V1 accepts an already-hosted URL and reuses `VodRotator` and the existing forwarding path —
zero hosting cost, no new vendor. Direct upload ships once fifty contributors have proved
the demand; a linear channel delivers each video once regardless of audience, so playout is
a sub-$100/month line item when it arrives.
→ [`design/the-grid.md`](design/the-grid.md) §6

**2026-08-10 · partner · Partner Day is a config toggle over any mint, with $ANSEM as
tenant #1 — built, dark, and demoed rather than pitched.** The only mint-specific code is
the balance read. It ships configured and switched off; it goes live when the partner nods.
The argument is that **holdings-rationed utility creates only buy pressure**, because
nothing is ever spent. Refusal list from `master-plan.md` §11.5 carries over unchanged.
→ [`design/the-grid.md`](design/the-grid.md) §8

**2026-08-10 · token · Finding: purses, fees and gates are denominated in tokens, which
makes them floating dollar liabilities.** They are live-tunable, so this is a wrong-unit
problem rather than a hardcoding problem — but staying correct requires a human to notice,
and nothing fails loudly. Recommendation is to denominate in supply share or dollars and
resolve to tokens at settlement. **Not yet actioned in code.**
→ [`design/token-economics.md`](design/token-economics.md) §6

**2026-08-10 · token · The existing "open-market buys to pay creators" promise is named,
ruled and published as the Airtime Buyback.** Percentage of cash revenue, cadence, cap,
wallet, transaction links, monthly report. Rules-based and reported, because ad hoc
buybacks are discounted by the market. The no-burn doctrine is untouched.
→ [`design/token-economics.md`](design/token-economics.md) §5.1

**2026-08-10 · growth · Short-form moves to P0; X is demoted to the credibility engine.**
Replies do not produce ~72 net followers a day at this account size and algorithmic
distribution does. 3 clips/day rising to 5, from video the network already produces and
currently discards.
→ [`plan.md`](plan.md) §1.1

**2026-08-10 · legal · The first layer is deliberately built on the access side of the
line.** Grid seconds are non-transferable, expiring and never redeemable for cash; Airtime
Yield is a disclosure, not a distribution. Transferable airtime, futures, prediction
markets and a streamer index are designed but sequenced behind counsel, so they remain an
option rather than a dependency.
→ [`design/token-economics.md`](design/token-economics.md) §7

**2026-08-10 · correction · $ANSEM was described as having "no product, no roadmap and no
revenue." That is no longer accurate and the claim is retracted.** It reflected June-2026
reporting. As of August it is building an on-chain liquidity and index layer for creator
ecosystems — automated LP pods, a Bull Index staking vault distributing real trading fees,
curated deployments with $ANSEM as deployment #1, ATH around $450M. The partner argument is
re-framed from "we'd be its first mechanism" to "a distribution layer offered to a liquidity
layer." Also recorded: reporting is explicit the token was **not** launched or endorsed by
Ansem himself, which makes the disclosure rule load-bearing rather than boilerplate.
→ [`design/the-grid.md`](design/the-grid.md) §8.2

**2026-08-10 · token · $CSGN becomes a denominator — the asset other tokens are quoted
against — rather than a tenant on someone else's surface.** Follows the StonkFun model
(fixed supply, one-sided locked liquidity, any custom quote token, reflections paid in the
quote asset) demonstrated by MANLET × ANSEM. CSGN's differentiator is that its quote asset
is redeemable for television: their buyers acquire airtime, and their reflections pay in
expiring in-kind access rather than money — which is also the securities-safer version of
the 2026 reflections meta. **Explicitly rejected: launching a second CSGN token.**
→ [`design/the-denominator.md`](design/the-denominator.md)

**2026-08-10 · token · Prices across the ecosystem will be quoted in screen-seconds — the
Airtime Standard.** Unit-of-account is the strongest form of monetary demand and almost no
token has it. It renders on hardware that already exists (`config/ticker.chyron`).
→ [`design/the-denominator.md`](design/the-denominator.md) §4

**2026-08-10 · product · The Grid's rule is generalised to five more surfaces.** *A fixed
resource, divided by the cap table, expiring daily* — applied to ticker rotations, the
Chyron Question, Meme 100 seats, the credits, and the guest chair. **The Chyron Question is
the one to build**: it is nearly free (the Right Now rail is already a gated, viewer-writable
submission pipeline) and it converts holding into a moment rather than a tally.
→ [`design/the-grid.md`](design/the-grid.md) §12

**2026-08-10 · show · The nightly block is planned as all eight hours live, 7 PM–3 AM, with
the burnout risk stated and a pre-committed tripwire.** Miss the 7 PM open three times in a
rolling 30 days and the block contracts to 7 PM–12 AM automatically. Three recovery hours
(9 PM, 12 AM, 1 AM) are load-bearing structure, not filler. Interviews are Tue/Wed/Thu only —
three bookings a week, not seven.
→ [`show-bible.md`](show-bible.md) §1–2

**2026-08-10 · show · Finding: interviews are blocked by missing graphics.** No guest lower
third, and **no take button** — the only lower thirds rotate on a fixed ~3-minute timer.
Also missing: segment clock, on-air poll bar, rundown board over the live feed, question
queue, generic standings. The build is one control doc (`config/showControl`), one Control
Room admin tab, and four browser sources. Until then the show runs on
`config/ticker.chyron`, which is a worse name-plate and is enough to start.
→ [`show-bible.md`](show-bible.md) §4

**2026-08-10 · show · The host is a custom comic-book browser source, not off-the-shelf
Live2D, and the founder does not dox.** `csgn-host.html`: ink line, halftone, panel borders
that change by segment, mouth flap from mic amplitude, five expressions and SFX lettering on
hotkeys, driven locally via obs-websocket for sub-100ms latency. The research is that
VTubers reduce social richness but not interpersonal attraction, credibility or parasocial
interaction; the decisive argument is that 56 hours a week on camera is not sustainable and
a rig is. Conditions attached: voice-forward, sub-100ms reactions, performed live, real
track record.
→ [`show-bible.md`](show-bible.md) §6–7

**2026-08-10 · growth · The founder's account gets a 70-minute daily budget and a written
procedure instead of a handle list.** X is the credibility engine, not the acquisition
engine — only short-form produces ~72 followers/day at this size. The CSGN Set from the
ratings book doubles as the Tier B follow list. The **Scoreboard Reply** — rendering someone
else's call as a CSGN lower third — is named the single highest-leverage daily habit.
→ [`x-playbook.md`](x-playbook.md)

**2026-08-10 · show · The show graphics and the sports ticker are two separate systems, and
will stay that way.** The BottomLine renders sports data from `config/ticker` on a 6-second
REST poll. The show graphics render from `config/showControl` on a sub-second `onSnapshot`
listener, because a take button on a 6-second poll is not a take button. Separate files,
separate control docs, no shared state. An earlier draft proposed using `config/ticker.chyron`
as a stopgap name-plate; that conflated the two and is dropped.
→ [`design/graphics-package.md`](design/graphics-package.md) §1

**2026-08-10 · show · The graphics package is four mode-driven browser sources, not sixteen
files.** `csgn-showbar` (name/guest/topic/clock), `csgn-fullframe` (twelve card modes),
`csgn-bug` (bug + ET clock + referral), `csgn-clip` (the 9:16 kit). Shared stylesheet, one
Control Room tab, one TAKE button. Broadcast palette wins over web where they fork —
gold `#ffcf40`, green `#68ff7a`, loss `#ff4b4b` — and type is Roboto Condensed, not Space
Grotesk, which only loads to 700.
→ [`design/graphics-package.md`](design/graphics-package.md) §1–2

**2026-08-10 · legal · The Bullpen referral link ships with a permanent, visible `REFERRAL`
tag.** FTC guidance requires a clear and conspicuous disclosure near the link whenever money
changes hands on a click, crypto endorsements draw heightened scrutiny, and "not financial
advice" does not cure an undisclosed commission. This also matches the house rule the jukebox
already enforces automatically with `PAID SPOTLIGHT`. The tag is a compliance requirement, not
a design choice, and is not to be shrunk.
→ [`design/graphics-package.md`](design/graphics-package.md) §6

**2026-08-10 · show · Betting lines render as market context, never as picks.** Spread and
total appear on matchup cards and the pregame ticker face the way a broadcast shows them. No
picks, no units, no confidence, no lock of the day — the doctrine that CSGN never pays for or
recommends a financial outcome extends to sports betting without exception.
→ [`design/ticker-football.md`](design/ticker-football.md) §7

**2026-08-10 · ticker · Football is a two-field feature and gets a proper upgrade.** Rank,
odds, timeouts, last play, line score and conference records are **all on the ESPN endpoint
already being called** and discarded. Three real bugs found: the possession dot shifts the
team abbreviations ~23px every change of possession because it has no reserved slot; it never
turns red in the red zone despite the file's own comment claiming it does; and a 60-game CFB
Saturday locks the band for 7–11 minutes while `MAX_SECDOTS = 14` makes the progress row stop
tracking past item 14. New situational data goes into the **130px of unused headroom** as a
Situation Strip, because the status cell is already ~9px over its box.
→ [`design/ticker-football.md`](design/ticker-football.md)

**2026-08-10 · data · ESPN for live football, CollegeFootballData for rankings and
standings.** ESPN's unauthenticated endpoints stay for volatile data and already work; CFBD
supplies poll *movement*, which ESPN's `curatedRank` cannot (current rank only, no previous-week
delta). CFBD's free tier is 1,000 calls/month against a poll that moves weekly.
→ [`design/ticker-football.md`](design/ticker-football.md) §6

**2026-08-10 · content · The show is designed so the reels fall out of it.** Three clip beats
at fixed times — 7:20, 11:15, 1:50 — two clean minutes each, one opinion, delivered knowing it
will be cut. Three beats a night is three reels tomorrow with no separate shoot, which is the
difference between "3 reels a day" being a second job and being a byproduct. Plus a
twelve-format segment library so no hour ever starts blank.
→ [`shows.md`](shows.md) §1.1, §5

**2026-08-10 · calendar · Correction: college football does not start on Sep 5.** Week 0 is
**Sat Aug 29** (eight games, USC–San Jose State opening) and Week 1 opens **Thu Sep 3**; Sep 5
is the big Saturday. Football is ~19 days out, not 26. The AP Preseason Top 25 lands **Aug 17
at noon ET** and is the quarter's first hard graphics deadline. Fantasy draft season runs
Aug 23 – Sep 3.
→ [`the-runup.md`](the-runup.md) §0–1

**2026-08-10 · token · REVERSAL of sequencing: the denominator play is relegated, not
cancelled.** It is not being built this quarter. The mechanism stands as designed; the host
suggests it on air and viewers can launch tokens quoted against $CSGN themselves, so whether
it happens is decided by popularity rather than roadmap. Supersedes the sequencing in the
2026-08-10 denominator entry above; that entry stays as written, per the append-only rule.
→ [`design/the-denominator.md`](design/the-denominator.md)

**2026-08-10 · ticker · Section dots move under the league pill and cap at five.** A
progress row in the corner of a game card reads as belonging to the game; under the pill it
sits with the league it counts, and the scoreboard gets its width back. Past five pips the
row becomes a sliding window with the lit pip always inside it. **The clamp was mandatory,
not cosmetic:** the old renderer compared the cursor against the *visible* count, so past
the cap every pip drew `done` and none drew `on` — at 14 that was rare, at 5 it would have
been constant. `setPill` now writes to a label span, because `textContent` on the pill would
delete the dots on every league change.
→ `docs/ops/obs/csgn-ticker.html`, [`ops/obs/README.md`](ops/obs/README.md)

**2026-08-10 · ticker · The Meme 100 face is rebuilt around $CSGN vote share as the hero
number.** It is the flagship token feature and it was leading with price. Share of vote
weight is the number nobody else on television can show, and a bar behind each row makes the
board readable before anyone reads a label. The bottom band is removed from this face
entirely — it carried ~411px of text in a 375px row and was the tightest line in the file.

**The overlap was arithmetic, not styling.** `.ml-list` declared 58px and held three 26px
rows plus gaps (80px), with no `overflow` and the same `z-index` as its neighbours, so it
bled raw text into the bands above and below. Above it, `.c-top` declared 26px while `.c-sym`
ran 30px with **no `line-height` declared anywhere in the dock**, so `min-height:auto`
inflated it and pushed the bottom band off *every* card, not just this one. Both bands now
budget to exactly 97px and the smoke test asserts the sum.
→ `docs/ops/obs/csgn-ticker.html`

**2026-08-10 · ticker · MMA renders the card, not the bout.** ESPN gives each bout its own
event, so a 14-fight night was 14 anonymous rows. Bouts now group under their card with a
static event rail and pages of three, reusing the golf board pattern; the shared sub-rotation
timer was generalised so two paged faces can't collide. **The event name was unreachable**
— the bout note and the card name were read from one chained expression with the note first,
and the note always exists. Weight class, TITLE and MAIN EVENT all ride each bout; a title
fight that is also the main event shows both flags.
→ `docs/ops/obs/csgn-ticker.html`

**2026-08-10 · ticker · MLB games-back gets a data source; the renderer was never broken.**
`gamesBackOf` → `teamRow` was correct and wired end to end. Its only source was
`team.standingSummary`, which the *scoreboard* payload generally omits — that field lives on
the standings endpoint — and every path degraded to `""` silently, so a feature with no data
looked identical to a working one. Added a standings fetch cached for six hours, behind the
existing scoreboard reads. **Not verified against a live payload** — outbound fetch is
blocked from the authoring environment — so it is built to work either way.
→ `docs/ops/obs/csgn-ticker.html`

**2026-08-10 · ticker · Upcoming football gets its own windowed boards.** WEEK 0 (Aug 29),
CFB WK 1 (Sep 3–7) and NFL WK 1 (Sep 9–14) are leagues with a fixed `dateWindow` rather than
a widened range on the live NFL/CFB pills — a game three weeks out sitting beside a live one
is how you confuse a viewer. Each retires itself once its window passes. **This also fixed a
silent bug:** `shouldKeepEventToday` discarded every event not on the current broadcast day
*after* the fetch, so `dateRangeDays` had no observable effect at all and MMA, F1, NASCAR and
both Wimbledon leagues were throwing away the extra days they had just requested. CFB was
also missing `groups=80` and so was getting a limited group rather than all of FBS.
→ `docs/ops/obs/csgn-ticker.html`

**2026-08-10 · ticker · The game panel fills instead of pooling dead space in the middle.**
`.rows` was `flex:0 1 auto` — able to shrink, never to grow — against `.gamebox` on
`space-between`, so all leftover width collected as one gap. On a pregame CFB card that ran
to roughly 550px, nearly half the panel. Rows now grow, empty score and logo columns
collapse (148px and 64px of guaranteed blank on an upcoming game), and `fitText` gained a
grow branch capped at 1.35× so a short headline no longer sits at its CSS size in a 1,100px
box. AP/CFP rank chips ship with a reserved slot so ranked and unranked rows still align.
→ `docs/ops/obs/csgn-ticker.html`

**2026-08-10 · docs · Repo-wide path repair after the reorganisation.** Prose and code
samples still pointing at `docs/obs/…` were repointed to `docs/ops/obs/…`; archived docs
were left verbatim by the archive rule. Separately, `docs/ops/obs/README.md`'s quick-start
table told operators to enable "Shutdown source when not visible" and "Refresh browser when
scene becomes active", contradicting its own §4.1/§4.3/§4.4 and `obs-setup.md`. The detailed
sections were right; the table is corrected.
→ [`ops/obs/README.md`](ops/obs/README.md)
