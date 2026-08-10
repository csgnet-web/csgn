# CSGN docs

**Four places. Read the one you need, ignore the rest.**

| I want to… | Open |
|---|---|
| Know what we're doing this quarter | [`plan.md`](plan.md) |
| Understand what the token actually does | [`design/token-economics.md`](design/token-economics.md) |
| Understand how the channel programs itself | [`design/the-grid.md`](design/the-grid.md) |
| Ship code / run my own node | [`../CONTRIBUTING.md`](../CONTRIBUTING.md) |
| Put it on air | [`ops/obs/README.md`](ops/obs/README.md) |
| Prove it works before it pays anyone | [`ops/dry-run.md`](ops/dry-run.md) |
| Know why something is the way it is | [`decisions.md`](decisions.md) |

**One rule about authority:** [`plan.md`](plan.md) is the operating document. **Where any
other file disagrees with it, it wins.** On token design specifically,
[`design/token-economics.md`](design/token-economics.md) is newer than anything in
[`archive/`](archive).

---

## Operate

| Doc | What it answers |
|---|---|
| **[`plan.md`](plan.md)** | **The 90 days.** Follower targets and how they're earned, the three phases, the weekly cadence, where the breakouts come from, pre-committed kill criteria, the refusal list |
| [`decisions.md`](decisions.md) | Append-only log of every decision that changed the shape of the thing, and where it lives |
| [`../CHANGELOG.md`](../CHANGELOG.md) | The full version history, v0.1 → v1.19 |

## Design

The specs. What each system is, why it is shaped that way, and the build order.

| Doc | What it answers |
|---|---|
| **[`design/the-grid.md`](design/the-grid.md)** | **The cap table is the programming schedule.** The 16 open hours allocated 1:1 to supply share; Producers and Talent; live always supplants; the ratings ladder; the Charter 50; links-then-uploads; moderation; the Partner Day toggle |
| **[`design/token-economics.md`](design/token-economics.md)** | **Why $CSGN works.** The spend-side diagnosis, the two-market structure and Airtime Yield, the demand engine, the seven things investors want that need no outreach, the legal line, the falsification test |
| [`design/token-voting.md`](design/token-voting.md) | Supply-weight voting and The 30-Minute Draft. Weight as % of supply aged by hold time — no deposits, no locks, no burns |
| [`design/csgn-share.md`](design/csgn-share.md) | A Nielsen ratings book for streaming. Share over Rating, the ET dayparts the Grid ladder runs on, The Book and Sweeps |
| [`design/games-and-payouts.md`](design/games-and-payouts.md) | Squares (weekly, pooled, 500k to the winner), Starting 5 (daily, free, 100k perfect card), and the payout ledger's four guarantees |
| [`design/broadcast-graphics.md`](design/broadcast-graphics.md) | Why the graphics layer is built the way it is |

## Ops

| Doc | What it answers |
|---|---|
| [`ops/obs/README.md`](ops/obs/README.md) | **Every browser source, how they stack, and the CSGN BottomLine spec.** Start here for anything on-air |
| [`ops/obs-setup.md`](ops/obs-setup.md) | The encoder walkthrough — scene, NVENC, RTMPS to X, audio |
| [`ops/env-setup.md`](ops/env-setup.md) | Every environment variable, which are secret, the payout-wallet key policy, the deploy checklist |
| [`ops/dry-run.md`](ops/dry-run.md) | **The gated verification runbook.** Local → settlement → payout dry run → the mainnet money test. Includes the idempotency test that must never be skipped |
| [`ops/backend-hardening.md`](ops/backend-hardening.md) | Cost, scale, and the attacks that actually happen. The six questions a new endpoint has to answer |
| [`ops/ops-cost-security-runbook.md`](ops/ops-cost-security-runbook.md) | Firestore cost control, security posture, incident steps |
| [`ops/security-audit.md`](ops/security-audit.md) | What was found, what was fixed, and what was deliberately left alone with reasoning |

## Archive

Superseded, kept verbatim, never deleted — [`archive/README.md`](archive/README.md)
explains what replaced what and what each is still worth reading for.

`master-plan` · `campaign` · `the-pitch` · `ecosystem-strategy` · `onchain-thesis` ·
`socialfi-era2` · `growth-and-market-plan` · `agent-packets`

---

## The vocabulary — use these definitions verbatim

> **StreamFi** — Live streaming where the **airtime itself is the onchain asset**:
> owned, priced, traded, settled. Not a stream with a token bolted on; a stream
> whose *time* is the instrument.

> **Attention Capital Markets (ACM)** — Markets where **attention is the
> underlying asset** — allocated by auction, verified by proof, programmable by
> anyone.

> **The Grid** — CSGN's sixteen open hours, allocated pro rata to supply share and
> programmed by the people who hold it. *1% of the network is 1% of the day.*

> **Airtime Yield** — the open-market value of the inventory a given share of supply
> received. A disclosure, in kind. Never a distribution.

> **CSGN, in one line** — *Blockspace for attention. A 24/7 channel where the hour
> is the asset.*

---

## The numbers, in one place

| | |
|---|---|
| The Grid | 3 AM – 7 PM ET · 8 × 2h blocks · **57,600 seconds/day**, allocated 1:1 to supply share |
| Network block | 7 PM – 3 AM ET, programmed. Not part of the Grid |
| Charter 50 | The first 50 contributors. Permanent badge, unbuyable after |
| Starting 5 | Daily · **free** · 100,000 $CSGN for a perfect card (5/5) · rolls over |
| Squares | Weekly · **6,250 $CSGN per square**, 20% rake · **500,000 to the winner** of a full board |
| Creator fee split | Streamer on air takes **30%** of the pump.fun creator fee |
| $CSGN mint | `GFV7fphvprMr1PYpYGPJort2QP7JJLEp3J1Buu7Zpump` |
| Treasury | `CSGNUgUpBqTNM7EBZSMeA5jzPLFNR2hELhLjbHLpbEY4` |
| Payout wallet | `EftavCt6Tk2bzWJ9Dnz7cAvfa5RAnh8S9vZcrorV7Hmv` |
| Licence | MIT — [`../LICENSE`](../LICENSE). Brand and wallets excluded |
