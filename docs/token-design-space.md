# $CSGN Token — Design Space & Direction

> Owner: founder-operator. Status: exploration + decision, July 2026.
> Companion to `docs/forward-strategy.md`. This is the full option space for what
> $CSGN *does*, the platform ("everyone runs their own channel") idea taken
> seriously, and the committed direction. **Built** = verified against this repo.

---

## 0. The decision (so it's not buried)

- **Wedge:** crypto-native. Live markets + degen drama lead the funnel; games
  (CFB dynasty, modded dynasty, Black Ops/LoL) are retention/personality, not
  top-of-funnel. (See `forward-strategy.md`.)
- **Token role:** **$CSGN as gas / platform token now; reserve token much later.**
  You hold/spend $CSGN to run a channel and to use premium tools; a protocol fee
  on channel volume buy-and-burns $CSGN. The reserve/sub-token layer is a
  deliberate "way down the road" step, gated on real traction + counsel.
- **The buyer-side fix ships first,** on rails already built (below).

---

## 1. The architectural unlock

CSGN's whole stack is already a **multi-tenant broadcast CMS running one tenant.**
Every control surface is a Firestore config doc (`config/ticker`,
`config/liveStream`, `config/vodPlaylist`, `config/emergencyOverride`), the
encoder is dumb, all intelligence is a web page. "Everyone runs their own
channel" is therefore **parameterization, not a rewrite**: add a `channelId`
dimension to those docs + routes and `/player?channel=x` becomes someone else's
network. This is why the platform play is credible and why the token can be its
gas.

---

## 2. The platform play — "pump.fun for channels"

The strongest idea in the space because it **inverts the solo-founder ceiling**:
CSGN stops being a media company (capped by one person) and becomes
infrastructure that profits from everyone else's audience-building.

**Token models considered (ranked):**

| Model | How $CSGN is used | Buy-pressure | Verdict |
|---|---|---|---|
| **Gas / platform** | Hold/burn $CSGN to spin up a channel; premium tools $CSGN-gated | Every channel launched = demand | **Chosen (now).** $CSGN = equity in the whole ecosystem |
| **Reserve** | Channels' volume is taxed into a $CSGN buy-and-burn | Every $ traded anywhere burns $CSGN | **Chosen (much later).** The "network of networks" endgame |
| **Protocol fee** | Platform takes a cut of channel fees in $CSGN | Aggregate volume → burn | Pairs with gas; cleanest legally |
| **Franchise key** | Holding a threshold *is* the operator license | Scarcity of seats | Good meme, caps growth artificially — not chosen |

**Why not start here:** empty-mall-squared (a platform of empty channels is worse
than one empty channel), multiplied legal exposure (enabling others to launch
tokens), and solo-operator support/moderation cost. **Prove the format on the
flagship channel first; the platform is the destination, not the on-ramp.**

---

## 3. The full option space (clustered)

1. **Trading *is* the show** *(the painkiller — mostly Built)* — trade $CSGN
   while a streamer is live → your handle + buy size appears on screen, the
   streamer earns the fee in real time. Collapses trade = tip = be-on-TV.
2. **On-air voice & status** *(Built rails)* — hold ≥X → post to the Right Now
   rail; holder leaderboard beat; "whale of the week"; PFP/handle on-air.
3. **Programming governance** — holders vote tonight's game, guest, CFB draft
   order, commissioner calls; holder-pooled bounties.
4. **Gated access** — holder Discord/alpha, gated AMAs/segments, gated premium
   VOD (the modded dynasty), early slot claims.
5. **Ad / sponsorship inventory in $CSGN** — Coin Spotlight (Built), Right Now
   placements, lower-thirds, full-screen cards, ticker takeover.
6. **Free-to-play games w/ token rewards** — Squares/Grid/pick'em (rewards, not
   wagering — real-money betting stays off the table without counsel + license).
7. **Rewards & loyalty** — clip bounties (feeds the top-of-funnel), referrals,
   partner-token airdrops to holders. (No naive watch-to-earn — sybil bait.)
8. **Supply mechanics** — buy-and-burn from every service line; scheduled
   fee-share burns, shown on-air.
9. **Identity/status (memecoin core)** — holder recognition, badges, on-air
   shout-outs; status *is* the product.

**Pushed past the brief:** inversion (reward *viewers holding* during a breakout,
as access/status not cash); 10x ("crypto-native cable package" — holding $CSGN =
all-access to every channel); combination ("$CSGN index" of the coins covered —
flag for counsel).

**Not doing:** real-money betting (legal landmine), a token per channel at launch
(1,000 dead coins), naive watch-to-earn (sybil), starting at the platform.

---

## 4. Three horizons — and why there's zero wasted work

Every token utility built for the flagship channel is a feature later sold to
platform operators. You dogfood the platform on CSGN itself.

- **Horizon 1 — give the token a buyer (now, Built rails):** trade-is-the-show +
  on-air voice + buy-and-burn spotlight + gated Discord.
- **Horizon 2 — deepen the loop:** governance, free-to-play games, clip bounties,
  visible burns.
- **Horizon 3 — "pump.fun for channels":** multi-tenant the config docs; $CSGN as
  gas + reserve; protocol fee buy-and-burns across every channel's volume.

**The bet the whole space rests on:** a crypto-native audience will pay for
*status and voice on a live broadcast* more reliably than for utility or yield.
Cheaply testable in Horizon 1 before building anything big.

**Hard line:** holder benefits stay **utility/access/status/supply only** — no
payouts, rev-share, or yield language without securities counsel. Volume comes
from reasons-to-trade, never wash trading.

---

## 5. What the July 2026 ticker rebuild already ships toward Horizon 1

The `docs/obs/csgn-ticker.html` + `docs/obs/csgn-lowerthirds.html` rebuild wired
the on-screen half of Horizon 1 (all driven by `config/ticker`):

| Token utility | On-air surface now Built |
|---|---|
| On-air voice (hold → be on the rail) | Right Now rail — immediate + retriggers on update; holder-gating is a write-side rule the admin/backend enforces |
| Buy-and-burn spotlight | Promoted coin **rises** in the crypto dock (gold accent), priced in $CSGN → burn |
| Trading = tipping made visible | `$CSGN` beat: live price + "creator fees this session" + who's live; **buy toasts** rise (green) as buys land |
| Governance | Governance beats + tonight's **vote** with a live 8PM ET countdown (ticker + full-screen lower-third overlay) |
| Breaking authority | Persistent red **BREAKING** takeover |

**Still to build (write-side, backend):** the holder-gate that lets a wallet with
≥X $CSGN push a `rightNow` item; the buy-and-burn contract wiring behind
spotlight sales; a feed of on-chain buys into `config/ticker.buys`. The *display*
is done; these connect it to the chain.

---

*Cross-references: `docs/forward-strategy.md`, `docs/broadcast-graphics.md`,
`docs/obs/csgn-ticker.html` (+ `csgn-lowerthirds.html`), `src/lib/slots.ts`
(fee engine + slot marketplace toggle).*
