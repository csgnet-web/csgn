# CSGN documentation — start here

There are only **three current documents**:

1. **[`master-plan.md`](master-plan.md)** — the original business and product plan. Coin Spotlight, the Right Now Rail, $CSGN participation, connected Twitch streamers, and TikTok clips remain part of that product; they are not replaced by generic sponsorship products.
2. **[`autonomy-runbook.md`](autonomy-runbook.md)** — the exact build, vendor, setup, rehearsal, and launch sequence for the autonomous channel.
3. **[`obs/README.md`](obs/README.md)** — how the existing ticker, lower-third, HUD, PIP, and browser sources stack in OBS.

Everything else in this directory is background analysis, a historical proposal, or a narrow technical reference. Do not read it to understand the current product. It remains in Git so implementation details and past reasoning are not lost.

## The product in one screen

| Layer | Already exists | Autonomous product |
|---|---|---|
| Main program | `/player`, live/VOD switching | `/autoplayer`, AI anchor packages, 30-minute wheel |
| Audience graphics | scores, crypto prices, Coin Spotlight, token highlighting, Right Now Rail | keep unchanged as the permanent lower-third |
| Community inventory | TikTok OAuth/import, submissions, moderation, weighted clip rotation | run approved clips as short labeled breaks |
| Live takeover | connected Twitch roster and founder/master controls | preempt AUTO and return at a clean boundary |
| Admin | broadcast, ticker, clips, roster, schedules, fees, votes | Autopilot becomes the daily control room; specialized screens remain secondary |
| Viewer product | `/watch`, schedule, accounts, profiles, treasury, voting | point the live embed at the autonomous OBS output |

## What still needs a decision

Only four inputs require founder detail before production automation can be finished:

- the two anchor names, appearance, on-air relationship, and prohibited character traits;
- the approved sports/news/data providers and the display/broadcast rights purchased;
- the two cloned voices (the founder's consented voice plus one licensed original voice);
- the first 30 minutes of scripts, pronunciation dictionary, music, and SAFE packages.

Use the runbook for everything else. Do not create another strategy document.
