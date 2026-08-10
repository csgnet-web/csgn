# The Show Bible — 7 PM to 3 AM ET, every night

> **Status: operating document.** The nightly block, hour by hour; what has to be built
> before it can run; the OBS scene; and the host rig.
>
> Sits under [`plan.md`](plan.md), which owns the quarter. This owns the night.
>
> **The premise:** the streak is the asset. Everything below is engineered so that the
> hardest night of the year still produces eight hours of television.

---

## 1. The shape of the night

7 PM–11 PM is **Prime** and 11 PM–3 AM is **Late** — the two highest-audience dayparts in
the category ([`design/csgn-share.md`](design/csgn-share.md) §2.3), and the block CSGN
already reserves as Originals.

**The design principle, because eight hours is not a show, it's a shift:**

> **Nobody is "on" for eight hours. Anybody can be on for twenty minutes, eight times.**

High-energy blocks alternate with formats that carry themselves. The recovery hours are not
filler — they are the load-bearing structure.

| ET | Block | Energy | What carries it |
|---|---|---|---|
| **7:00** | **THE OPEN** — cold open, the board, the day's tape, Called It | **Peak** | **You.** This hour is the show's identity |
| **8:00** | **THE INTERVIEW** (Tue–Thu) · Mailbag (Mon) · Film Room (Fri) | High | **The guest does the work** |
| **9:00** | **THE GAME** — CFB 27 dynasty | **Recovery** | Gameplay. Low talk, high watch-time |
| **10:00** | **THE DRAFT** — the 30-minute draft on air, then the whip-around | Medium | The community |
| **11:00** | **LATE OPEN** — reset for the West Coast, prime recap | **Peak** | You, second wind |
| **12:00** | **CO-VIEW / REACTION** | **Recovery** | The thing you're reacting to |
| **1:00** | **THE ROOM** — open mics, callers, degen hours | Medium | Callers |
| **2:00** | **LAST CALL** — tomorrow's board, credits, sign-off | Low | Ritual |

**The three recovery hours — 9 PM, midnight, 1 AM — are where you eat, rest your voice and
stop performing.** Protect them. They are the reason this is survivable, and the first
thing that will get eaten if the show starts running long.

### 1.1 The weekly grid

| | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|---|---|---|---|---|---|---|---|
| **8 PM** | Mailbag | **Interview** | **Interview** | **Interview** | Film Room | Extended Room | Co-view |

**Three interviews a week, not seven.** Nightly booking is the first thing that collapses,
and a missed guest is a dead hour. Monday's Mailbag and Friday's Film Room — a tape review
of the week's calls, yours and other people's — need no booking and produce the best clips.

### 1.2 Segment beats, so you never face a blank

Every hour is four ~13-minute beats plus a two-minute tease. That is the whole rundown
discipline, and it is what lets you improvise inside a structure instead of improvising the
structure. **THE OPEN**, worked example:

| | Beat | Notes |
|---|---|---|
| :00 | **Cold open** | 90 seconds, highest energy of the night. One take, no housekeeping |
| :02 | **The board** | Tonight's rundown graphic. What's coming, who's booked |
| :05 | **The tape** | The day's movers, Meme 100, what actually happened |
| :20 | **Called It** | The scoreboard. Yours and the room's, wins and losses both |
| :45 | **The chyron questions** | Holder questions from the queue ([`design/the-grid.md`](design/the-grid.md) §12.1) |
| :58 | **Tease** | Who's on at 8, one sentence, then out |

---

## 2. Say the burnout part out loud

**56 hours a week, live, solo.** Both `campaign.md` and `socialfi-era2.md` name
solo-operator burnout as the most likely cause of death for this project, and this document
takes the aggressive option deliberately and with open eyes.

So the mitigation is pre-committed rather than agonised over in the moment:

> **The tripwire.** If the 7 PM open is missed three times in any rolling 30 days, the block
> contracts to **7 PM–12 AM live** with the back half programmed. Automatically. Not a
> decision, a rule.

And the ladder, in the order you climb it — every rung already exists in the product:

1. **Recovery-hour formats** (9 PM, 12 AM, 1 AM) run at low effort by design.
2. **Guest hours** — a booked guest carries an hour you don't have.
3. **Drafted streamers** take 10 PM ([`design/token-voting.md`](design/token-voting.md) §3).
4. **Forwarded rooms** take 1 AM, permissioned.
5. **The Grid and VOD** take anything left ([`design/the-grid.md`](design/the-grid.md) §3).

**Cut the length, never the streak.** A five-hour night that happened beats an eight-hour
night that didn't.

---

## 3. What the audience does during the show

The Grid gives holders the *day*. The nightly block is where they get the *room*:

- **The Chyron Question** — supply share sets how many of your questions get asked. The
  guest is interviewed by the market. ([`design/the-grid.md`](design/the-grid.md) §12.1.)
- **The Draft**, live at 10 PM, with the vote on air.
- **Called It** — the permanent public record of who backed what.
- **The Credits** at 2:50, naming everyone who produced an hour that day.

---

## 4. The graphics you do not have

This is the blocking section. **Everything in this table is missing**, and the first two
make interviews impossible:

| Missing | Why it blocks the show |
|---|---|
| **A guest lower third** | There is no interview graphic anywhere in the codebase. The only person-plate is `csgn-nowwatching.html` — a *channel bug* with one name line and a hard-coded "Now Watching on CSGN" kicker. It cannot name a second person, has no handle or role line, and swapping it swaps the bug |
| **A TAKE button** | `csgn-lowerthirds.html` rotates three fixed cards on a ~3-minute timer. **There is no way to fire a graphic on demand.** You cannot conduct an interview on a timer |
| **A segment clock** | No ET clock, no elapsed timer, no segment timer on air anywhere. The three countdowns that exist are all wired to a vote or to the player's own state machine |
| **An on-air poll bar** | The vote renders a question and options; live tallies exist **only inside the admin panel**. There is no bar, no percentage, no result on screen |
| **A rundown board** | `UpNextPanel` is a real three-item board, but it renders **only during INTERMISSION** — i.e. only when nobody is live |
| **A question queue** | Nothing renders one. §3's best feature has no graphic |
| **A standings renderer** | The ticker does golf and the Meme 100. There is nothing you can point at a house league or segment results |

**The architectural constraint:** `/player` renders **no overlays over a live feed, by
design** — while a streamer is up, its only job is clean video. So show graphics are
**OBS-native browser sources layered in the scene**, exactly like everything already in
[`ops/obs/`](ops/obs). That is the right shape, and it means none of this touches the
player.

### 4.1 The build

**One control document, one admin tab, four browser sources.**

```
config/showControl        ← the live control-room doc (the config/broadcastGraphics
  segment  {name, startedAt, plannedSec}     spec from broadcast-graphics.md §5
  take     {kind, ttlSec, nonce}              that was specified and never built)
  guest    {name, handle, role, note}
  poll     {question, options[], showResults}
  rundown  [{time, title, guest?}]
  queue    [{handle, question, share}]
```

| Source | Renders | Priority |
|---|---|---|
| `csgn-showbar.html` | Take-able lower third, guest ID, segment clock | **P0** — interviews are blocked without it |
| `csgn-rundown.html` | "Coming up" board over the live feed | **P0** |
| `csgn-poll.html` | Live vote bar with percentages | P1 |
| `csgn-host.html` | The VTuber rig (§6) | P1 |

Plus a **Control Room** tab in Admin that writes `config/showControl` and has, above all
else, **a TAKE button**.

**Latency rule.** The existing assets poll `config/ticker` over REST every 6–10 seconds,
which is right for headlines and wrong for a show. Anything with a take button uses a
**Firestore `onSnapshot` listener** — push-based and sub-second — or a local WebSocket.
Keep the REST-polling assets exactly as they are; don't rewrite what works.

**Design constraints inherited from [`ops/obs/README.md`](ops/obs/README.md) §8, and they
are not negotiable:** each file standalone, dependency-free, no build step, one public
Firestore read. **The browser source reads, the admin panel writes, Firestore is the wire.
No asset ever writes state, so no asset can corrupt the broadcast.**

### 4.2 What you can already do from a phone, tonight

Before any of the above ships, the ticker is a more capable show tool than it looks. Two
arbitrary-text takeover surfaces already exist and land on air in about six seconds:

- **`config/ticker.chyron`** — full manual kicker / title / subtitle / pill, leading the
  rotation. This is a usable interview name-plate today if you accept it lives on the
  bottom band.
- **`config/ticker.breaking`** with `mode:"row"` — its own red bar in the ticker headroom
  while the band keeps rotating below.

Plus the Right Now rail (8 items, **60 characters each — the cap is enforced as you type**),
the coin spotlight, the X post rotation, the vote, Now Live / Up Next, and the on-air fan
counter. **Run the first month of the show on the chyron.** It is worse than a real lower
third and it is enough to start.

---

## 5. The room and the rig

### 5.1 Scene

One scene, built once, never switched — the existing doctrine, and it is correct. Add the
new sources above the ticker and below the interstitials:

```
1. csgn-lowerthirds.html   interstitials
2. csgn-showbar.html       ← new: guest ID, segment clock, take
3. csgn-rundown.html       ← new: coming up
4. csgn-poll.html          ← new: vote bar
5. csgn-host.html          ← new: the host rig
6. csgn-nowwatching.html   permanent bug
7. csgn-ticker.html        the BottomLine
8. csgn-pip.html           frames + labels (multi-source nights)
9. …video sources…
10. /player                the 24/7 program, bottom layer
```

### 5.2 Encoder — unchanged, and the one setting that bites

NVENC (or x264 `veryfast`), **CBR 6000 Kbps, keyframe 2s, 1920×1080 @ 30**, AAC 160 Kbps
48 kHz. RTMPS to X Media Studio → Producer; **Media Studio's own recommended ingest settings
win on any conflict.**

**Set every browser source to a custom frame rate of 30.** Leaving CEF at 60 against a 30 fps
output makes the browser render twice the frames OBS keeps, and is the usual cause of ~50%
skipped frames.

Audio: **only `Feed` carries audio.** Mute everything else in the mixer. Browser source fader
at 0 dB, Monitor Off.

### 5.3 The per-session ritual — the only manual steps

1. Start Streaming in OBS → go live in Media Studio.
2. Open the broadcast post on @CSGNet → copy the post URL.
3. Admin → **X Broadcast Post URL** → paste → Push.
4. At sign-off: Stop Streaming → **Clear** in Admin.

`csgn-master.lua` handles the rest — a 12-hour reload watchdog on the `/player` source, for
CEF memory creep on a machine that runs for weeks.

---

## 6. The host — a comic book, not an avatar

`csgn-host.html`. A transparent 1920×1080 browser source, standalone and dependency-free
like everything else in [`ops/obs/`](ops/obs). **Not Live2D, not VTube Studio** — the whole
point is that it looks like nothing else, and the project already has the exact skill that
makes bespoke browser graphics its unfair advantage.

### 6.1 The look

Heavy black ink line. Halftone dot fill. Paper grain. A stick figure with **weight** — the
line thickens on emphasis, the way an inker leans on a brush.

**The frame is a comic panel**, with a thick black border that **changes shape by segment**:
a splash page for the cold open, a two-panel split for interviews, gutter-separated cells
for the whip-around. Segment changes are **ink-bleed transitions** instead of the brand wipe.
The halftone palette cools as the night progresses, so **Late looks like Late** without
anyone being told.

### 6.2 The parts that make it a performance instead of a puppet

- **Mouth flap from mic amplitude.** `getUserMedia` → Web Audio `AnalyserNode` → RMS →
  mouth-open. No camera, no face tracking, works in the dark at 2 AM. (The browser sources
  already run with *Read and write to OBS* page permissions; the mic prompt needs handling
  once.)
- **Five expressions on number keys:** neutral, hype, dead-inside, suspicious, laughing.
  Five is enough. Twenty is a rig you never learn.
- **SFX lettering on function keys** — `POW`, `BRRRR`, `NGMI`, `SEND IT` — with speed lines
  and impact bursts. **This is the money feature.** It is the thing that gets clipped, and
  nobody in this category has it.
- **Caption boxes** (`MEANWHILE…`, `LATER THAT NIGHT…`) for segment changes, and speech
  balloons for punchlines.

### 6.3 Latency is the whole engineering problem

A face that reacts a second late is worse than no face. Drive expressions and SFX from a
**Stream Deck or numpad through obs-websocket JS injection** — local, no network in the
path, no dependency on Firestore being up. Reserve a Firestore `onSnapshot` listener for
slow changes only: costume, daypart palette, panel layout.

**Budget: under 100 ms from keypress to pixels.** If a bit needs two keys, it will not
happen live.

---

## 7. Do you need to dox? No — with four conditions

The evidence is better than the vibes on this one.

- A comparative study of VTubers against face-cam and no-face streaming finds VTubers
  produce significantly less **social richness**, but **no notable effect on interpersonal
  attraction, perceived credibility, or parasocial interaction**
  ([UCF](https://stars.library.ucf.edu/etd2020/1535/)). **The bond is not made of a face.**
- The lane is large and getting more indie: VTuber content set a record **571.9M watch hours
  in Q1 2026**, and **independents crossed 50.4% of total watch time** — solo creators with
  their own rigs ([Streams Charts](https://streamscharts.com/news/vtubers-q1-2026-report)).
- **Crypto is natively pseudonymous.** Most of the largest accounts in this category are a
  handle and a PFP. Nobody in your audience will think it's strange.
- **Sustainability is the decisive argument.** 56 hours a week on camera is punishing. A rig
  lets you broadcast sick, tired, unshaven, in the dark, on the worst day of the month. For
  a solo eight-hour nightly show, this alone probably decides it.
- **A face reveal is a one-time growth event you can only spend if you haven't spent it.**
  "Face reveal at 10k" is a lever that staying faceless keeps loaded.

**The conditions, which are the actual answer:**

1. **Be voice-forward and opinion-forward.** Anonymity is survivable; blandness is not. The
   rig removes your face, so everything else has to be louder — the takes, the record, the
   willingness to be wrong on air.
2. **The rig must react in under 100 ms across five emotions and three stock bits.** A
   character that can only idle and talk is worse than a webcam. **This is the real failure
   mode**, not anonymity.
3. **Perform it live.** Heavily automated and AI-driven content shows roughly **70% lower
   retention** than human-fronted work. Your hand on the hotkeys is the entire difference
   between a character and a screensaver.
4. **Keep a real track record.** Called It, the Book, published receipts, the buyback
   ledger. Credibility substitutes for a face — and it is the one thing here you already
   have the infrastructure to produce.

**Where it would go wrong:** a rig that can't emote, a host who hides behind it, or a
character with no opinions. None of those are caused by being faceless. They're caused by
being boring, which a webcam would not have fixed.

---

## 8. Before the first night

- [ ] `csgn-showbar.html` + the TAKE button. **Nothing else matters until this exists.**
- [ ] `csgn-rundown.html` and the rundown written for night one.
- [ ] Three guests booked for the first week — Tue, Wed, Thu.
- [ ] The chyron rehearsed as the interim name-plate (§4.2).
- [ ] `csgn-host.html` at v1: mouth flap, five faces, three SFX. Ship it ugly.
- [ ] Scene built, 30 fps CEF on every source, only `Feed` unmuted.
- [ ] A full dry run at 7 PM on a night you are not announcing.
- [ ] The tripwire in §2 written where you'll see it.
