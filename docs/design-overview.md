# Design overview — what the site is, page by page, and what to fix

A walk through every surface, what it's doing right, what it's doing wrong, and
the specific change I'd make. Written after this branch, so it describes what
exists today rather than what was planned.

The organising question throughout: **does this page have one obvious next
move?** A page that reports state without ever suggesting an action is a
dashboard. A page that always has exactly one obvious thing to do is a loop.
CSGN needs to be the second, and mostly is not yet.

---

## The bar the whole site has to clear

Somebody arrives from a link, on a phone, with no sound, knowing nothing.
Within **eight seconds** they need to have answered:

1. What is this? — *a TV channel for crypto*
2. Is something happening? — *yes, right now, look*
3. Can I be in it? — *yes, paste a link*

Every page below is graded against that.

---

## /watch — **B+**

**Working.** The stage leads, the LIVE/OFFLINE state is unmissable, the page
ends at the token panel instead of turning into a brochure. Removing the
conversion block was right — a pitch under a live video reads as a landing page.

**Wrong.** A signed-out visitor who watches for thirty seconds and likes it has
*nowhere to go*. The tab bar is the only route in, and a tab bar is navigation,
not an invitation. There's no moment where the page says "the thing you're
watching was posted by someone like you."

**Fix.** One line under the stage, only for signed-out visitors, only after
they've been on the page ~20 seconds: *"@handle posted this. So can you."* with
the handle of whatever is actually on. Not a card, not a block — one line that
converts the thing they're already enjoying into an offer. Timed rather than
immediate, because an offer before the product has proved itself is an ad.

---

## /studio — **A−**, and the best page on the site

**Working.** The number leads, the working is shown, the lock is explained with
a countdown, and `NextStep` now closes the loop with exactly one ask. The reel
is a picture rather than a table. Zero states name which zero it is.

**Wrong.** Two things.

The **crop control** is still the most confusing thing here. It only appears
when it's needed, which is right, but when it appears it's a slider with no
preview — you're choosing a window of a video you can't see. Nobody knows what
second 47 of their own clip looks like.

**Airtime is abstract.** "4 min 12 sec" is a number. It isn't a *feeling*.

**Fix.**
1. Show the YouTube thumbnail at the crop start position as the slider moves.
   Three lines of code (`i.ytimg.com/vi/{id}/hqdefault.jpg` is already used),
   and it turns an abstract control into a visible one.
2. Under the airtime figure: *"That's about **9 clips** a day"* — divide by the
   member's average clip length. Time is abstract; a count of your own things is
   not.

---

## /participate — **C+**, and the weakest page

**Working.** The Meme 100 is genuinely interesting, the score breakdown is
honest, the jukebox countdown gives it urgency.

**Wrong, and structurally.** It's four unrelated products stacked vertically —
board, wallet, vote, ticker, jukebox — with no hierarchy between them. Nothing
says which matters. A first-time visitor scrolls past the most interesting thing
on the site to reach a wallet card.

**Fix.** Make the Meme 100 the page and demote the rest to a strip of three
tabs beneath it. The board is the reason to come back daily; the vote and the
jukebox are things you do *because* of the board. Right now they're presented as
peers, which flattens all four into noise.

---

## /schedule — **B**

**Working.** The roster leads, which is the honest headline. Past hours stay
visible, so a busy day looks busy.

**Wrong.** When nobody's live — which is most of the time today — the page opens
with an empty state and *then* shows a grid. The first thing a visitor sees is
an absence.

**Fix.** When the roster is empty, lead with what's *on* instead: the clip
currently airing, with its poster frame and the member's handle. The channel is
never actually empty; the page just describes it as if it were.

---

## /account — **B−**

**Working.** Username editing is now discoverable. Connections are clear. The
forwarding grant sits next to the thing it governs.

**Wrong.** It's a settings page pretending to be a profile. The stats row (XP,
slots played, live minutes, fees earned) is the most interesting thing on it and
it's four small grey numbers in a row.

**Fix.** Promote fees earned and live minutes to hero figures with the same
treatment the Studio gives airtime. These are the numbers that make somebody
feel like they're *in* something.

---

## /about — **A−**

Genuinely good now. Opens with what the product is, explains the ratio in one
sentence, admits what the token does and doesn't gate.

**One fix.** It's still text-only. A single diagram — *clip → review → air → your
share* — would do more than three paragraphs. It's the one page where a picture
is unambiguously better than prose.

---

## /player — **A**

The strongest surface. The HUD answers all four arrival questions, the ident
makes it read as a channel, the package is coherent.

**One risk.** The HUD is dense enough that on a vertical clip it occupies real
estate that matters. Watch the first ten hours of real air and be prepared to
cut the up-next strip during vertical segments.

---

## Cross-cutting

### 1. Nothing is ever celebrated

A member pastes a link and gets a row in a list. Their clip is approved and a
dot changes colour. **Their clip airs on television and nothing happens at all.**

That last one is the single biggest miss on the site. The moment a member's clip
goes to air is the most emotionally valuable thing this product can produce, and
it currently produces silence.

**Fix, and I'd do this before anything else on this page:** a "you were on"
moment. When a clip finishes airing, the Studio shows it — *"@you aired at 4:12
PM. 34 seconds."* — with a share card. This is the loop. Everything else is
plumbing for it.

### 2. There is no social layer at all

You cannot see another member. Not their reel, not what they've aired, not who
they are. Every surface is either the channel or your own stuff. For a product
that calls itself a network, there is no *network* in the interface.

### 3. Mobile is competent, not native

Bottom nav is right. But nothing swipes, nothing pulls to refresh, and no list
is infinite. It reads as a website that fits on a phone.

---

## The five changes I'd make, in order

1. **The "you were on" moment.** Nothing else on this list matters as much.
2. **A public profile with a reel.** `/u/:username` exists but shows almost
   nothing. Make it somebody's channel.
3. **Meme 100 becomes the whole of /participate.** Demote everything else.
4. **Crop preview and "that's about N clips".** Two small changes, both turn an
   abstraction into something a person can feel.
5. **A signed-out invitation on /watch**, delayed, tied to whoever is actually
   on air.

---

*Companion: `docs/analysis-social-platform.md` for why item 1 and item 2 are the
whole game, and `docs/design-routes.md` for the art-direction decision still
waiting on a pick.*
