# The Graphics Package — the show's on-air look

> **Status: design.** Every graphic the nightly show needs, specified so a developer can
> build it without guessing a single value.
>
> **This is a separate system from the ticker.** The BottomLine
> ([`ticker-football.md`](ticker-football.md), `ops/obs/csgn-ticker.html`) renders sports
> data from its own control document on its own refresh cycle. The graphics package renders
> *the show*, from `config/showControl`, on its own. Neither reads the other's state, and
> nothing here changes the ticker.
>
> Companions: [`../shows.md`](../shows.md) (which graphic each segment calls for),
> [`../show-bible.md`](../show-bible.md) (the OBS scene and the host rig),
> [`broadcast-graphics.md`](broadcast-graphics.md) (why the layer is built this way).

---

## 1. Architecture — four sources, not sixteen files

One control document and **four mode-driven browser sources**. Sixteen single-purpose files
would be sixteen things to keep in brand; four mode-driven ones share a stylesheet and one
control surface.

| Source | Size | Modes |
|---|---|---|
| `csgn-showbar.html` | 1920×1080 | name plate · guest ID · topic bar · segment clock |
| `csgn-fullframe.html` | 1920×1080 | `TAKE` `MATCHUP` `TOP25` `STANDINGS` `STAT` `TALE` `TIER` `PICKS` `RUNDOWN` `QUESTION` `POLL` `CREDITS` |
| `csgn-bug.html` | 1920×1080 | channel bug + ET clock + LIVE dot + referral lockup |
| `csgn-clip.html` | **1080×1920** | hook · lower · stat · end card |

Each file inherits the doctrine from [`../ops/obs/README.md`](../ops/obs/README.md) §8 and
must not break it: **standalone, dependency-free, no build step, one public read.** The
browser source reads, the admin panel writes, Firestore is the wire, and no asset ever
writes state.

### 1.1 The control document

```
config/showControl
  segment  { name, startedAt, plannedSec }
  take     { kind, payload, ttlSec, nonce }   ← nonce change = fire it now
  guest    { name, handle, role, note }
  poll     { question, options[], tallies, showResults }
  rundown  [{ time, title, guest? }]
  queue    [{ handle, question, sharePct }]
  referral { enabled, url, tag }
```

### 1.2 Latency — the one place this differs from every other asset

The ticker polls `config/ticker` over REST every 6 seconds, which is correct for headlines
and **fatal for a live show**. A take button that fires up to six seconds later is not a take
button.

**The graphics package uses a Firestore `onSnapshot` listener** — push-based, sub-second.
`take.nonce` changing is the trigger; the payload rides along with it. Everything slow
(rundown, referral config) can ride the same listener at no extra cost.

### 1.3 The Control Room

A new admin tab writing `config/showControl`. The single most important element on it is a
**TAKE button** — big, unambiguous, and reachable on a phone. Everything else is secondary:
guest fields, rundown rows, poll controls, segment start/stop.

---

## 2. Brand tokens — quoted from source, not invented

Every value below is already in the codebase. Reproduce, don't reinterpret.

### 2.1 Palette

```css
--red:      #ff2346;   /* the brand */
--red-deep: #7d1010;   /* accent-bar gradient terminus */
--shell:    #0b0b0e;   /* chrome */
--panel:    rgba(10,10,13,.92);
--ink:      #fff;
--muted:    #9a9aa4;
--gold:     #ffcf40;
--green:    #68ff7a;
--loss:     #ff4b4b;
```

**Where the web and broadcast palettes fork, broadcast wins.** The app uses `#ffb020` gold,
`#35ff8a` green and `#ff4d6a` negative; all four OBS files use the values above. **The
package is a broadcast asset — use the broadcast values.** State it once, hold it forever.

Supporting values in use: vote/info blue `#7ad0ff`, X blue `#1d9bf0`, TV-badge blue text
`#a9ccff` on `rgba(70,140,255,.15)` with a `rgba(95,160,255,.45)` border, and the grey
ladder `#e8e8ec` → `#c9c9d2` → `#b6b6c0` → `#9a9aa4` → `#4a4a54`.

### 2.2 Type

```css
--cond: "Roboto Condensed","Arial Narrow",Arial,system-ui,sans-serif;
--mono: ui-monospace,"JetBrains Mono",Consolas,monospace;
```

**Roboto Condensed, not Space Grotesk.** The broadcast look is `font-weight:900` +
`font-style:italic` + `text-transform:uppercase` + `line-height:1`, and Space Grotesk only
loads to 700 — `font-black` synthesises and looks soft on the encode. Numbers are mono with
`font-variant-numeric: tabular-nums`, always, so digits don't jitter as they change.

Established sizes to match: title **56px/900 italic** · kicker **22px/800** at `.16em` ·
sub **28px/700** · brand chip 20px/900 italic · team abbreviation 40px/900 · score 47px/900 ·
record 27px/800 mono. Letter-spacing runs `.16em`–`.18em` on kickers, `.01em`–`.02em` on
headlines.

> **The sizing rule from the BottomLine spec applies to everything here:** *if a face reads
> comfortably on your laptop it is almost certainly too small on stream.*

### 2.3 The card grammar — every graphic is built this way

```
[12px accent bar] [ near-black panel, hairline border, generous padding ]
```

```css
.accent { width:12px; flex:none;
          background:linear-gradient(180deg,var(--red),var(--red-deep));
          border-radius:4px 0 0 4px }
.body   { background:var(--panel); border:1px solid rgba(255,255,255,.08);
          border-left:none; border-radius:0 6px 6px 0;
          padding:20px 34px 22px; backdrop-filter:blur(3px) }
.shell  { filter:drop-shadow(0 12px 34px rgba(0,0,0,.55)) }
```

Square where the accent meets the body, rounded on the outer corners. Radii ladder: 4–6px on
panels, 8–10px on chips, 14px on window frames.

**The mark** hangs off the panel's top-right corner at `top:-16px; right:-14px` — `CS**G**N`
with the G in `--red`, white on `#0c0c0e`, `1px solid rgba(255,35,70,.5)`, 6px radius.

### 2.4 Safe area

**64px** from left and right. **150px** from the bottom — this clears the ticker band and its
headroom, and it is non-negotiable; a graphic that collides with the BottomLine makes both
look broken. **64px** from the top.

### 2.5 Motion

```css
/* graphic in/out */   transform .5s cubic-bezier(.2,.9,.2,1), opacity .5s
/* wipe travel */      transform 540ms cubic-bezier(.7,0,.2,1)
/* roll / rise */      cubic-bezier(.22,1,.36,1)
```

**Content changes crossfade, never cut.** The established pattern is a 300ms opacity
transition with the text swapped at the 220ms midpoint — *"so a change reads as a graphic,
not a flicker."* Copy it exactly.

Live dot: `pulse 1.2s ease-in-out infinite`, 14px, `box-shadow:0 0 12px var(--red)`.

---

## 3. `csgn-showbar.html` — the take-able lower third

**The P0 graphic.** Interviews are impossible without it: there is currently no guest plate
anywhere in the repo, and the existing lower thirds rotate on a fixed 180-second timer with
no way to fire one on demand.

| Mode | Renders |
|---|---|
| `name` | Kicker + name + subtitle. The host plate |
| `guest` | **Two-line guest ID**: name, `@handle`, role/affiliation. The thing that doesn't exist today |
| `topic` | Segment title bar — `THE TAKE`, `THE RECEIPT`, `FILM ROOM` |
| `clock` | Segment countdown, top-right, mono tabular |

Behaviour: fires on `take.nonce`, holds for `ttlSec` (default 12s), animates out. Never
auto-rotates — **the operator decides, always.** Geometry follows the established shell:
`left:64px; bottom:150px`, min-width 760px, max-width 1180px.

The segment clock is deliberately a mode of this file rather than its own source: it shares
the shell, the type, and the control doc, and one fewer browser source is one fewer thing to
go wrong at 1 AM.

---

## 4. `csgn-fullframe.html` — the card deck

One file, twelve modes, one stylesheet. Every mode is the §2.3 grammar at full-frame scale.

### 4.1 Show modes

**`TAKE`** — the clip engine. A single claim, set enormous, with the segment kicker above and
an optional attribution line below. This is what sits behind the host during a clip beat and
it is what makes a two-minute reel look like television. Keep it to one sentence; if it
wraps three lines it is two takes.

**`RUNDOWN`** — what's on now and what's next, three rows. The version that exists today
renders only during INTERMISSION, i.e. only when nobody is live, which is exactly backwards
for a show.

**`QUESTION`** — a holder question: the question, the asker's handle, their supply share as a
chip. Turns a tally into a moment.

**`POLL`** — question, options, **live bars with percentages**. No on-air vote bar exists
today; tallies live only inside the admin panel.

**`CREDITS`** — the 2:50 roll. Everyone who produced an hour that day.

### 4.2 Football modes

**`MATCHUP`** — the fundamental unit of football television. Two teams with logos, **overall
and conference records**, rank chips, kick time, TV badge, venue, and **the spread and total
as market data**. No pick, no units, no lock of the day — the number is context, the way a
broadcast has always shown it.

**`TOP25`** — the Aug 17 deliverable. Paged five at a time under a static rail, with
**movement arrows** against the previous poll. Rankings are the most-argued artifact in
college football, and this single graphic is the entire "be the scoreboard" strategy made
concrete. Fed by CollegeFootballData, which carries previous-week rank; ESPN's scoreboard
gives current rank only, with no delta.

**`STANDINGS`** — conference or division table. Zebra-free: a leader-highlighted row in gold
on `rgba(255,207,64,.16)`, matching the golf board's established treatment.

**`STAT`** — one player or team line, set big. The `THE NUMBER` graphic.

**`TALE`** — tale of the tape. Head-to-head stat bars, away left, home right, category
centred. Reuses the existing `stats / stat-side / stat-mid` three-column shape.

**`TIER`** — the tier board, S through F. The most-shared ranking format in sports.

**`PICKS`** — the week's picks with the **published win-loss record** attached. The record is
the point; without it this is just opinions in a box.

---

## 5. `csgn-bug.html` — the permanent furniture

Always on screen. Three elements in one source:

1. **The channel bug** — `CS**G**N` mark, bottom-left by default, `?pos=` switchable.
2. **The ET clock and LIVE dot** — specified in `broadcast-graphics.md` §3 as part of `Bug`
   and never built. **There is currently no clock anywhere on air.**
3. **The referral lockup** — §6.

Behaviour inherited from the existing bug: never blank, never rotate away, crossfade on
change, and keep last-good on a failed read so a network blip can't blank the furniture.

---

## 6. The referral lockup — and the disclosure that rides with it

`bullpen.fi/@CSGN` gets a permanent, first-class lockup. It renders in the §2.3 grammar —
accent bar, dark panel, hairline border — with the URL in condensed 900 and a persistent
**`REFERRAL`** tag in the same chip.

**The tag is not optional and it is not small print.**

The FTC Endorsement Guides require disclosing a material connection whenever money changes
hands on a click. The disclosure must be **clear, conspicuous, and near the link** — burying
it, or putting it behind a "more" link, does not satisfy the requirement. Crypto and digital
asset endorsements draw heightened scrutiny specifically, and **"not financial advice" does
not cure an undisclosed commission**
([FTC guidance summary](https://www.referralcandy.com/blog/ftc-affiliate-disclosure/),
[crypto-specific](https://terms.law/Trading-Legal/guides/ftc-endorsement-guidelines.html)).

This is also not a new standard for this project. The house rule is already that **unlabeled
paid promotion of a financial asset is the single mistake that can actually end a network**,
and the Coin Jukebox already stamps `PAID SPOTLIGHT` automatically, with the payment endpoint
setting the flag so it cannot be switched off.

**Treat it the way broadcast has always treated sponsorship** — labelled, permanent, and more
professional for it. A visible `REFERRAL` chip reads as a real network with real commercial
relationships. An unlabelled affiliate link reads as something else entirely.

The same lockup, with the same tag, appears on the `end` mode of the clip kit (§7), because
that is where most people will actually see it.

---

## 7. `csgn-clip.html` — the 9:16 kit

**1080×1920.** A 1920×1080 lower third is useless inside a reel — it either crops to nothing
or shrinks below readability. The vertical kit is the same tokens at different geometry, not
the same file scaled.

| Mode | Renders | Notes |
|---|---|---|
| `hook` | The take, huge, top third | **The first 1.5 seconds is the whole game.** Text should be readable at a glance and paused |
| `lower` | Vertical name/topic bar | Sits above the caption zone |
| `stat` | One number, centred | The vertical `THE NUMBER` |
| `end` | Handles + the referral lockup | Two seconds, hard cut |

**Safe areas matter more here than anywhere else.** TikTok and Instagram both overlay UI
chrome: keep content out of the **bottom ~320px** (caption, handle, action rail) and the
**top ~140px**. The action rail on the right eats roughly 180px — nothing important goes
there.

Captions are burned in, not platform-generated: high contrast, 2–4 words per line, and
positioned inside the safe zone. **An editor asset pack — transparent PNG/MOV titles for
CapCut and Premiere — follows once the daily rhythm holds**; browser sources ship first
because they are faster to get on air and require no per-clip labour.

---

## 8. Build order

1. **`csgn-showbar.html`** + the TAKE button + `config/showControl`. Interviews are blocked
   until this exists — everything else can wait.
2. **`csgn-fullframe.html`** with `TAKE` and `RUNDOWN` only. Two modes is enough to run a
   show.
3. **`csgn-bug.html`** — bug, clock, referral lockup.
4. **`TOP25`** — hard deadline **noon ET, Aug 17**.
5. **`MATCHUP`** — before Week 0, **Aug 29**.
6. **`csgn-clip.html`** — the vertical kit, alongside the first week of reels.
7. `POLL` · `QUESTION` · `STAT` · `TALE` · `TIER` · `PICKS` · `STANDINGS` · `CREDITS`.
8. The editor asset pack.

---

## 9. What to be honest about

**Twelve modes in one file gets unwieldy.** The moment `csgn-fullframe.html` passes ~2,000
lines, split the football modes into their own source. Don't pre-split — the shared
stylesheet is worth more early than the separation is.

**None of this renders over `/player`'s live feed.** That is by design: while a streamer is
up, the player's only job is clean video. Everything here is an OBS-native layer in the
scene, which is why it can be built and tested without touching the player at all.

**The disclosure will be tempting to shrink.** Don't. The one thing on this page that is a
compliance requirement rather than a design choice is the `REFERRAL` tag, and the cost of
getting it wrong is not proportional to the space it takes up.
