# Put autonomous CSGN on air

This is the build sheet, not a strategy memo. Work top to bottom. The goal is an eight-hour reliable channel first, then 24/7. The current product is preserved: the existing BottomLine owns scores, crypto, Coin Spotlight, token highlighting, and the Right Now Rail; approved TikToks are break inventory; a connected Twitch streamer or the founder may preempt AUTO.

## 0. What the repository now does

- Open `/autoplayer?preview=1&demoVoice=1` at 1920×1080 to see and hear the demo. It follows the real 30-minute clock. Add `&segment=lead`, `scores`, `markets`, `board`, `film`, `numbers`, `community`, or `finish` to inspect a segment.
- Admin → **Autopilot** is the daily screen. It controls AUTO / COMMUNITY / OWNER LIVE / SAFE, holds a segment, edits the current editorial frame, publishes a two-anchor package, reviews TikTok break submissions, and exposes the connected Twitch roster for a live takeover.
- Production packages accept recorded/generated audio URLs. Demo Voice uses the browser's synthetic voices only for rehearsal; never depend on browser speech for air.
- The existing ticker is a separate transparent OBS source above `/autoplayer`. Do not rebuild it here.

## 1. Create the two anchors (one afternoon)

Write one page for each anchor: name, visual age, wardrobe, point of view, cadence, humor limit, topics they may cover, prohibited claims, and five sample exchanges. Anchor A is the founder-commentator and uses the founder's voice. Anchor B must be an original licensed character and voice—not an imitation of a broadcaster.

### Voice

Recommended production path: **ElevenLabs Professional Voice Clone** for the founder and either a contracted voice actor with an explicit synthetic-voice license or an ElevenLabs Voice Design voice for Anchor B. Start at [ElevenLabs voice cloning](https://elevenlabs.io/docs/voices/voice-lab/voice-cloning) and [text-to-speech API](https://elevenlabs.io/docs/api-reference/text-to-speech/convert). Keep the voice ID and API key server-side.

1. Record 30–60 clean minutes in the same microphone position, without music, compression pumping, or room echo.
2. Upload only the founder's own recordings. Complete the vendor consent verification.
3. Create Anchor B from a paid actor agreement or a designed voice; store the agreement.
4. Generate ten difficult test lines: player names, token symbols, scores, percentages, acronyms, and corrections.
5. Build `pronunciations.json`; never solve pronunciation by misspelling the public transcript.
6. Export 48 kHz WAV or high-bitrate MP3. Loudness-normalize all speech to one target before playout.

Do not call the voice API from the browser. Add a Netlify render function later that receives an approved package ID, reads its script, calls the provider with the secret key, writes audio to Storage, and records the URL/hash on the package.

### Visual anchor

Fastest professional path: commission two original bust portraits/rigs, then animate them rather than generating a new person every line. For a rapid demo, use [HeyGen's Avatar API](https://docs.heygen.com/reference/create-an-avatar-video-v2) to render short presenter shots. For real-time interactive experiments, evaluate [Tavus](https://docs.tavus.io/) separately; it adds latency and operational risk that a linear show does not need.

For the first airable version, use three reusable shots per anchor (wide, medium, reaction), a transparent foreground, and graphic-led B-roll. Render 1080p, 30 fps, consistent eyeline, lighting, wardrobe, and background. Generate presenter video only for introductions, transitions, and opinions; scores, tables, charts, corrections, and sources should remain deterministic HTML graphics.

## 2. Build the content pipeline (days 1–3)

Create these server-side collections; clients must not write them directly:

- `factPackets/{id}`: claims, exact source URLs, source timestamps, expiry, rights class, confidence, approvedBy.
- `packages/{id}`: segment, two-anchor turns, factPacketIds, review class, sponsor/promotion disclosure, pronunciation version, status.
- `renders/{id}`: packageId, scriptHash, voice/audio URLs, avatar/video URLs, duration, QC results.
- `playout/current`: mode, packageId, startedAt, heartbeat, hold, nextMode.
- `playoutQueue/{id}`: renderId, plannedStart, priority, freshUntil, state.

The code owns scores, prices, math, clocks, labels, and expiration. The model gets a fact packet and a strict JSON schema; it never browses autonomously and never invents a source.

Minimal generation job:

1. ingest licensed API and primary-source updates;
2. normalize and deduplicate;
3. rank for the current daypart;
4. create a fact packet;
5. ask an LLM for `turns[]` containing only supplied fact IDs;
6. reject any sentence whose claim IDs are absent;
7. human-approve reported news, all ads, first-time formats, and corrections;
8. render two voice tracks and optional anchor video;
9. run duration, silence, loudness, black-frame, expiry, and disclosure checks;
10. move the render to READY.

Use a scheduled Netlify function only to coordinate short jobs. Video rendering belongs on a worker such as Google Cloud Run, AWS ECS/Fargate, or Modal because it needs FFmpeg, more memory, and longer execution. Store finished media in Firebase Storage or an object store/CDN, never in Firestore.

## 3. Make the first package (today)

In Admin → Autopilot:

1. enter the lead and context;
2. paste Anchor A and Anchor B turns;
3. optionally paste hosted MP3/WAV URLs for each turn;
4. publish the package;
5. open the segment rehearsal link;
6. use `demoVoice=1` only when no audio URL exists;
7. confirm the source time and `REHEARSAL` label;
8. repeat for the next package.

The current editor intentionally handles one two-anchor package so the whole path is visible now. The next engineering increment moves the same schema to `packages/` and adds queue ordering, review states, and worker rendering without changing the playout contract.

## 4. Put it in OBS (today)

Create one scene named `CSGN AUTO` at 1920×1080, 30 fps:

1. Browser Source: `https://YOUR_DOMAIN/autoplayer` at 1920×1080, shutdown when hidden **off**, refresh when active **off**.
2. Existing ticker/lower-third Browser Source above it. Use the current production ticker file; no duplicate scores or prices are required in the program layer.
3. Existing notices/now-watching source above the ticker if desired.
4. Audio Monitoring: monitor `/autoplayer`; confirm OBS desktop/browser audio reaches Program.
5. Add `CSGN SAFE`, a local media source with at least two hours of evergreen packages plus the live ticker.
6. Keep the existing founder scene and existing forwarded-stream scene.

Hotkeys: AUTO, OWNER LIVE, STREAM TAKEOVER, COMMUNITY BREAK, SAFE, HOLD NEXT, MUTE PROGRAM. A hotkey must update the same Firestore mode as Admin; until OBS WebSocket automation is added, press the Admin mode button at the same time so `/watch` and the archive agree.

## 5. TikTok ads and community breaks

Do not create a second ad system. Use the existing TikTok OAuth/import/submission/review flow. A project or member connects the TikTok account that owns the creative, submits the post, and grants broadcast/derivative rights. Admin reviews it in the Autopilot screen.

Add three fields to the next backend increment: `contentKind: community|ad`, `disclosure`, and `campaignId`. Approved `ad` clips enter only the bounded COMMUNITY break, always render `ADVERTISEMENT · @account`, are frequency-capped, and return automatically to AUTO. Coin Spotlight and Right Now Rail remain the existing $CSGN promotional products and are not duplicated.

Before accepting paid TikTok creative, obtain counsel-approved terms covering music, likeness, claims, territory, platform reposting, and synthetic derivatives. TikTok availability through an API does not itself grant broadcast rights.

## 6. Twitch and founder preemption

Use the existing connected-Twitch roster. `OWNER LIVE` always wins; an admin-selected connected streamer wins over AUTO; a COMMUNITY break finishes or requeues according to policy; AUTO resumes at the next segment boundary. Never resume a sentence halfway through.

The next code integration should make `public/channelMode` support `auto` and have one director resolve this order:

```text
OWNER LIVE > selected Twitch streamer > approved Community/Ad break > AUTO > SAFE
```

The current Admin Autopilot page places these controls together, but the legacy `/player` and new `/autoplayer` are still separate playback engines. Do not call that 24/7 autonomous production until the director owns both sources and heartbeat-driven SAFE failover.

## 7. Reliability gates

Run unlisted before public air:

- 14 consecutive two-hour rehearsals;
- 30 READY minutes and two local SAFE hours at all times;
- no silence or black frame over five seconds;
- no expired score/story, unsupported claim, missing source, or unlabeled ad/rerun;
- automatic SAFE on stale heartbeat, low queue depth, render failure, silence, black frame, disk pressure, or destination failure;
- one-hour local recordings for recovery and review;
- second-device monitoring on a separate network.

Then air 4 PM–midnight ET for 30 days. Expand to 24/7 only at 99.5% playout uptime, SAFE below 5%, and daily human operation below 45 minutes excluding founder broadcasts.

## 8. The exact remaining engineering order

1. Replace the single `config/autopilot.activePackage` editor with server-validated `packages/` and `playoutQueue/` endpoints.
2. Add the voice render function and object-storage upload.
3. Add FFmpeg QC and a render worker; then optional avatar-video rendering.
4. Add licensed sports/news ingestion and fact-packet validation.
5. Extend channel mode to AUTO and implement the single director for AUTO/TikTok/Twitch/OWNER/SAFE.
6. Add heartbeat/audio/black-frame/destination telemetry and automatic SAFE.
7. Add clip/ad campaign fields, disclosure overlay, frequency cap, completed-play log, and billing record.
8. Add transcript/source pages and one-click vertical derivatives.
9. Remove old schedule/slot surfaces from primary navigation only after the director replaces them; do not delete working payout, OAuth, ticker, or moderation code.

That is the shortest honest path from the visible demo to a professional 24/7 network.
