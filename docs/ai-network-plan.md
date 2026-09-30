# CSGN autonomous network guide

> **The operating manual.** If a rule is not on this page, it is not part of the
> first autonomous channel. The objective is not “the most AI.” It is the most
> watchable, trustworthy live sports network one person can operate.

## 1. The product

**CSGN is the sports network of the internet economy: live sports first, crypto
covered like a sport, and gaming when it intersects with either—or when the
founder is live.**

The emotional reference is the best era of personality-led sports television:
smart anchors, humor, recurring bits, scoreboards, arguments, and the sense that
the desk knows what matters now. CSGN must build its own names, characters,
graphics, music, voices, and catchphrases. It does not clone ESPN, its shows, or
recognizable broadcasters.

The channel has three sources, in this exact order:

```text
1. OWNER LIVE       founder's OBS program feed                always wins
2. COMMUNITY BREAK  eligible holder clips from connected TikTok
3. CSGN AUTO        autonomous 30-minute show                 always available
```

This is the required product change. Today the code has only `master`, `stream`,
and `clip` modes and treats clips as the baseline. The new network needs an
explicit `auto` mode, makes it the baseline, and turns clips into scheduled,
bounded breaks. Do not disguise AUTO as the old intermission/VOD state.

**Launch mix:** AUTO 90–95%, COMMUNITY 5–10%, OWNER LIVE whenever the founder
chooses. A founder stream pauses the clock; it does not delete a member's queued
clip allocation.

---

## 2. The only show to build first

### The CSGN 30

One 30-minute wheel runs twice an hour. It feels current because live data and
headlines update inside a stable format. It does not pretend every minute is new.

| Clock | Duration | Segment | Screen-time rule |
|---|---:|---|---|
| `:00` | 0:20 | **Cold Open** | four moving images/data cards; say the top story immediately |
| `:20` | 3:40 | **First Takeaway** | one story, three facts, one opinion, one “watch next” |
| `4:00` | 3:00 | **The Scoreboard** | only live/recent games; no anchor if data tells it faster |
| `7:00` | 4:00 | **Market Season** | BTC/ETH/SOL + one consequential story, framed like standings |
| `11:00` | 0:30 | **CSGN ID** | reset; show time, mode, sources, and what is coming |
| `11:30` | 4:30 | **The Board** | four short stories at ~60 seconds each; max two crypto |
| `16:00` | 4:00 | **Film Room** | the day's durable original/explainer; rerun label after first air |
| `20:00` | 3:00 | **Numbers Game** | one comparison/ranking built from deterministic data |
| `23:00` | 2:00 | **Community Break** | up to four approved clips; omitted if queue is empty |
| `25:00` | 3:30 | **The Finish** | strongest opinion, debate, correction, or follow-up |
| `28:30` | 1:30 | **Next / reset** | upcoming games, next update time, source slate, clean loop point |

If Community Break is empty, extend Film Room with a second evergreen package.
If the founder goes live, finish the sentence, play a five-second wipe, and cut.
On return, play the next clean segment boundary rather than resuming mid-sentence.

### Screen-time laws

1. **One idea per frame.** A host plus a lower third plus a ticker is enough.
2. **Data beats narration.** Do not spend 45 seconds reading numbers already on
   screen. Let the graphic breathe and explain the implication.
3. **Change the visual every 8–15 seconds, not the subject.** Camera crop, card,
   chart, still, or full-screen board—not random motion.
4. **One permanent ticker.** It shows scores or markets, never both at once.
5. **No host for host's sake.** Scoreboards, schedules, corrections, and source
   slates are graphic-led.
6. **No stale “live.”** Every item displays `AS OF hh:mm ET`; reruns say `RECORDED`.
7. **No dead labels.** AUTO, COMMUNITY, or OWNER LIVE remains visible at all times.
8. **No ad clutter.** At most one presenting sponsor, one ticker sponsor, and one
   clearly labeled 30-second spot per wheel.

### Dayparts without making more shows

The structure stays fixed; the story mix changes.

| ET | Editorial bias |
|---|---|
| 6–10 AM | overnight results, morning slate, global markets |
| 10 AM–4 PM | news, press conferences, Film Room, market movement |
| 4 PM–1 AM | live games first, whiparound scoreboard, founder streams |
| 1–6 AM | global sports/crypto plus time-stamped best-of packages |

Gaming is not a standing desk at launch. It enters The Board when it is material
to sport, competition, streaming culture, or crypto, and expands during OWNER
LIVE. This protects a clear audience promise.

---

## 3. How autonomy works

Use a pipeline, not an all-powerful agent:

```text
approved feeds / primary sources
        ↓
normalize → deduplicate → timestamp → rights tag
        ↓
rank for the current daypart
        ↓
FACT PACKET (claims + links + confidence + expiry)
        ↓
script → claim check → pronunciation check → policy check
        ↓
voice/render → quality check → READY queue
        ↓
playout controller → /autoplayer → OBS → destination
        ↓
transcript + sources + derived social candidates
```

### Machines and models have different jobs

**Code owns:** scores, clocks, standings, prices, arithmetic, schedules, labels,
sponsor disclosure, queue priority, and timeouts.

**Models own:** concise summaries, transitions, analogies, debate positions, and
clip captions—only from a supplied fact packet.

**A model may never:** invent or select its own source URL, calculate a displayed
number, determine media rights, publish arbitrary HTML, give personalized financial
advice, make an accusation from one social post, or remove a correction.

### Publication classes

| Class | Examples | Can publish automatically? |
|---|---|---|
| A: deterministic | scores, schedules, standings, prices | yes, from contracted/approved APIs |
| B: confirmed | official roster move, league statement, company filing | yes, after primary-source parser and schema checks |
| C: reported | injury rumor, trade report, exploit, investigation | no; human approval or two approved independent sources |
| D: opinion | rankings, debate, predictions | yes if based on a published fact packet and labeled `ANALYSIS` |
| E: paid/community | ad, promoted token, member clip | only after rights/policy review and prominent label |

### Queue contract

Every package requires: `id`, `segment`, `createdAt`, `freshUntil`, `sources`,
`rights`, `sponsor`, `scriptHash`, `renderUrl`, `duration`, `reviewClass`, and
`correctionOf`. Missing or expired fields make it ineligible.

Keep two hours of rights-cleared evergreen material locally, 30 minutes of READY
programming, and six hours of planned slots. Below 20 READY minutes, enter the
local safe wheel and stop generating topical narration until the queue recovers.

### Fail closed

| State | What airs |
|---|---|
| `AUTO` | scheduled READY packages and live deterministic graphics |
| `COMMUNITY` | a bounded, approved clip pod; then automatic return to AUTO |
| `OWNER_LIVE` | the founder's program feed; highest priority |
| `SAFE` | local evergreen wheel plus fresh deterministic ticker |
| `OFF_AIR` | station slate; never a frozen or falsely live frame |

The watchdog selects SAFE for stale heartbeat, old data, low queue depth, render
failure, silence, black frames, disk pressure, or loss of destination health.
Recovery returns at the next segment boundary. Reboot starts SAFE.

---

## 4. Community clips and the token

### Eligibility

A community clip can enter the reel only when:

- the member owns $CSGN and has proved control of the wallet;
- the member connected their own TikTok through OAuth;
- the clip came from that connected account;
- the member granted CSGN broadcast, clipping, and social-derivative rights;
- automated safety checks pass and a moderator approved the account/first clip;
- the clip is 15–45 seconds for launch, not the current 15-minute maximum;
- it contains no unlicensed sports footage, deceptive ad, or undisclosed promotion.

### Allocation

Token balance determines a member's share of **Community Break inventory**, not a
share of the entire 24-hour day. This is easier to honor and cannot crowd the
flagship product off its own channel.

- Reserve **96 minutes/day** initially: two minutes in each half-hour wheel.
- Use square-root weight with a 10% per-identity daily cap.
- Guarantee no minimum to empty wallets and no single member consecutive plays.
- Unfilled inventory returns to AUTO; it is never black space.
- A preempted pod goes back to the front of the queue. Entitlement is measured in
  completed seconds, not scheduled seconds.
- Display `COMMUNITY PICK · @handle` and, where applicable, `PROMOTED`.

Token holders may also vote on the Film Room topic, show pilots, community grants,
and eligible ad creative. They cannot vote on scores, sourcing, corrections,
safety, or whether paid content is disclosed.

### Ad inventory

Keep commercial inventory scarce and legible:

| Product | Max | Sale |
|---|---:|---|
| Show presenting sponsor | one/daypart | fiat or stablecoin contract |
| 30-second spot | one/wheel | reviewed creative, frequency capped |
| Ticker sponsor | one/day | logo only; never disguised as a score/story |
| Community promotion | within Community Break only | $CSGN paid to public treasury |

Token spend goes to a disclosed treasury; do not burn it, promise appreciation,
or sell favorable coverage. Network revenue pays data, voice/likeness, music,
original reporting, distribution, and creators under written contracts.

---

## 5. OBS: four scenes, five buttons

OBS remains a dumb encoder. `/autoplayer` must own the queue and mode transitions.

| Scene | Source | Use |
|---|---|---|
| `CSGN AUTO` | `/autoplayer` + ticker + notices | normal 24/7 output |
| `CSGN OWNER` | founder's camera/game/desktop composition | founder broadcast |
| `CSGN COMMUNITY` | `/autoplayer?mode=community` for preview only | inspect a pod; automation normally switches it |
| `CSGN SAFE` | local HTML/video assets + ticker | internet/render failure |

Hotkeys: **TAKE OWNER**, **RETURN AUTO**, **TAKE SAFE**, **HOLD NEXT**, and
**KILL AUDIO**. The owner scene preempts the browser playout; the control plane
must also record `OWNER_LIVE` so the website, schedule, ticker, queue, and archive
agree with OBS. Returning AUTO advances to a clean boundary and requeues any
unfinished community seconds.

Use the existing 1920×1080, 30 fps, NVENC baseline. Record locally in one-hour
files. Use one upstream encode and a relay for multiple platforms. Broadcast under
a restricted OS user with no wallet, email, or social session. Cache SAFE assets,
fonts, and music locally; use wired ethernet and a UPS; monitor the destination
from a second device/network.

### Fifteen-minute daily checklist

**Open:** destination green; audio moving; zero dropped frames; queue ≥30 minutes;
feeds fresh; disk healthy; SAFE hotkey tested.

**Edit:** approve Class C items, the daily Film Room, first-time contributors, and
all ads. Scan the next six hours and pronunciation list.

**Close:** review corrections, SAFE minutes, rejected clips, costs, sponsor delivery,
and tomorrow's sports calendar. Everything else is automation.

---

## 6. One content object, every channel

```text
fact packet
  └─ broadcast package
      ├─ sourced web transcript
      ├─ 20–45 second vertical candidate
      ├─ score/headline card
      ├─ X/Threads copy
      └─ Discord/email line
```

Never create each surface independently. Every derivative inherits the package ID,
sources, correction state, expiry, rights, and sponsor label.

**Founder ceiling:** approve one Film Room daily, publish at most two derived clips,
one morning slate, and one evening results card. Produce one 6–10 minute flagship
weekly. Generated commentary and breaking news stay approval-only; after 30 clean
days, only final scores, schedule cards, and links to already-published packages
may auto-post.

---

## 7. Build sequence

### Gate 1 — prove one hour privately

Build `auto` mode, the package schema, `/autoplayer`, queue, safe wheel, and the
five OBS controls. Use an original licensed voice and original graphics. Run the
same 30-minute wheel twice to an unlisted destination.

**Pass:** 14 consecutive two-hour rehearsals with no fabricated claim, rights
violation, unlabeled rerun/ad, silence or black frame over five seconds.

### Gate 2 — public eight-hour day

Run 4 PM–midnight when live sports supply is strongest. Add deterministic sports
and crypto data, transcripts, source pages, and one Community Break per hour.

**Pass:** 99.5% playout uptime for 30 days, corrections published, SAFE below 5%,
and daily human operations below 45 minutes excluding founder streams.

### Gate 3 — 24/7

Add the other dayparts and overnight evergreen inventory. Increase Community Break
to twice hourly only after completion/retention data says it does not cause exits.

**Pass:** four-week returning-viewer growth, at least 20% of viewers watching 10+
minutes, and cost per broadcast hour inside the board-approved budget.

### Gate 4 — fund and expand

Sell one founding sponsor, license one correspondent/voice, and raise a pre-seed
against viewing retention and reliable playout—not a concept deck or token price.

The build backlog and business evaluation are in
[`autonomous-network-evaluation.md`](autonomous-network-evaluation.md).

---

## 8. Rights and trust are product features

Use only original fictional hosts or contracted people with explicit synthetic
voice/likeness rights covering broadcast, clips, advertising, geography, term,
revocation, derivatives, and deletion. Never clone or imply endorsement by a
recognizable broadcaster. Clearly disclose synthetic hosts in the open and on a
public host profile.

Do not scrape game highlights. License footage, accept rights-cleared submissions,
or tell the story through approved data, diagrams, original animation, licensed
stills, and commentary. Publish the source links and correction history for every
topical package. Mark paid material on screen, in transcripts, and in social copy.

Counsel must review publicity/voice rights, copyrights, sports-data terms, contests,
advertising, financial commentary, privacy, and token communications before the
public autonomous launch.
