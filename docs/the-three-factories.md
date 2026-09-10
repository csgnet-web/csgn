# The three factories, and the three modes

The product, stated once, in the words it should be described in everywhere.

---

## The factories — where content comes from

### CLIP FACTORY — *sign up with TikTok, get airtime passively*

**TikTok is now the front door, not a thing you do after making an account.**
That used to be the wrong way round: the pitch is "connect TikTok, your clips
air", and it sat behind making an account, which meant a crypto wallet. We were
asking a creator to do a crypto thing before the thing they came for. One tap
now creates the account AND connects the clips.

**The wallet is asked for at PAYOUT**, because that is the first moment it does
anything — you cannot be paid without somewhere for the money to land, and not
one moment earlier. (Airtime still needs one, because airtime is a share of the
token and a balance needs an address; /studio says exactly that, with a button,
rather than showing a bare zero.)

Connect a TikTok account. Your clips air on the member reel and **the share of
the day you get is your share of the token**: tokens held over the
1,000,000,000 supply, one to one. Nothing to book, nothing to attend, nobody to
ask.

Clips are the **source of last resort**, and that phrase is a job description
rather than an insult. The reel is what makes CSGN a channel instead of a
schedule with gaps in it — it carries every hour that nothing better is on,
which is most of them. A clipper is on television for holding a token and
posting something they already made. That is the deal, and it is a good one.

**The denominator is a constant: a whole day, every day.**

```
seconds = balance / 1,000,000,000 × 86,400
```

It used to move — sixteen hours on some days, twenty-four on others, against a
measured circulating supply that drifted with the chart. Both are gone, because
both broke the one thing that makes the promise believable: a member being able
to check their own number on a phone.

**An interruption is not a deduction.** When a streamer goes on or the MP takes
the channel, the reel is PRE-EMPTED — it pauses and picks up where it left off.
Nobody's entitlement moves. That is why clippers can be told plainly that the
control room will break in whenever it wants to: it costs them nothing.

Check it with `npm run verify:airtime`.

### STREAM FACTORY — *connect Twitch once, be available*

Connect Twitch and grant CSGN permission to forward the channel. **That is the
entire sign-up, and it happens once.** It puts you on the **Master Control
roster**; the poller samples every consenting channel each minute, so the board
always knows who is live.

Being on the roster is **not a booking**. The Master of Programming decides who
goes on and when. You stream exactly as you normally would; if you are worth
carrying, the channel cuts to you, and you earn 30% of the creator fees your
hour generates.

#### How the MP decides — the ranked shortlist

"Carry whoever has the most viewers" is the obvious rule and it fails three ways
inside a week: the same streamer wins every night until the rest of the roster
stops bothering, a six-hour-old stream ranks level with one that just started,
and holding $CSGN counts for nothing.

So Master Control ranks the live roster on four terms and shows the working:

| Term | Weight | What it corrects for |
|---|---|---|
| **Audience** | 55% | the only signal that tracks "worth watching" without a human |
| **Rotation** | 20% | somebody who has not been carried today |
| **Freshness** | 15% | a stream that just started has an audience arriving, not leaving |
| **Stake** | 10% | skin in the game — a nudge, never a veto |

Audience is square-root-scaled, so the gap between 5 and 50 watchers matters far
more than between 500 and 545 — and so a genuine gap stays decisive. The three
corrections reorder near-ties; they cannot overturn a ten-fold difference.

Each row carries the one fact most likely to change the decision
(*"42 watching · not on yet today"*) and the button that acts on it.

#### Being told, rather than watching

Alerts go to a webhook (`OPERATOR_WEBHOOK_URL`) as well as the board, so they
reach a phone with the laptop shut. Deduped by kind and subject and re-armed
when a condition clears — an alert fires every minute for as long as it holds,
and a notifier that repeats itself is one that gets muted.

### MYSELF FACTORY — *the MP's own encoder*

The Master of Programming going on air from their own OBS. It **pre-empts
everything**, by definition — there is no appeal above the person running the
channel. No eligibility check, no consent record, no stream URL: the encoder is
already pointed at the network.

It still writes a slot, exactly like the other two paths, because the fee
ledger, the airtime sampler, the ticker and `/schedule`'s record of who aired
all read slots. A master hour that appeared in no history would be the one hour
of the day the channel could not account for.

---

## The modes — what is on screen

| Mode | Source | Who decides |
|---|---|---|
| **CLIP MODE** | the member reel, ordered by holdings | nobody — it is the floor |
| **STREAM MODE** | a roster streamer | the MP picks from Master Control |
| **MASTER MODE** | the MP's own encoder, or their 7 PM–3 AM block | the MP |

### Precedence, which is the product

```
1. The MP is on their own encoder       →  MASTER MODE
2. The MP has put a roster streamer on  →  STREAM MODE
3. The hour is inside the MP's block    →  MASTER MODE (scheduled)
4. Anything else                        →  CLIP MODE
```

Two and three are in that order deliberately. **The block is a default, not a
lock**: if the MP puts a streamer on inside it, the channel is showing that
streamer and the sign must say so. Checking the block first made the badge read
"Master Mode" over somebody else's face.

The rule lives in exactly one place — `netlify/functions/_shared/channelMode.ts`
— and is pinned by tests. Every surface renders the stored verdict.

### The one distinction the mode alone cannot carry

Both master cases publish `mode: 'master'`, and for a badge that is the whole
story. For the thing that PAINTS THE FRAME they are opposite instructions:

- **The MP on their own encoder.** There is already a picture. `/player` must
  draw nothing over it and must not run the reel.
- **The 7 PM–3 AM block with nobody on it.** Master mode is what the sign says —
  the hour belongs to the MP — but no encoder is sending anything, so the reel
  has to keep the channel alive. Clips run 24/7.

So the verdict carries **`encoder`**, true only for a live takeover. `/player`
was wrong about this for as long as it existed: `go_master` writes a slot with a
null stream URL, `/player` read "assigned slot, no URL" as "use the house
channel", and the moment the MP went on air their own network page armed
`twitch.tv/csgnet` and played somebody's TikTok over a live studio broadcast.

Two setups for `/player` in master mode, and an operator should pick one
deliberately: it is the whole picture (leave it — the master card IS the
picture), or it is one layer over the MP's own scene (`?master=clear`, and it
draws nothing).

---

## Why the rule is published

A viewer who tunes in at 3 PM sees a clip reel and at 4 PM sees somebody live.
Nothing on screen ever told them why. Two visits, two different products, no
stated rule: the honest conclusion a stranger draws is that the channel is
broken.

Networks switch formats constantly and get away with it **because the audience
knows the rule**. So the mode, one sentence of *why*, and one sentence of *what
changes it* are published to `public/channelMode` every poll tick — and
immediately after any Master Control action, so the sign is never behind the
picture. `/watch` and `/schedule` render it and expand into the log of the last
24 switches with times.

---

## Where each piece lives

| Thing | File |
|---|---|
| The mode rule | `netlify/functions/_shared/channelMode.ts` |
| Publishing it | `netlify/functions/_shared/channelModeStore.ts` |
| Master Control | `netlify/functions/adminLiveNow.ts`, `src/components/admin/LiveNowTab.tsx` |
| Clip airtime maths | `netlify/functions/_shared/airtime.ts` |
| The 16/24 switch | `config/scheduleMeta.networkBlockEnabled` |
| TikTok connection | `netlify/functions/_shared/tiktok.ts`, `src/components/studio/TikTokImport.tsx` |
| TikTok as a sign-up door | `netlify/functions/tiktokOAuthCallback.ts`, `src/hooks/useTikTokLink.ts` |
| Rehearsing it all without accounts | `src/lib/rehearsal.ts`, `netlify/functions/adminRehearseReel.ts` |
| Whether the reel plays on the clock | `src/lib/reel.ts` |
| Twitch + forward consent | `netlify/functions/linkTwitch.ts`, `setForwardConsent.ts` |
| The public sign | `src/components/watch/ChannelModeCard.tsx` |

---

## Vocabulary — use these verbatim

> **Master of Programming (MP)** — the person who decides what is on. Not "the
> admin", not "the operator" on member-facing surfaces.

> **Master Control** — the board where that decision is made.

> **The reel** — the clip playlist. Not "the VOD rotation", not "the playlist".

> **Clip air** — the seconds available to the reel today. 16 hours or 24,
> depending on the block.
