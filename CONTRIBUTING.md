# Contributing to CSGN

CSGN is open source under the [MIT licence](LICENSE). The code is yours to read,
run, fork and ship. The brand and the wallets are not — see the trademark note at
the bottom of the licence.

This file covers three things: getting it running, the rules the codebase
actually holds itself to, and how to run your own network on it.

---

## 1. Getting it running

```bash
git clone https://github.com/csgnet-web/csgn
cd csgn
npm install
cp .env.example .env     # fill in Firebase — see docs/env-setup.md
npm run dev              # http://localhost:5173
```

```bash
npm test          # vitest, ~475 tests
npm run lint      # eslint
npm run build     # tsc -b && vite build
```

All three must be green before a PR. There is no CI babysitter that will catch
it for you later.

**You do not need a Solana wallet, a Twitch app, or a funded treasury to work on
most of this.** The game engines, the payout ledger, the ratings maths and the
banner logic are all pure modules with no I/O — they're the majority of the
interesting code, and they're fully testable from a cold clone.

---

## 2. The rules this codebase keeps

These aren't style preferences. Each one is here because breaking it caused a
real bug, and the tests that pin them down will fail if you break it again.

### Pure core, thin edges

Anything that decides an outcome — who won, what gets paid, what's on screen —
lives in a pure module that takes state and returns state. No Firestore, no
clock it wasn't handed, no `fetch`. The I/O sits in a thin wrapper around it.

That's why a settlement can be exercised in a REPL ([`docs/dry-run.md`](docs/dry-run.md) §2)
and why "does this pay the right person" is a unit test rather than a mainnet
experiment.

### Never `Math.random()` where money is involved

Every draw is derived from a published Solana blockhash through
`src/lib/games/provablyFair.ts`, so a stranger can reproduce it. If you need
randomness in a payout path and you're reaching for `Math.random()`, you want
`seededShuffle` instead.

### Money code fails closed

A payout that can't be verified is not paid. A lottery with no seed **refuses to
draw** rather than picking the first row. A settlement against a dead price feed
**rolls the purse over** rather than paying everyone. If you're adding a fallback
to a money path, the fallback is "don't pay", never "pay anyway".

### Idempotency is enforced by the database, not by care

Payout ids are derived from what a payout is *for* — never a timestamp, never a
counter, never a nonce — and claimed with a CREATE that fails if the id exists.
If you find yourself adding a nonce to make a retry work, you've broken the
double-payment guarantee. Read `netlify/functions/_shared/payouts.ts` first.

### Comments explain *why*

The codebase is heavily commented and deliberately so. Not "what this line
does" — the code says that. Why the multiplier is capped at 2.5×, why the rake
rounds down, why the signature is written before the broadcast. If the reason
isn't obvious in six months, write it down.

### One rule, one place

`slotIdentity` decides who's on an hour. `boardEconomics` decides what a board
pays. When two surfaces disagreed about a slot label, the fix wasn't to make them
agree — it was to delete one of them. Prefer a shared pure function over a
consistent copy-paste.

---

## 3. Running your own node

The whole point of open-sourcing this is that a network shouldn't need our
permission to exist. To run your own:

1. **Fork it and rebrand.** Change the name, the logo (`public/`), and the
   marks in `docs/obs/`. Don't call it CSGN.
2. **Point the addresses at wallets you control.** `CSGN_MINT`, `CSGN_TREASURY`
   in `src/lib/slots.ts`; `CSGN_PAYOUT_WALLET` in
   `netlify/functions/_shared/payouts.ts`; the mirrors in
   `netlify/functions/_shared/solana.ts`. **Leaving ours in means paying us.**
3. **Stand up your own Firebase + Netlify.** [`docs/env-setup.md`](docs/env-setup.md)
   lists every variable and which are secret.
4. **Set your own schedule.** `netlify/functions/_shared/schedule.ts` defines the
   twelve daily blocks and which are network-reserved. It's a template, not a law.
5. **Do the dry run before you pay anyone.** [`docs/dry-run.md`](docs/dry-run.md).
   §4.4 in particular — the idempotency test — is not optional.
6. **Get your own legal advice on the games.** Entry fees and prize payouts are
   regulated. Ours were reviewed for our structure in our jurisdiction; that
   tells you nothing about yours.

The OBS assets in `docs/obs/` work against any Firestore project — they're static
HTML that reads a config document. Point them at yours and the broadcast layer
works on day one.

---

## 4. Broadcasting

**X is the recommended output.** OBS captures `/player` and streams to X Media
Studio over RTMPS. One destination, one encoder, no third party in the path.

**Use [Restream](https://restream.io) if you also want to be on Twitch.** OBS
sends one stream to Restream, which fans it out to X and Twitch simultaneously.
Costs a subscription and adds a hop, but it's the only sane way to hit both
without running two encoders. Configure it as your single RTMP target and let it
handle the split — see [`docs/obs-setup.md`](docs/obs-setup.md).

Streamers on the network keep streaming to **their own** Twitch channels. Only
the network's output stream goes to X.

---

## 5. Pull requests

- **Branch from `main`.** Small PRs, one concern each.
- **Tests with behaviour changes.** Especially in `src/lib/games/` and
  `netlify/functions/_shared/` — a money-path PR without tests won't be merged.
- **Say what you verified.** "Tests pass" is not the same as "I ran the dry run
  and the ledger balanced." Be specific about which you did.
- **Flag anything touching a wallet, a purse, a cap, or a rake** in the PR title.
  Those get read line by line.

### Reporting a security issue

**Do not open a public issue** for anything that could move tokens: a payout
double-spend, a signature-verification gap, a Firestore rule that exposes
ballots. Mail the maintainers or DM [@CSGNet](https://x.com/CSGNet) and give us a
chance to fix it before it's public.

Everything else — bugs, ideas, "why is it like this" — is welcome in the open.
