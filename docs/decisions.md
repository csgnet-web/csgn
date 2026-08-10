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

**2026-08-10 · docs · Repo-wide path repair after the reorganisation.** Prose and code
samples still pointing at `docs/obs/…` were repointed to `docs/ops/obs/…`; archived docs
were left verbatim by the archive rule. Separately, `docs/ops/obs/README.md`'s quick-start
table told operators to enable "Shutdown source when not visible" and "Refresh browser when
scene becomes active", contradicting its own §4.1/§4.3/§4.4 and `obs-setup.md`. The detailed
sections were right; the table is corrected.
→ [`ops/obs/README.md`](ops/obs/README.md)
