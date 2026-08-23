#!/usr/bin/env node
/**
 * PROBE THE MEME 100 DATA SOURCES — from your machine, in about ten seconds.
 *
 *   npm run meme:probe
 *
 * Why this exists: the board has come back thin several times, and every
 * diagnosis so far has been guesswork because the environment this code was
 * written in cannot reach api.dexscreener.com or lite-api.jup.ag at all. This
 * script closes that gap. It runs the SAME two stages the server runs and tells
 * you which one is starving:
 *
 *   DISCOVERY  — every source, how many Solana mints each one yielded
 *   ENRICHMENT — DexScreener, how many of those mints have a readable pair
 *
 * A thin board is always one of those two, and they need completely different
 * fixes. Guessing between them is what cost four rounds.
 *
 * It reads the source list straight out of
 * netlify/functions/_shared/tokenSources.ts, so it can never drift from what
 * the server actually calls. It writes nothing and needs no credentials.
 *
 * Flags:
 *   --json     machine-readable output
 *   --verbose  print the first few mints from each source
 */

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const SOURCES_TS = join(HERE, '..', 'netlify', 'functions', '_shared', 'tokenSources.ts')

const args = new Set(process.argv.slice(2))
const AS_JSON = args.has('--json')
const VERBOSE = args.has('--verbose')

const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const MINT_SCAN = /[1-9A-HJ-NP-Za-km-z]{32,44}/g
const BOARD_SIZE = 100
const DEX_BATCH = 30
const DEX_CONCURRENCY = 6
const TIMEOUT_MS = 12_000

/** Never counted as a memecoin. Mirrors MEME_BOARD_EXCLUDE. */
const EXCLUDE = new Set([
  'So11111111111111111111111111111111111111112',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
])

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
}

async function getJson(url, opts = {}) {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { ...opts, signal: ctl.signal })
    if (!res.ok) return { error: `HTTP ${res.status}` }
    return { body: await res.json() }
  } catch (err) {
    return { error: err?.name === 'AbortError' ? 'timeout' : String(err?.message || err) }
  } finally {
    clearTimeout(timer)
  }
}

/** Every base58 mint anywhere in a JSON body — the same shape-blind harvest the
 *  server does, so a field rename upstream cannot change this script's answer. */
function harvestMints(body) {
  const out = new Set()
  const walk = (node) => {
    if (out.size >= 500) return
    if (typeof node === 'string') {
      if (MINT_RE.test(node)) { out.add(node); return }
      for (const m of node.match(MINT_SCAN) ?? []) out.add(m)
      return
    }
    if (Array.isArray(node)) { for (const v of node) walk(v) ; return }
    if (node && typeof node === 'object') { for (const v of Object.values(node)) walk(v) }
  }
  walk(body)
  return [...out]
}

/** Pull the discovery list out of the TypeScript, so this cannot drift. */
async function readSources() {
  const src = await readFile(SOURCES_TS, 'utf8')
  const block = src.slice(src.indexOf('function discoveryUrls'))
  const rows = []
  const re = /url:\s*[`'"]([^`'"]+)[`'"][^}]*source:\s*['"]([^'"]+)['"]/g
  let m
  while ((m = re.exec(block))) {
    // Template literals carry ${JUP}; resolve the one substitution that exists.
    const jup = /const JUP\s*=\s*'([^']+)'/.exec(src)?.[1] ?? ''
    rows.push({ url: m[1].replace('${JUP}', jup), source: m[2] })
  }
  return rows
}

async function main() {
  const sources = await readSources()
  if (sources.length === 0) {
    console.error('Could not read the discovery list out of tokenSources.ts — has discoveryUrls() changed shape?')
    process.exit(2)
  }

  if (!AS_JSON) {
    console.log(c.bold('\n  CSGN — Meme 100 source probe\n'))
    console.log(c.dim(`  ${sources.length} discovery sources, target ${BOARD_SIZE} coins\n`))
  }

  /* ── Stage 1: discovery ── */
  const union = new Set()
  const report = []
  for (const s of sources) {
    const t0 = Date.now()
    const { body, error } = await getJson(s.url)
    const mints = error ? [] : harvestMints(body).filter((m) => !EXCLUDE.has(m))
    const before = union.size
    for (const m of mints) union.add(m)
    const row = {
      source: s.source,
      url: s.url,
      ok: !error,
      error: error ?? null,
      found: mints.length,
      contributed: union.size - before,
      ms: Date.now() - t0,
      sample: VERBOSE ? mints.slice(0, 3) : undefined,
    }
    report.push(row)
    if (!AS_JSON) {
      const status = error ? c.red(`FAIL ${error}`) : c.green(`${String(mints.length).padStart(4)} found`)
      console.log(`  ${s.source.padEnd(22)} ${status}  ${c.dim(`+${row.contributed} new · ${row.ms}ms`)}`)
      if (VERBOSE && row.sample?.length) console.log(c.dim(`      ${row.sample.join(' ')}`))
    }
  }

  const candidates = [...union]
  if (!AS_JSON) {
    console.log(`\n  ${c.bold('Discovery total:')} ${candidates.length} distinct mints\n`)
  }

  /* ── Stage 2: enrichment ── */
  const batches = []
  for (let i = 0; i < candidates.length; i += DEX_BATCH) batches.push(candidates.slice(i, i + DEX_BATCH))

  const priced = new Map()
  let dexCalls = 0
  let dexFails = 0
  for (let i = 0; i < batches.length; i += DEX_CONCURRENCY) {
    const wave = batches.slice(i, i + DEX_CONCURRENCY)
    const results = await Promise.all(wave.map(async (batch) => {
      dexCalls++
      return getJson(`https://api.dexscreener.com/latest/dex/tokens/${batch.join(',')}`)
    }))
    for (const { body, error } of results) {
      if (error) { dexFails++; continue }
      for (const pair of body?.pairs ?? []) {
        const address = pair?.baseToken?.address
        const price = Number(pair?.priceUsd) || 0
        if (!address || price <= 0) continue
        const liq = Number(pair?.liquidity?.usd) || 0
        const best = priced.get(address)
        // Deepest pool wins, same as the server.
        if (!best || liq > best.liquidityUsd) {
          priced.set(address, {
            address,
            symbol: pair?.baseToken?.symbol ?? '',
            priceUsd: price,
            liquidityUsd: liq,
            volumeH24Usd: Number(pair?.volume?.h24) || 0,
          })
        }
      }
    }
  }

  const rows = [...priced.values()].sort((a, b) => b.volumeH24Usd - a.volumeH24Usd)

  if (AS_JSON) {
    console.log(JSON.stringify({
      sources: report,
      candidates: candidates.length,
      priced: rows.length,
      dexCalls, dexFails,
      top: rows.slice(0, 10),
    }, null, 2))
    return
  }

  console.log(`  ${c.bold('Enrichment:')} ${rows.length}/${candidates.length} mints have a readable, priced pair`)
  console.log(c.dim(`  ${dexCalls} DexScreener calls, ${dexFails} failed\n`))

  if (rows.length > 0) {
    console.log(c.bold('  Top 10 by 24h volume'))
    for (const [i, r] of rows.slice(0, 10).entries()) {
      const vol = r.volumeH24Usd >= 1e6 ? `$${(r.volumeH24Usd / 1e6).toFixed(1)}M` : `$${Math.round(r.volumeH24Usd / 1e3)}k`
      console.log(`  ${String(i + 1).padStart(3)}. ${(r.symbol || '?').padEnd(12)} ${vol.padStart(9)}  ${c.dim(r.address)}`)
    }
    console.log('')
  }

  /* ── The verdict, which is the whole point ── */
  const failedSources = report.filter((r) => !r.ok)
  console.log(c.bold('  Verdict'))
  if (rows.length >= BOARD_SIZE) {
    console.log(`  ${c.green('✓')} ${rows.length} priced coins — a full board of ${BOARD_SIZE} is available.`)
    console.log(c.dim('    If the live board is still thin, the problem is downstream of here:'))
    console.log(c.dim('    the tier thresholds in _shared/memeBoard.ts, or a stale stored board.'))
    console.log(c.dim('    Use the admin panel\'s "Rebuild now" and read the source table on it.'))
  } else if (candidates.length >= BOARD_SIZE) {
    console.log(`  ${c.yellow('!')} Discovery is fine (${candidates.length} mints) but ENRICHMENT is starving`)
    console.log(`    — only ${rows.length} have a readable pair. DexScreener is the bottleneck.`)
    console.log(c.dim('    Check: rate limiting (raise DEX_BATCH interval), or a batch-size change upstream.'))
  } else {
    console.log(`  ${c.red('✗')} DISCOVERY is starving — only ${candidates.length} mints from ${sources.length} sources.`)
    if (failedSources.length) {
      console.log(`    ${failedSources.length} source(s) failed: ${failedSources.map((r) => `${r.source} (${r.error})`).join(', ')}`)
      console.log(c.dim('    A failed source is usually a URL that moved. Fix it in tokenSources.ts.'))
    } else {
      console.log(c.dim('    Every source answered but yielded few mints — the endpoints may have'))
      console.log(c.dim('    changed shape. Run with --verbose to see what came back.'))
    }
  }
  console.log('')
}

main().catch((err) => {
  console.error('probe failed:', err)
  process.exit(1)
})
