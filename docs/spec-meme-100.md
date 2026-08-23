# Spec: getting 100 real memecoins on the Meme 100

Everything you need to diagnose, tune, or re-point the board yourself.

**Read this first if the board is thin.** It is written so you can fix it
without me, because I have now shipped three fixes for this and cannot test any
of them — this sandbox blocks all outbound network, so I have never once seen a
real response from any of these APIs.

---

## 1. What went wrong three times, so you can skip those

| Attempt | What I fixed | Why it didn't work |
|---|---|---|
| 1 | Thresholds were too strict (25k liquidity, 50k vol, 24h age) | Real, but not the cause |
| 2 | Discovery threw away pair data then re-fetched it, starving enrichment | Real, and a genuine speedup, but not the cause |
| 3 | **The source itself was wrong** | ← this one |

**The actual problem:** `api.dexscreener.com/latest/dex/search?q=SOL` is a
*search* endpoint. It returns a capped handful of pairs matching a string,
across every chain, dominated by the same majors whatever you ask. Seventeen
search terms against it yield a few dozen distinct Solana mints, mostly
duplicates. **No threshold tuning turns that into 100 names, because the 100
names were never in the response.**

If you take one thing from this document: *the board was never being filtered
down to two coins — it was being starved down to two.*

---

## 2. How it works now

Five independent sources, merged. Any one failing costs that source's coins and
nothing else.

| Source | Endpoint | Role |
|---|---|---|
| `jupiter:organic` | `lite-api.jup.ag/tokens/v2/toporganicscore/24h?limit=100` | **Primary.** Jupiter's own organic-activity score, wash volume filtered |
| `jupiter:traded` | `lite-api.jup.ag/tokens/v2/toptraded/24h?limit=100` | Raw 24h volume — catches what organic hasn't caught up with |
| `jupiter:recent` | `lite-api.jup.ag/tokens/v2/recent?limit=60` | New launches, because a memecoin's whole life is often day one |
| `dexscreener:boosts` | `token-boosts/top/v1` + `latest/v1` + `token-profiles/latest/v1` | Promoted coins — intent, not size |
| `dexscreener:search` | `latest/dex/search?q=…` | Last-resort floor. Kept only because it has historically answered |

Code: `netlify/functions/_shared/tokenSources.ts`.

Order matters only for collisions — the first source to report a mint keeps its
numbers, so Jupiter (richer stats) is asked before DexScreener fills gaps.

### After discovery

1. **Exclude** WSOL, USDC, USDT — *critical now.* Jupiter's top-traded list puts
   them at the very top, because by volume they are the biggest things on
   Solana by an enormous margin. Without this the "Meme 100" opens with SOL.
2. **Apply the denylist** (`config/memeBoard.deny`).
3. **Add pins** (`config/memeBoard.mints`) — these bypass every threshold.
4. **Fill in tiers** until 100:

| Tier | Liquidity | 24h volume | Pair age |
|---|---|---|---|
| `core` | $25,000 | $50,000 | 24h |
| `wide` | $10,000 | $15,000 | 6h |
| `tail` | $3,000 | $3,000 | 1h |

5. **Wash filter, every tier:** volume/liquidity > 50× *and* liquidity < $60,000
   → rejected. Relaxing size is a judgement call; letting through an obvious
   laundromat is not.

---

## 3. Diagnosing a thin board — do this first

### The 10-second version: `npm run meme:probe`

```bash
npm run meme:probe          # add --verbose to see sample mints
```

Run it from your own machine. It hits **the same sources the server hits**,
reading the list straight out of `tokenSources.ts` so it can never drift, and
prints two numbers that between them explain every thin board there has ever
been:

```
  jupiter:organic         98 found  +98 new · 240ms
  jupiter:traded         100 found  +14 new · 190ms
  dex:boosts-top          52 found  +31 new · 310ms
  ...
  Discovery total: 214 distinct mints
  Enrichment: 168/214 mints have a readable, priced pair

  Verdict
  ✓ 168 priced coins — a full board of 100 is available.
```

The verdict is the point. It says which of three things is true:

| Verdict | What it means | Where to look |
|---|---|---|
| **✓ full board available** | The feeds are fine | Thresholds in `_shared/memeBoard.ts`, or a stale stored board. Press Rebuild now. |
| **! enrichment starving** | Plenty of mints, few readable pairs | DexScreener rate limiting. Lower `DEX_CONCURRENCY`. |
| **✗ discovery starving** | Few mints from the sources at all | A source URL moved. The failing ones are named. §4. |

### The board cannot collapse any more

Since `topUpBoard`, a thin run **tops itself up from the last good board**
rather than publishing three coins over ninety-seven. Practically:

- A run that finds 3 coins publishes those 3 plus 97 held from the previous
  build, each marked `carriedFrom`.
- Held rows older than **24 hours** are dropped instead — a day-old price is
  defensible, a week-old one is a lie with a number on it.
- The admin card shows a **held** tag on each carried row and a warning line
  saying how many are held. **A full board with a high carry count means the
  feeds are down and only the carry-over is hiding it** — that is the one state
  that would otherwise be completely invisible.

So "the board only loaded three coins" is now only reachable on a genuinely
first-ever build. If you see it after the board has ever been healthy, the
stored document was wiped.

### The per-source table

**Admin → Meme 100 → Rebuild now.** The card shows a per-source table:

```
● jupiter:organic      98 found   +98
● jupiter:traded      100 found   +14
● jupiter:recent       60 found   +31
○ dexscreener:boosts    0 found    +0   HTTP 429
● dexscreener:search   34 found    +2
```

Read it like this:

| Symptom | Meaning | Fix |
|---|---|---|
| All sources `found: 0` | No outbound network from the function | Check Netlify egress / the function is deploying |
| Jupiter `found: 0`, note set | Endpoint moved or shape changed | §4 below |
| High `found`, low `contributed` | Duplicates — normal for `traded` after `organic` | Nothing |
| Good `found`, few `qualified` | Thresholds genuinely biting | Lower a tier in `tokenSources.ts` |
| High `unpriced` in `discovery` | Enrichment starving | Should not happen now — Jupiter carries price inline |

`public/memeBoard.discovery` also carries `byTier`, so `{core: 41, wide: 38,
tail: 21}` tells you the shape of the board at a glance. All 100 in `tail` means
the thresholds are doing nothing.

---

## 4. If Jupiter's API has changed

The most likely single point of failure, since it is the primary source and I
could not verify its response shape.

**Check it by hand:**

```bash
curl -s "https://lite-api.jup.ag/tokens/v2/toporganicscore/24h?limit=3" | head -c 2000
```

**What the parser expects** (`jupToPair` in `tokenSources.ts`) — it reads each
field with fallbacks, so a rename costs one number rather than the source:

| We read | Fallbacks | Used for |
|---|---|---|
| `id` | `address` | the mint |
| `symbol`, `name`, `icon` | `logoURI` | display |
| `usdPrice` | `price` | price |
| `mcap` | `marketCap`, `fdv` | size term |
| `liquidity` | — | tier gate |
| `stats24h.buyVolume + sellVolume` | `stats24h.volume` | volume term + tier gate |
| `stats24h.priceChange` | — | momentum term |
| `firstPool.createdAt` | — | age gate |

**If a field moved:** add the new name to the `num(...)` call for that field.
They take any number of fallbacks and use the first non-zero.

**If the base URL moved:** change `JUPITER_BASE` at the top of the Jupiter
section. There is also a paid `api.jup.ag` tier if the lite endpoint starts
rate-limiting you.

---

## 5. Adding a source yourself

Sources are self-contained. A new one is a function returning `SourceResult`:

```ts
export async function myNewSource(): Promise<SourceResult> {
  const pairs = new Map<string, SourcePair>()
  try {
    const data = await fetchJson<Whatever>('https://…', { timeoutMs: 8_000 })
    for (const token of data?.items ?? []) {
      const address = String(token.mint || '')
      if (!SOLANA_MINT_RE.test(address)) continue
      pairs.set(address, {
        chainId: 'solana',
        baseToken: { address, symbol: token.sym, name: token.name },
        priceUsd: String(token.price ?? 0),
        marketCap: Number(token.mcap) || 0,
        volume: { h24: Number(token.vol24) || 0 },
        priceChange: { h24: Number(token.chg24) || 0 },
        liquidity: { usd: Number(token.liq) || 0 },
        info: { imageUrl: token.image },
      })
    }
    return { source: 'myprovider', pairs, ok: pairs.size > 0 }
  } catch (err) {
    return { source: 'myprovider', pairs, ok: false, note: String(err) }
  }
}
```

Then add it to the array in `discoverAllSources()`. **Never let it throw** —
the whole design is that one bad source cannot take the board down.

### Sources worth adding if you want more depth

| Provider | Endpoint | Key? | Notes |
|---|---|---|---|
| **Birdeye** | `public-api.birdeye.so/defi/tokenlist` | Yes, free tier | Best Solana coverage. Sort by `v24hUSD` |
| **CoinGecko** | `/coins/markets?category=solana-meme-coins` | Free tier | Curated, slower to list new coins |
| **Moralis** | Solana token API | Yes | Good for holder counts |
| **pump.fun** | unofficial | No | Where most of them are born; unstable |

Birdeye is the one I would add next. Put the key in `BIRDEYE_API_KEY` and gate
the source on its presence so the board still works without it.

---

## 6. Tuning knobs

| What | Where | Default |
|---|---|---|
| Board size | `MEME_BOARD_SIZE` in `_shared/memeBoard.ts` | 100 |
| Tier thresholds | `TIERS` in `_shared/memeBoard.ts` | see §2 |
| Wash filter | `SUSPICIOUS_TURNOVER` / `SUSPICIOUS_MIN_LIQUIDITY_USD` | 50× / $60k |
| Rebuild interval | `MEME_BOARD_INTERVAL_MS` | 5 min |
| Pins | `config/memeBoard.mints` (Firestore, admin UI) | — |
| Denylist | `config/memeBoard.deny` | — |
| Excluded majors | `MEME_BOARD_EXCLUDE` | WSOL, USDC, USDT |
| Score weights | `POWER_WEIGHTS` in `src/lib/games/memeBoard.ts` | momentum 30, vol 25, votes 30, size 15 |

---

## 7. The fastest possible check

```bash
# 0. The one that answers it fastest — runs the real sources from your machine
npm run meme:probe

# 1. Does the function work at all?
curl -s "https://csgn.fun/.netlify/functions/memeBoard" | python3 -m json.tool | head -40

# 2. Force a rebuild and read the source table
curl -s "https://csgn.fun/.netlify/functions/memeBoard?force=1" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('coins:', len(d['coins'])); [print(s) for s in (d.get('sources') or [])]"

# 3. Is Jupiter reachable from your machine?
curl -s "https://lite-api.jup.ag/tokens/v2/toporganicscore/24h?limit=1" | head -c 500
```

If step 3 works from your laptop and step 2 shows `jupiter:organic` with
`found: 0`, the function cannot reach it — that is a Netlify egress or timeout
problem, not a code problem.

---

## 8. What I could not verify, stated plainly

**None of this has been run against a live API.** This environment blocks all
outbound hosts — `lite-api.jup.ag` returns a 403 at the proxy, as does
everything else. So:

- The Jupiter endpoint paths are from documentation and memory, not from a
  response I have seen.
- The field names in §4 are the same.
- The parser is deliberately lenient *because* of this — every field has
  fallbacks, and a source that fails entirely is contained.

**The first thing to do after deploying is §7.** If Jupiter's shape is
different from what I have assumed, §4 tells you exactly which two lines to
change, and the source table will have told you it was Jupiter.
