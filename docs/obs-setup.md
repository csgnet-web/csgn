# CSGN OBS Workstation Setup — the 24/7 Encoder

## The architecture in one paragraph

**OBS does not handle any network logic.** It is a dumb, always-on encoder: one scene, one
source, streaming to X via RTMPS forever. All 24/7 intelligence — knowing when a streamer is
live, showing "starting soon" / "we'll be right back" cards, rotating intermission VODs and the
animated network board, playing the brand wipe between states, and cutting back the instant a
dropped streamer returns — lives in the `/player` page itself (see `src/lib/masterControl.ts`).
`/player` reads the same Firestore state as the rest of the site and reacts in real time. If OBS,
the browser source, or the whole machine restarts, `/player` reloads straight into the correct
network state. No OBS plugins, no scene switching, no scripts.

```
Slot streamer (their Twitch channel)
        │  ONLINE/OFFLINE events (Twitch embed JS API)
        ▼
/player  ── LIVE ─ STARTING_SOON ─ BRB(120s) ─ INTERMISSION(VODs+board) ─ OVERRIDE
        │  rendered at 1920×1080 inside OBS
        ▼
OBS Browser Source → NVENC encode → RTMPS → X Media Studio → live on @CSGNet
```

## 1. Scene setup (one time)

Create exactly one scene: **`CSGN MASTER`**, containing exactly one source:

**Browser Source** —
- URL: `https://csgn.fun/player`
- Width `1920`, Height `1080`
- FPS: ✅ **Use custom frame rate** = **30** (match your stream output). Leaving CEF
  at 60 while the output is 30 makes the browser render twice the frames OBS
  keeps — a common cause of ~50% *skipped* frames. Set it to 60 only if you are
  actually outputting 60.
- ✅ **Control audio via OBS**
- ❌ Shutdown source when not visible
- ❌ Refresh browser when scene becomes active
- **Page permissions:** *Read and write to OBS* (this exposes `window.obsstudio`,
  which `/player` uses to detect it's running inside OBS and force audio on)

In the Audio Mixer: browser source fader at **0 dB**, monitoring **Monitor Off** (the stream
gets the audio; you don't need it playing on the workstation). If you ever need to click inside
the page, right-click the source → **Interact**.

Canvas: Settings → Video → Base and Output resolution both `1920×1080`.

### Custom scenes (tickers / background bars): sizing the `/player` source

If your scene reserves part of the canvas for other sources (e.g. sports/crypto
tickers along the bottom with a branded background filling the rest), size the
`/player` Browser Source to the **exact pixels it will occupy** and keep it
**16:9** so the live Twitch feed fills it edge-to-edge with no internal black bars:

- Height = canvas height − everything you've reserved (e.g. `1080 − 108` ticker = `972`).
- Width = height × 16 ⁄ 9 (e.g. `972 × 16/9 = 1728`), centered horizontally —
  your background bars own the leftover side gutters.
- Don't set the source to one size and scale/stretch it in the transform — CEF
  renders sharpest at its native size, and the page's broadcast layout is
  fixed-pixel 1080p-class design: **keep the source at least ~1600 px wide**
  (an 800×600 source clips the intermission board's headline and cards).

### On-air promos

`/player` renders **no overlays over a LIVE feed** — the page's only job while
a streamer is up is clean, uninterrupted video. Network promos (who's on,
who's next, $CSGN, branding) are OBS-native elements, built and layered in the
scene alongside the tickers, so they can never interfere with playback.

### Why `/player` behaves differently in OBS vs a normal tab

`/player` detects its environment (`window.obsstudio`) and adapts:

- **Inside OBS**, the browser source autoplays *with sound* and there is never a
  user click, so audio is forced on programmatically and stays on (gently
  re-checked every 15s — and only nudged if it has actually drifted to muted, so
  a healthy feed is never disturbed). What reaches the encode is governed by
  **FeedGate** (`src/lib/feedGate.ts`): `/player` samples the embed's playback
  position every second, and a **branded cover is held over the feed** — with
  audio muted — until frames are proven to be advancing *and* a fixed
  **preroll-ad mask** (33s from first frames, longer than Twitch's ≤30s ad
  break) has elapsed. Twitch stitches preroll ads server-side and offers no API
  to detect them, so the deterministic mask is what guarantees the ad video,
  its countdown text, and all startup chrome (play-button poster, channel/
  Follow UI) are never seen on-stream — on first load, retunes, *and* every
  watchdog rebuild. Only after the mask does `/player` pin Twitch's **source**
  quality (`chunked`, so the encode never drops to auto/360p), let the feed
  settle ~2s more, then unmute and reveal. Between constructing the embed and
  that confirmation the player is deliberately never touched — no `play()`,
  no quality request, no unmute — because poking it mid-ad is what used to
  freeze the feed on the first ad frame. Going LIVE no
  longer depends on Twitch's flaky `ONLINE`
  event. LIVE is now reached four independent ways: the embed's `ONLINE` event,
  a real `PLAYING` event (playback started ⇒ the channel is live), FeedGate
  confirming frames of the armed channel, **and** the
  server's Twitch Helix check (`feePollerBackground` verifies the slot's channel
  every minute and records `streamActivity.lastLive` on the slot doc `/player`
  reads). The Helix path is the important one: Twitch's `ONLINE` event only fires
  on an offline→online *transition*, so a channel that is *already live when the
  page loads* never fires it — that's the old *stuck-on "Starting Soon"* bug, and
  the server signal fixes it regardless of the embed.
- **In a normal browser tab**, the browser's autoplay policy forbids un-muting
  without a gesture, so the feed starts muted and a **🔊 Tap for sound** button
  (or any click/keypress) unlocks audio. This is a hard browser rule — there is
  no way to force gesture-less sound in a regular tab, and it does not affect the
  OBS encode.

**Nothing to configure for this** — it's automatic. Just make sure the Browser
Source has **Page permissions: Read and write to OBS** so the OBS detection works.

### Faster "Now Live": no-ads / Turbo fast-reveal (`?noads`)

The 33s "Now Live" curtain is **entirely** the preroll-ad mask — its only job is
to outlast Twitch's server-stitched ad (≤30s) so the ad video, its countdown
text, and the startup chrome never reach the encode. If the feed the encoder is
playing is **genuinely ad-free**, that 33s is dead air and can be cut hard.

Add **`?noads=1`** (or `?turbo=1`) to the Browser Source URL —
`https://csgn.fun/player?noads=1` — to switch `/player` into **fast-reveal
mode**:

- The preroll mask drops from 33s to ~2s (just enough to hide the poster and
  the first buffering frame).
- The "Now Live" curtain becomes a **deterministic 10-second countdown** (a
  depleting ring + a live `10 → 1` readout) instead of an indeterminate hold, so
  OBS viewers see exactly when the feed cuts in — a broadcast bumper, not a
  stall.
- Everything else (quality pin to `chunked`, stall-nudge, wedge-rebuild,
  fail-open reveal) still runs behind the countdown; the fail-open ceiling just
  moves to ~11s.

Confirm the flag took effect with `?debug=1` — the panel's **`reveal`** row reads
`no-ads · 10s countdown` (vs `ad-mask · 33s`). Rehearse the bumper on its own
with `/player?preview=countdown`.

> ⚠️ **Only enable `?noads` once you have verified no preroll actually plays.**
> If a Twitch ad can still run, the 10s countdown will end *on the ad* and it
> leaks straight onto the stream — the exact thing the 33s mask exists to
> prevent. Verify by watching `?debug=1` on the real source through a full
> streamer start (or `?channel=<name>`): the `gate` row should go
> `boot → settling → on-air` with **no** long `ad-mask` phase.

**Can Twitch Turbo actually remove the ads?** Partly, with real caveats — Turbo
only suppresses ads for a session **authenticated as the Turbo account**, and the
Twitch *embed* `/player` uses (`player.twitch.tv` in an iframe) is a separate
browser context from your logged-in twitch.tv tab:

- **It is not automatic.** An OBS Browser Source (CEF) starts logged-out, and
  there's no login UI inside a source pointed at `/player`. Turbo on your normal
  browser does nothing for the OBS encode.
- **Making CEF carry the session is fiddly and fragile.** You'd point a
  throwaway Browser Source at `https://www.twitch.tv/login`, right-click →
  **Interact**, log into the Turbo account (2FA and CAPTCHA included), and rely
  on CEF persisting `twitch.tv` cookies in its cache so the embed picks up the
  session. It can work, but the cookie can expire, a CEF/OBS update can clear the
  cache, and third-party-cookie handling for the embed is not guaranteed — so it
  is **not** something to trust for a 24/7 unattended encoder.
- **Turbo + a rebroadcast embed is a gray area.** Twitch's embed has
  historically still served ads on third-party sites, and using Turbo to strip
  ads from a stream you re-broadcast elsewhere isn't a supported, contractual
  "ad-free embed" feature.

**The robust, network-grade answer is to not depend on Twitch's ad pipeline at
all** — have streamers/hosts push their feed into CSGN's *own* ingest (RTMP), so
there is zero Twitch ad surface and `?noads` is simply always correct. That path
(and the professional-graphics build it unlocks) is written up in
[`docs/broadcast-graphics.md`](./broadcast-graphics.md). Until that exists, run
`?noads` **only** on a source you've confirmed is ad-free (a Turbo-authenticated
CEF that's tested clean, or a non-Twitch/own-ingest OVERRIDE), and leave the safe
33s mask on for anything that plays real Twitch prerolls.

### Verifying the encode (do this once before going live)

Open `https://csgn.fun/player?debug=1` in the OBS source (right-click → Interact,
or just point a throwaway source at it). A small debug panel shows in the
top-left with `env` (should read `OBS <version>`), the current `mode`, the armed
`channel`, `playback` (FeedGate confirmation + whether the cover has lifted),
`gate` (live FeedGate readout: phase — `boot` / `ad-mask` / `settling` /
`on-air` / `stalled` — plus seconds of preroll mask remaining and seconds since
frames last advanced), `audioBlocked`, `server live` (the server's Helix
check), and a live event log. When a streamer is live you should see
`→ LIVE (playing)` / `→ LIVE (online)` (or `server live: yes …` driving
`mode: LIVE` if the embed event never fired), then `quality pinned (chunked)`
and `gate: content confirmed` as the cover lifts. Remove the `?debug=1` for the
real broadcast source.

## 2. Your master-control monitor (monitor 4)

Don't run a kiosk browser — watch the *actual encoded output*:

1. Right-click the OBS preview → **Fullscreen Projector (Preview)** → select monitor 4.
2. Settings → General → ✅ **Save projectors on exit** (the projector returns after restarts).

Monitor 4 now shows exactly what X receives, indefinitely. The other three monitors stay yours.

## 3. Streaming to X (RTMPS)

1. X Media Studio → `studio.x.com` → **Producer** → create a broadcast **source** → copy the
   RTMPS URL and stream key. (Requires Media Studio access on @CSGNet.)
2. OBS → Settings → Stream → Service **Custom** → paste URL + key.
3. Output settings (Settings → Output → Advanced):
   - Encoder: **NVENC** (or x264 `veryfast` if no NVIDIA GPU)
   - Rate control **CBR**, bitrate **~6000 Kbps**, keyframe interval **2 s**
   - 1080p @ 30 fps (60 only if the upstream Twitch feeds are consistently 60)
   - Audio: AAC **160 Kbps**, 48 kHz
   - ⚠️ Media Studio displays recommended ingest settings per source — **those win** on any conflict.
4. **Start Streaming**, then go live from Media Studio (attach/publish the broadcast post).

## 4. Per-session ritual (the only manual steps)

1. Start Streaming in OBS → go live in Media Studio.
2. Open the broadcast's post on @CSGNet → copy the post URL (`https://x.com/CSGNet/status/…`).
3. Admin panel → **X Broadcast Post URL** → paste → Push. `/watch` now embeds the live broadcast.
4. Ending the session: Stop Streaming → **Clear** in Admin → `/watch` shows the offline panel.

Everything else — streamer drops, slot handoffs, empty slots, intermission programming — is
automatic. Fill the **Intermission VOD Playlist** in Admin with MP4 URLs whenever promo content
is ready; `/player` rotates them with the animated board, no restart needed.

## 5. 24/7 reliability checklist (Windows)

- OBS → Settings → Advanced → ✅ **Automatically Reconnect** — Retry Delay `2s`, Max Retries `25`.
- Launch OBS with flags: `obs64.exe --startstreaming --minimize-to-tray` (add to the shortcut).
- Task Scheduler → new task → *Run at log on* → that shortcut (auto-resume after any reboot).
- Windows Settings: sleep/hibernate **Never**; Windows Update **active hours** covering your
  broadcast day; Focus Assist / Do Not Disturb **on** (no toast popups on stream — browser
  source is immune, but the projector monitor isn't).
- Power plan: High Performance; disable "turn off display" only for monitor 4 if you want the
  projector always visible (the stream itself doesn't care).

## 6. Fallback: kiosk window capture

If browser-source playback ever misbehaves (rare codec/DRM edge cases), the old approach still
works: run `chrome --kiosk --autoplay-policy=no-user-gesture-required https://csgn.fun/player`
fullscreen on monitor 4 and point an OBS **Window Capture** at it. You lose the projector
workflow and gain OS-notification risk — treat it as a temporary fallback only.

## 7. Troubleshooting

| Symptom | Fix |
|---|---|
| No audio on stream | Browser source is missing ✅ "Control audio via OBS", or fader down. Open `?debug=1` — if `env` reads `browser` (not `OBS`), set the source's **Page permissions → Read and write to OBS** and reload |
| Stuck on "Starting Soon" though streamer is live | Fixed in-app: LIVE triggers on `ONLINE`, `PLAYING`, *or* the server Helix check. Open `?debug=1`: if `server live` stays `false`/`—` while the streamer is live, the fee poller (`feePollerBackground`) isn't running or `TWITCH_CLIENT_ID/SECRET` are unset — fix that and it self-heals within a minute. No `READY` in the log means the Twitch embed script is blocked (check hardware accel / reload) |
| Coin stats blank on the site | The home page reads `public/tokenStats` (written by `feePollerBackground`) and now also falls back to a direct DexScreener fetch client-side. If both are empty, check the browser console for a blocked `api.dexscreener.com` request (CSP `connect-src`) and that the fee poller is deployed |
| Black browser source | Toggle Settings → Advanced → browser hardware acceleration, or right-click source → Interact → reload |
| "We'll be right back" / reconnecting though streamer is live | Fixed in-app: this was the mount-timeout firing a false drop after an already-live load, and reaching LIVE by any path now cancels it. LIVE also self-heals from the server Helix check. If it persists, open `?debug=1` — `server live: yes` with `mode: BRB` means a real embed `OFFLINE` event; hard-reload the source and check the slot's channel URL in Admin |
| Stream drops repeatedly | Check Automatically Reconnect is on; verify RTMPS key still valid in Media Studio |
| **High dropped frames** (OBS Stats shows a large % of dropped/skipped frames) | Two different failures share the name. **Dropped frames (network)** = the upload can't keep up → lower the OBS bitrate (try 4500–6000 Kbps CBR) and check the wired connection. **Skipped/lagged frames (rendering/encoding)** = the machine can't render+encode fast enough → (1) set the Browser Source to *Use custom frame rate* = **30** so CEF doesn't render at 60 for a 30 fps output (a common ~50% waste), (2) OBS → Settings → Advanced → enable **Browser source hardware acceleration**, (3) NVENC (not x264) if you have an NVIDIA GPU. `/player` already pins source quality; if the box can't render 1080p60, step the OBS **output** down to 1080p30 rather than lowering the feed quality |
| **Audio runs ahead of the video** | Almost always a *symptom* of dropped/skipped frames — the video falls behind while audio keeps going, so fix frame drops first (row above). To trim any residual drift, add a positive **audio sync offset** on the browser source: OBS → Audio Mixer → the source's ⚙ → **Advanced Audio Properties** → *Sync Offset* → start around **+250 ms** and adjust. `/player` no longer spams `play()`/unmute (the old 15s-ago behaviour), which was itself a re-buffer/drift source |
| **Feed looks low quality / soft** | `/player` pins Twitch **source** (`chunked`) automatically: once per playback session, right after the preroll mask, from Twitch's populated quality list (`quality pinned (…)` in the `?debug=1` log). If it still looks soft, the upstream streamer may not be broadcasting a source-quality tier, or the OBS **output** resolution is below the canvas — set both Base and Output to 1920×1080 (Settings → Video) |
| **Frozen at the start of the :15 preroll ad** (picture stuck on the first ad frame, player claiming it's playing) | Fixed in-app, two ways. (1) Root cause: the old page poked the embed the moment Twitch's `READY`/`PLAYING` events fired — but those fire while the *server-side-stitched ad* is playing, and `setQuality()`/`play()`/unmute calls mid-ad wedged the player. `/player` now runs a **quiet bootstrap**: the embed is constructed autoplay+muted and never touched again until FeedGate confirms real frames post-mask. (2) Backstop: FeedGate watches the playback position itself, so a feed that stops advancing for 20s while LIVE is torn down and rebuilt behind the branded cover — a wedged embed can no longer sit frozen on-stream. Timings live in `src/lib/feedGate.ts` |
| Twitch play-button / **preroll ad (video or countdown text)** / channel chrome flashes on-stream | Fixed in-app: a branded cover masks the LIVE feed until FeedGate confirms it — frames advancing **and** the 33s preroll mask elapsed (Twitch ad breaks cap at 30s and are unstitchable/undetectable client-side, so the mask is deterministic), plus quality pinned and ~2s settle. Audio stays muted behind the cover, so ad audio can't leak either. If the feed can't start, the cover simply stays up while the gate rebuilds behind it. Mask/settle constants live in `src/lib/feedGate.ts` (`PREROLL_MASK_MS` etc.) |
| **Stream shows a Twitch "channel is offline" page while the slot streamer is live** | Fixed in-app: this was the embed stuck on the default channel — Twitch silently drops `setChannel()` calls made while its iframe is still bootstrapping, and the old reveal timer then exposed the mistuned player. `/player` now (1) never arms the default channel before slot data has loaded, and (2) never calls `setChannel()` at all: every channel change tears the embed down and rebuilds it tuned from its constructor, so the iframe is on the right channel from birth. FeedGate rebuilds a wedged embed (LIVE with no frames advancing for 20s) behind the branded cover. Open `?debug=1` and check the `playback`/`gate` rows + event log (`channel change → rebuild` / `gate: …` entries) if you suspect it |
| **Video stuck unplayed after a slot change** | Fixed in-app: same root cause and fix as the row above — the old retune path (`setChannel` + `getChannel` verification) could wedge playback in a restart loop on a slot handoff. Channel changes now rebuild the embed deterministically; nothing retunes a running player |
| Brand wipe stutters or plays twice in a row | Fixed in-app: the wipe is now one continuous sweep (in left → out right), and it only plays when leaving a state `/player` actually settled in for ≥5s — boot-time state shuffling and brief event races no longer fire it |
| `/watch` embed not showing | Broadcast post URL not pushed in Admin, or it's a raw `/i/broadcasts/` link (not embeddable — paste the *post* URL) |

**State previews:** open `/player?preview=board`, `?preview=brb`, `?preview=starting`,
`?preview=wipe`, or `?preview=countdown` (the no-ads "Now Live" bumper) to check each
look inside OBS without touching live state. Add `?debug=1` to any `/player` URL for
the live diagnostic panel (env, mode, channel, reveal mode, playback/gate state, audio
state, event log). To rehearse against a specific
public channel without touching slot data, use `/player?channel=<name>` (the
admin emergency override still wins over it) — handy for verifying the whole
startup sequence, ad mask included, before a slot goes live.

## 8. Optional: OBS control script (`csgn-master.lua`)

`/player` already handles all *network* logic, so an OBS script is **not
required**. But a tiny watchdog script makes a 24/7 encoder self-healing.
`docs/obs/csgn-master.lua` (in this repo) does three things:

1. **Periodic refresh watchdog** — hard-reloads the browser source every N hours
   (default 12) to clear memory creep from a CEF process that never restarts.
   Because `/player` reloads straight back into the correct network state *and*
   masks the reload with its branded cover until the feed settles, this is
   invisible on stream. The default is deliberately infrequent — each reload is a
   brief re-buffer, so reload only as often as memory creep demands.
2. **Nightly refresh** — an optional single scheduled hard-reload at a quiet hour
   (default 05:00 local), for operators who'd rather refresh once a day than on a
   rolling interval.
3. **Hotkeys** — bindable actions (Settings → Hotkeys) to hard-reload the source
   on demand and to toggle the `?debug=1` diagnostic panel on/off, so you can
   check state on-air without retyping the URL.

Install: OBS → **Tools → Scripts → +** → select `csgn-master.lua`. Set
*Browser source name* to match your source (e.g. `CSGN MASTER SOURCE`), pick the
base `/player` URL, and tune the intervals. The script never switches scenes and
never changes the URL's state — it only *reloads* the one source — so the brand
wipe stinger and every state transition still run entirely inside the page. There
is no hard cut to design around.

> The script deliberately does **not** try to detect the page's mode
> (LIVE/BRB/etc.): an OBS browser source is a one-way bridge (the page can call
> OBS, OBS can't read the page), so mode-aware logic lives in `/player`, not here.
