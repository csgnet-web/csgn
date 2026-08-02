# CSGN OBS Assets — the complete guide

> **Every browser source CSGN puts on air, what controls it, and how they stack.**
> This is the index for `docs/obs/`. For the full encoder walkthrough (NVENC
> settings, RTMPS to X, audio routing) see [`../obs-setup.md`](../obs-setup.md);
> for the design rationale behind the graphics layer see
> [`../broadcast-graphics.md`](../broadcast-graphics.md).


---

## 0. Quick start — on air in fifteen minutes

If you read nothing else, read this. Everything after it is detail.

**You build ONE scene, once. You never touch OBS again.**

### Step 1 — Make the scene

New scene, call it `CSGN`. Add these five **Browser Sources**, bottom of the list
first (OBS draws bottom-to-top, so the first one you add sits behind everything):

| # | Source name | URL | Size |
|---|---|---|---|
| 1 | `Feed` | `https://csgn.fun/player` | 1920 × 1080 |
| 2 | `PIP` *(optional)* | `https://csgn.fun/../docs/obs/csgn-pip.html` | 1920 × 1080 |
| 3 | `Ticker` | `…/csgn-ticker.html` | **1930 × 240** |
| 4 | `Bug` | `…/csgn-nowwatching.html` | 1920 × 1080 |
| 5 | `Lower thirds` | `…/csgn-lowerthirds.html` | 1920 × 1080 |

For every source, tick these two boxes and leave the rest alone:

- ☑ **Shutdown source when not visible**
- ☑ **Refresh browser when scene becomes active**

Position the **Ticker** flush to the bottom of the canvas. It is 240px tall but
only the bottom 110px draws — the space above is transparent headroom the coin
spotlight rises into. Everything else is full-canvas and needs no positioning.

### Step 2 — Point OBS at X

Settings → Stream → **Custom**, then paste the RTMPS URL and stream key from
**X Media Studio → Producer**.

Also going to Twitch? Point OBS at **[Restream](https://restream.io)** instead
and let it fan out to both. One encoder, one upload, two destinations.

### Step 3 — Encoder

Settings → Output → Advanced:

| | |
|---|---|
| Encoder | NVENC H.264 (or x264 `veryfast`) |
| Rate control | CBR |
| Bitrate | **6000 Kbps** |
| Keyframe interval | **2s** |
| Preset | Quality |
| Resolution / FPS | 1920×1080 / 30 |

### Step 4 — Go live

Start Streaming in OBS, then go live from X Media Studio. Paste the broadcast
**post** URL into Admin → *X Broadcast Post URL* → Push, and `/watch` embeds it.

**That's it.** From here on the whole network is run from Admin → Broadcast
Control. Nobody opens OBS again.

### If something looks wrong

| Symptom | Fix |
|---|---|
| Ticker not at the bottom | Move it down — the source is 240px, only the bottom 110px is opaque |
| Twitch chrome or an ad on screen | `/player` is still masking. Wait ~33s, or add `?noads=1` if your feed is ad-free |
| Nothing on the ticker | `config/ticker` is empty. Save anything in Broadcast Control |
| Graphics frozen | Right-click the source → Refresh |
| Two audio sources | Only `Feed` should have audio. Mute the rest in the Audio Mixer |

---

## 1. The one idea behind all of it

**OBS is a dumb encoder. Every piece of intelligence is a web page.**

OBS runs one scene, forever. It never gets switched, and no graphic is ever
dragged into place mid-show. Each asset below is a **transparent browser source**
that decides for itself what to draw, by reading the same world-readable
Firestore doc the admin panel writes (`config/ticker`) or by rendering the app's
own logic (`/player`).

That is why the whole network can be run from a phone: you change a field in
**Admin → Broadcast Control**, and within ~60 seconds the broadcast changes.
Nobody touches OBS.

| | Hand-built OBS scenes | CSGN's model |
|---|---|---|
| Change what's on air | Alt-tab, drag, restart | Type in admin, wait ~60s |
| Survives a crash/restart | ❌ | ✅ (state lives in Firestore) |
| Reacts to live data | ❌ | ✅ (prices, who's live, votes) |
| Anyone can run a node | ❌ | ✅ (same URLs, same result) |

---

## 1a. Where the stream goes — X, or Restream for both

**X is the recommended output, and it's the simplest.** OBS captures `/player`
plus the graphics stack and streams to **X Media Studio over RTMPS**. One
destination, one encoder, nothing in the path you don't control. Full encoder
settings in [`../obs-setup.md`](../obs-setup.md).

**Want Twitch as well? Use [Restream](https://restream.io).** OBS sends one
stream to Restream and Restream fans it out to X and Twitch simultaneously. It
costs a subscription and adds a hop, but it is the only sane way to hit both
without running two encoders on one machine. Point OBS at Restream as its single
RTMP target and configure the split there.

> Slot streamers keep streaming to **their own** Twitch channels — only the
> network's output stream goes to X. Restream is about CSGN's own broadcast
> reaching two places, not about how creators get on air.

---

## 2. The assets

| File | What it is | Rotates? | Driven by |
|---|---|---|---|
| **`csgn-pip.html`** | Multi-source layout frames (PIP / splits) | No — you pick | URL flag / `1`–`9` keys |
| **`csgn-nowwatching.html`** | Permanent "Now Watching" channel bug | **No — always on** | `config/ticker.nowLive` |
| **`csgn-lowerthirds.html`** | Interstitials that break in, then clear | Yes (~every 3 min) | `config/ticker` (`nowLive`, `upNext`, `vote`) |
| **`csgn-ticker.html`** | The bottom ticker band (scores, coins, headlines) | Yes (continuous) | `config/ticker` + live sports/coin APIs |
| **`csgn-master.lua`** | Optional OBS control script | — | OBS itself |
| **`ticker-smoke.mjs`** | Offline smoke test for the ticker | — | `node docs/obs/ticker-smoke.mjs` |

Plus the app route itself:

| Route | What it is |
|---|---|
| **`/player`** | The video program — live feed, Starting Soon, BRB, intermission board, overrides. This is the *picture*; everything above is *furniture* drawn over it. |

---

## 3. The layer stack

Order matters. In OBS, **top of the list = front of the screen.** Build the
scene in exactly this order:

```
┌─ 1. csgn-lowerthirds.html   interstitials (transparent until they fire)
├─ 2. csgn-nowwatching.html   permanent channel bug
├─ 3. csgn-ticker.html        ticker band (bottom strip)
├─ 4. csgn-pip.html           window frames + labels  ─┐ only when running
├─ 5. …your video sources…    Twitch/camera/capture   ─┘ a multi-source layout
└─ 6. /player                 the 24/7 program (full frame, bottom layer)
```

Running the simple 24/7 setup? You only need **1, 2, 3 and 6** — `/player` fills
the frame and the rest draws over it. Layers 4–5 are for when you're compositing
your own sources (a whip-around, a co-stream, a desk + gameplay shot).

---

## 4. Each asset in detail

### 4.1 `/player` — the program

Not in this folder (it's the React route), but it's the bottom layer of the
stack and the thing the others decorate.

- **Add it:** Browser Source → URL → `https://csgn.fun/player` → 1920 × 1080 → X 0, Y 0
- **Custom CSS:** `body { background: rgba(0,0,0,0); }`
- **Shutdown source when not visible:** OFF. **Refresh on scene activate:** OFF.

**What it does on its own:** plays the live Twitch feed for whoever holds the
current slot; shows *Starting Soon* when a slot holder hasn't gone live; shows a
120-second **last-call countdown** if they still haven't, then reverts the hour
to the open-to-claim board; shows *BRB* if a live feed drops; rotates the
intermission board + VODs when nobody's on. Forwards **Twitch, Kick and
YouTube**.

**Useful flags:**

| Flag | Effect |
|---|---|
| `?noads=1` (or `?turbo=1`) | Feed is ad-free → 10s "Now Live" countdown instead of the 33s ad mask. **Only use when a Twitch preroll genuinely can't play** — otherwise the ad leaks on air. |
| `?channel=name` | Force a specific Twitch channel, ignoring slot data (rehearsal). |
| `?preview=board\|brb\|starting\|lastcall\|wipe\|countdown` | Freeze one look to check it in OBS. |
| `?debug=1` | On-screen state panel (mode, channel, gate phase, server-live). |
| `?peek=1` | Drop the curtain to 22% so you can watch the raw Twitch startup behind it. **Never on a live broadcast.** |

---

### 4.2 `csgn-pip.html` — multi-source layouts *(new)*

One file, every common broadcast permutation. It draws **branded frames, source
labels and the corner bug around transparent windows** — your OBS video sources
sit *behind* it and show through.

- **Add it:** Browser Source → ✅ Local file → `csgn-pip.html` → 1920 × 1080 → X 0, Y 0
- **Custom CSS:** `body { background: rgba(0,0,0,0); }`

**The layouts** (`?layout=…`, or press `1`–`9` while the source has focus):

| # | `layout=` | Shape |
|---|---|---|
| 1 | `solo` | One full-frame source |
| 2 | `duo` | **Two even, side by side** |
| 3 | `duo-stack` | Two even, stacked |
| 4 | `pip` | **One full background + one corner box** (`?corner=tl\|tr\|bl\|br`) |
| 5 | `tri` | **One focus (left) + two even (stacked right)** |
| 6 | `tri-top` | One focus (top) + two even (bottom) |
| 7 | `quad` | 2 × 2 grid |
| 8 | `spotlight` | Big centre + two thin side rails |
| 9 | `solo-bug` | Full frame, brand bug only (no window chrome) |

**How to place your video sources — the important bit.** Load the file with
**`?guide=1`**. Every window fills in and prints its exact rectangle in 1920×1080
space:

```
Source 1        Source 2
X 40 · Y 40     X 1280 · Y 40
W 1216 · H 1000 W 600 · H 488
```

Copy those into each OBS source's **Edit → Transform → Edit Transform…**
(Position X/Y, Bounding Box Size W/H). Turn `?guide=1` off and the feeds sit
perfectly inside the frames.

**Other flags:** `?labels=Content,Host` (name the windows), `?accent=%23ff2346`
(frame colour, URL-encoded hex).

> **Tip:** one scene per layout is usually calmer than hotkey-switching — add the
> source multiple times with different `?layout=` URLs.

---

### 4.3 `csgn-nowwatching.html` — the permanent bug *(new)*

The always-on lower-third that tells viewers **what they're watching**. Unlike
the interstitials, this **never rotates away** and is never blank.

- **Add it:** Browser Source → ✅ Local file → `csgn-nowwatching.html` → 1920 × 1080 → X 0, Y 0
- **Custom CSS:** `body { background: rgba(0,0,0,0); }` · **Shutdown when not visible:** OFF

**You control it from: Admin → Broadcast Control → "Now Live" (name + title).**
Saving there pins your label (it flips `onAirAuto` off) until you turn auto-fill
back on. Left on auto, it follows the schedule's current show by itself. If
nothing is set at all it shows the network default — a permanent bug should
always say *something*.

| Flag | Effect |
|---|---|
| `?pos=bl\|br\|tl\|tr` | Corner. Default `bl` (bottom-left, sits above the ticker). |
| `?default=Name\|Subtitle` | Override the "nothing set" fallback. |
| `?demo` | Sample content, for setup. |

---

### 4.4 `csgn-lowerthirds.html` — interstitials

The graphics that **break into** the broadcast and then clear, keeping the feed
clean in between: *Live Now*, *Up Next*, *Holders Vote* (with a live countdown).

- **Add it:** Browser Source → ✅ Local file → `csgn-lowerthirds.html` → 1920 × 1080 → X 0, Y 0
- Roughly one every ~3 minutes, ~12s each. Nothing configured → nothing shows.
- **Flags:** `?demo` (sample content now), `?always` (back-to-back, for rehearsal).

**Controlled by:** `config/ticker` → `nowLive`, `upNext`, `vote` — all set from
Admin → Broadcast Control.

---

### 4.5 `csgn-ticker.html` — the ticker band

The bottom instrument: live scores, coin prices, the **RIGHT NOW headline rail**,
breaking cards, the $CSGN beat and the live creator-fee readout.

- **Add it:** Browser Source → ✅ Local file → `csgn-ticker.html` → **1930 × 240** → **X -5, Y 840**
  (the band is the bottom ~110px; the transparent headroom above it is where
  rising cards animate in)
- **Test it offline:** `node docs/obs/ticker-smoke.mjs`

**Controlled by:** Admin → Broadcast Control → *Rail & Coins* (headline rail,
coin spotlight) plus the server fee poller (prices, live fees, on-air/up-next).

> **Headline length:** the rail's cell ellipsizes past ~60 characters, so the
> admin editor now **caps each headline at 60 characters as you type** and shows
> a live preview with a per-line counter. If a headline looks clipped on air, it
> was written somewhere other than the admin box.

---

### 4.6 `csgn-master.lua` — optional OBS script

Convenience only (hotkeys/scene helpers). Nothing about the broadcast depends on
it — see [`../obs-setup.md` §8](../obs-setup.md).

---

## 5. Admin → what it changes on air

| You change (Admin) | Asset that reflects it | Latency |
|---|---|---|
| Broadcast Control → **Now Live** | `csgn-nowwatching.html`, `csgn-lowerthirds.html`, ticker | ~10–60s |
| Broadcast Control → **Up Next** | `csgn-lowerthirds.html`, ticker | ~10–60s |
| Broadcast Control → **Right Now rail** | `csgn-ticker.html` | ~60s |
| Broadcast Control → **Coin spotlight** | `csgn-ticker.html` | ~60s |
| Schedule → **assign a streamer** | `/player` (switches feed; live immediately if it's the current hour) | seconds |
| Schedule → **stream URL override** | `/player` (Twitch / Kick / YouTube) | seconds |
| **Emergency override** (config doc) | `/player` (takes over everything) | seconds |
| Intermission **VOD playlist** | `/player` intermission rotation | seconds |

---

## 6. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Graphic shows a **black box** instead of transparency | Missing `body { background: rgba(0,0,0,0); }` in the source's Custom CSS. |
| Overlay never updates | OBS cached the page — right-click the source → **Refresh**. Check the source is *not* set to "Shutdown when not visible". |
| Feed visible but **no frames / frozen** | `/player` self-heals (FeedGate rebuilds the embed); if it persists, refresh the `/player` source. |
| A **Twitch ad** appeared on air | `?noads=1` was set on a feed that can still play prerolls. Remove the flag — the 33s mask is the protection. |
| PIP windows don't line up with the video | Re-open `csgn-pip.html?guide=1` and re-enter the printed X/Y/W/H into each source's Transform. |
| Ticker headline is **cut off with "…"** | It exceeded the rail width; rewrite it in Admin (the box now caps at 60 chars). |
| Bug/ticker shows stale text after an admin change | Polls are ~10–60s. If it's been longer, the Firestore doc write failed — check the admin panel for an error banner. |

---

## 7. Testing without going live

```bash
node docs/obs/ticker-smoke.mjs            # ticker renders offline (jsdom)
open docs/obs/csgn-pip.html?guide=1       # layout rectangles
open docs/obs/csgn-nowwatching.html?demo  # permanent bug, sample content
open docs/obs/csgn-lowerthirds.html?demo  # interstitials, sample content
# /player looks, in a browser or OBS:
#   /player?preview=board | brb | starting | lastcall | wipe | countdown
```

---

## 8. Design notes (why these are built the way they are)

Each file is **standalone, dependency-free, and framework-free** — one HTML file
with inline CSS and vanilla JS, no build step and no network calls except the one
public Firestore read. That is deliberate:

1. **They must survive the encoder.** OBS's embedded Chromium is not a modern
   browser tab. No bundler, no imports, no module graph.
2. **They must be portable.** Anyone running a CSGN node loads the same file and
   gets the same broadcast — that's what makes "a decentralized TV network"
   mean something.
3. **They must be quotable.** These are written to be open-sourced as
   self-contained modules: a broadcast ticker, a layout compositor, a
   data-driven bug. Each is useful on its own to any streamer, with the CSGN
   Firestore read as the only thing to swap out.

The state boundary is the same everywhere: **the browser source reads, the admin
panel writes, Firestore is the wire.** No asset ever writes state, so no asset
can corrupt the broadcast.


---

## 9. The CSGN BottomLine — the finalized spec

The band is a **BottomLine**, not a crawl, and the distinction is the whole
design. A crawl scrolls text past you and you wait. A BottomLine *paginates*: it
shows one thing at a time, at full size, and tells you where you are in the set.
ESPN's 2008–11 board is still the reference implementation, and this is ours.

### 9.1 Anatomy

```
┌────────┬──────────┬───────────────────────────────────┬──┬──────────────────┐
│ BRAND  │  LEAGUE  │  SCOREBOARD / DETAIL              │  │  CRYPTO LED DOCK │
│ 110px  │  158px   │  rolls vertically, flips to detail │  │  price + chart   │
│        │   pill   │                        • • ◦ ◦ ◦  │  │                  │
└────────┴──────────┴───────────────────────────────────┴──┴──────────────────┘
   110px tall, pinned to the bottom. Anything above is transparent headroom.
```

### 9.2 The rules

**One item at a time, at full size.** The scoreboard rolls vertically between
games; the league changes behind a wipe. Nothing shrinks to fit — if it doesn't
fit, it wraps or it gets its own face.

**The flip is for detail, not decoration.** Every game can turn over to a second
face: probable starters, pitching decisions, top performers. It only flips when
there's something to show — never an empty face.

**Section dots, bottom right.** One pip per item in the current league. The pip
you're on is gold; the ones you've passed are drawn down to a dim white; the ones
ahead are dark. The row resets on the league wipe. Over 14 items the overflow
rides as a `+N` rather than a wall of dots nobody can count.

This is the cheapest thing a ticker can do to stop feeling infinite. You always
know how much of the NBA is left, which means you know whether to keep watching.

**Type is sized to be read across a room, not on a monitor.** The band ships at
1930×240 and gets scaled down on air. Team abbreviations run 40px, detail
headlines 30px, the Meme 100 leaderboard 26px. If a face reads comfortably on
your laptop it is almost certainly too small on stream.

**Everything is driven by a document, nothing by a person.** The band reads
`config/ticker` over the public Firestore REST API. Change a field in Admin →
Broadcast Control and the board follows within ~60 seconds. Nobody touches OBS.

### 9.3 What each band is for

| Band | Job |
|---|---|
| **Brand** | Constant identity. Never changes, never animates |
| **League pill** | Where you are. Colour-coded per league, wipes on change |
| **Scoreboard** | The item: score, records, status — or a detail face on the flip |
| **Section dots** | How much of this league is left |
| **Crypto dock** | Always-on price board: LED price, 24h chart, Meme 100 power rank, $CSGN |

### 9.4 Verifying it

```bash
node docs/obs/ticker-smoke.mjs      # offline render checks
```

Then the on-air pass in [`../dry-run.md`](../dry-run.md) §5 — Meme 100 readable
from across the room, MLB record and games-back together, detail face filling its
space, dots counting down and resetting on the wipe.
