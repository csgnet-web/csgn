# Decisions waiting on you

Everything in this pass is built, tested and switched **off** where switching it
on costs money or touches a live broadcast. This is the list of what is behind a
switch, what it costs, and which way I would go.

Nothing here is blocking. The channel runs exactly as it did before every one of
these.

---

## 1. X access for the Right Now rail — the only real bill

**What I need from you:** an `X_BEARER_TOKEN` — an app-only bearer from the
[X developer portal](https://developer.x.com), on a plan that includes
**recent search** (`GET /2/tweets/search/recent`).

**Why it costs anything.** X's free tier is write-only plus a single read of
your own user. There is no free way to read a timeline you do not own, so
reading "what crypto is talking about" starts at their **Basic** tier — around
**$200/month** at time of writing. That is the entire cost of this feature and
it is not negotiable from our side.

**It already works without it.** With no token configured the writer falls back
to the channel's own **Meme 100 board** — the coins that moved today, which the
poller already rebuilds every five minutes at no extra cost. The lines it
produces from that are about the market rather than about the timeline, which is
a different flavour, not a worse one.

| | X timeline | Meme 100 board (today's default) |
|---|---|---|
| Cost | ~$200/mo | £0 — already paid for |
| Flavour | what people are saying | what actually moved |
| Fails when | X rate-limits or changes tiers | the poller is down |

**My recommendation: run on the board for a month first.** Look at the lines in
Master Control → Broadcast Control → the writer panel. If they read as generic —
and they might, because a price change is a thinner prompt than a joke somebody
made — then the $200 is buying something real and you will be able to say what.
Switching later is one environment variable and no code.

**If you do buy it,** also decide what it reads. `X_RAIL_QUERY` takes standard X
search syntax, so it can be:

- the default — `crypto OR solana OR memecoin OR $SOL`, English, originals only
- **a list of accounts you trust** — `from:someone OR from:someoneelse` — which
  is the version I would actually run, because a curated timeline is the whole
  difference between "crypto Twitter" and "crypto Twitter at 3 AM"
- your own community — a cashtag, or your own mentions

---

## 2. Which model writes the rail, and what it costs

Currently **Claude Opus 5** (`CSGN_RAIL_MODEL` overrides it).

Twelve runs a day, a couple of thousand input tokens and a few hundred output
tokens each: **single-digit dollars a month.** The system prompt is cached, so
the repeated half of every run is billed at a tenth.

There is nothing meaningful to save by going smaller and something real to lose —
this text is the channel's voice, on screen, unsupervised. **My recommendation:
leave it.** If you want to compare, set `CSGN_RAIL_MODEL=claude-sonnet-5` and
use the writer panel's **Try it** button on both; it writes lines and shows them
to you without airing them.

**You will need an `ANTHROPIC_API_KEY` in Netlify.** Without it the scheduled
function exits immediately and the rail keeps whatever holders put on it.

---

## 3. How strict the rail's vetting should be

Every line a model writes is checked in code before it can reach the broadcast
(`netlify/functions/_shared/rightNow.ts`). The checks are: length, character
set, no links, no @handles, no profanity, and **nothing that reads as financial
advice**.

That last one is the judgement call, and I have set it **strict**. A line is
thrown out if it contains any of: buy / sell / short / long / ape / accumulate,
"not financial advice" / NFA / DYOR, guaranteed / risk-free, any `<number>x`,
"to the moon", a price target, pump / dump, or rug.

**The cost of strict:** some genuinely funny lines get thrown out, and the
writer panel will regularly show you rejections. **The cost of loose:** a chyron
on your channel tells an audience to buy something.

**My recommendation: leave it strict, and watch the rejections for a fortnight.**
If the same good line keeps dying on `\b\d+x\b`, that is a specific pattern to
loosen with evidence rather than a policy to relax on a hunch.

### The related one you should know about: which coins it may name

A `$TICKER` on a television chyron is worth more to somebody than anything else
this feature could be made to do — a post written specifically to be quoted, with
enough engagement to clear the floor, ends with a scam ticker on your broadcast.

So a line may only name a coin **that this run's material actually named**, plus
a short always-allowed list (BTC, ETH, SOL, USDC, USDT, BNB, XRP, DOGE, and
$CSGN). The model cannot invent a ticker and cannot carry one further than the
source it came from. A run with no material may use only the majors.

This does not make the feature injection-proof and I would not claim it does: an
attacker whose post makes it into the material has, by construction, got their
ticker into the allowed set. What it removes is the cheap version — a
hallucinated or smuggled ticker with no post behind it — and it bounds the
expensive version to "a coin that was genuinely being discussed at the time".

**If that residual bothers you, the lever is `X_RAIL_QUERY`.** A curated
`from:someone OR from:someoneelse` list means the material can only come from
accounts you chose, which closes the gap almost entirely. That is another reason
I would run the account-list version rather than the open query.

---

## 4. How the reel plays out — the one that changes what goes on air

**This is the most consequential decision in this document and I have
deliberately not made it.**

The scheduler writes every member's segments onto the clock with real
timestamps, and /studio shows a member **the minute their clip airs**. The
playout ignored those timestamps: it looped the list with a minute of network
board between clips. So the promise on the member's screen and the thing the
encoder actually did were two different programmes, and the gap grew all day.

Both behaviours are defensible:

| | **LOOP** (today's default) | **CLOCK** (`/player?reel=clock`) |
|---|---|---|
| What it does | stretches what content exists across the whole day | plays each segment in the minute it was booked for |
| The channel looks like | continuous programming | mostly the network board, until holdings grow |
| The member's quoted time | approximate | exactly true |
| Right when | you have four minutes of content and 24 hours to fill | you have enough clips to fill real hours |

Today, with a handful of holders, LOOP is the only thing standing between the
channel and a board that sits there for twenty-three hours. That is why it is
still the default and why I did not switch it: **changing what goes out on a
live channel is your call, not a side effect of a refactor.**

**How to decide it in ten minutes:** open `/player?reel=clock` in a browser tab
alongside the real one. You will see immediately whether the board-heavy version
reads as an honest schedule or as a dead channel.

**My recommendation: stay on LOOP now, and switch to CLOCK the week the reel can
fill more than about a third of the day.** The moment a member can check the
time on their screen against the picture and be right is the moment the airtime
promise becomes checkable, and checkable is the whole product.

Related, smaller: the board break between clips was a hardcoded **60 seconds**,
which against 20–45 second clips means the board is on screen more than half the
time the reel is "running". It is now `?board=<seconds>` on the browser source.
I have not changed the default. Try `?board=10` during a rehearsal and see.

---

## 5. Switching on the TikTok sign-up door

Built and **off** (`TIKTOK_AUTH_ENABLED` in `src/config/authProviders.ts`).

**What I need from you,** in the TikTok developer console:

1. **Login Kit** approved for the `user.info.basic` and `video.list` scopes.
2. `https://csgn.fun/.netlify/functions/tiktokOAuthCallback` registered as a
   redirect URI, byte-for-byte.
3. `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` and `TIKTOK_REDIRECT_URI` in
   Netlify.

Then flip the boolean. The server already refuses cleanly when the environment
is missing (`tiktok_not_configured`), so the only thing the flag protects
against is a live button that fails on a redirect-URI mismatch — which is
TikTok's least helpful error message and the one you would hit first.

**Why this matters more than it looks.** The clip factory's entire pitch is
"connect TikTok, your clips air", and until now that was step *two*: first make
an account, which meant a crypto wallet. We were asking a creator to do a crypto
thing before the thing they came for. TikTok is now the credential — one tap and
the account exists **and** their clips are importable.

**The wallet moves to payout,** which is the first moment it does anything: you
cannot be paid without somewhere for the money to land, and not one moment
earlier. Airtime still needs a wallet, because airtime is a share of the token
and we cannot read a balance without an address — /studio says exactly that,
with a Connect button, rather than showing a bare zero.

---

## 6. Google, X and email sign-in

Still off (`SOCIAL_AUTH_ENABLED`), still one boolean, still waiting on the
console work in [`docs/auth-provider-setup.md`](auth-provider-setup.md). That is
unchanged by this pass — but note that with TikTok live, the door most of your
target creators want is open, and these three become nice-to-have rather than
the funnel.

---

## 7. What to do about `/player` in master mode

When you go on air from your own encoder, `/player` now draws a **master card**
over the intermission backdrop rather than the member reel. Two setups, and you
should pick one deliberately:

- **`/player` is your only visible source** (how every other mode runs) — leave
  it. The card is the picture.
- **`/player` is one layer over your own scene** — camera, game capture,
  graphics — add `?master=clear` and it draws nothing while you are on.

The default is the card, because the two failure modes are not symmetric: a card
covering your scene is visible on your own preview in the first second; a
transparent default fails as a **black rectangle going out to an audience**
while your preview, composited over your scene, looks perfect.

---

## 8. Things I did NOT do, and why

- **I did not touch the day lock or the payout ledger.** The rehearsal writes to
  its own document and substitutes the allocation step, precisely so nothing
  about testing can reach the record that settles money.
- **I did not change the default board break, the reel playout, or the mode
  precedence.** All three decide what an audience sees; all three are now
  flags you can watch before you choose.
- **I did not switch the rail writer on for you.** It needs an API key, and the
  first thing you should do with it is press **Try it** and read four lines it
  wrote before any of them go near the broadcast.
