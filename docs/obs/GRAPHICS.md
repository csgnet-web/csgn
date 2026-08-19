# On-screen graphics — what's on air, and who made it

Every graphic CSGN puts on the channel, what draws it, what data drives it, and
what you have to build versus what already exists.

This is the credits list and the design brief in one file. If a graphic is on
the channel, it is in here.

---

## The stack, bottom to top

OBS draws bottom-first. This is the order in the scene, and the order they
occlude each other.

| Layer | Source | What it is | Built? |
|---|---|---|---|
| 1 | `/player` | The programme itself — live stream, or the clip reel | ✅ In app |
| 2 | `csgn-pip.html` | Picture-in-picture frame for a second source | ✅ In repo |
| 3 | `csgn-ticker.html` | Bottom ticker: price, fees, RIGHT NOW rail, coin spotlight | ✅ In repo |
| 4 | `csgn-nowwatching.html` | Corner channel bug | ✅ In repo |
| 5 | `csgn-lowerthirds.html` | Operator-triggered name strap | ✅ In repo |

Everything in this table exists. Nothing below needs commissioning — the list
further down is what each one *draws*, so you know what you are looking at.

---

## 1. The programme layer — `/player`

The only source that changes what is actually on screen. Five states, and the
transitions between them are automatic.

| State | What viewers see | Trigger |
|---|---|---|
| `LIVE` | The streamer's Twitch feed, fullscreen, audio on | Their channel is online and an operator put them on |
| `STARTING_SOON` | Branded card, streamer name, countdown | A block was assigned but the feed hasn't come up |
| `BRB` | "Back shortly" card | The feed was live and dropped |
| `INTERMISSION` | **The clip reel**, with the member's credit card | Nobody is on air |
| `OVERRIDE` | A non-Twitch source — YouTube, Kick, an X broadcast | Operator override |

### The clip credit card — the one that matters

This is the graphic a member is actually buying with their bag, and it is the
one worth understanding.

When a member's clip airs, their card is drawn over it for the whole segment.
The member chooses **a colour** and **a shape** in `/studio`, and both travel on
the published schedule so the broadcast never has to look anything up.

**Three shapes:**

| Shape | Position | Reads as |
|---|---|---|
| `bar` | Lower left, vertical accent stripe | Classic broadcast lower third |
| `badge` | Upper right, pill | Light touch, keeps the frame clear |
| `ticker` | Full-width strip along the bottom | Loud, unmissable |

**Ten colours:** Signal (brand red), Money, Gold, Ice, Violet, Mono, Sunset,
Toxic, Midnight, Blood.

**The avatar** is their X profile picture, in a circle, ringed in their accent
colour. It is captured server-side from the signed ID token — never from
anything the client sends — so nobody can put an arbitrary image on television
by posting a URL. If they have no X connection or turned it off, the card falls
back to the text layout with no gap.

> **Why circular.** Every other piece of broadcast furniture on the channel is
> rectangular. Making the avatar the only round element means the one circle on
> screen is always somebody's face, which is what makes it read as a person at a
> glance and from across a room.

Drawn by `src/components/player/VodRotator.tsx` → `ClipCredit`. The Studio
preview at the bottom of `/studio` is `src/components/broadcast/LowerThird.tsx`
— same three shapes, same ten colours, UI sizes rather than broadcast sizes.

---

## 2. Picture-in-picture — `csgn-pip.html`

A frame for a second video source (a co-host, a chart, a reaction cam). No text
by design — it is furniture, not a label, and anything that needs saying is said
by the lower third.

---

## 3. The ticker — `csgn-ticker.html`

Bottom strip, **1930 × 240** (only the bottom 110px draws; the space above is
transparent headroom the coin spotlight rises into).

Four rails, all fed from `config/ticker`, all automatic:

| Rail | Content | Source |
|---|---|---|
| `$CSGN` | Price, 24h change, market cap, volume | DexScreener, every minute |
| Live fee | Who is on air and what their block has generated | The fee poller |
| `RIGHT NOW` | Member-submitted lines (5,000,000 $CSGN to post) | `submitRightNow` |
| **Coin spotlight** | The current jukebox winner, marked `PAID SPOTLIGHT` | `jukeboxSpotlight` |

The spotlight is worth calling out: it is **bought airtime, and it says so**. A
paid placement rendered identically to an editorial pick is the kind of thing
that ends a channel's credibility in one screenshot.

---

## 4. The channel bug — `csgn-nowwatching.html`

Corner mark. Small, permanent, the thing that makes a clip screenshot
identifiable as CSGN when it is reposted with no context — which is most of how
a channel like this spreads.

---

## 5. Lower thirds — `csgn-lowerthirds.html`

Operator-triggered name straps for live segments, driven from the admin panel.
Distinct from the clip credit card above: that one is automatic and belongs to
the member, this one is manual and belongs to you.

---

## The broadcast package

Art direction is sports-network editorial — enormous condensed type, hard-edged
colour blocking, structural rules, numbers as the hero. Four rules everything
follows, and they are the difference between "a website on television" and "a
channel":

1. **Type is the graphic**, not a label on a graphic. Delete every decorative
   element and what's left should still read across a room.
2. **Hard edges.** No soft shadows, no glass blur. A broadcast graphic is cut,
   not faded — a subtle gradient is the first thing a 4 Mbps encoder destroys.
3. **One accent, used structurally.** Brand red is a rule, a bar, a fill — not
   a highlight sprinkled on six elements.
4. **Motion means something changed.** Nothing pulses for decoration.

The kit lives in `src/components/player/kit/`. `BroadcastKit.tsx` holds the
tokens and primitives — `Kicker`, `Mega`, `Rule`, `Stat`, `CornerMarks`,
`Slate`, `StripeField` — so the package can't drift into six slightly different
reds.

| Graphic | What it does | Component |
|---|---|---|
| **Channel ident** | ~2.6s brand hit between every segment | `ChannelIdent.tsx` |
| **Now on air** | Introduces whoever is up — huge avatar, name, viewers | `NowOnAir.tsx` |
| **Coming up** | The next five slots as an editorial table | `ComingUp.tsx` |
| **Clip credit** | The member's card over their segment | `VodRotator.tsx` → `ClipCredit` |
| **Intermission board** | The animated network board | `IntermissionBoard.tsx` |

### The ident is the highest-leverage graphic on the channel

A viewer decides whether they're watching *a channel* or *someone's stream* in
the first few seconds, almost entirely from production furniture rather than
content. An ident is the clearest possible signal — a thing that only exists
because somebody made it, recurring, so it reads as a network. It costs three
seconds of airtime and buys the whole package credibility.

It plays on every hand-over between clips. Four beats — black, stripes,
wordmark, lockup — driven from one counter rather than CSS animation delays, so
it can be **ended on cue** when the next segment is ready. A stack of
independently-timed CSS animations can't be interrupted cleanly; you get a
graphic that's halfway through something when the video cuts under it.

---

## Previewing any of it without going on air

`/player` takes a `?preview=` parameter, so you can frame and check every
graphic against the real canvas:

```
https://csgn.fun/player?preview=ident       the channel ident
https://csgn.fun/player?preview=nowonair    the on-air introduction
https://csgn.fun/player?preview=comingup    the next five slots
https://csgn.fun/player?preview=clipcredit  a member's clip introduction
https://csgn.fun/player?preview=board       the intermission board
https://csgn.fun/player?preview=brb         the BRB card
https://csgn.fun/player?preview=starting    "goes live shortly"
https://csgn.fun/player?preview=lastcall    the last-call countdown
https://csgn.fun/player?preview=wipe        the transition wipe
https://csgn.fun/player?preview=countdown   the block countdown
https://csgn.fun/player?preview=x           the X broadcast frame
```

---

## The escape hatch — `/oldplayer`

Same player, **clip reel switched off**. Live blocks behave identically; the
gaps fall back to the admin VOD playlist and then the branded board.

Point OBS here when a clip is misbehaving on air and you need it off the channel
immediately — a platform changed an embed policy, a segment is rendering black,
audio is wrong and you cannot tell which clip. Switch the browser source, the
channel keeps running, and you debug with the pressure off.

It is a flag on the real player, not a copy, so it cannot rot: it receives every
fix the primary gets.

---

## What you would still need a designer for

The package is complete and launch-ready. Three additions would raise it
further, in order of impact — none block launch, and all drop into the existing
scene as browser or media sources:

1. **Audio.** The ident is silent. A three-note sting under it is worth more
   than any visual change on this list — sound is what makes a hand-over feel
   like a network, and it is the one dimension the package currently has none of.
2. **Motion plates behind the slates.** The `Slate` diagonal is a flat colour
   field. Shot footage or a generative loop behind it at low opacity would give
   the cards depth without touching the type.
3. **A spotlight sting.** A paid jukebox placement that arrives with a movement
   and a sound is worth more than one that fades in, and it is the surface
   people actually pay for.

---

*Encoder settings, RTMPS to X, and audio routing: [`../obs-setup.md`](../obs-setup.md).
Design rationale for the graphics layer: [`../broadcast-graphics.md`](../broadcast-graphics.md).
Scene assembly: [`README.md`](README.md).*
