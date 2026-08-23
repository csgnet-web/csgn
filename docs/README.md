# CSGN docs

**Four tiers. Read the one you need, ignore the rest.**

| I want to… | Open |
|---|---|
| Get our first users | [`product-process.md`](product-process.md) |
| Open the door to non-crypto streamers | [`plan-twitch-first-claim.md`](plan-twitch-first-claim.md) |
| Make payouts honest, and give streamers a reason to come back | [`plan-network-growth.md`](plan-network-growth.md) |
| Fill the schedule without recruiting anyone | [`plan-decentralized-tv.md`](plan-decentralized-tv.md) |
| Know why nobody has signed up yet | [`analysis-onboarding-and-supply.md`](analysis-onboarding-and-supply.md) |
| Write the ads, DMs and posts | [`marketing-outreach.md`](marketing-outreach.md) |
| Know what we're doing this week | [`campaign.md`](campaign.md) |
| Ship code / run my own node | [`../CONTRIBUTING.md`](../CONTRIBUTING.md) |
| Put it on air | [`obs/README.md`](obs/README.md) |
| Prove it works before it pays anyone | [`dry-run.md`](dry-run.md) |
| Switch on Google / X / email sign-in | [`auth-provider-setup.md`](auth-provider-setup.md) |
| **Understand the product in one page** | [`the-three-factories.md`](the-three-factories.md) |
| **Get from $3,600 to $1,000,000+** | [`analysis-path-to-1m.md`](analysis-path-to-1m.md) |
| Work out why the Netlify bill is what it is | [`netlify-cost.md`](netlify-cost.md) |
| Decide when to run clips vs. a live streamer | [`analysis-clip-vs-streamer-mode.md`](analysis-clip-vs-streamer-mode.md) |
| Switch on TikTok import and the share sheet | [`setup-tiktok-and-share.md`](setup-tiktok-and-share.md) |

---

## 1 · Operate

The two documents that describe what is actually happening.

| Doc | What it answers |
|---|---|
| **[`product-process.md`](product-process.md)** | **The funnel, end to end.** The two funnels (viewer and streamer), where people actually leave, the cut list with recommendations, the three gates to first users, and the six numbers to write down weekly |
| **[`marketing-outreach.md`](marketing-outreach.md)** | Positioning, the line, the refusal list, ad copy, cold-DM and investor scripts, the 30-day calendar and the creative briefs. Built on the funnel above |
| **[`campaign.md`](campaign.md)** | **The operating document.** Three pillars (the room · the show · the campaign), owners, weekly cadence, exact copy, the 30-day table. **Where any other doc disagrees, this one wins.** |
| [`the-pitch.md`](the-pitch.md) | The line — **"YOU'RE ON"** — and the campaign that ships it: the empty slot as the creative, the proof stack, what each platform is for, the refusal list, four metrics we can be held to |

## 2 · Build & run

| Doc | What it answers |
|---|---|
| [`../CONTRIBUTING.md`](../CONTRIBUTING.md) | Getting it running, the rules this codebase keeps, **running your own node**, broadcasting (X, or Restream for Twitch too), PRs and security reports |
| [`plan-twitch-first-claim.md`](plan-twitch-first-claim.md) | **Implementation plan, not yet built.** Twitch alone creates an account and claims an hour; admins reserve hours for a Twitch handle with no account; the wallet is asked for at payout. Four phases; the three forks are settled — fees stay manual toward a pull-based claim contract |
| [`plan-network-growth.md`](plan-network-growth.md) | **Implementation plan, not yet built.** Pro-rate the creator fee by verified live minutes (the poller already samples them and nothing reads them), then an always-on season leaderboard and a raid chain down the schedule. Four parts, A first and alone |
| [`plan-decentralized-tv.md`](plan-decentralized-tv.md) | **Implementation plan, not yet built.** Holder-uploaded airtime: the channel runs 24/7 because holders fill it, share of supply decides share of the day (sqrt-curved, floored and capped), and the owner's block toggles in and out of the pool. Ship Phase 1 alone |
| [`analysis-onboarding-and-supply.md`](analysis-onboarding-and-supply.md) | **Analysis.** A Twitch streamer with no wallet cannot currently make an account at all; an honest read on the odds they join; why fixing supply comes before outreach |
| [`signup-flow.md`](signup-flow.md) | **Sign-up, sign-in, and the Twitch problem.** Why federated login cannot work inside Phantom's in-app browser, the three-tap wallet sign-up, and the cross-browser Twitch handoff that replaced it |
| [`auth-provider-setup.md`](auth-provider-setup.md) | **Step-by-step console walkthrough.** Enabling Google, X and passwordless email sign-in in Firebase (and the X developer portal), authorized domains, a test checklist, and the error-to-cause table |
| [`env-setup.md`](env-setup.md) | Every environment variable, which are secret, the payout-wallet key policy, and the **deploy checklist** |
| [`dry-run.md`](dry-run.md) | **The gated verification runbook.** Local → payout dry run → **the mainnet money test**. Includes the idempotency test that must never be skipped |
| [`payout-wallet.md`](payout-wallet.md) | The $CSGN payout ledger's four guarantees and crash recovery. **Retained but unwired** — the games that used it were removed; the contract the next caller inherits |
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
| **[`the-three-factories.md`](the-three-factories.md)** | **The product, stated once.** CLIP FACTORY / STREAM FACTORY / MYSELF FACTORY, the three modes they produce, the precedence order, the 16-vs-24-hour clip denominator, and the vocabulary to use verbatim |
| [`netlify-cost.md`](netlify-cost.md) | Where the function bill was going (a 45-second sleep, every minute, forever), the duty cycle that replaced it, edge caching, and what to check if it is still high |
| **[`analysis-path-to-1m.md`](analysis-path-to-1m.md)** | **The total rundown and the growth plan.** What exists and how solid it is, the two economic loops, what $1M actually costs in dollars (~$50–80k of net buying), the three growth engines, a 90-day plan, what not to do, and the honest odds |
| [`analysis-clip-vs-streamer-mode.md`](analysis-clip-vs-streamer-mode.md) | When the channel runs clips and when it carries a streamer — the viewer-floor rule, the thresholds and when to move them, the business case for a 15–25% live day, and the public switch log |
| [`analysis-clips-concept.md`](analysis-clips-concept.md) | Whether clips are genuinely novel. The short answer: yes, and the invention is the scarcity, not the scrolling |
| [`spec-social-import.md`](spec-social-import.md) | Why TikTok import is worth building and Instagram's API is not. **Both recommendations now shipped** — see `setup-tiktok-and-share.md` |
| [`setup-tiktok-and-share.md`](setup-tiktok-and-share.md) | Registering the TikTok app, the three environment variables, testing the share sheet, and the symptom→cause table |
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
| Payout wallet | `EftavCt6Tk2bzWJ9Dnz7cAvfa5RAnh8S9vZcrorV7Hmv` |
| Treasury | `EftavCt6Tk2bzWJ9Dnz7cAvfa5RAnh8S9vZcrorV7Hmv` |
| $CSGN mint | `GFV7fphvprMr1PYpYGPJort2QP7JJLEp3J1Buu7Zpump` |
| Network block | 7 PM – 3 AM ET, programmed. Every other hour runs the member reel unless a live member is cut in |
| Streamer share of creator fees | 30% (`STREAMER_SHARE_OF_CREATOR_FEE`) |
| Per-member airtime ceiling | 25% of the day (`AIRTIME_MAX_SHARE`) |
| Broadcast day | Locks at 2 AM ET (`BROADCAST_DAY_START_HOUR_ET`) |
| Licence | MIT — [`../LICENSE`](../LICENSE). Brand and wallets excluded |
