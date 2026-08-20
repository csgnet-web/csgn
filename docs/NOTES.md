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

**5. Furniture belongs in OBS, not `/player`.**
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
- **The clip pipeline end to end** with a real approved clip going to air.

The unit tests cover the pure logic thoroughly — 639 of them, and they have
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
1. `analysis-social-platform.md` — the loop is unclosed, and that is the game
2. `analysis-clips-concept.md` — what is actually novel here
3. `design-overview.md` — per-page grades and fixes
4. `spec-social-import.md` — TikTok import, the biggest conversion lever

**If you're going on air:** `obs/GRAPHICS.md`, then `obs/README.md`.

**Still waiting on a decision:** `design-routes.md` — DRAPER, BETTY or PEGGY.
