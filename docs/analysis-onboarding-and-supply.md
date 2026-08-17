# Analysis — onboarding, and whether streamers actually come

**What this is:** an honest read of two questions the product's future depends
on, answered from the code rather than from the pitch. Every claim about current
behaviour was read out of the files named. Where a number is a judgement rather
than a measurement, it says so.

The short version:

> **Onboarding is three taps for someone who already has Phantom, and
> impossible for everyone else.** Not slow — impossible. `signupWithPhantom.ts`
> is the only door, and it demands a Solana wallet with on-chain history. A
> Twitch streamer with no crypto cannot create an account, so the odds of them
> joining are not low, they are zero, and no amount of outreach changes that
> until `plan-twitch-first-claim.md` lands.
>
> **Even once the door opens, the offer is weak** — roughly $12 for a two-hour
> slot. What a streamer actually wants is audience, and the network cannot
> credibly promise audience while the schedule is mostly dark. That is the real
> case for holder-uploaded airtime: **it fixes supply first, so there is
> something to bring an audience to.**

---

## 1. The funnel that exists today

### 1.1 Getting an account

| # | Step | Where | What it costs the user |
|---|---|---|---|
| 1 | Continue with Phantom | `AuthModal.tsx` → `createPhantomChallenge` | Must already have Phantom installed and funded |
| 2 | Approve a signature | `verifyPhantomSignature.ts` | One wallet prompt |
| 3 | **On-chain history check** | `signupWithPhantom.ts:119` | A brand-new wallet is **rejected** (`wallet_not_established`) |
| 4 | Pick a name | derived by `lib/username.ts`, editable | Nothing — pre-filled and valid |
| 5 | Create account | `finalizeCreateAccount.ts` | — |

Steps 1, 2 and 4 are genuinely good. `signup-flow.md` is right that the flow is
three taps and a signature, and the work that got it there — deriving the
username, dropping the sign-in/sign-up fork, moving Twitch past the finish line
— is real craft.

**Step 3 is the wall.** The sybil gate is defensible on its own terms (it stops
a wallet farm), and it fails open when the chain is unreachable, which is the
right instinct. But its effect on a normal streamer is total: no wallet, no
account. The fallback when it rejects you is an **email + password form** —
which means the least crypto-native user gets the *most* friction, exactly
backwards.

### 1.2 Getting on air

`claimSlot.ts:73` requires, and this is the whole list:

```
user.phantom.verified && walletAddress
user.twitch.verified  && twitchUsername && twitchUserId
email_verified (if an email is on the account)
status === 'active'
fewer than slotLimits.maxConcurrentClaims (default 2) future/live claims
```

So claiming demands **both** a verified wallet and a verified Twitch. Twitch
verification inside Phantom's in-app browser needs the cross-browser handoff
(`useTwitchLink.ts`) — which is well-built and genuinely necessary, but is still
a "finish this in Safari, come back, we'll poll" detour in the middle of the
one flow that matters.

### 1.3 Where this actually leaves people

| Who they are | What happens |
|---|---|
| Crypto-native, has Phantom, streams on Twitch | Signs up in three taps, claims an hour. **This flow is fine.** |
| Twitch streamer, no wallet | **Cannot create an account.** Not "has extra steps" — cannot. |
| Crypto person, no Twitch | Account yes, claiming no. Can watch and vote. |
| Curious viewer on a phone from a link | Account requires installing a wallet. Almost all of them leave. |

The second row is the entire target market of `plan-network-growth.md` Part D,
and it is currently a locked door. That plan calls
`plan-twitch-first-claim.md` a hard prerequisite; this is why.

---

## 2. The Instagram/TikTok gap

The stated bar is that the product should feel as seamless and fun as
Instagram or TikTok, and that a member should feel like part of the channel.
Measured against that bar, the honest gaps:

**A wallet is not an onboarding step, it's a different product.** TikTok's
sign-up is a phone number. Ours is "install a browser extension, fund it,
approve a cryptographic signature, and have prior on-chain history." Every
consumer app that put a wallet first has the same retention chart.

**There is nothing to do in the first thirty seconds.** TikTok gives you a feed
before it asks for anything. `/watch` gives you whatever single stream is on —
and if nobody claimed the hour, it gives you an intermission card. A first
visit that lands on dead air has no second visit.

**Nothing you do is visible to anyone.** The product's own thesis is "you're
part of the channel," but a new member's only available actions are voting and
claiming an hour they probably can't claim. There is no lightweight, immediate,
visible contribution — which is precisely what uploaded seconds of TV would be.

**The good news:** the pieces for the fun version already exist and are unused.
`config/vodPlaylist` is an admin-managed rotation that `/player` already plays
during `INTERMISSION` (`Player.tsx:473`, `masterControl.ts`). The gap between
"admin pastes MP4 links" and "members upload and order their seconds" is a
product, not an architecture.

---

## 3. Odds a Twitch streamer joins

### 3.1 What is actually being offered

| The offer | The reality |
|---|---|
| "Earn 30% of creator fees" | ~$12 for a two-hour slot at current volume (`plan-network-growth.md` §Context). Below minimum wage; not a reason. |
| "Be on a 24/7 network" | True, and the best line — **if** the network has viewers. |
| "Keep your normal schedule" | Genuinely well-designed, and now enforced honestly by verified airtime. |
| "Get raided into your hour" | Not built (Part C). Would be the strongest line if it were. |

### 3.2 The honest odds

Judgement, not measurement — stated so it can be argued with:

| Scenario | Odds a targeted 10–200 CCV streamer signs up and airs one slot |
|---|---|
| Today, wallet-first, dark schedule | **~0%.** They cannot make an account. |
| Twitch-first login, dark schedule, $12/slot | **2–5%.** The offer is weak and the channel looks empty. Crypto streamers who already know CSGN convert; nobody else does. |
| Twitch-first + always-on content + raid chain | **10–20%.** "You get raided into your hour and you raid out" is a real, non-monetary reason, and a channel that is always on looks like a network instead of a parked domain. |

The gap between rows two and three is not marketing. It is **whether the
channel is ever on when a prospect looks at it.**

### 3.3 The one structural advantage, and it is real

Open inventory is 3am–7pm ET because 7pm–3am is the owner's block. That window
is **EU and Asia prime time**. A German streamer's 8pm is 2pm ET — squarely
inside our open hours. This is a genuine edge that nobody has articulated
publicly, and `plan-network-growth.md` B1's schedule-matcher surfaces it
automatically. It costs nothing and should be in the first outreach message.

---

## 4. Why holder-uploaded airtime is the right next move

The jumpstart problem is a **supply** problem, and every proposed fix so far has
been a demand fix. The ordering that works:

1. **Supply** — the channel is on 24/7 with real content, because holders
   upload it. No streamer had to be recruited for this to be true.
2. **Demand** — an always-on channel with a schedule is something you can
   actually promote, screenshot, and clip.
3. **Streamers** — now the live-slot pitch is "join a channel that already has
   an audience," which is the only version of it that works.

Uploaded airtime also converts the token from a governance abstraction into
something with an obvious, visible, daily use: **your bag is how much of the
channel is yours.** That is a far better line than the current six utilities
combined.

Two cautions carried forward into the plan, both from settled policy rather than
my opinion:

- **`master-plan.md` §5:** the token "never gates claiming a slot, making an
  account, or going live." Holder-weighted *upload* airtime is a promotion gate
  (like the Right Now rail) and is compatible — but only if the free paths stay
  free and there is a floor for zero-holders. Get this wrong and the product's
  own stated principle breaks.
- **`token-voting.md` §2.4–2.5:** linear weight where ownership should decide,
  a sub-linear curve where participation should, and an anti-capture cap on top
  of either. A purely linear airtime split hands the channel to one whale.

Both are handled in [`plan-decentralized-tv.md`](plan-decentralized-tv.md).

---

## 5. What I would do, in order

1. **`plan-twitch-first-claim.md` Phases 1–2.** Nothing else matters while the
   door is locked. This is the single highest-leverage change in the repo.
2. **Holder-uploaded airtime** (the plan beside this one). Fixes supply, gives
   the token a daily use, and makes the channel promotable.
3. **The raid chain** (`plan-network-growth.md` C3). The strongest recruiting
   line, and cheap — the `upNext` data already exists.
4. **Then outreach**, into EU/Asia prime, with a channel that is actually on.

Doing 4 before 1 burns the list.

---

## 6. Known dead surfaces, while we are being honest

- **`xp`** is rendered in `Header.tsx:158` and `Dashboard.tsx:377` and has **no
  writer anywhere**. Every member sees `XP 0`. Either the airtime/season work
  populates it or it should come out of the UI.
- `winnings` / `gameStats` had the same problem and were removed with the games.
- The payout engine (`_shared/payouts.ts`, `payoutRunner.ts`) is now retained
  but has **no caller** — see [`payout-wallet.md`](payout-wallet.md).
