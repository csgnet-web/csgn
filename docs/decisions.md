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
