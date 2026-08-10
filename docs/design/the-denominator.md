# The Denominator — $CSGN as the asset other tokens are priced in

> **Status: design.** The biggest version of the Grid's rule. Where
> [`the-grid.md`](the-grid.md) turns the token into programming rights, this turns it into
> **the quote asset other projects launch against** — so that buying their token means
> acquiring airtime on ours.
>
> Companions: [`the-grid.md`](the-grid.md) (what a $CSGN second actually is),
> [`token-economics.md`](token-economics.md) (why hold-side beats spend-side, and where the
> legal line sits). Sequenced by [`../plan.md`](../plan.md).
>
> **Evidence note.** `stonkfun.xyz`, `x.com/launchonsf` and `stonksonstonk.com` were all
> unreachable from the environment this was written in — blocked by an egress proxy. §1 is
> reconstructed from secondary reporting and **§1.1 lists exactly what must be confirmed
> before anyone builds against it.** Treat the mechanism as sound and the parameters as
> unverified.

---

## 0. The one-paragraph version

A launchpad called **StonkFun** lets you launch a token quoted against **any asset you
choose** rather than against SOL, and pays holder reflections **in that quote asset**. The
breakout example is **MANLET quoted against ANSEM**: every buyer of MANLET must first
acquire ANSEM, and every MANLET holder accumulates ANSEM without deciding to. That is the
cleanest supply-side machine in the market. CSGN can run it — but with a denominator
nobody else can offer, because **$CSGN is redeemable for television.** A token quoted in
$CSGN pays its holders in seconds of a channel that covers them.

---

## 1. What StonkFun does

- **Fixed supply**, a **one-sided Raydium market**, and liquidity **permanently locked**
  (Burn & Earn).
- **Quoted against any custom quote token** — a memecoin, a tokenised stock (xStocks such
  as the McDonald's-linked `$MCDX` or Take-Two-linked `$TTWO`), a commodity, a currency.
- **Reflections paid to holders in the paired quote asset**, funded by trading fees
  (~85% distributed).
- **`$STONK`**: a published **60% of platform revenue** buys STONK on the open market and
  burns it.
- **Curated deployments**, not a permissionless free-for-all.

Sources: [StonkFun](https://www.stonkfun.xyz/), [launch page](https://www.stonkfun.xyz/launch),
[MEXC](https://blog.mexc.com/), and secondary coverage of the pairs model.

### 1.1 Verify before building

1. **Can an arbitrary SPL like $CSGN be registered as a custom quote token?** Everything in
   this document depends on yes. The launch flow advertises "choose a quote token or add
   your own" — confirm what "add your own" requires.
2. **The exact fee split** and who sets it: creator share, platform share, reflection share.
3. **Curation requirements** — what gets a launch approved, and who decides.
4. **The post-August-5 "V1 Pairs" behaviour.** Reporting suggests tokens launched before
   that date burn supply for rewards while later ones distribute quote-only fees. Which
   applies now materially changes §3.
5. **Whether reflections can be redirected** — §4 wants them denominated in $CSGN but
   *delivered* as Grid seconds, which may need to happen on our side rather than theirs.

---

## 2. Why MANLET × ANSEM worked

Four reasons, and only one of them is financial. Copying the financial one alone is how
this gets cargo-culted badly.

**1. The pairing was native.** *"Heart of a black bull, size of a manlet"* is the Ansem
community's own line. MANLET quoted against ANSEM needs no explanation to the people who
matter. **A pairing you have to justify is already dead** — which is the single most
important constraint on §5.

**2. The denominator trade.** To buy the new thing you must first hold the reserve thing.
Demand for the satellite is demand for the centre, mechanically, with no goodwill required.

**3. Reflections deepen the bind.** MANLET holders accumulate ANSEM passively. The new
community becomes a holding community for the old one **by default rather than by
persuasion**, which is a far stronger form of alignment than a partnership announcement.

**4. It creates a chart worth arguing about.** Priced in ANSEM, the only question is *"is
this beating the denominator?"* That is a game, games generate posts, and posts are
distribution.

---

## 3. The move: $CSGN becomes the denominator

Not a tenant on somebody else's surface. **The asset other people launch against.**

Every quote asset competes on one question: *why hold this instead of SOL?* StonkFun's
generic answer is reflections. ANSEM's answer is community plus reflections. CSGN's answer
is a different kind of thing entirely:

> **Every other launchpad pairs your token with an asset. We pair it with an audience.**

Because of [`the-grid.md`](the-grid.md), $CSGN is not only a currency — it is **a claim on
sixteen hours of daily programming**. So for a project that quotes its token in $CSGN:

### 3.1 Their buyers acquire airtime

Every purchase of their token routes through $CSGN. Under the Grid that is seconds of
television, allocated pro rata and refreshed daily. **Their community ends up owning time
on a channel that covers them** — and they can point it at their own content, which means
the token purchase and the marketing budget become the same transaction.

No other quote asset does anything when you hold it except exist.

### 3.2 Their reflections pay in television

Fees distribute in $CSGN, so holders accumulate airtime rather than a coupon.

This matters more than it sounds, because it is **the securities-safer version of the 2026
reflections meta.** A reflection paid in a liquid token is a cash-equivalent distribution. A
reflection paid in **non-transferable, expiring, cash-non-redeemable access** is in-kind
utility — the line [`token-economics.md`](token-economics.md) §7 is deliberately built on.
CSGN can offer the mechanic the market currently wants in a shape most issuers cannot.

**Design consequence:** the reflection is *denominated* in $CSGN but should be **delivered
as Grid seconds**, converted at the published Airtime Standard (§4). Whether that conversion
happens on the launchpad or on our side is §1.1 item 5.

### 3.3 We can guarantee distribution to tokens quoted in us

A Grid lane. A ticker cell. A segment. Published, mechanical, and tied to nothing but the
choice of denominator.

That is a **product** reason to pick this quote asset rather than a purely financial one,
and it is not copyable: no other quote asset on any launchpad owns a channel. A tokenised
McDonald's share cannot put you on television.

---

## 4. The Airtime Standard — priced in seconds

Because a $CSGN balance maps to a fixed share of 57,600 daily seconds, **any token quoted in
$CSGN has a price expressible in seconds of television**:

```
SHOWCOIN     0.004 CSGN     ≈ 2.3 seconds of Fringe
```

Publish the conversion openly and quote **everything** in it — sponsorships, jukebox plays,
ticker leases, rate card. Three things follow:

- **It is a unit of account, not just an asset.** That is the strongest form of monetary
  demand there is, and almost no token in this industry has ever achieved it.
- **It is inherently a broadcast graphic.** It renders on hardware that already exists —
  `config/ticker.chyron` takes an arbitrary kicker, title, subtitle and pill today, editable
  from a phone.
- **It gives outsiders a sanity check.** A price in seconds can be compared against what an
  advertiser would pay in cash for the same seconds, which is exactly the Airtime Yield
  argument in [`token-economics.md`](token-economics.md) §3, arriving from the other
  direction.

---

## 5. Show tokens — a memecoin with a fundamental

The strongest thing that can launch against $CSGN is **a show**.

A show token's backing is a **guaranteed, recurring slot on a real schedule**, with
**Proof-of-Broadcast attestations** proving the hours actually aired
([`token-economics.md`](token-economics.md) §5.4). That is a verifiable fundamental. Almost
nothing in this category has one at all.

**Sequence it on yourself first.** The nightly 7 PM–3 AM show
([`../show-bible.md`](../show-bible.md)) is the obvious pilot: CSGN takes the risk, proves
the rail, publishes what happened, and only then opens it to other people's shows. Running
the experiment on a partner first would be both cowardly and worse — you learn less.

**And respect §2's first rule.** A show token works if the show has a community that
already has a joke. It fails if it is a fundraising instrument wearing a title card.

---

## 6. What CSGN refuses here

The tenancy refusals from `master-plan.md` §11.5 carry over, plus three specific to being a
denominator:

- **No launching a second CSGN token.** The whole point is that $CSGN gets deeper, not that
  the attention gets split. If a mechanism needs a new token to work, it is the wrong
  mechanism.
- **No promotion sold as coverage.** Featuring a token quoted in $CSGN while benefiting from
  its volume is paid-promotion-shaped whether money changed hands or not. `PAID SPOTLIGHT`
  labelling and *pay to feature content, never for a financial outcome* apply without
  exception.
- **No implied endorsement of anything quoted in us.** Publish the curation policy before
  the first launch, not after the first problem.

---

## 7. Risks, stated before anyone signs up

**Reputational coupling runs both ways, and this is the real cost.** Other people's charts
become denominated in your token. A $CSGN drawdown wrecks their book through no fault of
theirs, and they will say so in public, loudly. Anyone quoting in $CSGN must be told this
in writing before they launch. **A denominator that hides its own volatility is a trap.**

**We do not control who launches against us.** A scam quoted in $CSGN is a CSGN problem, in
the press and in the replies, regardless of curation. Assume it happens and decide the
response in advance.

**Third-party dependency.** StonkFun is a venue, not the definition. Design every mechanism
here to work on any launchpad that supports custom quote tokens, and never write code that
assumes one.

**The slot-backed token edges toward a revenue claim.** A token whose value derives from
guaranteed future airtime is closer to the line than anything else in this repository.
Counsel before the first one — including our own.

**Reflections are only safe while they stay in kind.** The moment a Grid second becomes
transferable or redeemable for cash, §3.2's whole argument inverts.

**It may simply not be picked.** Projects choose denominators for liquidity depth, and
$CSGN's is thin. The honest early pitch is not "this is the best denominator" — it is "this
is the only denominator that comes with distribution," aimed at projects that need
attention more than they need depth. If nobody takes that trade after a quarter of asking,
the answer is no and the document should say so.

---

## 8. Build order

1. **Publish the Airtime Standard** (§4) — a conversion table and a page. No code, and it
   is the prerequisite for every other item.
2. **Quote the existing rate card in seconds.** Jukebox, ticker, spotlight. Proves the unit
   in a place that already takes money.
3. **Verify §1.1** — a live conversation with the launchpad, not an assumption.
4. **The show token pilot**, on CSGN's own nightly show, with counsel.
5. **Reflection delivery as Grid seconds** — the conversion path from §3.2.
6. **The curation policy**, published, before item 7.
7. **Open it** to other projects, with the coupling warning in writing.

**The one line:**

> **Every other launchpad pairs your token with an asset. We pair it with an audience.**
