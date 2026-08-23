# Connecting Instagram and TikTok to auto-load content

> **STATUS — both recommendations below are now built.** The share-target PWA
> ships in `public/manifest.webmanifest` + `src/pages/Share.tsx`, and the TikTok
> Login Kit / Display API import ships in `netlify/functions/_shared/tiktok.ts`
> + `src/components/studio/TikTokImport.tsx`. Setup instructions, environment
> variables and the failure table are in **`docs/setup-tiktok-and-share.md`**.
> The analysis below is kept as written because the reasoning — especially why
> Instagram's own API is not worth building — is still the reasoning.

You're right that this would make the product seamless. Here is exactly what it
takes, what it costs, and where it breaks — because the honest summary is:

> **TikTok is achievable and worth doing. Instagram is a wall, and the wall is
> in a place people usually don't discover until they've built half of it.**

---

## Why this matters more than it looks

Today: sign in → open Studio → go to TikTok → find the post → copy link → come
back → paste → wait for review.

With import: sign in → **Connect TikTok** → your last 20 videos appear → tick
three → done.

That's not a convenience improvement. It changes the **unit of the ask** from
"go and fetch something" to "choose from what you already made", and choosing is
an order of magnitude easier than fetching. It would plausibly double posting
conversion on its own — more than any copy change on the list.

---

## TikTok — ✅ Achievable

### What you get

**Login Kit** + **Display API**, both public, both documented, no partnership
required for basic scopes.

| Scope | Gives you |
|---|---|
| `user.info.basic` | Open ID, display name, avatar |
| `video.list` | The user's public videos — id, title, cover image, **duration**, share URL, embed link |

`video.list` is the one that matters. It returns everything the clip pipeline
needs *including duration*, which currently falls back to a 45-second guess for
every TikTok on the platform. Import would fix that as a side effect.

### The flow

1. Register at `developers.tiktok.com`, get a client key/secret
2. OAuth redirect → `/auth/tiktok/callback` (same shape as the existing Twitch
   flow — `startTwitchOAuth.ts` and `twitchOAuthCallback.ts` are the template)
3. Store the refresh token server-side, encrypted
4. `POST /v2/video/list/` → up to 20 videos per page
5. Show them as a picker; member ticks what they want on air

### Cost and effort

| | |
|---|---|
| **API cost** | Free |
| **Approval** | Self-serve for these scopes. Days, not weeks |
| **Build** | ~1 week — 3 days OAuth, 2 days picker UI, 2 days polish |
| **Ongoing** | Token refresh (60-day expiry), one cron |

### The catches

- **Public videos only.** Private and friends-only are invisible, which is
  correct behaviour but will confuse a member whose post doesn't appear.
- **Refresh tokens expire in 60 days.** Needs a re-auth prompt, or the
  connection silently dies.
- **Unaudited apps are capped** (~1,000 users). Fine to launch; apply for audit
  before you'd hit it.
- **Rate limits are per-user and generous.** Not a constraint at your size.

---

## Instagram — ❌ Effectively blocked

This is where the honest answer diverges from the intuition, and it's worth
being precise, because "Instagram integration" sounds like the same size of job
as TikTok and is not.

### The problem

Meta killed the Basic Display API in **December 2024**. What replaced it:

| API | Requires | Gets you Reels? |
|---|---|---|
| Instagram Basic Display | **DEAD** | — |
| Instagram Graph API | **Business/Creator account** + linked Facebook Page | Yes |
| Instagram API with Instagram Login | Business/Creator account | Yes |

Every remaining path requires the member to have a **Business or Creator
account** *and* to have linked it to a Facebook Page.

### Why that kills it for this product

Your target member is somebody with a good clip on a personal account. Asking
them to:

1. Convert to a Business account
2. Create a Facebook Page
3. Link them
4. Then authorise CSGN

...is a four-step detour through another company's settings, to save one paste.
**Nobody does this.** The feature would exist and go unused, which is worse than
not having it — it's a dead button on your most important screen.

### Additional friction even if they do

- **App Review required** before any real user can connect — weeks, with a
  screencast demo and a privacy policy review
- **A Facebook Developer app** with Business Verification for production
- Meta **deprecates these aggressively**; this is the third API in five years

### What to do instead

**Keep the paste for Instagram, and make the paste excellent.**

The realistic improvements, all cheap:

1. **Paste detection.** Watch the clipboard on Studio focus (with permission) —
   if it holds an Instagram URL, offer it. Removes the paste step without any API.
2. **Share-target PWA.** Register CSGN as a share target. On Android the member
   hits Share in Instagram → CSGN appears in the sheet → the clip is submitted.
   This is a manifest change and about a day of work, and it's genuinely close
   to the seamless experience you want.
3. **Bulk paste.** Accept ten URLs at once, newline-separated.

Option 2 is the sleeper. It gets Instagram to a *better* place than an API
would for the common case — the member is already in the app, already looking at
the post, and Share is one tap.

---

## YouTube — ✅ Easy, and half-done already

Worth noting since it's the third platform:

- **YouTube Data API v3**, free quota, no approval
- `YOUTUBE_API_KEY` is **already wired** for durations (`_shared/clipMeta.ts`)
- Adding OAuth + "list my uploads" is ~3 days on top of what exists

If you want a second import after TikTok, this is it — cheapest remaining win.

---

## Recommendation

| Platform | Do it? | Effort | Why |
|---|---|---|---|
| **TikTok** | ✅ **Yes, first** | ~1 week | Achievable, free, and fixes durations as a bonus |
| **YouTube** | ✅ Yes, second | ~3 days | Key already configured |
| **Instagram** | ❌ No API | ~1 day | Share-target PWA instead — better UX than the API path |

### The order I'd build in

1. **Share-target PWA** *(1 day)* — covers all three platforms, no approvals,
   works on Android today and iOS increasingly
2. **TikTok import** *(1 week)* — the real prize, and durations come free
3. **YouTube import** *(3 days)* — cheap add-on

Step 1 first is deliberate: it's a day, it needs nobody's permission, and it may
get you 70% of the benefit. Measure whether posting actually goes up before
spending a week on OAuth.

---

## One thing to be careful about

Auto-import makes it trivial to bulk-submit twenty clips. Two consequences:

- **The review queue becomes the bottleneck.** At ~100 clips/day manual review
  stops working. Budget for a triage tool, or auto-approve members with a clean
  history and review only new accounts.
- **Airtime is finite.** A member who imports 20 clips and holds enough for 40
  seconds will be confused about why 19 never air. The picker should say so up
  front: *"You have 4m 12s today — that's about 8 clips."*

Both are good problems, but they arrive the same day import ships.
