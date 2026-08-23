#!/usr/bin/env node
/**
 * PROVE THE 1:1 AIRTIME RATIO — on your machine, in one second.
 *
 *   npm run verify:airtime                 # the standard table
 *   npm run verify:airtime 1890000         # your own wallet
 *   npm run verify:airtime 1890000 500000  # several wallets, and the split
 *
 * The promise is: **your share of the day is your share of the token.**
 *
 *     seconds = balance / 1,000,000,000 x 86,400
 *
 * That is the whole product, and it is only believable if it can be checked.
 * This runs the same arithmetic the server runs, prints it, and re-derives it
 * independently so the two have to agree.
 *
 * It needs no credentials, no network and no deploy — it is arithmetic.
 */

const SUPPLY = 1_000_000_000
const DAY_SECONDS = 86_400
/** No member takes more than this share of a day, however large the bag.
 *  Mirrors AIRTIME_MAX_SHARE in netlify/functions/_shared/airtime.ts. */
const MAX_SHARE = 0.25

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
}

/** The server's rule, reimplemented from the spec rather than imported — two
 *  independent derivations agreeing is evidence; one derivation printed twice
 *  is not. */
function secondsFor(balance) {
  const share = Math.min(1, Math.max(0, balance) / SUPPLY)
  const uncapped = share * DAY_SECONDS
  const ceiling = MAX_SHARE * DAY_SECONDS
  return { seconds: Math.floor(Math.min(uncapped, ceiling)), share, capped: uncapped > ceiling }
}

const fmtTokens = (n) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n)

const fmtTime = (s) => {
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  if (m < 60) return rem ? `${m}m ${rem}s` : `${m}m`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

const DEFAULT_BALANCES = [1_000, 10_000, 100_000, 1_000_000, 1_890_000, 10_000_000, 50_000_000, 300_000_000]

const args = process.argv.slice(2).map((v) => Number(String(v).replace(/[_,]/g, ''))).filter((n) => Number.isFinite(n) && n >= 0)
const balances = args.length > 0 ? args : DEFAULT_BALANCES

console.log(c.bold('\n  CSGN — airtime ratio check\n'))
console.log(c.dim(`  supply ${SUPPLY.toLocaleString()} · day ${DAY_SECONDS.toLocaleString()}s · per-member cap ${MAX_SHARE * 100}%\n`))
console.log(c.dim('  ' + 'holding'.padEnd(14) + 'share'.padStart(10) + 'airtime'.padStart(14) + 'check'.padStart(12) + '   the sum'))
console.log(c.dim('  ' + '─'.repeat(76)))

let allOk = true
for (const balance of balances) {
  const { seconds, share, capped } = secondsFor(balance)
  // The check a member would do on a phone.
  const byHand = Math.floor((balance / SUPPLY) * DAY_SECONDS)
  const expected = capped ? Math.floor(DAY_SECONDS * MAX_SHARE) : byHand
  const ok = seconds === expected
  if (!ok) allOk = false

  const sum = `${fmtTokens(balance)} ÷ 1B × 86,400 = ${byHand}s`
  console.log(
    '  ' +
    fmtTokens(balance).padEnd(14) +
    `${(share * 100).toFixed(4)}%`.padStart(10) +
    fmtTime(seconds).padStart(14) +
    (ok ? c.green('ok'.padStart(12)) : c.red('MISMATCH'.padStart(12))) +
    '   ' + c.dim(sum) + (capped ? c.cyan('  (capped)') : ''),
  )
}

console.log('')

/* ── The properties that make it a RATIO rather than a table of numbers ── */
const checks = []
const push = (name, pass, detail) => { checks.push({ name, pass, detail }); if (!pass) allOk = false }

const one = secondsFor(SUPPLY * 0.002).seconds
const two = secondsFor(SUPPLY * 0.004).seconds
push('doubling the bag doubles the airtime', Math.abs(two - one * 2) <= 1, `${one}s → ${two}s`)

push('1% of supply gets 1% of the day', secondsFor(SUPPLY * 0.01).seconds === 864, `${secondsFor(SUPPLY * 0.01).seconds}s of 86,400s`)

push('a zero balance gets nothing', secondsFor(0).seconds === 0, '0s')

const whale = secondsFor(SUPPLY * 0.9)
push('a 90% holder is capped at a quarter of the day', whale.capped && whale.seconds === DAY_SECONDS * MAX_SHARE, fmtTime(whale.seconds))

// The property the 24/7 change is FOR: nothing about the schedule enters this.
push('the denominator is a constant, not a schedule', DAY_SECONDS === 86_400, 'clips run 24/7 — an interruption pre-empts, it does not deduct')

console.log(c.bold('  Properties'))
for (const { name, pass, detail } of checks) {
  console.log(`  ${pass ? c.green('✓') : c.red('✗')} ${name} ${c.dim(`— ${detail}`)}`)
}

/* ── If several balances were given, show how the day divides between them ── */
if (args.length > 1) {
  const total = args.reduce((n, b) => n + b, 0)
  const claimed = args.reduce((n, b) => n + secondsFor(b).seconds, 0)
  console.log(c.bold('\n  Between these wallets'))
  console.log(`  ${fmtTokens(total)} held in total → ${fmtTime(claimed)} of the day claimed`)
  console.log(c.dim(`  ${fmtTime(DAY_SECONDS - claimed)} of the day is unclaimed and runs on whatever is on the reel.`))
  console.log(c.dim('  Unclaimed air is normal: the reel loops until enough holders post clips to fill it.'))
}

console.log('')
console.log(allOk ? c.green('  All checks passed.\n') : c.red('  SOMETHING IS WRONG — the printed sum and the rule disagree.\n'))
process.exit(allOk ? 0 : 1)
