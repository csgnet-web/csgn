# Setting up TikTok import and the share sheet

Two features ship together because they solve the same problem from opposite
ends: **getting a clip onto CSGN without anybody having to copy a link.**

| | What it does | Who it needs |
|---|---|---|
| **Share target** | CSGN appears in the phone's share sheet. One tap from Instagram, TikTok, X or YouTube. | Nobody. It works the moment the site is installed. |
| **TikTok import** | The member's own videos appear as a grid to tick. | A TikTok developer app — about 20 minutes of forms. |

Neither needs Meta's permission, which is the whole point — see
`docs/spec-social-import.md` for why Instagram's own API is a dead end.

---

## Part 1 — The share sheet (nothing to configure)

Already live. `public/manifest.webmanifest` declares the share target and
`public/sw.js` makes the site installable. There is no key, no approval and no
account.

### How a member uses it

1. Open **csgn.fun** on Android in Chrome
2. Menu → **Install app** / **Add to Home screen**
3. From then on, in Instagram/TikTok/X: **Share → CSGN**
4. The clip lands on `/share`, is posted to their reel, done

### Testing it

You cannot test this in a desktop browser — the share sheet is an OS feature.
On an Android phone:

- Install the site, then share any post to it
- The URL should land on `csgn.fun/share?...` and the page should say
  "On your reel"
- Signed out, it says "We've got your link" and posts automatically after
  sign-in — the link is not lost

**iOS**: Safari does not implement Web Share Target. iPhone members still paste.
Nothing breaks; the feature simply is not offered. This is Apple's gap, not ours,
and it is the main reason the TikTok import below is still worth building.

### Testing `/share` without a phone

Visit the URL by hand:

```
https://csgn.fun/share?text=look%20at%20this%20https://www.tiktok.com/@someone/video/7300000000000000000
```

The link parsing (`src/lib/shareTarget.ts`) is unit-tested against how Instagram,
TikTok and X actually fill the three fields — they all do it differently, and
only X puts the URL in `url`.

---

## Part 2 — TikTok import

### What you get

The member's own **public** videos, with **real durations**. That second part
matters more than it sounds: a TikTok pasted by hand has no readable runtime, so
today every one of them is scheduled against a 45-second guess. Imported clips
are exact.

### Registering the app

1. Go to **developers.tiktok.com** → **Manage apps** → **Connect an app**
2. Fill in the app details. You will need:
   - App name: `CSGN`
   - Icon, description, category (Entertainment)
   - **Terms of Service URL**: `https://csgn.fun/terms`
   - **Privacy Policy URL**: `https://csgn.fun/privacy`
3. Add products: **Login Kit** and **Display API**
4. Request scopes: `user.info.basic` and `video.list`
   — both are self-serve, no partnership required
5. Set the **Redirect URI** to exactly:

```
https://csgn.fun/.netlify/functions/tiktokOAuthCallback
```

6. Verify domain ownership (TikTok gives you a TXT record or a file to host)

### Environment variables (Netlify → Site settings → Environment)

| Variable | Value |
|---|---|
| `TIKTOK_CLIENT_KEY` | From the app's Credentials page |
| `TIKTOK_CLIENT_SECRET` | Same page. Never in the repo. |
| `TIKTOK_REDIRECT_URI` | `https://csgn.fun/.netlify/functions/tiktokOAuthCallback` |

Until all three are set, `startTikTokOAuth` returns
`tiktok_not_configured` and the panel never offers a broken button.

### Testing the round trip

1. Sign in, open **/studio**
2. The "From your TikTok" panel shows **Connect TikTok**
3. Connect → TikTok's consent screen → back to `/studio?tiktok=connected`
4. The grid fills with your own videos and their real lengths
5. Tick some → **Add to my reel** → they appear as `pending`

### What can go wrong

| Symptom | Cause |
|---|---|
| `tiktok_not_configured` | One of the three env vars is missing |
| Back with `tiktok=failed` | Redirect URI mismatch — it must match **character for character**, including `https://` and no trailing slash |
| Panel says "couldn't read your videos" | Scope not granted, or the access token expired and the refresh failed. Reconnect. |
| A member's video is missing | Private or friends-only. TikTok does not expose those, correctly. |

### Limits worth knowing

- **Unaudited apps are capped** at roughly 1,000 connected users. Fine to
  launch on; apply for audit before you would hit it.
- **Refresh tokens last 365 days** and rotate on every use. The stored expiry
  is on the member's document so the UI can warn before it dies.
- **20 videos per page**, and import is capped at **10 per request** —
  deliberately, so one tap cannot fill the review queue.

### Where the secrets live

`tiktokTokens/{uid}` in Firestore, which has **no security rule at all**. No
rule means no browser can reach it in any mode; only `firebase-admin` (which
bypasses rules) touches it. The member's own document gets the display name and
avatar and never the credentials. If somebody ever "tidies up" `firestore.rules`
by adding a rule for that collection, that is a leak, and there is a comment in
the file saying so.

---

## What this does NOT include

**Instagram import.** Meta killed the Basic Display API in December 2024 and
every remaining path requires the member to convert to a Business account and
link a Facebook Page. That is a four-step detour through another company's
settings to save one paste — nobody completes it, and the button would be dead
weight on the most important screen in the product. The share sheet covers
Instagram better than the API would.

**YouTube import.** Cheap to add later (~3 days) — `YOUTUBE_API_KEY` is already
configured for durations. Worth doing after TikTok proves the picker converts.
