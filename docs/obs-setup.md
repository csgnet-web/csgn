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

### Why `/player` behaves differently in OBS vs a normal tab

`/player` detects its environment (`window.obsstudio`) and adapts:

- **Inside OBS**, the browser source autoplays *with sound* and there is never a
  user click, so audio is forced on programmatically and stays on (gently
  re-checked every 15s — and only nudged if it has actually drifted to muted, so
  a healthy feed is never disturbed). The feed is also pinned to Twitch's
  **source** quality (`chunked`) so the encode never drops to auto/360p, and a
  **branded cover is held over the feed until it settles** — so the Twitch
  startup reveal (play-button poster, preroll, channel/Follow chrome) is never
  seen on-stream, on first load *or* after a watchdog reload. Going LIVE no
  longer depends on Twitch's flaky `ONLINE`
  event. LIVE is now reached three independent ways: the embed's `ONLINE` event,
  a real `PLAYING` event (playback started ⇒ the channel is live), **and** the
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

### Verifying the encode (do this once before going live)

Open `https://csgn.fun/player?debug=1` in the OBS source (right-click → Interact,
or just point a throwaway source at it). A small debug panel shows in the
top-left with `env` (should read `OBS <version>`), the current `mode`, the armed
`channel`, `audioBlocked`, `server live` (the server's Helix check), and a live
event log. When a streamer is live you should see `→ LIVE (playing)` /
`→ LIVE (online)` (or `server live: yes …` driving `mode: LIVE` if the embed
event never fired). Remove the `?debug=1` for the real broadcast source.

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
| **Feed looks low quality / soft** | `/player` pins Twitch **source** (`chunked`) automatically on going live and retries as the quality list populates. If it still looks soft, the upstream streamer may not be broadcasting a source-quality tier, or the OBS **output** resolution is below the canvas — set both Base and Output to 1920×1080 (Settings → Video) |
| Twitch play-button / small ad / channel chrome flashes on-stream | Fixed in-app: a branded cover masks the whole startup reveal until the feed settles (~3.5s hold), on first load and every reload. If you still catch a flash, the cover hold may need lengthening — it lives in `REVEAL_HOLD_MS` in `src/pages/Player.tsx` |
| `/watch` embed not showing | Broadcast post URL not pushed in Admin, or it's a raw `/i/broadcasts/` link (not embeddable — paste the *post* URL) |

**State previews:** open `/player?preview=board`, `?preview=brb`, `?preview=starting`, or
`?preview=wipe` to check each look inside OBS without touching live state. Add
`?debug=1` to any `/player` URL for the live diagnostic panel (env, mode, channel,
audio state, event log).

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
