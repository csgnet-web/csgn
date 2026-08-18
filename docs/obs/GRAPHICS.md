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

## Previewing any of it without going on air

`/player` takes a `?preview=` parameter, so you can frame and check every
graphic against the real canvas:

```
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

Nothing to go on air. But three things would visibly raise the production
value, in order of impact:

1. **A 3–5 second animated channel ident.** Plays over the wipe between
   segments. This is the single strongest signal that a channel is a channel
   rather than a stream — it is what a viewer's eye reads as "produced".
2. **A designed intermission board.** The current one is generated in code and
   is fine; a real motion background with the schedule laid over it would be
   better, and it is on screen more than anything else on a quiet night.
3. **A sting for the coin spotlight.** A paid placement that arrives with a
   sound and a movement is worth more than one that fades in, and it is the
   surface people actually pay for.

All three drop into the existing scene as browser sources or media sources. None
of them block launch.

---

*Encoder settings, RTMPS to X, and audio routing: [`../obs-setup.md`](../obs-setup.md).
Design rationale for the graphics layer: [`../broadcast-graphics.md`](../broadcast-graphics.md).
Scene assembly: [`README.md`](README.md).*
