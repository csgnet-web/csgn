# CSGN AI Network — the one-person operating plan

> **Decision:** CSGN's primary showcase is an autonomous, always-on network for
> crypto, sports, and gaming. It should feel like the sports television people
> remember—strong dayparts, desks, scoreboards, highlights, bumpers, and a calm
> editorial voice—without copying ESPN's marks, music, graphics, talent, or
> scripts. The holder-programmed clip channel remains a product mode, not the
> default identity.

This is a product and operations brief, not a promise that an unsupervised model
can safely publish anything it finds. “AI-run” means automation handles the
repeatable production work; sources, rights, policy, and a kill switch still have
an accountable human owner.

---

## 1. The product in one sentence

**CSGN is a live AI sports desk for the internet economy: scores, markets, games,
and culture, programmed as television instead of a feed.**

The channel has two distinct modes:

1. **CSGN Network (primary):** an automated editorial channel with recurring
   shows, synthetic hosts, live score/market interruptions, explainers, and
   reruns. The network is useful even when no community clip is submitted.
2. **CSGN Community:** the existing holder-weighted 24/7 clip reel and claimed
   live windows. $CSGN controls promotion within these windows and selected
   interactive features; it does not buy editorial truth or access to the app.

The viewer should never wonder which mode is active. Put `CSGN NETWORK`,
`COMMUNITY HOUR`, or `LIVE PARTNER` in the permanent now-playing bug and schedule.

### The differentiator

Do not make “an AI avatar reading headlines.” That is a demo, not a network. The
moat is the **programming system**:

- a clock viewers learn;
- the same facts expressed coherently across ticker, desk, web, and socials;
- interruptions when a score, roster move, exploit, launch, or market move is
  genuinely important;
- persistent franchises and characters with memory;
- transparent provenance and correction behavior;
- a community remote that affects entertainment, never facts.

---

## 2. What is on the channel

### 2.1 Start with a repeatable 30-minute wheel

An honest first version does not generate 24 hours of unique television. It makes
one strong wheel, refreshes parts of it, and labels reruns.

| Minute | Segment | Refresh | Automation |
|---:|---|---|---|
| 00:00 | Open + top four stories | every 30 min | generated rundown, fixed open |
| 03:00 | Scoreboard whip | 1–2 min live data | deterministic data graphics |
| 07:00 | Crypto market desk | 1–5 min data | numbers first, scripted context |
| 11:00 | Gaming desk | 15–30 min | approved sources and calendar |
| 15:00 | The Big Board | hourly | ranked stories with “why now” |
| 20:00 | Explainer / original package | daily | pre-rendered and reviewed |
| 25:00 | Community play / Meme-100 | hourly | token-directed, clearly labeled |
| 28:00 | What is next + reset | every wheel | deterministic schedule |

The ticker is live throughout. A breaking-event controller may replace the next
segment, but never cuts copyrighted game footage or an unverified social post to
air. Overnight, run the newest wheel plus clearly time-stamped evergreen packages.

### 2.2 Dayparts create the old-school feeling

| ET | Franchise | Purpose |
|---|---|---|
| 6–10 AM | **First Block** | overnight results, markets, today's slate |
| 10 AM–3 PM | **The Loop** | rolling desk, explainers, press events |
| 3–7 PM | **Closing Bell / First Tip** | market close into games and esports |
| 7 PM–1 AM | **Game Night** | live scoreboard whiparound and community windows |
| 1–6 AM | **After Hours** | global crypto/gaming, reruns explicitly stamped |

Launch with one neutral host and one analyst persona. Add a third character only
after the first two are recognizable and reliably produced. Recurring beats,
music cues, transitions, colors, and segment names create nostalgia more cheaply
than trying to manufacture nonstop novelty.

### 2.3 Editorial hierarchy

Every candidate story receives:

1. **domain:** sports, esports/gaming, crypto, or CSGN community;
2. **state:** developing, confirmed, corrected, or expired;
3. **importance:** ticker, rundown, interruption, or emergency;
4. **freshness deadline:** when it becomes stale;
5. **source bundle:** URL, publisher, publication time, event time, and rights;
6. **confidence:** deterministic facts, corroborated report, or commentary.

Scores and prices may interrupt automatically from licensed APIs. Claims about
injuries, trades, hacks, deaths, criminal activity, token launches, or market
manipulation require either a primary source or two reputable independent sources.
Financial segments are news and entertainment—never personalized advice, price
targets, or undisclosed paid promotion.

---

## 3. The automation pipeline

Build a queue, not one giant agent. Small stages are observable and can fail
closed.

```text
licensed feeds + primary sources + approved RSS/social lists
                         │
                         ▼
 ingest → normalize → deduplicate → rank → fact bundle
                         │
              policy and rights gate
                         │
                         ▼
 rundown planner → script → claim checker → pronunciation pass
                         │
                         ▼
 TTS + avatar/render → playout queue → OBS browser source → RTMP
                         │
                         ├── transcript + citations → site
                         └── vertical clip + caption → social approval queue
```

### 3.1 Separate deterministic data from generated language

- **Code owns:** scores, clocks, standings, prices, percent changes, schedule,
  sponsor disclosure, source labels, and lower-third spelling.
- **Models own:** transitions, summaries, comparisons, interview questions, and
  alternate clip hooks—but only from the supplied fact bundle.
- **Templates own:** breaking copy, corrections, disclaimers, station IDs,
  weather-delay states, and “data unavailable.”

Never let a model calculate a price change, invent a source, decide whether media
rights exist, or publish arbitrary HTML/URLs to the OBS machine.

### 3.2 A practical local stack

Run the workstation as two processes:

- **Control plane:** a small scheduler/worker that writes the current rundown and
  next 6–12 segments to Firestore. It can run locally first and later move to a
  hosted worker. Persist every input, output, model/version, source, and decision.
- **Playout plane:** a full-screen browser route that preloads rendered packages,
  crossfades them, renders deterministic live graphics, and falls back locally.
  OBS captures only this route plus the existing overlay stack.

Pre-render hosted segments rather than generating a talking avatar at broadcast
time. Reserve real-time rendering for scoreboards and rare updates. This reduces
GPU load, cost, lip-sync failures, and dead air.

**Minimum queue targets:** two hours of safe material on disk, 30 minutes fully
rendered ahead, and the next 6 hours planned. If the queue drops below 20 minutes,
stop generating topical claims and enter a branded evergreen loop.

### 3.3 Safety states

The playout controller needs explicit states:

| State | Behavior |
|---|---|
| `NORMAL` | automated rundown and approved interruptions |
| `HOLD` | finish current item; stop accepting new generated packages |
| `SAFE_LOOP` | local, rights-cleared evergreen packages + live deterministic ticker |
| `MANUAL` | operator chooses a package or live source |
| `OFF_AIR` | slate and music bed only; no stale “live” claims |

Expose one global **TAKE SAFE** button in admin and one keyboard shortcut on the
desktop. A watchdog should enter `SAFE_LOOP` if heartbeat, data freshness, disk,
network, audio loudness, or render queue crosses a threshold. Reboot should resume
the safe loop, not the last half-played generated segment.

---

## 4. Voices, likenesses, footage, and trust

“Broadcasters' voices and likenesses” must mean **contracted talent or original
characters**, not cloned celebrities.

- Use a voice/face only with a written license covering synthetic generation,
  broadcast, clips, ads, territories, term, revocation, training/derivatives,
  and post-termination takedown behavior.
- Default to CSGN-owned fictional hosts with clearly synthetic presentation.
  Never imply endorsement or imitate a recognizable broadcaster without consent.
- Give each synthetic host an on-screen disclosure in the show open and an
  accessible profile listing its voice performer/licensor and editorial role.
- Do not scrape highlight footage. License footage, use creator submissions with
  explicit broadcast/clip rights, embed permitted sources, or tell the story with
  scores, diagrams, licensed stills, and original animation.
- Keep paid stories out of ranking decisions. Mark `SPONSORED` on screen, in the
  transcript, and in the social caption.
- Publish source links and correction history for every topical package. When a
  fact changes, add a correction card to the next wheel and update the web record;
  do not silently overwrite the archive.

Before commercial launch, counsel should review publicity/voice rights,
copyright, league data and footage licenses, contest rules, advertising
disclosures, and token communications in each market served.

---

## 5. OBS from one desktop

Keep OBS boring. Intelligence belongs upstream.

### Scene collection

1. **`CSGN AUTO`** — the new playout browser route, existing ticker,
   now-watching bug, and notices.
2. **`CSGN COMMUNITY`** — the existing `/player` community/live flow and the same
   overlay stack.
3. **`CSGN MANUAL`** — desktop/game capture, microphone, and optional camera.
4. **`CSGN SAFE`** — local station loop, local music, and ticker. It must work with
   the internet disconnected.

Use the current `1920×1080`, 30 fps, NVENC baseline. Put all four scenes in one
collection, bind hotkeys for AUTO, COMMUNITY, MANUAL, SAFE, and record the program
feed locally in hour-long files. Stream through a relay/multistream service only
when one upload needs to reach several destinations; do not run several encodes
from the desktop.

### Workstation boundaries

- OBS and playout browser run under a dedicated OS user.
- Social publishing, wallets, email, and general browsing do not happen in that
  account or browser profile.
- Cache the safe loop and fonts locally; pin browser/OBS versions during a season.
- Put the machine and router on a UPS; use wired ethernet; configure BIOS power-on
  and OS auto-login only for the restricted broadcast user.
- Monitor stream heartbeat from a different device/network. A local green preview
  does not prove the destination is live.

### Daily operator check (15 minutes)

1. Check destination health, audio, dropped frames, disk, queue depth, data age,
   and the safe-scene hotkey.
2. Read the top story bundle and approve the day's original package.
3. Review queued social clips and sponsorship labels.
4. At close, review corrections, rejected items, spend, and the next day's calendar.

That is the human role: editor-in-chief and exception handler, not 24/7 board op.

---

## 6. The one-person content and social factory

One editorial object should produce every surface:

```text
fact bundle → 60–120s broadcast package
            → 20–45s vertical clip
            → headline card
            → sourced web transcript
            → one X/Threads post
            → daily email/Discord rundown
```

Do not ask separate agents to independently “make a post”; they will drift and
multiply review work. Derivatives inherit the package ID, sources, correction
state, embargo, rights, and sponsor label.

### Sustainable output ceiling

- **Daily:** one reviewed original package, 3–5 machine-selected clip candidates,
  publish at most two, one morning slate, one evening results card.
- **Weekly:** one 6–10 minute flagship explainer, one community show, one
  programming retrospective, and one sponsor-ready inventory report.
- **Monthly:** retire a weak franchise, test one new segment, and publish a
  transparency report (sources, corrections, automation incidents, uptime).

Start with approval-required social publishing. After 30 clean days, allow only
low-risk deterministic posts—final scores, schedule cards, and published-package
links—to auto-post. Breaking news and generated commentary always remain approval
required. If a platform API is unavailable, the same queue becomes a five-minute
manual checklist rather than a new integration project.

### Metrics that matter

Manage one page weekly:

- unique viewers, average minute audience, returning viewers, and hours watched;
- clip completion/share rate and conversion to live;
- freshness latency by desk and percent of airtime less than two hours old;
- source coverage, corrections, false-interruption count, and rights incidents;
- queue depth, safe-loop minutes, uptime, and cost per broadcast hour;
- sponsor fill and revenue per thousand viewer-hours;
- holders who used a utility, not holder count or token price.

---

## 7. Updated $CSGN tokenomics

### 7.1 The rule

**The token is the remote for participation and promotion, not the assignment
desk, a paywall, an investment contract, or a license to falsify the scoreboard.**

Holding $CSGN must never change a score, suppress a correction, manufacture a
“breaking” label, buy an undisclosed recommendation, or override a rights/policy
gate. Core viewing, account creation, source pages, and corrections remain free.

### 7.2 Fixed-supply allocation and disclosure

Do not migrate or promise retroactive allocations merely to fit a prettier chart.
Publish the actual mint, authorities, concentration, liquidity, treasury wallets,
and vesting before changing utilities. If a future relaunch is legally and
operationally justified, use this target allocation:

| Allocation | Share | Rule |
|---|---:|---|
| Circulating/community | 55% | existing circulation, claims, and public programs |
| Treasury/runway | 20% | public multisig; quarterly budget and transaction report |
| Contributor reserve | 12% | 48-month vest, 12-month cliff |
| Creator/talent pool | 8% | earned grants vest over 12 months; no pay-to-praise |
| Liquidity/market operations | 5% | disclosed venues and mandate; never fake volume |

Keep supply fixed after launch, disable mint authority where technically possible,
and publish any remaining control. No transaction tax, reflection, rebasing,
automatic burn, guaranteed floor, yield promise, or language that network work
will increase price.

### 7.3 Utility ladder

| Utility | Mechanic | Guardrail |
|---|---|---|
| Program the community wheel | quadratic/square-root weighted vote from a live balance snapshot | 10% effective-weight cap per verified person/entity; abstain option |
| Request a topic | stake-free signal queue | editorial team/model may reject; result labeled community-requested |
| Promote an eligible clip | spend $CSGN into treasury for a disclosed slot | rights/policy review; frequency caps; `PROMOTED` label |
| Unlock participation cosmetics | hold thresholds for badges, host skins, emotes, and prediction-game leagues | never gates facts, viewing, corrections, or account access |
| Sponsor settlement | sponsors may pay in USDC/SOL/$CSGN at a quoted fiat value | invoice, disclosure, no favorable coverage |
| Governance | vote on community windows, grants, show pilots, and treasury budgets | no votes on news truth, personnel safety, compliance, or emergency controls |

Use a **spend-to-treasury** model rather than burns. The public treasury funds
data licenses, contracted voices, creator rights, original reporting, and runway.
Every inflow receives a category; every outflow receives a transaction link and
budget line. A quarterly community vote recommends grants, while the accountable
operator retains a disclosed compliance veto.

### 7.4 Revenue and talent economics

Separate operating revenue from token speculation:

- sponsorships, licensed graphics/data products, syndication, production services,
  and promoted community inventory are network revenue;
- creator fees and token payments received by CSGN go to the disclosed treasury;
- contracted voices, reporters, and clip owners are paid under fixed fees or
  revenue-share contracts in fiat/stables by default, with optional token bonuses
  that vest and are never described as returns;
- monthly reporting shows revenue by product, treasury receipts, talent payouts,
  and runway without forecasting token price.

Do not promise the existing “30% of trading fees while on air” as the flagship
economy. Honor already-accrued obligations and any published program terms, then
replace it prospectively with a budgeted **Creator Airtime Pool**: a disclosed
monthly amount allocated by verified minutes, original-viewer-hours, rights
compliance, and a per-creator cap. This rewards useful programming without making
compensation depend on speculative token turnover.

---

## 8. Build order and stop/go gates

### Phase 0 — rights and control (week 1)

- Name the original host characters; secure voice/likeness and music agreements.
- Choose allowed data/news sources and document display/rebroadcast rights.
- Build the local safe loop and test it with ethernet unplugged.
- Define prohibited topics, high-risk claims, corrections, and sponsorship rules.

**Gate:** no autonomous output until every aired object has a source bundle,
rights state, expiry, and package ID.

### Phase 1 — a convincing hour (weeks 2–4)

- Produce the 30-minute wheel, two hosts, five segment packages, and daypart IDs.
- Add the rundown/queue document and a browser playout route.
- Run two hours daily to an unlisted destination; review every output afterward.
- Record freshness, factual, pronunciation, timing, and rendering failures.

**Gate:** 14 consecutive rehearsals with zero fabricated facts, rights violations,
dead-air events over five seconds, or unlabeled stale content.

### Phase 2 — 24/7 public beta (weeks 5–8)

- Run the wheel continuously with SAFE fallback and destination monitoring.
- Keep generated social posts approval-only.
- Add live score/price graphics and low-risk deterministic interruptions.
- Introduce one scheduled Community Hour using the existing clip system.

**Gate:** 99.5% playout uptime for 30 days, less than 5% SAFE airtime, correction
rate published, and daily human operations under 45 minutes excluding original
creative work.

### Phase 3 — a network, not a loop (months 3–4)

- Add the flagship weekly explainer, a second daypart, and one licensed talent
  voice or correspondent.
- Sell one clearly disclosed founding sponsorship.
- Add package-derived site transcripts and social clips.
- Publish treasury and editorial transparency pages.

### Phase 4 — scale only what worked (months 5–6)

- Syndicate the playout feed or graphics package.
- Automate deterministic social posts only after the clean-run threshold.
- Add languages or additional hosts only if a partner funds rights and review.
- Expand Community Hours based on repeat viewing, not token pressure.

### The no-build list

Until Phase 3 works, do not build a newsroom of autonomous agents, real-time 3D
hosts, an AI call-in show, scraped highlights, personalized betting picks, a new
chain/coin, DAO control of news, mobile apps, or custom video hosting. Each creates
more risk or operations than audience value.

---

## 9. The next seven founder actions

1. Write the two host bibles: name, role, vocabulary, prohibited claims, and
   pronunciation style.
2. Produce three rights-cleared station IDs and ten evergreen safe-loop packages.
3. Obtain written terms for one sports data source, one crypto data source, music,
   fonts, and every synthetic voice/likeness.
4. Mock the 30-minute wheel with existing OBS graphics and a simple local playlist.
5. Run it privately for two hours, deliberately kill the internet and renderer,
   and time recovery.
6. Choose one daily original; derive—do not separately create—the first social
   clip, card, transcript, and post from it.
7. Publish the editorial policy, AI/talent disclosure, corrections process, and
   treasury policy before calling the stream autonomous.

The winning version is not the one with the most AI. It is the one a viewer can
leave on, trust, recognize, and return to tomorrow—while one person can still take
a weekend off.
