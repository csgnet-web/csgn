# CSGN Broadcast Graphics — Lower Thirds, PIP & the Whip-Around

> How to take `/player` from "clean single feed" to a SportsCenter/CNN-grade,
> **code-driven, automated** broadcast package — without turning OBS into a
> control room you have to babysit.

This is the design + build plan for the on-air graphics layer: text lower
thirds, a persistent bug/clock, a crypto/headlines ticker, and the
**picture-in-picture whip-around** (one content square + one or two host
side-screens). It is written to fit the architecture CSGN already has, so read
[`docs/obs-setup.md`](./obs-setup.md) first if you haven't.

---

## 1. The core decision: build the graphics in code, not in OBS

CSGN's whole edge is already in the codebase: **OBS is a dumb encoder and all
intelligence lives in a web page** (`src/lib/masterControl.ts`, `/player`). Every
professional network runs a graphics system (ESPN's is basically a web app;
Vizrt/Singular.live/CasparCG are the industry tools) that is exactly this — a
browser layer rendering data-driven graphics over video. **We should build ours
the same way we built the intermission board: as React overlays driven by
Firestore, rendered in the browser, encoded by OBS.**

Why not just drag PNGs and OBS sources around per show?

| Approach | Pro | Con |
|---|---|---|
| **OBS-native** (image sources, StreamFX, manual scene switches) | No code | Manual, per-operator, not automated, can't react to data (prices, who's live), doesn't survive a restart, doesn't scale to "a decentralized network anyone runs" |
| **Code-driven overlays** (React + Firestore, the CSGN way) | Automated, data-reactive, restart-proof, one source of truth, any operator's OBS renders it identically | Up-front build (this doc) |

The tie-breaker: **"fully automated" and "a decentralized TV network anyone can
run" are impossible with hand-built OBS scenes.** They're the natural result of
code-driven graphics. So the recommendation is a **thin hybrid**:

- **In code (new `/broadcast` overlay routes):** lower thirds, bug, clock,
  ticker, PIP frames, transitions, full-screen stat cards — everything that is
  *graphics*.
- **In OBS (unchanged philosophy):** one scene, browser source(s) for the
  overlay + feeds, NVENC → RTMPS. No per-show scene switching.

Today `/player` renders **no overlays over a LIVE feed** on purpose (obs-setup.md
§"On-air promos"). This plan is how we lift that restriction *safely* — the
overlays live in their own transparent layer, so they can never wedge playback.

---

## 2. The on-air "look" rundown

Think in the same vocabulary a network control room uses. Each is a state of the
graphics layer, switchable live (and, where it makes sense, automatically):

| Look | What's on screen | Trigger |
|---|---|---|
| **Clean** | Full feed, nothing over it | Default while a single streamer is live |
| **Bug + clock** | Small CSGN logo + live ET clock, one corner, always up | Persistent (the "we're a network" watermark) |
| **Lower third** | Name/title bar, lower-left; optional secondary line | Operator pushes text, or auto from slot data |
| **Ticker** | Bottom strip: $CSGN + top coins + headlines, scrolling | Persistent or toggled; data from the fee poller |
| **Whip-around / PIP** | Content square + 1–2 host side-screens (see §4) | Show format; layout pushed from admin |
| **Full-screen card** | Stats, "Coming Up", token spotlight, sponsor | Between segments (reuses IntermissionBoard panels) |
| **Transition** | Brand wipe stinger between any two looks | Automatic on look change (reuse `WipeOverlay`) |

We already ship the last two conceptually: `IntermissionBoard` is a full-screen
data-driven card system, and `WipeOverlay` is the stinger. The new work is the
**over-the-feed** layer (bug, lower third, ticker) and the **PIP compositor**.

---

## 3. Asset & component checklist

Good news: **you barely need external "assets."** Broadcast-grade design is
mostly type, color, motion, and layout — all of which the design system already
defines (`src/index.css`):

**Already have (reuse, don't re-source):**
- **Type:** Space Grotesk (`--font-display`), Inter (`--font-sans`), JetBrains
  Mono (`--font-mono`) — display/UI/numbers, exactly the three-role system a
  network uses.
- **Color:** `--color-primary-500 #ff2346` (CSGN red), `--color-gold #ffb020`,
  positive/negative greens/reds, dark surfaces. This is your brand palette —
  don't introduce new colors per graphic.
- **Motion:** `csgn-wipe` (stinger), `board-fade`, `stage-*` (sheen, radar rings,
  breathing glow, marching border), `live-pulse`, `shimmer`. Reuse these so
  every graphic feels like one network.
- **Logo:** the inline `CSGN` SVG wordmark used across `FeedCover`/`StatusCard`/
  `IntermissionBoard`. (Upgrade path: replace with a real vector logo lockup —
  one SVG component, swapped everywhere.)

**To build (React components, transparent background):**

| Component | Role | Notes / reuse |
|---|---|---|
| `Bug` | Corner logo + ET clock + tiny LIVE dot | `animate-live-pulse`; ~120px, one corner, 60–70% opacity |
| `LowerThird` | Name + title/handle bar, animated in/out | Slide+fade in, hold, slide out; primary-500 accent bar; `font-display` name, `font-mono` handle |
| `Ticker` | Scrolling bottom strip | Coins from the fee poller's `tokenStats`; marquee via CSS transform; headlines from a Firestore array |
| `PipStage` | The whip-around compositor (§4) | CSS grid: content square + 1–2 host cells, labeled name plates |
| `FullScreenCard` | Segment cards (stats/coming-up/sponsor) | Extend `IntermissionBoard` panels — already built |
| `GraphicsRoot` | Transparent overlay page that mounts the above per Firestore state | New route, e.g. `/broadcast/overlay` |

**Actual art to produce (optional, later):** a real logo lockup (SVG),
show-title cards / a "cold open" bumper (can be an MP4 in the existing VOD
rotator, or animated in code), and sponsor slates. **You do not need a designer
to start** — the code system gets you to broadcast-grade on day one.

---

## 4. The whip-around: PIP with a content square + host side-screens

This is the interesting one and the one with real engineering choices, because
**the hard part isn't the frame — it's getting 2–3 live video sources composited
together.** The frame is easy CSS grid; the video plumbing is the decision.

### The layout (easy part)

A `PipStage` component, transparent background, `1920×1080`, CSS grid. Two host
variant looks:

```
 One host (2-up)                Two hosts (3-up whip-around)
┌───────────────┬──────┐       ┌───────────────┬──────┐
│               │ HOST │       │               │HOST A│
│    CONTENT     │  A   │       │    CONTENT    ├──────┤
│    (square)   │      │       │    (square)   │HOST B│
│               │      │       │               │      │
└───────────────┴──────┘       └───────────────┴──────┘
  name plate + lower third under the content; name plates on each host cell
```

- Content square left (the coin chart, a clip, a streamer's screen), host
  cell(s) right, each with a `font-display` **name plate** (reuse the LowerThird
  styling). Border accents in primary-500, dark gutters, the bug top-right, the
  ticker underneath. Push the active layout (`1host` / `2host` / `clean`) from
  admin → Firestore, and `PipStage` reacts live — same pattern as
  `config/emergencyOverride`.

### Sourcing the video (the real decision)

Pick based on where hosts/content actually come from. Ranked by how well it fits
"automated, decentralized, no ads":

1. **CSGN own-ingest (RTMP/WHIP) — the network-grade answer.** Hosts stream into
   *CSGN's* ingest (a media server — [Mediasoup](https://mediasoup.org),
   [LiveKit](https://livekit.io), [Ant Media], or Cloudflare Stream/Realtime),
   and the browser overlay plays those low-latency streams as `<video>` elements
   inside `PipStage`. **This is the one that makes `?noads` always correct, gives
   you real multi-host layouts, sub-second latency for banter, and is the literal
   "decentralized TV network" architecture.** Biggest build; highest payoff.
2. **Browser-based studio (WebRTC).** Hosts join a call (LiveKit/Dabreak-style,
   or roll your own with the media server above); the overlay subscribes to each
   participant's track. Same infra as (1), optimized for "hosts on webcams."
3. **Multiple Twitch embeds.** `PipStage` mounts 2–3 Twitch iframes (reuse the
   `FeedGate`/embed machinery per cell). Zero new infra, works today — **but**
   inherits Twitch ads per cell (each needs its own `?noads`-style handling),
   higher latency, and per-embed startup masking. Fine for a v1 "whip around
   other CSGN streamers who are already live."
4. **OBS-native compositing.** Each host = an OBS source; the code overlay only
   draws frames/plates/ticker on top (transparent holes where video shows
   through). Least automated, but a pragmatic bridge if hosts are already OBS
   sources on the workstation.

**Recommendation:** ship the **frame + plates + control** now (option 3 or 4 for
video, since they need no new backend), and put **own-ingest (option 1)** on the
roadmap as the thing that unlocks the real product. The overlay code is identical
across all four — only the `<video>`/iframe source per cell changes — so building
the compositor now is not wasted work.

---

## 5. Making it automated (the CSGN control pattern)

"Fully automated" = **the graphics react to data and to a single control
surface, not to an operator dragging things.** You already have the exact pattern
three times over (`config/emergencyOverride`, `config/vodPlaylist`,
`public/tokenStats`). Extend it:

- **`config/broadcastGraphics` (Firestore):** the live "control room" doc —
  `{ layout: 'clean'|'lowerThird'|'1host'|'2host', lowerThird: {name, title},
  hosts: [{name, source}], contentSource, tickerHeadlines: [...],
  bugVisible, tickerVisible }`.
- **Admin "Control Room" tab:** buttons that write that doc — "Show lower third",
  type name/title, "Go 2-host", pick sources, edit the ticker. (Mirror the
  existing Admin override/VOD editors.)
- **`GraphicsRoot` overlay** subscribes via one `onSnapshot` and renders the
  current look, running the brand wipe between looks. Restart-proof: OBS reloads
  straight back into the correct graphics state, exactly like `/player` does.
- **Auto-reactions (no operator at all):**
  - Lower third auto-fills from the live slot's `assignedName` + handle when a
    streamer goes live (data's already in `LiveSlotContext`).
  - Ticker prices/marketcap come straight from the fee poller's `tokenStats`
    (already written every minute, 24/7).
  - "Coming Up" / schedule cards auto-build from `allSlots` (IntermissionBoard
    already does this).

That's the difference between "a stream with graphics" and "a network that runs
itself."

---

## 6. OBS scene changes (small)

The encoder stays dumb. You add **one transparent overlay browser source above
the feed**, and (for code-composited PIP) point the feed source at the PIP route:

- **Overlay source:** Browser Source, `1920×1080`, URL
  `https://csgn.fun/broadcast/overlay`, transparent (CEF browser sources are
  transparent by default — no page background), **on top** of the `/player`
  feed source. Bug + lower third + ticker live here and never touch playback.
- **PIP:** either the overlay draws frames over multiple feed sources
  (option 3/4 above), or a single `https://csgn.fun/broadcast/pip` source renders
  the whole composite when video is code-sourced (option 1/2).
- Keep the `/player` feed source for solo-streamer "clean" segments; the overlay
  rides on top of it too (bug/ticker over a solo feed is normal and good).

No scene switching, no plugins — the *page* changes look via Firestore, OBS just
encodes whatever the browser draws.

---

## 7. Build roadmap (phased, each shippable)

1. **Overlay foundation** — `/broadcast/overlay` route + `GraphicsRoot` +
   `config/broadcastGraphics` doc + Admin "Control Room" tab. Ship `Bug` + clock
   first (persistent, low-risk, instantly "network-y").
2. **Lower thirds** — `LowerThird` with in/out animation; manual push + auto-fill
   from the live slot. This alone is the single biggest "pro" upgrade.
3. **Ticker** — `Ticker` wired to `tokenStats` + a Firestore headlines array.
4. **PIP compositor** — `PipStage` (1-up / 2-up), name plates, admin layout
   switch. Video via Twitch embeds (option 3) to ship without new infra.
5. **Own-ingest** — stand up the media server (LiveKit/Mediasoup/Cloudflare),
   swap PIP cells to `<video>` tracks. This is the "decentralized TV network"
   milestone and what makes `?noads` universally true.
6. **Polish** — real logo lockup, cold-open bumper, sponsor slates, per-show
   theme accents.

Phases 1–4 need **no new backend** — they're the same React + Firestore +
onSnapshot pattern this repo already runs, so they're fast. Phase 5 is the
strategic investment.

---

## 8. Related

- [`docs/obs-setup.md`](./obs-setup.md) — the encoder, the no-ads/`?noads` flag,
  the "Now Live" countdown, verifying the encode.
- `src/components/player/IntermissionBoard.tsx` — the existing code-driven
  full-screen graphics system to extend for full-screen cards.
- `src/components/ui/WipeOverlay.tsx` — the brand transition stinger to reuse
  between looks.
- `src/lib/masterControl.ts` — the "dumb encoder, smart page" state machine this
  graphics layer sits alongside.
