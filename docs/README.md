# CSGN docs

**Four tiers. Read the one you need, ignore the rest.**

| I want to… | Open |
|---|---|
| Know what we're doing this week | [`campaign.md`](campaign.md) |
| Ship code / run my own node | [`../CONTRIBUTING.md`](../CONTRIBUTING.md) |
| Put it on air | [`obs/README.md`](obs/README.md) |
| Prove it works before it pays anyone | [`dry-run.md`](dry-run.md) |

---

## 1 · Operate

The two documents that describe what is actually happening.

| Doc | What it answers |
|---|---|
| **[`campaign.md`](campaign.md)** | **The operating document.** Three pillars (the room · the show · the campaign), owners, weekly cadence, exact copy, the 30-day table. **Where any other doc disagrees, this one wins.** |
| [`the-pitch.md`](the-pitch.md) | The line — **"YOU'RE ON"** — and the campaign that ships it: the empty slot as the creative, the proof stack, what each platform is for, the refusal list, four metrics we can be held to |

## 2 · Build & run

| Doc | What it answers |
|---|---|
| [`../CONTRIBUTING.md`](../CONTRIBUTING.md) | Getting it running, the rules this codebase keeps, **running your own node**, broadcasting (X, or Restream for Twitch too), PRs and security reports |
| [`env-setup.md`](env-setup.md) | Every environment variable, which are secret, the payout-wallet key policy, and the **deploy checklist** |
| [`dry-run.md`](dry-run.md) | **The gated verification runbook.** Local → settlement → payout dry run → **the mainnet money test**. Includes the idempotency test that must never be skipped |
| [`games-and-payouts.md`](games-and-payouts.md) | Squares (weekly, pooled, 500k to the winner), Starting 5 (daily, free, 100k perfect card), and the payout ledger's four guarantees |
| [`backend-hardening.md`](backend-hardening.md) | **Cost, scale and the attacks that actually happen.** The read amplifier that was there, the caching/timeout/body-cap primitives, and the six questions a new endpoint has to answer |
| [`ops-cost-security-runbook.md`](ops-cost-security-runbook.md) | Firestore cost control, security posture, incident steps |

## 3 · Broadcast

| Doc | What it answers |
|---|---|
| [`obs/README.md`](obs/README.md) | **Every browser source, how they stack, and the finalized CSGN BottomLine spec.** Start here for anything on-air |
| [`obs-setup.md`](obs-setup.md) | The encoder walkthrough — scene, NVENC, RTMPS to X, audio |
| [`broadcast-graphics.md`](broadcast-graphics.md) | Why the graphics layer is built the way it is |

## 4 · Proposals & reference

Designs on the table, and the long-form thinking behind the product.

| Doc | What it answers |
|---|---|
| [`token-voting.md`](token-voting.md) | **Supply-weight voting + The 30-Minute Draft.** Vote weight as % of supply aged by hold time — no deposits, no locks, no burns — and the hourly draft where the audience programs the open blocks |
| [`csgn-share.md`](csgn-share.md) | **A Nielsen ratings book for streaming.** Share over Rating, ET dayparts, the honest answer on US-only measurement, The Book and Sweeps |
| [`master-plan.md`](master-plan.md) | The long-form original: who we are, the schedule model, the shows, the token audit, the 180-day plan |
| [`growth-and-market-plan.md`](growth-and-market-plan.md) | Where the project stands, what the fee maths actually require for a given income, honest odds on market cap, and the six-month content and recruiting plan |
| [`security-audit.md`](security-audit.md) | Full security / cost / correctness audit: what was found, what was fixed, and what was deliberately left alone with reasoning |

### Archive — superseded, kept for the reasoning

Written in sequence before `campaign.md` locked the plan. Still useful for *why*
a decision was made; **not** authoritative on what we're doing now.

`onchain-thesis.md` · `socialfi-era2.md` · `ecosystem-strategy.md` · `agent-packets.md`

---

## The vocabulary — use these definitions verbatim

> **StreamFi** — Live streaming where the **airtime itself is the onchain asset**:
> owned, priced, traded, settled. Not a stream with a token bolted on; a stream
> whose *time* is the instrument.

> **Attention Capital Markets (ACM)** — Markets where **attention is the
> underlying asset** — allocated by auction, verified by proof, programmable by
> anyone.

> **CSGN, in one line** — *Blockspace for attention. A 24/7 channel where the hour
> is the asset.*

---

## The numbers, in one place

| | |
|---|---|
| Starting 5 | Daily · **free** · 100,000 $CSGN for a perfect card (5/5) · rolls over if nobody goes perfect |
| Squares | Weekly · **6,250 $CSGN per square**, 20% rake · **500,000 to the winner** of a full board |
| Payout wallet | `EftavCt6Tk2bzWJ9Dnz7cAvfa5RAnh8S9vZcrorV7Hmv` |
| Treasury | `CSGNUgUpBqTNM7EBZSMeA5jzPLFNR2hELhLjbHLpbEY4` |
| $CSGN mint | `GFV7fphvprMr1PYpYGPJort2QP7JJLEp3J1Buu7Zpump` |
| Network block | 7 PM – 3 AM ET, programmed. Every other hour is claimable |
| Licence | MIT — [`../LICENSE`](../LICENSE). Brand and wallets excluded |
