# The BottomLine, football edition

> **Status: design.** An upgrade to `ops/obs/csgn-ticker.html` — the bottom sports band —
> to carry football properly before Week 0.
>
> **This is not the show graphics package.** The BottomLine is its own system: its own file,
> its own control document (`config/ticker`), its own 90-second data cycle. The show's
> graphics live in [`graphics-package.md`](graphics-package.md) and read a different
> document entirely. Nothing in this file touches those, and nothing there touches this.
>
> Everything below is grounded in the shipped code. Line references are to
> [`../ops/obs/csgn-ticker.html`](../ops/obs/csgn-ticker.html).

---

## 1. Where football actually stands

The ticker renders 24 leagues through four parser types. Football — `nfl`, `cfb`, `xfl` —
goes through the same generic `parseGameEvent` path as basketball and soccer, and has
**exactly two sport-specific data fields**:

```js
if(live && l.sport==="football"){
  const dd=cleanText(sit.shortDownDistanceText||sit.downDistanceText||"");
  if(dd)football={dd,redZone:!!sit.isRedZone};
  if(sit.possession){ /* home | away */ }
}
```

For comparison, **baseball has five dedicated data structures and two bespoke flip faces**
(probable starters, decisions + top bat). Football has two fields and zero bespoke faces.

Three consequences:

- **It's live-gated.** The football branch only runs `if(live && …)`, so a pregame or final
  football game is indistinguishable from an NBA game.
- **The flip face is always the quarterback.** `leaderOf` takes the first category with a
  leader, and ESPN orders football leaders `passingYards, rushingYards, receivingYards` — so
  the "Top performers" face shows a QB and nothing else, every time.
- **The status cell is at its ceiling.** `.cell` is a 92px box; the live football stack
  (`Q3 4:12` / `3rd & 8` / `FOX`) computes to ~101px and only fits because `fitText` shrinks
  it at runtime. **There is no room to append anything.**

---

## 2. Free wins — the data is already being fetched

The ticker calls ESPN's public `site/v2` scoreboard and throws most of the payload away.
Every field below arrives on a request that is already being made:

| Field | What it gives | Today |
|---|---|---|
| `competitors[].curatedRank.current` | **AP / CFP rank** | Parsed for *racing only* (`leadingCompetitor`), never for teams |
| `competitions[].odds[]` → `details`, `overUnder` | Spread and total | **0 occurrences in the file** |
| `situation.homeTimeouts` / `awayTimeouts` | Timeout pips | 0 occurrences |
| `situation.lastPlay.text` | "Allen pass complete to Diggs for 14 yds" | 0 occurrences |
| `situation.yardLine`, `down`, `distance`, `possessionText` | Field position, goal-to-go | Only `isRedZone` is read |
| `competitors[].linescores[]` | Quarter-by-quarter | Used only as a fallback string when `.score` is missing |
| `competitors[].records[1..n]` | **Conference record** | `recordOf` takes `records[0]` only |
| `competitions[].notes[0].headline` | Bowl, rivalry, week name | Read for generic events and MMA, never for games |
| `weather`, `venue`, `neutralSite` | Cold-weather game, stadium | 0 occurrences |

> **A college football graphic with no rank on it is the most conspicuous miss in the file**,
> and closing it costs one line in the parser plus a slot in the row.

Not available on this endpoint: drives, play-by-play, win-probability series, standings, and
poll *movement*. Those live behind `sports.core.api.espn.com` or a real data provider — see
§6.

---

## 3. Three real bugs

### 3.1 The possession dot makes the scoreboard jitter

`teamRow` emits the dot inline, inside `.tname`, with no reserved slot:

```js
const poss=g.possession===side?'<span class="poss"></span>':"";
…<div class="tname">${poss}<span class="abbr">${esc(abbr)}</span>…
```

When a team doesn't have the ball the span isn't emitted at all, so the flex gap collapses
and **the two team abbreviations shift horizontally by ~23px every change of possession.**
On a broadcast band that reads as the graphic twitching.

**Fix:** always render the slot, toggle `visibility`/opacity. Costs nothing, and it's the
kind of thing that separates a real network look from a hobby one.

### 3.2 The dot never turns red

The file's own header comment says *"possession dot (red in the red zone)"*. It doesn't —
`.poss` is `background:var(--gold)` unconditionally, and the only red-zone treatment anywhere
is the down-distance text turning `--loss`:

```css
.cell .l2.rz{color:var(--loss);text-shadow:0 0 6px rgba(255,75,75,.6)}
```

**Fix:** either make the dot honour `redZone`, or correct the comment. Making it honour the
flag is better television — a red possession dot is instantly readable across a room.

### 3.3 CFB Saturday breaks the rotation

A college football Saturday is routinely 60+ games, all landing in one group. Two failures:

1. **The band locks up.** 60 items × 7s (or 11.6s with a flip face) is **seven to eleven
   minutes** on the CFB pill before the wipe moves on. There is no cap on items per group
   anywhere in the file.
2. **The progress dots silently stop working.** `MAX_SECDOTS = 14`, and `renderSecDots`
   compares the cursor `ii` against the *visible* pips. Past item 14, every pip renders
   `done` and none renders `on` — the row shows no current position at all.

**Fix:** cap items per group, page the remainder (§5.2), and clamp the cursor so the `on`
pip always tracks.

---

## 4. The Situation Strip — build up, not in

**There are 130px of transparent headroom above the 110px band**, and almost nothing uses
it: a 400px coin riser pinned right, and the breaking bar. Both are off screen most of the
time. Meanwhile the status cell is already 9px over budget.

**So new football data goes up.**

A football-only **Situation Strip** that rises above the band during live play:

```
┌──────────────────────────────────────────────────────────────┐
│  ●●○ KC        3rd & 8        KC 34         ●●●  BUF         │  ← 96px
│  ├──────────────────────█──────────────────────────────┤     │     field position
└──────────────────────────────────────────────────────────────┘
[ BRAND ][ PILL ][ ················ SCOREBOARD ··············· ][ CRYPTO ]  ← 110px band
```

Carrying: **timeout pips**, down and distance at full size, ball spot, a **field-position
bar**, and the last play on a slower rotation.

It reuses the proven `.riser` pattern exactly — `position:absolute; bottom:110px;
transform:translateY(110px)` with an `.up` class and a `.62s cubic-bezier(.22,1,.36,1)`
transition — and it degrades to nothing on a short source through the existing test:

```js
const BAND_H=110;
function hasHeadroom(){ return (window.innerHeight-BAND_H) >= 96 }
```

Recommended install is already 1930×240 at Y 845, which gives the 130px. Anyone running the
band at 110px simply never sees the strip, and nothing breaks.

---

## 5. Rotation and cadence

### 5.1 Order by what matters, not by kickoff time

`buildGroups` sorts every group's items by `sortDate` ascending, so on an NFL Sunday the
1 PM finals play **before** the live 4:25 games. Sort football groups by state instead:

**live and one score → live → ranked matchup → final → pregame**, then by kickoff within
each band.

### 5.2 Cap and page

Cap items per group at ~12 and rotate the remainder across cycles, using the golf
sub-rotation precedent (`startGolfRotation` mutates a sub-container on an interval while the
outer item holds a computed `dwellMs`). Note `golfTimer` is a single module-global — a second
sub-rotating face needs it generalised first.

### 5.3 Refresh cadence

`SPORTS_REFRESH_MS: 90_000` applies flatly to every league, so **a 3rd-and-8 can sit stale
on air across two or three real plays.** Give live football its own tier at 20–25s and leave
everything else at 90. The staging discipline in `advance()` — new data lands in
`pendingGroups` and is only applied at the top of a cycle, never mid-dwell — is correct and
should be preserved exactly.

### 5.4 Marquee dwell

The per-item `dwellMs` override already exists and is currently used only by golf and
tweets. Use it: a ranked matchup, or a one-score game in the fourth quarter, holds 10s
instead of 7.

### 5.5 Request parameters

- **CFB is missing `groups=80`.** Without it ESPN's college-football scoreboard defaults to
  a limited group rather than all of FBS, whatever `limit=300` says.
- **NFL and CFB declare no `dateRangeDays`**, so only "today" is ever requested. A football
  week runs Thursday to Monday; give NFL a range so Thursday night and Monday night are
  visible on a Sunday.

---

## 6. A TOP 25 lead group

Lead groups are the cleanest extension point in the file — a builder returning
`{league:{key,label,className}, items}` or `null`, plus one push in `buildGroups()`. No
`LEAGUES` row needed, no parser changes.

```js
function buildTop25Group(poll){
  if(!poll?.ranks?.length) return null;
  return { league:{key:"top25",label:"AP TOP 25",className:"league-cfb"},
           items:[ /* paged 5 at a time, golf-style */ ] };
}
```

**Fed by CollegeFootballData, not ESPN.** The scoreboard's `curatedRank` gives a current rank
with no previous-week delta, and **movement arrows are the entire point of a poll graphic**.
CFBD carries previous rank; the free tier is 1,000 calls a month, which is enormous relative
to a poll that moves once a week. Cache hard, poll daily, and the whole season costs ~30
calls.

Add a `--league-top25` CSS variable if it should read differently from the existing
`--league-cfb: #8b4513`.

---

## 7. Betting lines — context, never a pick

Spread and total render as **market data**, in the same register as a TV network badge: what
the market thinks, stated flatly. Pregame `MATCHUP` faces and the pregame cell carry
`odds[0].details` and `overUnder`.

**No pick, no units, no confidence, no lock of the day, ever.** The house rule stands
unchanged: *pay to feature content, never pay for a financial outcome* — and a ticker that
starts recommending bets is a different product with different regulators.

---

## 8. Build order

Ordered by value per hour of work:

1. **Rank chips** on team rows — one parser line, one row slot. The biggest visible win.
2. **Possession slot reserved** + red in the red zone. Two small fixes, both visible.
3. **Section-dot clamp** + per-group item cap. Fixes CFB Saturday before CFB Saturday.
4. **Odds on the pregame face**, and conference records from `records[1]`.
5. **Live-football refresh tier** at 20–25s.
6. **`groups=80`** for CFB, `dateRangeDays` for NFL.
7. **The TOP 25 lead group** — before noon ET on Aug 17.
8. **The Situation Strip** — before Week 0, Aug 29.
9. Line-score flip face, last play, weather.

---

## 9. What to be honest about

**Two faces per item is a hard structural limit.** The flip is a CSS `rotateX(180deg)` on a
`.flip` with exactly one `.a` and one `.b` child. A third face (main → box score → drives)
is not expressible without rebuilding the flip as a carousel, or emitting extra items —
which inflates the dot count and the group duration.

**There is no face registry.** Faces are hardcoded if-chains in `renderMainFace` and
`renderStatsFace`. Adding one means editing both, and anything not shaped like "two teams and
a label" needs its own container following the `renderGolfBoard` precedent — its own `kind`,
parser, renderer and dwell math.

**ESPN's endpoints are undocumented and can change without notice.** They are free and they
work, and everything above assumes they keep working. The mitigation is that `fetchScoreboardData`
already fails soft — an endpoint that errors logs a warning and returns the first non-empty
result — so a broken league degrades to an empty group rather than a dead band.

**Test coverage for football is two assertions**, both NFL, in `ticker-smoke.mjs`. There is
no CFB test at all. Anything added here should extend `window.__csgn` and the smoke harness,
or it is untested by construction.
