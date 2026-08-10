# The Dry Run — verifying every feature before it touches a stranger

> **Read this before the first real payout.** It is the checklist that turns
> "the tests pass" into "this moved money on mainnet and the books balanced."
>
> Two parts: **§1–3** exercise every feature with no money at risk, **§4** is the
> mainnet money test, deliberately tiny. Do them in order. §4 is the only
> irreversible step in the document.

---

## 0. Before you start

**Print the exit criteria.** A dry run without a written pass/fail is a demo. For
each step below, the box is either ticked or the run stops — "seemed fine" is not
a result. If something fails, fix it and re-run **that whole section**, not just
the failing line.

**Have two wallets ready.** A funded operator wallet and a **fresh, empty
recipient** you control. The empty one matters: a wallet with no $CSGN token
account is the case that breaks payout runs (the transfer has to create the
account and pay rent), and it is the *common* case for a real winner.

**Know the two addresses by heart.**

| | |
|---|---|
| Payout wallet | `EftavCt6Tk2bzWJ9Dnz7cAvfa5RAnh8S9vZcrorV7Hmv` |
| Treasury | `CSGNUgUpBqTNM7EBZSMeA5jzPLFNR2hELhLjbHLpbEY4` |
| $CSGN mint | `GFV7fphvprMr1PYpYGPJort2QP7JJLEp3J1Buu7Zpump` |

```bash
npm install
npm test          # 475 tests — all green before anything else
npm run lint
npm run build
```

☐ **Gate:** all four commands clean. Do not proceed on a red suite.

---

## 1. Local dry run — the app

```bash
cp .env.example .env      # fill in the Firebase values
npm run dev               # http://localhost:5173
```

### 1.1 Account + connections

☐ Register: email → Phantom signature → Twitch OAuth. Completes in under a minute.
☐ `/account` shows your name, handle, role, and **three connection rows** that
   report real state (a missing wallet reads "Not connected", not a green chip).
☐ Resize to 375px wide. **Nothing overlaps.** The avatar sits above the name, the
   name wraps rather than truncating, stats stay in their cells.
☐ Holder Standing shows your $CSGN balance and share of supply, and the two
   allowance bars agree with what you hold.

### 1.2 Game Control → the /watch strip

Admin → Broadcast Control → **Game Control**.

☐ Set a countdown 3 minutes out. `/watch` shows it and **ticks every second**.
☐ Under one minute the clock turns amber.
☐ Let it hit zero: the strip falls back to the rotating lines. It does not blank,
   and it does not sit at `00:00`.
☐ Change the rotating lines. `/watch` picks them up without a reload.
☐ Set mode **Off**: the default network copy returns.
☐ Enter one line only — the prism still shows four faces, no blank quarter turn.
☐ Change the Squares entry fee and rake. The **"Full board pays"** figure updates,
   and matches what `/account` shows. At 6,250 and 20% it reads **500,000**.

### 1.3 Slots and the player

☐ Claim an open hour. `/watch`, `/schedule` and `/player` all agree on who has it.
☐ `/player?debug=1` reports the state machine and the reveal mode.
☐ Admin emergency override cuts `/player` over, and clearing it returns.

☐ **Gate:** every box in §1 ticked.

---

## 2. Game settlement — dry run, no chain

The engines are pure, so a settlement can be exercised end to end in a REPL with
no Firestore and no wallet. This is the cheapest place to find a bad purse.

```bash
npx tsx      # or: node --experimental-strip-types
```

```ts
import { settleSlate } from './src/lib/games/startingFive.ts'
import { boardEconomics, settleBoard, drawDigits } from './src/lib/games/squares.ts'
```

### 2.1 Starting 5 — the perfect card

☐ A slate where every pick finishes green pays the purse.
☐ **One red pick** anywhere → `perfect` is empty and `rolloverCsgn` is the full purse.
☐ **An empty price snapshot** → nothing is paid and the purse rolls. *(This is the
   six-figure failure: unpriced picks score flat, and flat clears a zero
   threshold. If this test ever pays out, stop and fix it before anything else.)*
☐ Lottery mode **with no seed** → pays nobody, returns a `note`, rolls the purse.
☐ Lottery mode **with a seed** → same seed, same winner, every time.

### 2.2 Squares — the pool

☐ A full board at 6,250/20% → `poolCsgn` 625,000, `rakeCsgn` 125,000,
   `prizeCsgn` **500,000**.
☐ A 40-square board → prize 200,000, `toppedUp: false`. **A short board pays a
   short prize** — if this ever tops up without `guaranteePrize`, the treasury is
   silently subsidising every quiet week.
☐ A seed sampled *before* `entriesCloseAt` is refused.
☐ The same blockhash draws the same digits, twice.
☐ Paid out + rolled over = the prize, exactly. No dust.

☐ **Gate:** every box in §2 ticked.

---

## 3. Payout dry run — real ledger, no money

`adminRunPayouts` is **dry-run by default**. It builds the batch, checks
solvency, and reports — without signing anything.

```bash
curl -s -X POST https://<site>/.netlify/functions/adminRunPayouts \
  -H "Authorization: Bearer $ADMIN_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"source":"starting5","sourceId":"slate-2026-08-02"}' | jq
```

Read the response, don't skim it:

☐ `dryRun: true`, and **nothing was written** — the `payouts` collection is untouched.
☐ `requested` matches the winners you expect.
☐ `totalCsgn` is what you intend to spend. **Say the number out loud.**
☐ `solvency.ok` is true. If not, `reason` says `insufficient_csgn` or
   `insufficient_sol` — top up the payout wallet and re-run.
☐ `solvency.requiredSol` is **non-zero** when winners are new. That's token-account
   rent, and a zero here means the wallet lookup failed rather than that it's free.
☐ `review` is empty. Anything in it hit a cap and needs a human.
☐ Run it **twice**. The second run is identical — a dry run must be side-effect free.

☐ **Gate:** every box in §3 ticked, and `totalCsgn` is a number you are happy to
   spend for real.

---

## 4. Mainnet dry run — the money test

> **This is the irreversible step.** Everything above can be repeated freely.
> From here on, tokens move. Do it deliberately, at a time you are not tired,
> with someone else reading the output.

### 4.1 Fund thin

Send the payout wallet **only what this test needs**, plus a margin:

- **$CSGN:** the test amount (start at **1,000**) plus 20%.
- **SOL:** `0.05`. Covers fees and a handful of token-account rents.

☐ `payoutWalletStatus` reports `configured: true` and both balances.

> **Never park the reserve in the payout wallet.** It signs unattended; its
> secret sits in a build environment. The cap in `config/payoutLimits` bounds a
> *bug*, not a thief — only the balance does. See [`env-setup.md`](env-setup.md).

### 4.2 Lower the caps for the test

In `config/payoutLimits`, set `maxPerPayoutCsgn: 1000` and `maxPerRunCsgn: 1000`.
If anything is miscomputed, the run parks it for review instead of sending it.

☐ Caps written and confirmed.

### 4.3 One payout, one wallet, brand new

Create a settled test board or slate whose only winner is your **fresh, empty**
recipient, for **1,000 $CSGN**.

```bash
# Dry run first. Always.
curl ... -d '{"source":"squares","sourceId":"<test-board>"}' | jq
# Then, and only then:
curl ... -d '{"source":"squares","sourceId":"<test-board>","dryRun":false}' | jq
```

☐ `paid: 1`, `errors: []`, one signature returned.
☐ **Solscan the signature.** The transfer is there, the amount is 1,000 $CSGN,
   the sender is the payout wallet, the recipient is your fresh address.
☐ The recipient's **token account was created by this transaction** — this is the
   whole reason the test uses an empty wallet.
☐ `payouts/{id}` reads `status: confirmed` with the signature and `confirmedAt`.
☐ `payoutDays/{ET-date}.totalCsgn` incremented by exactly 1,000.
☐ An audit log entry exists.

### 4.4 Idempotency — the test that matters most

**Run the exact same command again, with `dryRun: false`.**

☐ `paid: 0`.
☐ **No second transaction on Solscan.** The recipient's balance is unchanged.
☐ No new ledger document.

> If a second transfer lands, **stop everything and do not run another payout.**
> The idempotency key or the ledger CREATE is broken, and every future run is a
> double-payment risk.

### 4.5 The failure paths

☐ **Over-cap:** request a payout above `maxPerPayoutCsgn`. It lands in `review`
   as `needs_review`, and **nothing is sent**.
☐ **Insolvency:** request more $CSGN than the wallet holds. The run refuses to
   start, writes no ledger entries, and reports `insufficient_csgn`. Nothing is
   half-paid.
☐ **Unconfigured:** unset `PAYOUT_WALLET_SECRET` on a preview deploy. A live run
   returns `payout_wallet_unconfigured` rather than silently paying nobody.

### 4.6 The Coin Jukebox paths

Still un-exercised on mainnet, and both take money *in*:

☐ Pay a spotlight in **SOL**. `verifySolPayment` accepts; the coin goes on air.
☐ Pay a spotlight in **$CSGN**. `verifySplPayment` accepts.
☐ Confirm both landed in the **treasury**, not the payout wallet.

### 4.7 Restore

☐ Put `config/payoutLimits` back to production values.
☐ Top the payout wallet to its intended float — a few days of prizes, no more.
☐ Record the test signatures somewhere durable. They're the proof this was done.

☐ **Gate:** every box in §4 ticked. The system is cleared to pay real winners.

---

## 5. Broadcast dry run

Full encoder setup is in [`obs-setup.md`](obs-setup.md). This is the pre-air check.

☐ Ticker: **Meme 100** leaderboard is readable at 100% zoom from across the room.
☐ Ticker: MLB rows show **record and games back** together, no clipping.
☐ Ticker: the detail face ("PROBABLE STARTERS") fills its space at full size.
☐ Ticker: **section dots** bottom-right count the games in the league, draw down
   as it rolls, and reset on the league wipe.
☐ `/player` in a Browser Source shows no Twitch chrome and no preroll ad.
☐ Audio present, levels sane, no double audio from a second source.
☐ Stream key set for **X**, or Restream if you're also going to Twitch (§ below).

```bash
node docs/obs/ticker-smoke.mjs   # all checks pass
```

---

## 6. What to do when a step fails

**Stop at the failing gate.** The steps are ordered by blast radius, and a
failure in §2 will reappear as a wrong number in §4 where it costs real tokens.

**Never "fix forward" past §4.4.** Any idempotency failure is a halt: the whole
payout path is unsafe until the cause is understood, not patched.

**Write down what failed and what you changed.** The next person running this —
including you in six months — needs the record more than they need the fix.
