# CSGN OBS — Direct-Twitch Setup (zero hosting)

This is the **no-`/player`** pipeline: OBS loads Twitch's own player straight
off Twitch's servers, and everything `/player` used to do is redone with OBS
primitives — a cover source, custom CSS inside the browser source, and one Lua
script. Netlify serves nothing to the encoder, ever. The original hosted-page
setup remains documented in `docs/obs-setup.md`; treat this as the alternative
you cut over to once it has soaked on a test scene.

```
Twitch CDN ──► Browser Source "CSGN FEED"  (player.twitch.tv, custom CSS inside)
                     ▲            ▲
   csgn-twitch-direct.lua ────────┤ retune / reload / mute
   (slot follow · guards · BRB)   │
                     Browser Source "CSGN COVER"  (local cover.html, above feed)
                     └──► NVENC encode ──► RTMPS ──► X
```

## 0. Two corrections to the obvious approach (read first)

1. **Do not load `https://twitch.tv/<username>`.** The full site hauls in nav,
   chat, consent banners, recommendations, login nags — and the video doesn't
   fill the canvas without clicking theater/fullscreen. Load the **interactive
   embed** instead:

   ```
   https://player.twitch.tv/?channel=<username>&parent=twitch.tv&autoplay=true&muted=false
   ```

   It is just the player, it **autoplays with sound inside OBS** (OBS's
   browser allows gesture-less audio), and it **fills the viewport by
   itself** — there is no play button to press and no fullscreen button to
   find. The `parent=` parameter must be present (Twitch requires it); the
   value only matters when the player is iframed by a web page, which OBS's
   top-level load is not.

2. **A Lua script cannot click buttons inside a page.** The browser source is
   a one-way bridge (`docs/obs-setup.md` says the same): OBS can reload the
   source, change its URL, mute it, hide it — it cannot reach the DOM. The
   design below never needs an in-page click: play/fullscreen are solved by
   the embed URL, and the two page states that DO want a one-time click
   (quality menu, mature gate) are handled once via right-click → **Interact**
   and remembered by the browser profile.

## 1. What you build in OBS (the whole list)

One scene, two sources, one script, one CSS paste:

| # | Thing | What it is |
|---|---|---|
| 1 | Scene `CSGN 24/7` | the only scene; no scene switching, same philosophy as before |
| 2 | Browser Source **`CSGN FEED`** | `player.twitch.tv` URL above, 1920×1080 — with `docs/obs/twitch-embed.css` pasted into its **Custom CSS** |
| 3 | Browser Source **`CSGN COVER`** | **Local file** → `docs/obs/cover.html`, 1920×1080, placed **above** the feed, scene item **hidden** by default — this is the transition cover |
| 4 | Script **`docs/obs/csgn-twitch-direct.lua`** | Tools → Scripts → **+** — retunes/reloads the feed, raises/lowers the cover, mutes with the cover, follows the slot schedule, watches BRB |

### `CSGN FEED` settings

- URL: the `player.twitch.tv` template above with your default channel
  (the script rewrites `channel=` at every slot handoff)
- Width `1920`, Height `1080`
- ✅ **Use custom frame rate** = **30** (match stream output; 60 only if you output 60)
- ✅ **Control audio via OBS** — fader 0 dB, monitoring off
- ❌ Shutdown source when not visible, ❌ Refresh browser when scene becomes
  active — the **script** owns reloads (every reload it performs is wrapped in
  the cover; OBS-initiated reloads would be raw)
- **Custom CSS**: paste the entire contents of `docs/obs/twitch-embed.css`
- **Page permissions: No access.** This is now Twitch's remote code, not our
  page — it gets no `window.obsstudio`. (The old `/player` needed *Read and
  write*; do not carry that setting over.)
- Settings → Advanced → ✅ **Browser source hardware acceleration** (video
  playback in CEF needs it)

### `CSGN COVER` settings

- ✅ **Local file** → `cover.html` from this repo (copy the `docs/obs/` folder
  somewhere stable on the encoder, e.g. `C:\csgn\obs\`)
- Width `1920`, Height `1080`; scene item ABOVE the feed; eye icon **off**
  (the script toggles it)
- ❌ Shutdown source when not visible — the page must stay warm so raising the
  cover is instant; a cold CEF boot would leak raw frames underneath
- Optional flourish: right-click the scene item → **Show Transition** /
  **Hide Transition** → Fade, 250 ms — every cover raise/drop becomes a soft
  wipe instead of a hard cut. A stinger Media Source works here too if you
  ever produce one.
- Optional billing: add `?label=Now%20Live&name=Streamer` to the file URL —
  `cover.html` renders the same layout as `/player`'s FeedCover.

### Script properties (Tools → Scripts)

| Property | Default | Notes |
|---|---|---|
| Feed browser source | `CSGN FEED` | must match the source name exactly |
| Cover source | `CSGN COVER` | scene-item name the script toggles |
| Embed parent= domain | `twitch.tv` | any registrable domain works top-level |
| Guard seconds | `40` | the deterministic mask: ≤30s stitched preroll + slop + settle — same semantics as `PREROLL_MASK_MS` in `src/lib/feedGate.ts`. Drop to ~8 if the profile is logged into an ad-free account (§4) |
| Slot poll seconds | `60` | Firestore GET cadence |
| BRB redial minutes | `5` | reload-behind-cover cadence while a slot channel is offline |
| Firebase project id / web API key | — | the public client values from the site bundle (`VITE_FIREBASE_PROJECT_ID` / `VITE_FIREBASE_API_KEY` in Netlify env). Public by design — Firestore rules, not the key, are the security boundary |
| Default channel | `csgnet` | played when no slot is confirmed/live |
| Manual mode + channel | off | ignore slots, pin a channel (rehearsals, emergencies) |
| React to server live checks | on | BRB from `streamActivity.lastLive` (§5) |
| Watchdog reload hours | `12` | CEF memory-creep insurance, always behind the cover |

**Hotkeys** (Settings → Hotkeys): **`CSGN: PANIC — toggle cover + mute`**
(one key slams the brand slate over video AND audio — surprise midrolls,
anything unexpected) and **`CSGN: reload Twitch feed`** (always behind the
cover). Bind both; a Stream Deck pointing at these two keys is the whole
control surface.

## 2. How "cover up all elements of loading from Twitch" actually works

Four layers, each catching what the previous one can't see. No single layer is
load-bearing:

| Layer | Covers | Mechanism |
|---|---|---|
| **Deterministic guard** (Lua) | OBS boot, every retune/reload, the **entire preroll-ad window**, quality ramp, startup chrome | cover up + feed muted for N seconds, then reveal. Twitch stitches ads server-side with no reliable client signal — a fixed window outlasting the ≤30s break is the only guarantee, exactly like `/player`'s FeedGate mask |
| **In-page CSS** (`twitch-embed.css`) | **midroll ads** (video), buffering spinner, offline screen, mature/error gates — anything that appears while the cover is down | Twitch's own ad/gate DOM markers flip a full-viewport brand slate *inside* the page, frame-accurate. Selectors are tagged `[verify]` — drift-prone but merely defense-in-depth |
| **BRB steering** (Lua) | streamer drops mid-slot: covered before Twitch's offline chrome can matter, redialed until they return, revealed behind a fresh guard | `streamActivity.lastLive`, written each minute by the existing server Helix poller onto the slot doc (public read) |
| **Panic hotkey** (you) | midroll **audio** without an ad-free login, and every failure nobody predicted | one key: cover + mute, toggle |

What a slot handoff looks like on air: cover fades in (streamer A muted) →
URL retunes to streamer B → B's embed boots and its preroll (if any) plays
*behind the cover, muted* → 40s later the cover fades out on settled, source-
quality video. The same choreography wraps every reload, boot, and BRB return.

## 3. The ads reality — read this before trusting anything

- Twitch inserts ads **server-side into the video stream** (preroll on join;
  midroll on the streamer's schedule/Twitch's discretion). There is no
  client-side API that flags them, and OBS cannot see into the page.
- **Preroll**: fully covered by the guard — video and audio. Parity with
  `/player`.
- **Midroll video**: covered by the CSS ad-marker slate the moment Twitch
  renders its "Ad" pill. This is *better* than the old `/player`, which had no
  midroll defense at all.
- **Midroll audio**: CSS cannot mute, and Lua gets no signal to mute on. Two
  real options: the **panic hotkey** (manual), or make ads not exist (next
  section). Note this is not a regression — midroll audio reached the encode
  under `/player` too.

## 4. The complete ad fix: an ad-free logged-in profile (recommended)

OBS's browser keeps a persistent Chromium profile (cookies survive restarts).
Log it into a Twitch account that doesn't get served ads and **preroll and
midroll both disappear entirely** — video and audio, no covers needed, guard
can drop to ~8s:

- **Twitch Turbo** (~$12/mo) — ad-free on every channel. Compare with the
  $50–100/mo hosting spend this migration avoids.
- or a **gift/regular sub to each network channel** (channels ≥ affiliate can
  enable ad-free for subs), or channel-side pre-roll disabling for channels
  you control.

One-time ritual (per encoder machine): point any browser source at
`https://www.twitch.tv/login`, right-click → **Interact**, complete the login
(have 2FA handy), close. Done — `player.twitch.tv` shares the `.twitch.tv`
cookie jar. While you're in Interact on the feed source: open the gear →
**Quality → Source** once (persists in the profile; the embed remembers), and
if a channel ever shows the mature **Start Watching** gate, click it once
(also remembered; the CSS covers the gate meanwhile, but playback needs the
click — do it when arming a new mature-flagged channel).

## 5. What still comes from the cloud (and what it costs)

- **Slot schedule**: the script GETs the slot doc for the current ET window
  directly from Firestore's public REST API (`slots/{slot-YYYY-MM-DD-HH}` —
  world-readable by `firestore.rules`). One tiny GET per minute, straight to
  Google. **Netlify is not involved.**
  ⚠ The doc-id math mirrors `SCHEDULE_TEMPLATE` in `src/lib/slots.ts`
  (2-hour slots, odd ET start hours). Change the template → update
  `slot_start_hour` logic in the script. (Verified against the site's own
  slot generation across 5,000 timestamps incl. DST transitions; the single
  ambiguous spring-forward gap hour lands in the 1–3 AM slot and is
  documented in the script.)
- **Emergency override**: `config/emergencyOverride` is honoured every poll;
  a Twitch URL retunes immediately, anything else holds the cover and logs
  (YouTube overrides can't play in this pipeline — take the scene by hand).
- **BRB truth**: `streamActivity.lastLive` on the slot doc — written by
  `feePollerBackground`, which keeps running for the site anyway. If it's ever
  decommissioned, the script fails open (no BRB logic, CSS still covers the
  offline screen) — and loses auto-recovery when a dropped streamer returns,
  so keep the poller alive.

**On the Netlify bill itself**: the `/player` *page* is a one-time static load
per boot — check the dashboard before attributing spend to it. The usual
line items are the every-minute scheduled function (runs regardless of this
migration) and any media the site serves (intermission VOD MP4s pulled by
`/player` 24/7 would dwarf everything — host those on a bulk CDN or stop
rotating them). If it turns out you mainly want the *page* off Netlify, the
same static bundle on GitHub Pages / Cloudflare Pages is $0 and keeps the old
setup intact. This direct-Twitch pipeline removes the dependency entirely
either way.

## 6. What you give up vs `/player` (honest list)

| Lost | Impact / mitigation |
|---|---|
| FeedGate frame-advance confirmation | The guard is a timer, not proof frames flow. A wedged embed can't be detected from OBS (one-way bridge). Mitigations: watchdog reloads, BRB redial, panic key, your projector eyeballs |
| Wipe stinger + Starting-Soon / BRB / Intermission cards with names | The cover slate (optionally with `?label=&name=`) is the universal state card; scene-item Fade approximates the wipe. Build a proper OBS intermission scene later if wanted |
| VOD intermission rotation | Not recreated. An OBS Media Source playlist on the intermission scene is the native equivalent (and takes those MP4s off the web entirely) |
| Instant slot/override reactivity | 60s poll vs Firestore snapshots. Acceptable at 2h slot granularity |
| `?debug=1` panel | Script Log window (Tools → Scripts → Script Log) narrates every retune/cover/BRB decision |
| YouTube emergency overrides | Cover holds + log line; manual takeover |

Also inherited-but-different: quality pinning is now the profile's remembered
"Source" choice rather than per-session `setQuality('chunked')`.

## 7. Inspecting the live player (selector maintenance)

Twitch's DOM drifts; the CSS selectors are tagged `[verify]`. To check or
re-derive them on the encoder: add `--remote-debugging-port=9222` to the OBS
shortcut, open `http://localhost:9222` in a normal browser, pick the
`player.twitch.tv` target, and inspect during an ad break (join a big channel
logged-out to force a preroll). Update the selectors in the Custom CSS box;
the guard keeps you safe while they're stale.

## 8. Rollout

1. Build the scene + script on the encoder alongside the existing `CSGN
   MASTER` scene; rehearse with **Manual mode** on a busy public channel —
   watch a boot, a retune, a preroll, and the panic key.
2. Fill in the Firebase project id/key, turn manual mode off, and let it
   shadow the schedule for a day with the Script Log open.
3. Cut over (switch program scene), keep `/player` deployed as the fallback
   for a couple of weeks, then decommission at leisure.

Found while building this, worth fixing in the site regardless: in
`src/lib/slots.ts`, `etToUTC()` mis-adjusts by `+23h` when the initial guess
crosses midnight in an `h23` Intl engine (every modern browser), so the
nightly **23:00 ET slot's stored `startTime` is one day late during DST** —
which also makes the site's own `subscribeToCurrentSlot()` skip it at
runtime. Normalize the delta (e.g. `((hourET - nyHour + 36) % 24) - 12`) in
both places that compare hours. This script is immune (it follows labeled
wall-clock windows, not stored `startTime`).

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| Feed never appears, cover stuck | Script Log: `feed source not found` → source name mismatch in script properties. Or Firebase id/key blank → script idles on the default channel only |
| "the parent query parameter is missing/invalid" in the source | keep `parent=twitch.tv` (or set the property to your own domain) — the param must be present |
| Black browser source | Settings → Advanced → toggle browser hardware acceleration; then hotkey-reload the feed |
| Ad slate never shows during a test midroll | selectors drifted — §7. Guard/panic still protect you |
| Cover flashes on tiny rebuffers | that's the CSS spinner rule's 0.45s grace not being enough — raise the delay in `twitch-embed.css`, or ignore (it's on-brand) |
| Audio ahead of video / dropped frames | same as the old doc: custom FPS 30, hardware accel on, NVENC, sync offset ~+250 ms if residual |
| Slot handoff didn't happen | Script Log shows the computed `slot-…` id and the GET result; check the slot doc exists and is `confirmed`/`live` with a Twitch `streamUrl`. Remember the template coupling (§5) |
| Wrong channel after admin reassigns mid-slot | wait one poll (≤60s); if still wrong, the slot doc's `streamUrl` wasn't updated |
| Every channel shows "channel is offline" slate | the embed profile may be IP/region-blocked or the encoder clock is far off (slot id math needs correct UTC) — check Windows time sync |
