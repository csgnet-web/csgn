# Testing the channel — proving each piece works

Seven things to check, in the order that makes each one easy. Nothing here needs
a second person, a real streamer, a connected TikTok account, or waiting for
something to happen.

**Start with §0 if you are setting OBS up.** It is the whole channel, on a loop,
in two minutes, with no accounts involved.

---

## 0. The rehearsal — the whole channel, no accounts, two minutes

Point an OBS browser source at:

```
/player?rehearse=run
```

and watch the channel do every single thing it can do, on a loop:

```
clip (90s)  →  stream (45s)  →  master (45s)  →  clip (45s)  →  repeat
```

That order is the product: the reel is the floor, a streamer breaks in over it,
you pre-empt them, and the reel picks up where it left off. It is also the part
with the timers in it, which is the part that goes wrong.

**Every frame carries a REHEARSAL watermark**, top right. A rehearsal renders
the real components on demo footage, so a frame of it is otherwise
indistinguishable from the real channel in a screenshot — and an operator who
forgets to strip `?rehearse=` off a browser source would broadcast rehearsal
footage with nothing on screen to say so.

### Holding one mode

| URL | What it shows |
|---|---|
| `/player?rehearse=clip` | The member reel, forever — ident, board, clip, hand-over |
| `/player?rehearse=stream` | A live feed through the real gate (`&channel=name`) |
| `/player?rehearse=master` | The master stage — what airs while you are on your own encoder |
| `/player?rehearse=live` | **Your own links** — see §0b |

### Knobs

- `&leg=20` — seconds per leg of the run
- `&clip=10` — seconds per demo clip
- `&channel=xqc` — the channel a stream leg tunes
- `&board=6` — seconds of network board between clips (a rehearsal already
  turns this down; the live default is 60)
- `&debug=1` — the overlay now prints the **published channel mode** next to the
  state machine's own mode, which is what you want when the question is "why is
  the reel playing"

### What it proves, and what it does not

It proves the LOOK and the TIMING: every card shape a member can choose, the
ident between segments, the wipe, the hand-over, and that master mode gets out
of the way. It proves nothing about YOUR links — that is §0b.

```bash
npx vitest run src/lib/rehearsal.test.ts    # 17 tests
```

---

## 0b. Rehearse with your own clips — the real pipeline, no member

**Master Control → Clips → Rehearse the reel.** Paste up to twelve links, press
**Build rehearsal**, then open `/player?rehearse=live`.

Those links go through the **real** parser, the **real** short-link resolution,
the **real** metadata lookup, the **real** crop and the **real** playlist
builder. What comes back tells you, per link:

- whether it parses at all (and if not, the message a member would have seen)
- which platform it resolved to, and its canonical URL
- **whether the duration came back measured or guessed** — the single most
  useful thing on the screen, because a pasted TikTok falls back to a 45-second
  assumption and a connected one does not

You can also set the handle, look, shape and motion the segments wear, which is
how you find out the ticker card collides with your own lower third before it
does.

**It cannot reach the broadcast.** It writes one document —
`public/airtimeScheduleRehearsal` — that `/player` only reads when explicitly
asked with `?rehearse=live`. The live reel keeps running untouched, so this is
safe to use while the channel is on air. **Clear** empties it.

The one step it substitutes is **allocation** — how many seconds a member's bag
buys. That comes from the day lock, which is the record payouts settle against
and has no business near a test. The arithmetic it skips is the most thoroughly
proven thing in the codebase (§1).

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
| `/player?preview=master` | The master stage — what airs while you are on your own encoder |

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

**`/player` now gets out of the way.** It used to read "assigned slot, no stream
URL" as "fall back to the house channel", so the moment you took your own
channel your own network page armed `twitch.tv/csgnet` and either sat on
"Starting soon" or started playing somebody's TikTok over your live broadcast.
It now draws a master card and suppresses everything else.

Two setups, and you should pick one deliberately:

- **`/player` is your only visible source** — leave it, the card is the picture.
- **`/player` is one layer over your own scene** — add **`?master=clear`** and it
  draws nothing while you are on.

Check the card before your first takeover with `/player?preview=master`.

**The 7 PM–3 AM block is NOT this.** That hour is master mode on the sign with
no encoder behind it, so the reel keeps the channel alive underneath — clips run
24/7. The difference is published as `encoder` on `public/channelMode` and
pinned by tests, because the mode alone cannot tell the two apart and /player
had nothing else to read.

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

## 6. The Right Now rail, written automatically

**Master Control → Broadcast Control → the writer panel.**

### Try it without airing it

Press **Try it — don't air it**. One model call; the lines it wrote appear
below, and nothing reaches the broadcast. This is the whole point of the panel:
it is the difference between switching on a writer you have read and one you
have not.

You also see **what was rejected and why** — `advice`, `contains_link`,
`bad_tag`, `duplicate`. A model failing the same check every run is a prompt
problem, and this is the only place it becomes visible.

### What is wired up

The panel names the two wires separately, because "it is not running" has
different causes:

| Wire | Green | Not green |
|---|---|---|
| **Model** | the model id it will use | `ANTHROPIC_API_KEY` is not set — nothing runs |
| **Source** | X timeline | Meme 100 board — **not a fault**, see below |

**X is optional and costs about $200/month** (their recent-search endpoint is
not on the free tier). Without it the writer reads the channel's own Meme 100
board instead, which the poller already rebuilds every five minutes at no extra
cost. The rail keeps updating either way. See
[`docs/decisions.md`](decisions.md) §1.

### What can never happen

A model's line is a suggestion until `vetLines` accepts it in code — length,
character set, no links, no @handles, no profanity, nothing that reads as
financial advice. Posts pulled from X are untrusted input in the strictest
sense (anyone can write one, and "ignore your instructions" is a post), so they
reach the model inside a delimited block labelled as data, and the model is
never the control.

**A holder's paid line is never written over.** They hold five million $CSGN for
one line a day; the writer fills only what is left, and writes nothing at all
when holders have filled the rail.

```bash
npx vitest run netlify/functions/__tests__/rightNow.test.ts   # 37 tests
```

### Switching it off

**Switch off** in the panel. The rail keeps whatever holders put on it and
nothing is written or spent. It takes effect on the very next tick — the
scheduled function checks it before it checks anything else.

---

## 7. The minute tracker, and the intro

### Is the on-air clock right?

Put a guest on **partway through a block** — that is the case that was broken.

| Where | What you should see |
|---|---|
| `/admin` → Live Now | on-air minutes counting from **when you pressed the button**, not from the top of the hour |
| `/watch` mode card | "since" showing the same instant |
| The operator alert | nothing, until they have genuinely been on a while |

Before this, a streamer put on 47 minutes into a two-hour block was reported as
having been on air for 47 minutes the moment they went on, and the alert that
watches that number fired immediately.

```bash
npx vitest run netlify/functions/__tests__/onAirClock.test.ts   # 17 tests
```

### Is the airtime figure a duration or a sample count?

**Both, and they are labelled differently now.** `42 of 48 checks live` is the
ratio that decides the money; a duration says `1h 47m` and comes from
`liveSeconds`, which credits the measured gap between samples.

If you see a bare `~14m` anywhere, that is the old bug: the poller runs every
two minutes and backs off to four or ten, so a sample count read as minutes is
wrong by 2× at best.

### The intro

`/watch?intro=1` reopens the first-run sheet at any time, signed in or out —
for checking a copy change without clearing site data.

**It must never appear on `/player`.** `/player?intro=1` is a test worth running
by hand once: a sheet over an OBS browser source goes out on television.

```bash
npx vitest run src/lib/firstRun.test.ts   # 14 tests, half of them that one rule
```

---

## Everything at once

```bash
npx tsc -b && npm run lint && npm test && npm run build
```

933 tests. The ones specific to what is described above:

| File | Covers |
|---|---|
| `airtimeRatio.test.ts` | The 1:1 promise as arithmetic |
| `modeTimeline.test.ts` | Every permutation of a block changing hands |
| `streamerRank.test.ts` | Who goes on next, and why |
| `notify.test.ts` | Never sending the same thing twice |
| `channelMode.test.ts` | Mode precedence, and the public reason |
| `Player.test.tsx` | The on-air invariant, second by second |
| `rehearsal.test.ts` | The scripted run, and the demo reel's shape |
| `reel.test.ts` | Clock playout vs loop, and every malformed schedule |
| `rightNow.test.ts` | What a model may and may not put on the broadcast |
| `onAirClock.test.ts` | How long the current cut has been running |
| `firstRun.test.ts` | The intro, and the surfaces it must never cover |
