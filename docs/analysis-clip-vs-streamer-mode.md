# When should the channel run clips, and when should it run a streamer?

The rule you asked for, the reasoning behind it, and the numbers to turn as the
network grows.

---

## The rule you proposed, and why it breaks

> *"Streamer mode when one or more streamers are live."*

This is right today and wrong at scale, and it is worth being precise about
when it flips.

With five connected channels, somebody is live maybe 10% of the day. The rule
says: run a streamer for that 10%, clips for the other 90%. Good.

With **fifty** connected channels, somebody is live essentially **always**. The
rule now says: never run clips again. And the clip reel is the thing holders are
paying for with their bag — the entire economic promise of $CSGN is airtime,
and a rule that quietly retires the reel retires the token's only job.

So availability cannot be the trigger. It degrades from a sensible rule into a
broken one purely as a function of your own growth, which is the worst property
a rule can have.

---

## The differentiator: audience, not availability

**Clips are the baseline. A live stream has to EARN the interruption.**

The measure is viewers. Not because viewers are a perfect proxy for quality —
they are not — but because they are the only number available every minute, for
every channel, without asking anyone anything. Everything else you might use
(is it entertaining, is it on-brand, is it going anywhere) requires a human
watching, which is the thing this system exists to avoid needing.

The rule, stated once:

> **Carry the live stream with the most viewers, provided it clears the floor.
> Otherwise run clips.**

This keeps working at five channels and at five hundred. At five, almost
anything clears the floor and the channel is live whenever somebody is. At five
hundred, the floor does the sorting for you and the channel carries the best
thing available at any moment — which is what a network is.

### Why a floor at all

A stream with two viewers is worse television than a curated reel. It is also
worse for the *streamer*: being carried by a channel nobody is watching, at a
moment when the channel had something better to run, does not help them and
burns the network's credibility with the holders whose airtime paid for it.

The floor is the honest statement that **being live is not the same as being
worth watching.**

---

## The numbers, and when to change them

All three live in code with a config override, so none of this needs a deploy.

| Knob | Default | Where | What it does |
|---|---|---|---|
| `liveViewerFloor` | **3** | `config/scheduleMeta` | Viewers a stream needs to beat the reel |
| `LONG_SHIFT_MINUTES` | **240** | `_shared/operatorAlerts.ts` | When to nudge about a four-hour shift |
| `STRONGER_OPTION_MULTIPLE` | **3×** | `_shared/operatorAlerts.ts` | How much better a challenger must be to suggest switching |

### How to move the floor as you grow

The floor should sit at roughly **the audience the clip reel itself pulls.**
That is the honest comparison: a live stream should only pre-empt the reel if it
beats the reel.

| Network stage | Suggested floor | Reasoning |
|---|---|---|
| Now — under 10 channels | **3** | Nearly anything beats a reel nobody is watching yet. Bias hard toward live: live humans recruit other humans, reels do not. |
| 10–50 channels | **10–25** | Somebody is live most of the day. The floor starts doing real sorting. |
| 50+ channels | **Median concurrent viewers of your own channel** | At this point you have the data. Set it to what CSGN itself pulls and the rule becomes literally "only interrupt if you're better than us". |

**Do not raise it early.** The mistake available here is optimising for quality
before you have quantity: a strict floor on a small network means the channel
runs clips forever, nobody ever sees a member get carried, and the one thing
that proves the model works to a prospective streamer never happens.

### The 3× switch threshold

When a bigger streamer goes live while somebody is already on, you get told —
but only if they are **three times** bigger. A lower multiple produces a channel
that changes hands every few minutes, which reads as instability to viewers and
as disrespect to streamers. Three times is roughly "obviously worth the
disruption".

---

## What the operator actually sees

Five conditions, computed every minute in `_shared/operatorAlerts.ts`, published
to `public/operatorAlerts` whether or not anyone has the board open.

| Alert | Severity | Fires when |
|---|---|---|
| `on_air_dropped` | **Critical** | We are broadcasting somebody who has gone offline — dead air |
| `pick_a_streamer` | Action | Clips are running and someone clears the floor |
| `switch_to_clips` | Action | The stream on air has fallen below the floor |
| `stronger_option` | Info | Someone 3× bigger is live |
| `long_shift` | Info | The current occupant has been on four hours |

Two properties worth stating because they are what make the surface usable:

**It is silent when the channel is right.** Most of the time there are no
alerts. An alert bar that always has something on it is one nobody reads.

**A missing sample is not an offline sample.** If Twitch's API does not answer
for a channel, that member is simply absent from the roster — never marked
offline. Without this, every API timeout would page you about dead air that
isn't happening, and you would turn notifications off within a week.

Desktop notifications fire once per distinct condition and re-arm when it
clears, so a recurring problem tells you again but a persistent one does not
nag every sixty seconds.

---

## Guests

An operator can put any channel on air, member or not. A guest:

- is marked **Guest** on the schedule and on the board, with "added by you"
- carries **no uid**, so they accrue **no on-air minutes** and take **no share
  of fees** — those are computed from minutes, and a guest has no claim on them
- is the operator vouching personally, which is why it is logged to the audit
  trail with who added them

The alternative — letting guests look identical to members — would make the
roster meaningless. If a name on the schedule might be somebody who consented
and might be somebody an admin typed in, the schedule stops being evidence of
anything.

---

## The honest limitation

Viewers are a lagging and gameable signal. A streamer can buy viewbots; a
genuinely great stream can have eleven people in it on a Tuesday.

Two mitigations exist and neither is complete:

1. **You are still in the loop.** Every alert is a suggestion with a button, not
   an automatic switch. Nothing goes on air without a click.
2. **The `stronger_option` multiple is deliberately high**, so a marginal
   viewbot advantage does not move the channel.

The real fix is a quality signal that is not viewer count — retention on the
CSGN channel while a given streamer is carried, which requires the Twitch
analytics on your own channel and a few weeks of data. Worth building once
there is enough traffic for it to mean anything; not worth building now.

---

*Thresholds are `config/scheduleMeta.liveViewerFloor` and the constants in
`netlify/functions/_shared/operatorAlerts.ts`. The rules are unit-tested in
`netlify/functions/__tests__/operatorAlerts.test.ts` — change a number and the
tests tell you what behaviour you changed.*
