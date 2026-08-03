# Backend hardening — cost, scale, and the attacks that actually happen

> **Status: shipped.** What changed, why, and the rules to keep. Read §5 before
> adding an endpoint.
>
> Companion to [`ops-cost-security-runbook.md`](ops-cost-security-runbook.md)
> (Firestore cost control, incident steps) and [`dry-run.md`](dry-run.md).

---

## 1. The threat model, stated plainly

CSGN is a public read-heavy app on a **per-operation-billed database**, behind
**wall-clock-billed serverless functions**, calling **third-party APIs we don't
control**. That combination produces three failure modes, and only one of them
looks like an attack:

| | What it looks like | What it costs |
|---|---|---|
| **Bill drain** | Ordinary-looking traffic | Money, immediately |
| **Wall-clock burn** | A slow upstream | Money + timeouts + cascading failure |
| **Junk input** | A curl loop | 500s that bury real incidents |

Nobody needs to DDoS us. A loop calling one public endpoint at a polite rate was
enough — see §2.

---

## 2. The read amplifier (the real one)

`publicProfiles` read **~72 Firestore documents per request** and was rate
limited at **60/min per IP**. That's **4,320 document reads per minute from a
single IP**, from a public unauthenticated GET, using traffic no firewall would
flag. Ten IPs is 43,000 reads/minute.

That is not a traffic problem. It's an invoice with a URL.

**Fix:** the directory is now loaded once per TTL per container and ranked in
memory; the per-request work is a random sample over a cached array. Rate limit
dropped 60 → 20/min.

```
before:  1 request  = ~72 reads
after:   1 minute   = ~72 reads per container, regardless of request count
```

Single profile lookups are cached for 2 minutes and carry
`Cache-Control: public, max-age=60`, so a shared profile link opened repeatedly
from one feed never reaches the origin. The recommendation rail sends
`no-store` — it's supposed to differ on every load.

---

## 3. The primitives (`_shared/cache.ts`)

Three things, each fixing one failure mode. All per-container: they reduce cost
and latency, they are **not a correctness boundary**, and nothing that decides
money or permissions may depend on them.

### `memo(key, ttlMs, load)`

Cached read with **stampede protection**. When a hot key expires under load,
every in-flight request misses at once and they all hit Firestore together —
`singleFlight` collapses that to one load.

**A failed load is never cached.** Caching failures turns a one-second blip into
a full TTL of outage, which is how a cache makes an incident worse instead of
better.

The cache is **bounded at 500 keys** and cleared wholesale when full. A cache
that can grow without limit is just a memory leak with a good reputation.

### `fetchJson(url, opts)`

Every outbound call, with a **hard 6s timeout** and a **2MB response ceiling**.

This is the one to internalise: **Netlify bills wall clock and kills the
invocation at its limit.** A hung DexScreener socket doesn't fail fast — it
burns the entire budget and then fails anyway, taking every other thing that
invocation was going to do with it. The fee poller runs *every minute, forever*,
and calls three third parties.

Returns `null` on any failure, so callers get one branch instead of four.

> **Not for the money path.** `_shared/solana.ts` uses its own timeout wrapper
> that **throws**, because "couldn't reach the chain" must never be
> indistinguishable from "no payment found". Fail loud where it decides money.

---

## 4. Input and error hygiene

**Request bodies are capped at 16KB** (`MAX_BODY_BYTES`). Every real payload
here is a few hundred bytes — a proof token, a slot id, a mint. Without a
ceiling a caller posts megabytes and makes us pay to parse it, repeatedly,
inside the rate limit.

**Malformed JSON returns 400, not 500.** That distinction matters beyond
tidiness: a 500 says *we* broke, gets logged as an incident, and buries real
failures in noise — when what happened is that somebody sent junk, which is not
an outage.

**Non-object bodies are rejected.** Every handler does
`const { x } = parseJson(event)`. `null.x` is a 500 with a stack trace; `"str"`,
`[1,2]` and `42` are three more. One guard turns all four into a clean 400.

---

## 5. Rules for a new endpoint

Six questions. If you can't answer all six, the endpoint isn't finished.

1. **What does it cost per call, in Firestore operations?** If the answer is
   more than a handful, it needs `memo`. If it's unbounded, it needs a `limit`.
2. **Is every query bounded?** A `queryCollection` with no cap is one busy day
   from a five-figure bill. `firestore.rules` already enforces this for client
   reads (`request.query.limit != null && <= 150`); server reads are on you.
3. **Is it rate limited, and is the number defensible?** Multiply it by the
   per-call cost from (1) and say the result out loud.
4. **Does every outbound call have a timeout?** Use `fetchJson`. Never bare
   `fetch` against a third party — the only exceptions are the money paths that
   need to throw.
5. **Can it be called by someone signed out?** Then it must be cheap, cached,
   and it must not touch a document holding a private field. Return a hand-
   written projection, never a spread of the stored doc.
6. **What happens when the upstream is down?** Degrade, don't cascade. The board
   keeps its last good copy; a payout refuses to run.

---

## 6. Rules that were already right

Worth stating so nobody "optimises" them away:

- **CORS fails closed.** No `CSGN_ALLOWED_ORIGIN` means an empty origin header,
  which browsers treat as a non-match. Deny by default.
- **The rate limiter has a per-container pre-filter**, so a flood of
  already-blocked requests is rejected before any Firestore I/O. Without it,
  blocked traffic still bills a read per request.
- **`clientIp` prefers `x-nf-client-connection-ip`** (set by Netlify's edge,
  unforgeable) over `x-forwarded-for` (client-supplied, spoofable). Getting this
  backwards makes the rate limiter decorative.
- **Payout idempotency is enforced by the database**, not by caching or by care.
  See [`games-and-payouts.md`](games-and-payouts.md) §4.
- **`toPublicProfile` is the only place** that decides what leaves the users
  collection — one line to audit when someone asks whether their email is
  visible.

---

## 7. Known limits, honestly

**The caches are per-container.** Netlify runs many, so the real read reduction
is a function of container count and traffic shape, not a flat 72×. It's a large
win either way, but it isn't a global cache and shouldn't be described as one.

**Rate limiting still costs 1 read + 1 write per allowed request.** The memory
pre-filter only short-circuits requests that are already over the limit. Making
the *allowed* path cheaper means either sampling the Firestore sync (weakens
cross-container accuracy) or moving to Redis — which the README has flagged as
a v1.1 item since v1.0 and remains the right answer at real volume.

**Nothing here has been load-tested.** These are structural fixes with clear
reasoning and unit tests, not measured improvements. The numbers in §2 are
arithmetic on the code, not observations from production.
