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
- FPS: *Use custom frame rate* unchecked (matches canvas)
- ✅ **Control audio via OBS**
- ❌ Shutdown source when not visible
- ❌ Refresh browser when scene becomes active

In the Audio Mixer: browser source fader at **0 dB**, monitoring **Monitor Off** (the stream
gets the audio; you don't need it playing on the workstation). If you ever need to click inside
the page, right-click the source → **Interact**.

Canvas: Settings → Video → Base and Output resolution both `1920×1080`.

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
| No audio on stream | Browser source is missing ✅ "Control audio via OBS", or fader down |
| Black browser source | Toggle Settings → Advanced → browser hardware acceleration, or right-click source → Interact → reload |
| Stuck on BRB/board though streamer is live | Right-click source → Interact → hard-reload `/player`; check the slot's `twitchChannelUrl` in Admin |
| Stream drops repeatedly | Check Automatically Reconnect is on; verify RTMPS key still valid in Media Studio |
| `/watch` embed not showing | Broadcast post URL not pushed in Admin, or it's a raw `/i/broadcasts/` link (not embeddable — paste the *post* URL) |

**State previews:** open `/player?preview=board`, `?preview=brb`, `?preview=starting`, or
`?preview=wipe` to check each look inside OBS without touching live state.
