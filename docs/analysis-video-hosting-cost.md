# Should we host video ourselves?

**The question behind the question.** We link to posts rather than host files,
and that was a cost decision. But linking has a real product cost: **we cannot
read an exact duration from TikTok or Instagram**, so a clip's length is measured
for YouTube (with an API key) and assumed for everything else. If exact lengths
matter, hosting is the only way to get them for all three.

This is what hosting would actually cost.

> **Numbers are list prices as published by Google Cloud, and I could not reach
> the pricing pages from the build sandbox to re-check them today.** Treat every
> figure as ±20% and re-verify before committing spend. The *shape* of the answer
> — which line item dominates, and where the cliff is — is robust to that.

---

## 1. The three costs, and which one actually matters

| Line item | Google Cloud Storage (Standard, us) | Notes |
|---|---|---|
| **Storage** | ~$0.020 / GB / month | Cheap. Almost never the problem. |
| **Egress** (bandwidth out) | ~$0.12 / GB to internet | **This is the bill.** |
| Operations | ~$0.005 / 1,000 reads | Rounding error at our scale. |
| Transcoder API | ~$0.015 / minute of output (SD) | One-off per upload, per rendition. |

**Egress is 80–95% of the bill in every scenario below.** Storage is a rounding
error; the thing that costs money is people *watching*.

### The bit that makes this survivable

Our broadcast is **one stream, not one stream per viewer.** OBS pulls each clip
once and composites it into a single Twitch/X output. Twitch pays for fan-out to
viewers, not us. So the egress that matters is:

```
egress ≈ (bytes per clip) × (times it is fetched by the broadcast)
       + (bytes per clip) × (times it is previewed in /studio and the review queue)
```

That is a completely different order of magnitude from a consumer video app,
where every viewer pulls every byte. **Hosting for a broadcast is cheap; hosting
for an audience is not.** Keep that distinction and the numbers below stay small.

---

## 2. Assumptions

Stated so you can argue with them rather than guess at them.

| | |
|---|---|
| Average clip | 30 seconds |
| Encoded at | 1080p ≈ 4 Mbps → **~15 MB per clip** |
| Also stored | one 720p rendition (~8 MB) for previews |
| Clips per member per month | 8 |
| Broadcast fetches per clip | ~30 (aired repeatedly over its life) |
| Preview/review fetches | ~10 per clip (member checks it, admin reviews it) |
| Retention | 90 days, then deleted |

---

## 3. What it costs

### Monthly, at four sizes

| Members | Clips/mo | New GB/mo | Stored GB (90d) | Storage | Egress | Transcode | **Total/mo** |
|---|---|---|---|---|---|---|---|
| **100** | 800 | 18 | 54 | $1 | $75 | $6 | **~$82** |
| **1,000** | 8,000 | 184 | 552 | $11 | $754 | $60 | **~$825** |
| **10,000** | 80,000 | 1,840 | 5,520 | $110 | $7,540 | $600 | **~$8,250** |
| **50,000** | 400,000 | 9,200 | 27,600 | $552 | $37,700 | $3,000 | **~$41,250** |

*Egress here is 40 fetches × 15 MB × clips × $0.12/GB.*

### The same thing per member per month

| Members | Cost per member |
|---|---|
| 100 | ~$0.82 |
| 1,000 | ~$0.83 |
| 10,000 | ~$0.83 |
| 50,000 | ~$0.83 |

**It is linear.** There is no economy of scale in egress — that is the single
most important fact on this page. A hosting bill that is fine at 1,000 members is
a $41k/month bill at 50,000, and nothing about growing fixes it.

---

## 4. Where it goes wrong

The table above assumes the broadcast is the only consumer. Three things break
that, and they are all plausible.

**A viewer-facing feed.** If /studio or a public page ever plays clips to
visitors rather than showing thumbnails, egress stops being ~40 fetches and
becomes "however many people scrolled". At 10,000 members and a modest 50,000
clip-views a day, that is ~$2,700/month *on top*, and it scales with attention
rather than with membership.

**Someone hotlinks the bucket.** Public object URLs are public. Without signed
URLs, one popular post embedding our file directly is an unbounded bill on a
budget nobody set.

**No lifecycle rule.** Storage is the cheap line only while old clips are
deleted. Ninety days of retention at 50,000 members is 27 TB; forget the deletion
policy for a year and it is 110 TB and $2,200/month of pure dead weight.

---

## 5. What the alternatives cost

| Option | ~Cost at 10,000 members | Gets us exact durations? | Real trade |
|---|---|---|---|
| **Keep linking (today)** | **$0** | YouTube only, and only with an API key | No storage, no DMCA exposure on files, views stay on the member's own post |
| **Cloudflare Stream** | ~$500/mo (1,000 min stored + delivery) | Yes | Simple per-minute pricing, no egress cliff. **Best value if we host.** |
| **Mux** | ~$1,200/mo | Yes | Best tooling and analytics, most expensive |
| **Google Cloud Storage + Transcoder** | ~$8,250/mo | Yes | We own the pipeline; egress is uncapped and unpredictable |
| **Bunny Stream** | ~$300/mo | Yes | Cheapest credible option; smaller vendor |

**Google Cloud is the worst of these for this workload** — not because it is bad
infrastructure, but because raw storage + egress pricing is the wrong shape for
video. Cloudflare Stream and Bunny charge per minute stored and per minute
delivered, which caps the downside that the egress line does not.

---

## 6. Recommendation

**Do not build custom upload to solve durations.** It is a ~$800/month bill at
1,000 members and a legal surface (we would be hosting the files, not pointing at
them) to fix a problem with two much cheaper fixes:

1. **Set `YOUTUBE_API_KEY`.** Free at our volume, and it makes YouTube — likely
   the majority of submissions — exact today. This is a ten-minute job.
2. **Ask TikTok and Instagram properly.** TikTok's Display API and Instagram's
   Graph API both return duration. Both need an app review, neither costs money.
   That closes the remaining gap for free.

**Build upload when the reason is a product one, not a metadata one.** The real
argument for hosting is *native content that exists nowhere else* — clips made
for CSGN, that cannot be linked because they were never posted anywhere. That is
a genuinely different product and worth paying for. Paying $800/month to learn
how long a TikTok is, is not.

**If we do host, use Cloudflare Stream, not GCS.** Same capability, roughly a
tenth of the bill, and the per-minute model means a viral clip cannot produce a
surprise invoice.

### The one number to watch

If clips ever become viewer-facing rather than broadcast-only, re-run this from
scratch. Every figure here rests on "the broadcast pulls each clip a few dozen
times", and a feed breaks that assumption completely.
