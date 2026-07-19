# CSGN Agent Work Packets

> Scoped, self-contained work packets for future engineering/ops agents (or the
> founder). Each packet lists goal, context files, spec, and acceptance criteria
> so an agent can start cold. Ordering within each lane ≈ recommended priority.
> Companion strategy doc: [`business-spec.md`](./business-spec.md).

Conventions for any agent picking one up: develop on the designated branch,
never commit secrets, run `npx eslint src/ && npx tsc -b && npx vitest run &&
npm run build` before finishing, and label anything user-visible with the
built/planned honesty rule from `business-spec.md`.

---

## Lane A — Stream quality (what viewers see)

### A1. Broadcast graphics overlay, Phase 1 (bug + clock + GraphicsRoot)
- **Goal:** a transparent `/broadcast/overlay` route OBS layers above `/player`:
  persistent CSGN bug (real avatar, `public/csgn-logo.jpg`) + ET clock + LIVE
  dot, driven by a `config/broadcastGraphics` Firestore doc.
- **Context:** `docs/broadcast-graphics.md` (§build roadmap), `src/pages/Player.tsx`
  (route/env patterns), `firestore.rules` (`config/ticker` shows the
  public-read pattern), Admin config-card patterns in `src/pages/Admin.tsx`.
- **Spec:** new route registered in `src/App.tsx`; `onSnapshot` on the doc;
  `{ bugVisible: boolean, clockVisible: boolean }` v1; transparent body.
- **Accept:** overlay renders nothing but bug/clock on transparency; toggles
  land <2s after an admin write; zero pointer events; tests for the doc parse.

### A2. Lower thirds with slot auto-fill (Phase 2)
- **Goal:** operator-cued lower third (name/title, slide in/out) + auto-fill
  from the live slot's `assignedName` when a streamer goes LIVE.
- **Context:** A1's overlay; `src/contexts/LiveSlotContext.tsx`;
  `src/components/ui/WipeOverlay.tsx` for motion language.
- **Spec:** `lowerThird: { name, title, visible, autoFromSlot }` on the same
  doc; Admin card with push/hide; ~420ms slide+fade; primary-500 accent bar.
- **Accept:** manual push shows/hides cleanly; auto mode bills the slot
  streamer within one snapshot of LIVE; never overlaps the ticker band.

### A3. VOD Broadcast System, Phase 1 — scheduled playlist + real resume
- **Goal:** make "resuming the previous VOD" true across encoder reloads
  (today `VodRotator` keeps its index in React state — lost on every reload).
- **Context:** `business-spec.md` §3 (data model + acceptance tests, R1),
  `src/components/player/VodRotator.tsx`, `src/lib/masterControl.ts`.
- **Spec:** `playback/vodState` doc `{ itemId, positionS, updatedAt }` written
  every ~15s while VOD plays; on INTERMISSION entry, resume from it if fresh;
  labeled transition card at every state change (reuse `WipeOverlay`).
- **Accept:** kill and reload `/player` mid-VOD → same item within ±20s;
  streamer claim during VOD → LIVE handoff with transition; unit tests for the
  resume decision (pure function, fake clock).

### A4. VOD Phase 2 — shuffle rerun pool, specials, Claim-Here windows
- **Goal:** the founder's full 24/7 VOD vision: Priority/Scheduled tier, Series
  tier, shuffled Rerun pool, National Anthem 3:59–4:00 AM ET nightly, and
  ~15-min "Claim Here" takeover windows weighted overnight.
- **Context:** A3 shipped first; `business-spec.md` §3 tier table;
  `IntermissionBoard` open-stage panel (the Claim look exists).
- **Spec:** extend `config/vodPlaylist` → `{ scheduled: [], series: [],
  rerunPool: [], specials: [{ type:'anthem', atET:'03:59' }] }`; deterministic
  shuffle (seeded daily) so reruns don't repeat back-to-back; scheduler is a
  pure function of (nowET, doc) for testability.
- **Accept:** anthem fires 3:59 ET in a fake-clock test; claim window occupies
  its slot; shuffle never plays the same item twice consecutively.

### A5. Own-ingest spike (the ad-free endgame)
- **Goal:** kill the Twitch ad surface entirely — hosts push RTMP/WHIP to CSGN
  infra; `/player` plays our stream; `?noads` becomes always-correct.
- **Context:** `docs/obs-setup.md` (Turbo/ads sections), `docs/broadcast-graphics.md`
  §4 sourcing options.
- **Spec:** time-boxed evaluation build: LiveKit Cloud vs Cloudflare Stream
  Live vs self-hosted MediaMTX; measure glass-to-glass latency, cost/mo at 1
  ingest + 1 playback, reconnect behavior; wire ONE into `/player` behind
  `?ingest=1`.
- **Accept:** a written comparison in `docs/own-ingest.md` + a demo path where
  an OBS push appears on `/player` in <5s with zero Twitch chrome.

### A6. Encoder health telemetry
- **Goal:** know the 24/7 encoder is healthy without watching it.
- **Spec:** `/player` writes a `playback/heartbeat` doc every 60s (mode,
  channel, fps hint via `obsstudio`, gate phase); a tiny status card in Admin
  shows last-seen + mode; stale >3 min = red banner. Optional: Discord webhook
  ping on staleness (pairs with C2).
- **Accept:** unplug the encoder → Admin shows red within 3 min; heartbeat
  writes are batched/cheap (≤1 write/min).

## Lane B — Product / platform

### B1. Partner daypart mechanism (`config/partnerBlock`)
- **Goal:** the Ansem-class deal rail: a recurring daily window where the
  network runs a partner's branding + source, with a begin date.
- **Context:** `business-spec.md` Track B; `Player.tsx` broadcast derivation
  (the `emergencyOverride` pattern is the template); `masterControl.ts`.
- **Spec:** `{ active, partner, streamUrl, windowET: { startHour, hours },
  beginDate, brand: { label, color }, token: { symbol, mint } }`; during the
  window (≥ beginDate) the doc outranks slot data (but not emergencyOverride);
  graphics/ticker read the same doc for co-branding.
- **Accept:** pure reducer tests: inside/outside window, before/after begin
  date, override precedence; Admin card to arm/disarm; 12h window playable.

### B2. Second token surface ($ANSEM or any partner mint)
- **Goal:** partner token gets the $CSGN treatment: poller stats + watch panel
  + ticker presence.
- **Context:** `netlify/functions/feePollerBackground.ts` (writes
  `public/tokenStats`), `src/components/watch/TokenPanel.tsx`,
  `docs/obs/csgn-ticker.html` (spotlight already covers the OBS side).
- **Spec:** poller reads `config/partnerBlock.token`, writes
  `public/tokenStats_partner`; TokenPanel renders a second tab/row when
  present; keep DexScreener call volume flat (one extra pair per minute max).
- **Accept:** with a partner armed, `/watch` shows both tokens within a
  minute; poller failure degrades to stale-with-timestamp, never blank.

### B3. Holder utility: wallet-gated badges & slots
- **Goal:** $CSGN/$ANSEM holders get visible status + access — utility only,
  no payouts (legal line per `business-spec.md` §5).
- **Context:** `src/hooks/usePhantomWallet.ts`, `src/lib/slots.ts`
  (`requestSlot`), `@solana/web3.js` already in deps.
- **Spec:** read SPL balance for configured mints on wallet connect; threshold
  from `config/holderPerks`; award a profile badge + allow request on
  holder-gated slots (`slot.holderGate: 'csgn'|'partner'`).
- **Accept:** below-threshold wallet sees a clear "requires N tokens" state;
  balances re-checked server-side at claim time (never trust the client).

### B4. Marketplace re-open kit (post day-30 gate)
- **Goal:** everything needed to flip auctions back on in one PR.
- **Context:** `src/lib/slots.ts` (the two `'ceo'` operator overrides,
  quadratic `getMinimumBid`), `netlify/functions/_shared/schedule.ts`.
- **Spec:** revert instructions + a `SLOT_MODE` env/config switch instead of
  code edits; bid-flow smoke tests; Admin toggle with confirm.
- **Accept:** flipping the switch on a staging doc makes new daytime slots
  auction-typed while existing assigned slots are untouched.

## Lane C — Growth / business ops

### C1. Clip engine ops rail (non-code or light-code)
- **Goal:** the 10h/wk → clips pipeline from `business-spec.md` §2 as a
  repeatable checklist + folder/naming conventions + end-card template, so AI
  clippers (Opus/Klap/Vizard) slot in without decisions each day.
- **Accept:** `docs/clip-pipeline.md` an operator can follow start-to-finish;
  one week's dry run produces ≥15 branded clips with the LIVE-8PM end card.

### C2. Newsroom Discord automation
- **Goal:** be early on everything: auto-ingestion channels wired to the demo
  (crypto/sports/entertainment/gaming) + on-chain events from our own poller.
- **Context:** `feePollerBackground.ts` already watches Helix + DexScreener —
  add outbound Discord webhooks (env-config'd URL) for: slot went live, fee
  milestone, $CSGN/$partner ±X% in 1h.
- **Accept:** webhook posts land in the right channels; secrets via env only;
  a `docs/newsroom.md` runbook for the human war-room channels.

### C3. Ansem pitch package
- **Goal:** the outreach artifact for Track B: one-pager (daypart terms,
  utility mechanics, screenshots of the spotlight/ticker with $ANSEM live) +
  the 90-day pilot term sheet skeleton from `business-spec.md`.
- **Accept:** founder can send it same-day; every claim in it is demoable in
  the product; day-14 gate fallback list (2–3 alt CT personalities) attached.

### C4. Metrics baseline
- **Goal:** the KPI grid in `business-spec.md` §4 needs a source of truth.
- **Spec:** lightweight `docs/metrics.md` + a weekly template (shows shipped,
  clips posted, X followers, live concurrents, Discord members, slot claims);
  optional: a Netlify function snapshotting X follower count daily to
  Firestore.
- **Accept:** week-1 baseline row filled; template takes <10 min/week.

---

*Maintenance note: keep this file pruned — delete packets when shipped, and
mirror status into `business-spec.md`'s 30-day plan when a packet lands.*
