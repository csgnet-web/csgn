# Testing the channel — proving each piece works

Five things to check, in the order that makes each one easy. Nothing here needs
a second person, a real streamer, or waiting for something to happen.

---

## 1. The 1:1 airtime ratio — 10 seconds, no deploy

```bash
npm run verify:airtime            # the standard table
npm run verify:airtime 1890000    # your own wallet
```

```
  holding            share       airtime       check   the sum
  ────────────────────────────────────────────────────────────
  1.89M            0.1890%        2m 43s          ok   1.89M ÷ 1B × 86,400 = 163s
  10.00M           1.0000%       14m 24s          ok   10.00M ÷ 1B × 86,400 = 864s
  300.00M         30.0000%         6h 0m          ok   300.00M ÷ 1B × 86,400 = 25920s  (capped)

  Properties
  ✓ doubling the bag doubles the airtime
  ✓ 1% of supply gets 1% of the day
  ✓ a 90% holder is capped at a quarter of the day
  ✓ the denominator is a constant, not a schedule
```

The script re-derives the rule independently of the server code and compares —
two derivations agreeing is evidence; one printed twice is not.

**Pass several balances** and it also shows how the day divides between them:

```bash
npm run verify:airtime 1890000 50000000 250000
```

### And in the product

Open **/studio** signed in as a holder. Under the reel bar it now prints the
sum itself:

```
1.89M $CSGN ÷ 1B × 86,400s = 2m 43s
```

If that line and the script disagree, the server is wrong — and that is the
whole reason the line is there.

### The unit tests

```bash
npx vitest run netlify/functions/__tests__/airtimeRatio.test.ts
```

Eleven tests, including the one that matters: **the entitlement does not shrink
because somebody else is on air.** Clips run 24/7; a streamer breaking in
pre-empts the reel, it does not deduct from anybody.

---

## 2. /player — every look, without going live

`/player` has a preview harness. Each of these renders a full-frame 1920×1080
graphic you can frame in OBS before it ever goes to air:

| URL | What it shows |
|---|---|
| `/player?preview=board` | The intermission board — the clip-mode programming |
| `/player?preview=ident` | Channel ident |
| `/player?preview=nowonair` | The lower-third for a live streamer |
| `/player?preview=clipcredit` | The credit card for a member's clip |
| `/player?preview=comingup` | The up-next panel |
| `/player?preview=starting` | "Starting soon" |
| `/player?preview=lastcall` | The last-call countdown |
| `/player?preview=brb` | The BRB card |
| `/player?preview=wipe` | The going-live wipe |
| `/player?preview=countdown` | The no-ads "Now Live" curtain |

### The real path

1. Open `/player` with nothing on air → the **intermission board** cycles: how
   to get on, the mode rule, up next, the token, the follow card.
2. Put somebody on air (§3) → within a minute the page flips to the feed with
   the going-live wipe over it.
3. Take them off → it reverts to the board.

**Flags worth knowing:**

- `?noads=1` — for an encoder whose feed is genuinely ad-free. Shorter mask,
  fixed 10-second countdown instead of the 33-second ad mask.
- `?peek=1` — drops the curtain to ~22% opacity so you can watch the raw
  Twitch startup behind it and see whether a preroll actually plays. **Never on
  a real broadcast source** — the feed shows through, ad and all.
- `?debug=1` — prints the FeedGate phase. Pair with `?peek=1`.

### The automated version

```bash
npx vitest run src/pages/Player.test.tsx
```

Drives the real component against a scripted fake of Twitch's embed API with
fake timers, one simulated second at a time, asserting the on-air invariant
every second: **the embed is never visible without the branded cover until the
gate has confirmed settled content.** No ad frame, ad countdown or Twitch
chrome can reach the encode.

---

## 3. Stream mode — end to end

### The setup, once

1. A member signs in and connects Twitch at **/account**
2. They tick **"Let CSGN put my stream on the channel"** — this is the
   forwarding grant, and it is re-checked every time, not just at link time
3. They appear on **/admin → Live Now** as soon as the poller samples them

### Putting them on

On the Master Control board:

- The **Up next — ranked** panel lists who to put on, best first, with a
  one-line reason and a score bar (audience · freshness · rotation · stake)
- Press **Put on** → the current block is assigned to them, `/player` cuts to
  their feed, `/watch` and `/schedule` say **Stream Mode** with their name
- Press **Back to clips** → the hour returns to the reel

### Checking it actually happened

| Where | What you should see |
|---|---|
| `/watch` | The mode card: "Stream Mode — <name>", with the reason |
| `/schedule` | The block's timeline bar gains a green segment |
| `/admin` → Creator Fees | The hour accrues against them |
| `public/channelMode` | A new log entry with the reason frozen in |

### Testing without a real streamer

Use a **guest**. Master Control → **Guest** → paste any Twitch URL and a name.
It goes on air exactly like a member, is marked *Guest · added by you*
everywhere, and earns no on-air minutes — so it exercises the whole path
without touching anybody's fees.

### Master mode

Master Control → **I'm going on**. No roster, no consent, no URL — it takes the
current block with `sourceType: 'master'`. It outranks a roster streamer and the
7 PM–3 AM block alike, and `/watch` reads **Master Mode**.

---

## 4. The block timeline on /schedule

Each block on `/schedule` carries a bar showing what actually ran on it — clips
for the first 37 minutes, a streamer for the rest, back to clips when they
dropped. It is drawn from the published switch log, not from what was planned.

### What you should see

- A block with **no switches inside it** draws one solid bar of whatever was on
  — that is the commonest case and is not an empty block
- A **live block** stops at now, with the last segment pulsing, rather than
  claiming the rest of the hour
- A **future block** draws nothing at all
- A block **older than the log** draws nothing, rather than guessing

### Forcing a visible one

Put a guest on for two minutes, then take them off. The current block's bar
splits into clip / stream / clip within a minute of each action, because
`adminLiveNow` republishes the mode immediately rather than waiting for the
poller.

### The automated version

```bash
npx vitest run src/lib/modeTimeline.test.ts
```

Nineteen tests, one per permutation: switches before the block, inside it,
spanning it; one streamer handing to another; every mode in one block; a live
block; a future block; a log that does not reach back; slivers from a mis-click;
a log arriving newest-first; unparseable timestamps.

---

## 5. Notifications — being told, not watching

### In the browser

`/admin → Live Now → Alerts off` → grant permission. Desktop notifications
fire once per distinct condition and re-arm when it clears. Works only while
the tab is open.

### On your phone

Set **one environment variable** in Netlify:

```
OPERATOR_WEBHOOK_URL = https://discord.com/api/webhooks/...
```

Any URL that accepts a JSON POST works — Discord, Slack, or your own. The
payload carries both `content` and `text`, so it works on either without
configuration.

You then get a message like:

```
**CSGN — Master Control**
🔴 roblito went offline. someone is live with 42 watching.
https://csgn.fun/admin
```

### The rule that keeps it switched on

**Nothing is ever sent twice.** An alert fires every minute for as long as its
condition holds; a naive relay would send sixty an hour and be muted by
lunchtime. Sends are deduped by *kind + subject* — not by message text, because
the viewer count in it changes every minute — and the key is dropped when the
condition clears, so a problem that resolves and recurs is announced again.
`info`-level alerts stay on the board and never reach your phone.

```bash
npx vitest run netlify/functions/__tests__/notify.test.ts
npx vitest run netlify/functions/__tests__/streamerRank.test.ts
```

### Testing it without waiting for something to happen

The simplest trigger: put a guest on air with a URL for a channel that is
offline. Within a minute the poller sees an on-air occupant that the roster
cannot confirm is live and raises `on_air_dropped` — critical, so it goes to
the webhook immediately.

---

## Everything at once

```bash
npx tsc -b && npm run lint && npm test && npm run build
```

782 tests. The ones specific to what is described above:

| File | Covers |
|---|---|
| `airtimeRatio.test.ts` | The 1:1 promise as arithmetic |
| `modeTimeline.test.ts` | Every permutation of a block changing hands |
| `streamerRank.test.ts` | Who goes on next, and why |
| `notify.test.ts` | Never sending the same thing twice |
| `channelMode.test.ts` | Mode precedence, and the public reason |
| `Player.test.tsx` | The on-air invariant, second by second |
