# The three factories, and the three modes

The product, stated once, in the words it should be described in everywhere.

---

## The factories — where content comes from

### CLIP FACTORY — *connect TikTok, get airtime passively*

Connect a TikTok account. Your clips air on the member reel and **the share of
the day you get is your share of the token**: tokens held over the
1,000,000,000 supply, one to one. Nothing to book, nothing to attend, nobody to
ask.

Clips are the **source of last resort**, and that phrase is a job description
rather than an insult. The reel is what makes CSGN a channel instead of a
schedule with gaps in it — it carries every hour that nothing better is on,
which is most of them. A clipper is on television for holding a token and
posting something they already made. That is the deal, and it is a good one.

**The denominator moves, and members should be told which one they are on:**

| Master block | Clip inventory | Why |
|---|---|---|
| Reserved (default) | **16 hours** | 7 PM–3 AM ET belongs to the MP |
| Released | **24 hours** | the whole day is the reel's |

That switch is `config/scheduleMeta.networkBlockEnabled`, it takes effect on the
next schedule rebuild, and it rewrites no slot documents. It is the entire
16/24 lever.

### STREAM FACTORY — *connect Twitch, be available*

Connect Twitch and grant CSGN permission to forward the channel. That puts you
on the **Master Control roster**. The poller samples every consenting channel
each minute, so the board always knows who is live.

Being on the roster is **not a booking**. The Master of Programming decides who
goes on and when. You stream exactly as you normally would; if you are worth
carrying, the channel cuts to you, and you earn 30% of the creator fees your
hour generates.

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
