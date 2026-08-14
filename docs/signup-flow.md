# Sign-up, sign-in, and the Twitch problem

The one-paragraph version: **sign-up is three taps and a signature — Continue
with Phantom, approve, Create account.** Nothing else is on the critical path.
Twitch moved to after the finish line because inside Phantom's in-app browser it
*cannot work*, and email moved to the account page because it was never the
credential. What follows is why each of those is true and what happens in the
code.

---

## 1. The bug that started this

> The Twitch redirect from sign-up in the Phantom app opens a Log In to Twitch,
> the user is forced to sign in from an external browser rather than their
> phone's Twitch app, and the Continue with Google / Amazon / Apple paths end in
> "Something went wrong."

Every part of that is real, and only part of it is ours.

**"Something went wrong" is Google's policy, rendered by Twitch.** Google, Apple
and Amazon all refuse to run their sign-in flows inside an app's embedded
webview — Google returns `disallowed_useragent` — because the host app can read
the page and scrape the credentials. There is no header, flag or client setting
that turns this off. It is enforced deliberately, it applies to every app with
an in-app browser, and Twitch simply displays the generic error it gets back.
While the user is inside Phantom, those three buttons will never work.

**The logged-out Twitch page is cookie isolation.** A webview has its own cookie
jar. A user signed into Twitch on their phone — in the Twitch app, or in Safari
— arrives at `id.twitch.tv` as a stranger, because none of those sessions reach
into Phantom's webview.

**The honest limit: there is no handoff to the Twitch app.** Twitch publishes no
deep link for `id.twitch.tv/oauth2/authorize`, and it is not covered by their
iOS universal links, so "authorize using the session in your Twitch app" is not
a thing that can be built by anyone, us included. The nearest achievable thing
is the *system browser*, where the user's Twitch web session usually already
exists and where the federated buttons work. In practice that turns the hop into
one tap, and for anyone who has authorised CSGN before, into a zero-tap
redirect — Twitch skips its consent screen for a client you have already
approved.

So the fix has two halves: **get out of the sign-up path entirely**, and **when
Twitch is genuinely needed, get out of the webview.**

---

## 2. Sign-up: what is left

```
   ┌─ Continue with Phantom ──────────────────────────────┐
   │  connect → challenge → signature → verify            │
   └──────────────┬───────────────────────────────────────┘
                  │
        wallet already registered? ──yes──▶ signed in. Done. (2 taps)
                  │ no
                  ▼
   ┌─ Pick your name ─────────────────────────────────────┐
   │  pre-filled, valid, editable → Create account        │
   └──────────────┬───────────────────────────────────────┘
                  ▼
   ┌─ You're on ──────────────────────────────────────────┐
   │  Watch what's live      │  I want to go on air →     │
   └──────────────────────────────────────────────────────┘
```

Four things were removed from that path, each for a stated reason:

| Removed | Why it was never load-bearing |
|---|---|
| The sign-in / sign-up choice | The wallet knows which one applies. `loginWithPhantom` 404s for an unlinked wallet without creating anything, so we try it and branch on the answer. Asking a stranger to pick the right button first was asking them to know something we already know. |
| Typing a username | `lib/username.ts` derives a stable, valid handle from the wallet address. The primary button is live on arrival; typing is opt-in. |
| Connect Twitch | It gates *claiming an hour*, not *having an account* (`claimSlot.ts`). Inside Phantom it was also unfinishable — see above. |
| Email + password | `loginWithPhantom` has always admitted a holder on a signature alone, so the password was a second, weaker key that stopped being used after the first sign-in. It survives as **recovery**, offered on /account, and as an automatic fallback for the one rejection it actually solves (below). |

**The one place email still appears in sign-up.** A wallet with no on-chain
history is refused by the sybil gate in `signupWithPhantom.ts`
(`wallet_not_established`). "Try again" is useless advice for that user, so the
modal opens the email + password form itself with an explanation. The wallet
still gets attached; only the on-chain check is bypassed.

---

## 3. Twitch: the cross-browser handoff

Once the account exists, Twitch is offered — and here the browser decides the
route, not the caller. `hooks/useTwitchLink.ts` is the only entry point, used by
both the sign-up modal and /account.

### Route A — a real browser (desktop, mobile Safari/Chrome)

Unchanged, and it always worked: full-page redirect (never a popup — Apple
refuses OAuth in popups too), Twitch redirects back to
`/auth/twitch/complete?state=…`, that page claims the proof out of
sessionStorage and returns the user to the page they left.

### Route B — an embedded webview (Phantom, X, Instagram, …)

We do not navigate at all. Instead:

```
  Phantom's in-app browser              Safari                    CSGN backend
  ─────────────────────────             ──────                    ────────────
  tap "connect Twitch"
    POST startTwitchOAuth  ──────────────────────────────────────▶ mints state
                           ◀────────────────────────────────────── + linkToken
    show "Finish in Safari"
    ┌ Open Twitch in Safari ┐ ──tap──▶  id.twitch.tv/authorize
    │ Copy the link         │            (Google/Apple WORK here,
    │ ⟳ waiting…            │             session already exists)
    └───────────────────────┘                  │
                                               ▼
                                          twitchOAuthCallback ────▶ writes result
                                               │                    under {state}
                                               ▼
                                       "You're verified —
                                        close this tab"
    poll claimTwitchLink(linkToken) ─────────────────────────────▶ hands proof to
    ◀──────────────────────────────────────────────────────────── the token holder
    panel turns green. Never reloaded.
```

The `linkToken` is an HMAC proof token (`_shared/proofTokens.ts`) bound to the
OAuth `state`, and it **never leaves the tab that started the flow**. That is the
whole trick: whichever browser finishes the OAuth, the result is claimable only
by the tab the user came from. The browser that finished it has no token, so
`/auth/twitch/complete` there renders "you're verified, go back" and does
nothing else.

Design notes worth keeping:

- **Failures are written to the result doc too**, not only carried in the
  redirect. Otherwise a `duplicate_twitch` in Safari would leave the Phantom tab
  spinning for five minutes with no explanation.
- **The escape is an `<a href>`, not a scripted navigation.** Scheme handoffs
  (`x-safari-https://` on iOS, `intent://…;end` on Android) are far more reliable
  from a real tap, and `x-safari-` is an undocumented Apple scheme that fails
  *silently* when a host app declines it — which is exactly why the copy-link
  fallback is rendered next to it and not hidden behind a "having trouble?" link.
- **The poll is HMAC-verified, not document-backed**, so each poll costs one
  Firestore read instead of two. The schedule (`pollDelayMs`) is front-loaded:
  2s while the "already signed into Twitch in Safari" case is still plausible,
  then 3s, then 5s. ~70 requests across the full five-minute window.
- **The poll is never auto-resumed on mount.** Two `useTwitchLink` hooks can be
  alive at once (the modal is mounted behind every page; /account has its own)
  and the proof is single-use, so an automatic resume would race and the loser
  would report "already used" on a link that succeeded.

---

## 4. Files

| File | Job |
|---|---|
| `src/lib/webview.ts` | Am I in a webview, and how do I get out? Detection + `x-safari-` / `intent://` escapes. |
| `src/lib/twitchLink.ts` | The pending link in sessionStorage, and the poll schedule. No Firebase import — it is pure scheduling and is tested as such. |
| `src/hooks/useTwitchLink.ts` | Picks the route, owns the phase machine, calls back with the proof. |
| `src/components/auth/TwitchHandoffPanel.tsx` | The "Finish in Safari" UI: tap target, copy fallback, live waiting state. |
| `src/components/auth/AuthModal.tsx` | The three-tap sign-up. |
| `src/pages/TwitchComplete.tsx` | One landing page, two browsers. Claims, or says "go back". |
| `netlify/functions/startTwitchOAuth.ts` | Mints `state` + `linkToken`. |
| `netlify/functions/twitchOAuthCallback.ts` | Exchanges the code; writes every outcome under `{state}`. |
| `netlify/functions/claimTwitchLink.ts` | The polled endpoint. Single-use, HMAC-gated. |

Removed: `netlify/functions/consumeTwitchOAuthResult.ts` (assumed the returning
browser was the originating browser) and `src/lib/registerDraft.ts` (existed only
to carry half-typed sign-up fields across a redirect that no longer happens
during sign-up).

---

## 5. What to verify before trusting a deploy

The checklists in [env-setup.md](env-setup.md) under *Sign-up test (Phantom on
iPhone)* and *Twitch link test* are the acceptance criteria. The two that
actually catch regressions:

1. In Phantom on a phone, tapping "connect Twitch" must **not navigate**. If the
   page goes to Twitch, `isEmbeddedBrowser()` returned false and the user is
   about to hit "Something went wrong."
2. After approving in Safari, switching back to Phantom must show the connected
   state **without a reload**. If it doesn't, the poll died.

And one environment trap that produces an identical-looking failure for an
unrelated reason: `TWITCH_REDIRECT_URI` must match the Twitch console
character-for-character. When it doesn't, the token exchange fails and the user
sees a generic error. The callback now logs Twitch's own response body on that
path, which names the mismatch outright.
