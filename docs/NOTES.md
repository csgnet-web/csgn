# Project notes

Things worth knowing that don't belong in any one file. Written for whoever
touches this next — including you in three months.

---

## The bug pattern that has cost the most

**Every serious bug in this project has been an empty state indistinguishable
from a failure.** Not one of them threw a visible error. Each looked exactly
like the product being unimpressive.

| Bug | Rendered as | Actually was |
|---|---|---|
| Missing Firestore index | "0 seconds", empty Studio | 500 from a composite-index requirement |
| No `linkPhantom` function | Balance 0 | No way to attach a wallet, ever |
| CSP blocked the RPC | Balance 0 | Our own security header |
| `inventorySeconds` from a cache | "0 seconds" | Real bag × zero inventory |
| Meme 100 search endpoint | 2 coins | Wrong data source entirely |
| CSP `frame-src` | Blank video | TikTok/IG embeds blocked |
| Vote sent a ticker | Nothing happened | Server wanted a mint |

**The rule that came out of it, and it is the most valuable thing in this
repo:**

> Never render "we could not read it" as zero, empty, or absent. They are
> opposite facts. `catch { return 0 }` is the single most expensive line of code
> in this codebase's history.

Every reader now returns `null` for unknown and the UI says which it is. If you
add a data path, do the same, and add a diagnostic that says *which source*
failed — the Meme 100 took three wrong fixes because nothing said which layer
was empty.

---

## Architecture rules that are load-bearing

**1. The browser never talks to a chain or a token API directly.**
Every chain read goes through a function and reaches the page as same-origin
JSON. CSP `connect-src` deliberately lists no RPC host. Breaking this is what
zeroed every balance on the site. See the comment in `netlify.toml`.

**2. Pure rules in `_shared/`, persistence in the caller.**
`feeCalc`, `airtime`, `jukebox`, `operatorAlerts`, `broadcastDay`, `clipEmbed`
are pure and tested. Anything deciding money or airtime goes there, once. If you
find yourself writing the same arithmetic in a component, you are about to
create the second implementation.

**3. Server decides, client displays.**
The client never recomputes an entitlement. It reads the stored verdict. Two
implementations of one number always disagree eventually, and you find out on
air.

**4. `queryCollection` — no `orderBy` on bounded sets.**
An equality filter plus `orderBy` on a different field needs a composite index,
and Firestore returns FAILED_PRECONDITION rather than degrading. Fetch and sort
in JS unless the collection is genuinely large. The header on that function
explains it.

**5. Nobody claims an hour.** Claiming is gone — the endpoint, the buttons and
the client method. An hour either has somebody the operator put on (because they
are live and consented) or it runs the member reel. `isOpenHour` is what used to
be `isSlotClaimable` and now means "nothing programmed here, so the reel has
it"; `airEligibility` is what used to be `claimEligibility` and is now the
roster gate. If you find yourself adding a "book this hour" button, the model
has drifted.

**6. Why the channel is in a mode is PUBLISHED, not inferred.**
`_shared/channelMode.ts` turns the current slot into a mode plus one sentence of
reason and one of what changes it. The poller writes it to `public/channelMode`
every minute; `adminLiveNow` rewrites it immediately after an operator action so
the sign is never a minute behind the picture. Every surface renders the stored
sentence. Do not compute a mode in a component — that is how a live show once
headlined "THE STAGE IS OPEN".

**7. Three doors, one set of clip rules.**
A clip reaches a reel by paste (`submitClip`), by the Android share sheet
(`/share`), or by TikTok import (`tiktokVideos`). All three go through
`_shared/clipIntake.ts`, which owns the cap, the dedupe, the ordering, the
pending status and the exact runtime. A fourth door must use it too.

**8. Furniture belongs in OBS, not `/player`.**
If a graphic looks identical over any source, it is furniture. `/player` renders
the programme and things timed to a programme change. Everything else is a
separate browser source — it composites free on the GPU and can be retuned
without a deploy.

---

## Things that are configured, not coded

Flip these without touching code:

| Setting | Where | Note |
|---|---|---|
| `SOCIAL_AUTH_ENABLED` | `src/config/authProviders.ts` | **Still `false`.** The single highest-value item outstanding |
| `SOLANA_RPC_URL` | Netlify env | Set to a paid endpoint before launch. Public RPCs throttle serverless egress hard |
| `YOUTUBE_API_KEY` | Netlify env | Optional. Without it every YouTube clip guesses 45s |
| `liveViewerFloor` | `config/scheduleMeta` | How much of the day is live. Admin UI |
| `jukeboxFloorCsgn` | `config/tokenGates` | Opening bid. Admin UI |
| `airtimeStartAt` | `config/season` | Verified-airtime cutover date |
| Meme 100 pins/denies | `config/memeBoard` | Admin UI |
| `TIKTOK_CLIENT_KEY` / `_SECRET` / `_REDIRECT_URI` | Netlify env | All three, or the TikTok panel stays hidden. `docs/setup-tiktok-and-share.md` |

---

## Deploy checklist

1. **`firestore.indexes.json`** — deploy it. Nothing currently *needs* it, but
   it is there so the ordered query form is safe if reintroduced.
2. **`firestore.rules`** — deploy it. Several surfaces read `public/*` directly.
3. **`SOLANA_RPC_URL`** — do this one. The failover list works, but public
   endpoints will throttle you.
4. **`PROJECT_ID` in `docs/obs/csgn-hud.html`** — set before adding the browser
   source.
5. **Verify the Meme 100** — `docs/spec-meme-100.md` §7. This is the surface
   most likely to be wrong on first deploy, and I have never seen it work.
6. **`firestore.rules` again, specifically**: `tiktokTokens/{uid}` must have NO
   rule. No rule means no browser can reach it. There is a comment in the file
   saying so; if somebody "tidies it up" by adding one, refresh tokens leak.
7. **Install the PWA on an Android phone once** and share a post into it. The
   share target cannot be tested any other way, and iOS does not implement it at
   all (Safari's gap, not ours).

---

## What I have never been able to test

This sandbox blocks all outbound network. Everything below is written from
documentation and reasoning, and has never seen a real response:

- **Every Meme 100 data source.** Jupiter's endpoints and field names are from
  memory. `docs/spec-meme-100.md` §4 tells you exactly what to change if the
  shape differs.
- **The jukebox on-chain bid path.** Never run against mainnet. Dry-run with a
  small bid.
- **Twitch Helix sampling** with real credentials.
- **The whole TikTok round trip.** OAuth, the Display API's envelope, the token
  refresh. The parsing is tested against the documented shapes and nothing more.
- **The Android share sheet.** It is an OS feature; it cannot be exercised from
  a desktop browser at all.
- **The clip pipeline end to end** with a real approved clip going to air.

The unit tests cover the pure logic thoroughly — around 700 of them, and they have
caught real bugs (a negative crop start, a DST off-by-a-day, a payout summary
persisting recipient records). They cannot cover a third party's response shape.

---

## The one product decision waiting on you

**One free airing on a member's first clip, ever.**

Clip posting is the viral action — free, one paste, with a natural "I'm on TV"
share moment. But airtime requires holding $CSGN, so a first-time poster who
holds nothing does the work and sees nothing air. Viral loops do not survive a
purchase in the middle.

One free airing costs a few seconds of air once per member, gets a new poster
all the way through the loop, and produces your best recruitment asset from
somebody who has not spent a cent. It converts the token gate from a wall into
an upgrade path.

I have deliberately not built it — it changes the token's meaning and that is
yours to decide.

---

## Reading order for the docs

**If something is broken:** `spec-meme-100.md` (§3 first), then this file.

**If you're deciding what to build:**
1. `analysis-path-to-1m.md` — the whole picture, and what $1M actually costs
2. `analysis-social-platform.md` — the loop is unclosed, and that is the game
3. `analysis-clips-concept.md` — what is actually novel here
4. `design-overview.md` — per-page grades and fixes
5. `analysis-clip-vs-streamer-mode.md` — how much of the day should be live

**If you're going on air:** `obs/GRAPHICS.md`, then `obs/README.md`.

**Still waiting on a decision:** `design-routes.md` — DRAPER, BETTY or PEGGY.
