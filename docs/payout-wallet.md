# The payout wallet

> **Status: retained, unwired.** Squares and Starting 5 were removed from the
> product, and they were this engine's only two sources. `_shared/payouts.ts`,
> `_shared/payoutWallet.ts` and `_shared/payoutRunner.ts` are still here and
> still tested, but **nothing calls them** — the `adminRunPayouts` endpoint went
> with the games.
>
> That is deliberate. This is the most carefully built code in the repository and
> the next thing that pays anybody — season prizes, airtime rewards, anything
> $CSGN-denominated — should route through it rather than grow a second transfer
> path beside it. What follows is the contract that new caller inherits.
>
> SOL creator fees do **not** run through here. They are sent by hand and
> recorded via `adminMarkFeesPaid`, until the pull-based claim contract in
> [`plan-twitch-first-claim.md`](plan-twitch-first-claim.md) §5.3–5.5 exists.

```
EftavCt6Tk2bzWJ9Dnz7cAvfa5RAnh8S9vZcrorV7Hmv
```

`_shared/payouts.ts` (rules, pure) · `payoutWallet.ts` (signing) ·
`payoutRunner.ts` (sequence) · no endpoint · 53 tests

This is the highest-consequence code in the repository. Everything else, at worst,
shows someone the wrong number. This spends money, irreversibly, to strangers,
unattended, on a schedule.

It is built on one assumption: **this process will crash mid-run.** Not might —
will. Netlify functions have a wall-clock limit, RPC times out, a deploy lands at
3 AM while a settle is halfway through the field. Every rule exists so that when
it happens, nobody is paid twice and nobody is skipped.

## The four guarantees

**1. Idempotent by construction.** A payout's id is derived from what it's *for* —
`source:sourceId:wallet` — never from a counter, a timestamp, or a nonce. Any of
those would make a retry look like a new payout. Re-running a settlement produces
the same ids, and the ledger write that claims one is a **CREATE**, which fails if
the id exists. Double payment isn't prevented by being careful; it's prevented by
the database refusing.

**2. Signature recorded before broadcast.** We sign, write the signature to the
ledger, and only then send. Crash between the two and recovery re-broadcasts the
*identical* signed transaction — same signature, so the cluster deduplicates it.
Broadcasting first and recording after is the classic way to pay twice.

**3. Capped at every level.** Per payout, per run, per ET day, tunable from
`config/payoutLimits` without a deploy. A bug that computes a nine-figure prize
hits a ceiling and files for review instead of emptying the wallet. When a ceiling
truncates a run, payouts go out largest-first — a truncated run should pay the
winner, not the tenth-place consolation.

**4. Solvent before the first transfer.** A run that can't cover its whole field
never starts. The check budgets **associated-token-account rent for first-time
recipients** — which for a network whose job is turning viewers into holders is
the common case, not the edge case. Budgeting zero for it is how a payout run dies
on its first real new user.

## Recovery

| Ledger state | Action | Why |
|---|---|---|
| `confirmed` / `failed` / `needs_review` | skip | Terminal |
| `pending` | re-sign | No signature was ever recorded, so nothing was broadcast |
| `sending` **with** a signature | **ask the chain** | It may or may not have landed. Never re-sign — that creates a second transaction that could also land |
| `sending` **without** a signature | back to `pending` | A torn write. The signature is written first, so this can only mean nothing was sent |

An `unknown` answer from the chain leaves the record in `sending` for the next run
to ask again. That's a payout that stays stuck rather than one that pays twice,
and between those two failure modes there is no contest.

## What the next caller must not break

These are not style preferences. Each one is a way the engine pays twice or pays
the wrong person.

- **Dry-run by default.** The endpoint that returns must require an explicit
  `dryRun: false` to move a token. An endpoint that pays by default is one
  fat-fingered curl from an incident — and the dry run returns the batch, the
  solvency check and the review queue, which is what you wanted to see anyway.
- **Recipients are never accepted from the request body.** They are recomputed
  server-side from a stored document. A payout endpoint that pays whoever the
  caller names is not a payout endpoint, it's a withdrawal endpoint. Whatever
  replaces the settled-game document — a settled season standing, a settled
  airtime ledger — has to be *stored and settled first*, then read.
- **A new source is a new value in the `PayoutSource` union plus a request
  builder beside the others.** That is using the ledger as designed. If a change
  requires editing the run sequence itself, the design is wrong — stop and
  re-plan rather than editing the sequence.
- **Key handling** is in [`env-setup.md`](env-setup.md) — hot wallet, thin float,
  rotate freely.
- **Nothing here has ever touched mainnet.** Before it pays anyone, walk
  [`dry-run.md`](dry-run.md) §3–§4 in full, including the tiny real payment.
