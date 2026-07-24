// Smoke test for docs/obs/csgn-ticker.html — loads the file in jsdom (test
// mode, no network/boot) and drives the exported pure helpers with realistic
// ESPN/CoinGecko-shaped fixtures.
//   run:  node docs/obs/ticker-smoke.mjs
import { JSDOM } from 'jsdom'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const html = readFileSync(join(here, 'csgn-ticker.html'), 'utf8')
const dom = new JSDOM(html, { url: 'file:///csgn-ticker.html?test', runScripts: 'dangerously' })
const { __csgn } = dom.window
if (!__csgn) throw new Error('window.__csgn not exposed — script crashed during parse?')

let failures = 0
const check = (name, cond) => {
  if (cond) console.log(`  ok  ${name}`)
  else { failures++; console.error(`FAIL  ${name}`) }
}
/** Pin the page's clock (Date.now) while fn runs. */
const atTime = (iso, fn) => {
  const real = dom.window.Date.now
  dom.window.Date.now = () => new Date(iso).getTime()
  try { return fn() } finally { dom.window.Date.now = real }
}

// ── LED price formatting ────────────────────────────────────────────────────
const f = __csgn.formatLedPrice
check('BTC 98240 → grouped int', JSON.stringify(f(98240)) === JSON.stringify({ kind: 'plain', text: '98 240' }))
check('SOL 214.6 → 2dp', f(214.6).text === '214.60')
check('0.0821 → 4dp', f(0.0821).text === '0.0821')
const shib = f(0.00001234)
check('SHIB micro → zeros=4 sig=1234', shib.kind === 'micro' && shib.zeros === 4 && shib.sig === '1234')
const pepe = f(0.0000089)
check('PEPE micro → zeros=5 sig=8900', pepe.kind === 'micro' && pepe.zeros === 5 && pepe.sig === '8900')
check('0 → dash (never $0.00)', f(0).kind === 'dash' && f(null).kind === 'dash')
const led = __csgn.renderLed(shib)
check('micro LED renders sub digit', led.includes('digit sm') && (led.match(/class="digit /g) || []).length === 7)

// ── MLB live: base situation instead of a clock ─────────────────────────────
const mlbLeague = __csgn.LEAGUES.find((l) => l.key === 'mlb')
const mlbEvent = {
  date: new Date().toISOString(),
  competitions: [{
    date: new Date().toISOString(),
    status: { period: 5, displayClock: '0:00', type: { state: 'in', shortDetail: 'Bot 5th' } },
    situation: { balls: 2, strikes: 1, outs: 2, onFirst: true, onSecond: false, onThird: true },
    broadcasts: [{ market: 'national', names: ['FOX'] }],
    competitors: [
      { homeAway: 'home', id: '10', score: '3', team: { shortDisplayName: 'Yankees', logos: [{ href: 'x' }] },
        leaders: [{ shortDisplayName: 'HR', leaders: [{ displayValue: '2 HR', athlete: { shortName: 'A. Judge' } }] }],
        records: [{ summary: '55-38' }] },
      { homeAway: 'away', id: '11', score: '1', team: { shortDisplayName: 'Red Sox' },
        leaders: [{ shortDisplayName: 'SO', leaders: [{ displayValue: '8 SO', athlete: { shortName: 'B. Bello' } }] }],
        records: [{ summary: '48-45' }] },
    ],
  }],
  status: { type: { state: 'in' } },
}
const [mlb] = __csgn.parseGameEvent(mlbLeague, mlbEvent)
check('MLB live parsed with baseball situation', !!mlb.baseball && mlb.baseball.on1 && mlb.baseball.on3 && !mlb.baseball.on2 && mlb.baseball.outs === 2)
const cell = __csgn.renderStatusCell(mlb)
check('MLB cell shows diamond + count + inning, no 0:00', cell.includes('dia') && cell.includes('2-1') && cell.includes('Bot 5th') && !cell.includes('0:00'))
check('MLB cell marks 1B+3B occupied, 2B empty', cell.includes('base b1 on') && cell.includes('base b3 on') && !cell.includes('base b2 on'))
const mlbItem = __csgn.renderItem(mlb)
check('MLB item has a stats face (top performers)', mlbItem.hasStats && mlbItem.html.includes('A. Judge 2 HR'))

// ── NFL live: down & distance + possession ──────────────────────────────────
const nflLeague = __csgn.LEAGUES.find((l) => l.key === 'nfl')
const nflEvent = JSON.parse(JSON.stringify(mlbEvent))
nflEvent.competitions[0].situation = { shortDownDistanceText: '3rd & 8', possession: '11', isRedZone: true }
nflEvent.competitions[0].status.type.shortDetail = 'Q3 4:12'
const [nfl] = __csgn.parseGameEvent(nflLeague, nflEvent)
check('NFL live: down/distance + away possession + redzone', nfl.football?.dd === '3rd & 8' && nfl.football.redZone && nfl.possession === 'away')
check('NFL cell renders down & distance', __csgn.renderStatusCell(nfl).includes('3rd &amp; 8'))

// ── Golf: rotating faces of 3 with headshots ────────────────────────────────
const pga = __csgn.LEAGUES.find((l) => l.key === 'pga')
const golfEvent = {
  name: 'The Open Championship', shortName: 'The Open', date: new Date().toISOString(),
  status: { type: { state: 'in' } },
  competitions: [{
    status: { period: 2, type: { state: 'in', shortDetail: 'Round 2' } },
    competitors: Array.from({ length: 14 }, (_, i) => ({
      order: i + 1,
      athlete: { shortName: `Player ${i + 1}`, headshot: i < 2 ? { href: `https://a.espncdn.com/i/headshots/golf/players/full/${i}.png` } : undefined },
      score: { displayValue: i === 0 ? '-12' : i < 5 ? `-${9 - i}` : `+${i - 4}` },
      status: { position: { displayName: i === 1 ? 'T2' : String(i + 1) }, thru: i < 3 ? 18 : 11 },
    })),
  }],
}
const golfItems = __csgn.parseGolfEvent(pga, golfEvent)
check('Golf splits into rotating faces of 3 (top 9 → 3 faces)', golfItems.length === 3 && golfItems.every((it) => it.kind === 'golf' && it.rows.length === 3))
check('Golf face carries photos + pos + score + thru', golfItems[0].rows[0].photo.includes('headshots') && golfItems[0].rows[0].score === '-12' && golfItems[0].rows[1].pos === 'T2')
const board = __csgn.renderGolfBoard(golfItems[0])
const board3 = __csgn.renderGolfBoard(golfItems[2])
check('Golf face renders 3 big cards, tournament + round', (board.match(/g3-card[ "]/g) || []).length === 3 && board.includes('The Open') && board.includes('R2'))
check('Golf leader highlighted once on face 1, never on later faces', (board.match(/g3-card lead/g) || []).length === 1 && (board3.match(/g3-card lead/g) || []).length === 0)
check('Golf headshot img when present, initial placeholder when absent', board.includes('g3-photo" src="https://a.espncdn.com') && board.includes('g3-photo ph') && board.includes('THRU'))
check('Golf faces color under/over par', board.includes('g3-score under') && board3.includes('g3-score over'))

// ── Stacked main face: records on the game side, aligned scores ─────────────
const mainFace = __csgn.renderMainFace(mlb)
check('Main face shows both records in grey', mainFace.includes('55-38') && mainFace.includes('48-45'))
check('Stacked rows: away row before home row', (() => {
  const away = mainFace.indexOf('Red Sox'), home = mainFace.indexOf('Yankees')
  return away > -1 && home > -1 && away < home && (mainFace.match(/class="trow"/g) || []).length === 2
})())
check('Scores live in the fixed score column', (mainFace.match(/class="scorecell"/g) || []).length === 2)
const finalGame = { ...mlb, isFinal: true, live: false, winner: 'home', baseball: null }
const finalFace = __csgn.renderMainFace(finalGame)
check('Winner gets gold score + ◀ marker', finalFace.includes('score win') && finalFace.includes('win-arrow'))

// ── Stats face priorities ───────────────────────────────────────────────────
const preEvent = JSON.parse(JSON.stringify(mlbEvent))
preEvent.competitions[0].status.type.state = 'pre'
delete preEvent.competitions[0].situation
const [pre] = __csgn.parseGameEvent(mlbLeague, preEvent)
const preStats = __csgn.renderStatsFace(pre)
check('Pregame stats face shows season leaders, not records', preStats !== null && preStats.includes('Season leaders') && preStats.includes('A. Judge 2 HR') && !preStats.includes('55-38'))
const noLeaders = JSON.parse(JSON.stringify(preEvent))
noLeaders.competitions[0].competitors.forEach((c) => delete c.leaders)
const [bare] = __csgn.parseGameEvent(mlbLeague, noLeaders)
check('No leaders → no stats face at all', __csgn.renderStatsFace(bare) === null)

// ── MLB probable starters (pregame flip face) ───────────────────────────────
const probEvent = JSON.parse(JSON.stringify(preEvent))
probEvent.competitions[0].competitors[0].probables = [{
  name: 'probableStartingPitcher',
  athlete: { shortName: 'G. Cole' },
  statistics: [
    { name: 'wins', abbreviation: 'W', displayValue: '8' },
    { name: 'losses', abbreviation: 'L', displayValue: '3' },
    { name: 'ERA', abbreviation: 'ERA', displayValue: '2.75' },
  ],
}]
probEvent.competitions[0].competitors[1].probables = [{ athlete: { shortName: 'B. Bello' }, statistics: [] }]
const [prob] = __csgn.parseGameEvent(mlbLeague, probEvent)
check('Probables parsed both sides', prob.probables?.home?.name === 'G. Cole' && prob.probables.home.line === '8-3, 2.75 ERA' && prob.probables.away?.name === 'B. Bello')
const probFace = __csgn.renderStatsFace(prob)
check('Pregame face is PROBABLE STARTERS when probables exist', probFace.includes('Probable starters') && probFace.includes('G. Cole') && probFace.includes('8-3, 2.75 ERA') && probFace.includes('B. Bello'))
check('pitcherBrief tolerates missing stats', JSON.stringify(__csgn.pitcherBrief({ athlete: { shortName: 'J. Doe' } })) === JSON.stringify({ name: 'J. Doe', line: '' }))

// ── MLB pitching decisions (final flip face) ────────────────────────────────
const finEvent = JSON.parse(JSON.stringify(mlbEvent))
finEvent.competitions[0].status = {
  period: 9, type: { state: 'post', shortDetail: 'Final' },
  featuredAthletes: [
    { name: 'winningPitcher', athlete: { shortName: 'C. Holmes' }, statistics: [{ abbreviation: 'W', displayValue: '7' }, { abbreviation: 'L', displayValue: '4' }] },
    { name: 'losingPitcher', athlete: { shortName: 'B. Bello' }, statistics: [{ abbreviation: 'W', displayValue: '5' }, { abbreviation: 'L', displayValue: '6' }] },
    { name: 'savingPitcher', athlete: { shortName: 'E. Clase' }, statistics: [{ abbreviation: 'SV', displayValue: '25' }] },
  ],
}
delete finEvent.competitions[0].situation
finEvent.status = { type: { state: 'post' } }
const [fin] = __csgn.parseGameEvent(mlbLeague, finEvent)
check('Final parsed with W/L/SV decisions', fin.isFinal && fin.winner === 'home' && fin.decisions?.win?.name === 'C. Holmes' && fin.decisions.loss?.name === 'B. Bello' && fin.decisions.save?.name === 'E. Clase')
const finStats = __csgn.renderStatsFace(fin)
check('Final face is PITCHING DECISIONS (W/L/SV)', finStats.includes('Pitching decisions') && finStats.includes('W: C. Holmes') && finStats.includes('L: B. Bello') && finStats.includes('SV: E. Clase') && finStats.includes('(7-4)'))
check('Winner column leads the decisions face', finStats.indexOf('C. Holmes') < finStats.indexOf('B. Bello'))

// ── US TV sourcing ──────────────────────────────────────────────────────────
check('National broadcasts[] wins', mlb.tv === 'FOX')
check('TV rides the live baseball cell', cell.includes('class="tv"') && cell.includes('FOX'))
check('geoBroadcasts fallback', __csgn.broadcastOf({
  geoBroadcasts: [
    { type: { shortName: 'Radio' }, market: { type: 'National' }, media: { shortName: 'ESPNRadio' } },
    { type: { shortName: 'TV' }, market: { type: 'Home' }, media: { shortName: 'MASN' } },
    { type: { shortName: 'TV' }, market: { type: 'National' }, media: { shortName: 'TBS' } },
  ],
}) === 'TBS')
check('No broadcast data → empty, no crash', __csgn.broadcastOf({}) === '' && __csgn.broadcastOf(null) === '')

// ── 6 AM ET broadcast-day rollover ──────────────────────────────────────────
const ymdOf = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d).replaceAll('-', '')
check('4:30 AM ET still shows yesterday', atTime('2026-07-19T08:30:00Z', () => ymdOf(__csgn.broadcastRef())) === '20260718')
check('6:01 AM ET flips to today', atTime('2026-07-19T10:01:00Z', () => ymdOf(__csgn.broadcastRef())) === '20260719')
check('scoreboard dates param follows the broadcast day', atTime('2026-07-19T08:30:00Z', () =>
  __csgn.buildScoreboardUrl(mlbLeague, 'mlb').includes('dates=20260718')))
check('sameZonedDay honors the rollover', atTime('2026-07-19T08:30:00Z', () => __csgn.sameZonedDay('2026-07-18T21:00:00-04:00', 0)))

// ── Savannah Bananas: full remaining tour embedded ──────────────────────────
const bb = __csgn.BANANA_BALL_GAMES
check('Bananas schedule covers the full remaining tour (≥ 23 rows)', Array.isArray(bb) && bb.length >= 23)
check('All Bananas dates parse + sorted ascending', bb.every((g, i) => Number.isFinite(new Date(g.date).getTime()) && (i === 0 || new Date(g.date) >= new Date(bb[i - 1].date))))
check('Wrigley, Coors, Busch, Gillette + Banana Bowl all present', ['Wrigley', 'Coors', 'Busch', 'Gillette'].every((v) => bb.some((g) => (g.venue || '').includes(v))) && bb[bb.length - 1].event?.includes('Banana Bowl'))
const nextCard = atTime('2026-07-19T16:00:00Z', () => __csgn.bananasItems({ key: 'bananas' }))
check('Jul 19: card is the NEXT stop (Wrigley Jul 24), pregame', nextCard.length === 1 && nextCard[0].pregame && nextCard[0].subnote.includes('Wrigley') && nextCard[0].status.date === 'Jul 24')
const gameDay = atTime('2026-08-01T22:00:00Z', () => __csgn.bananasItems({ key: 'bananas' }))
check('Aug 1: card is that day\'s Grayson game', gameDay.length === 1 && gameDay[0].subnote.includes('Grayson') && gameDay[0].status.date === 'Aug 1')
const bowl = atTime('2026-10-09T16:00:00Z', () => __csgn.bananasItems({ key: 'bananas' }))
check('Oct 9: upcoming Banana Bowl renders as event card', bowl.length === 1 && bowl[0].kind === 'event' && bowl[0].title.includes('Banana Bowl'))

// ── Transitions: broadcast pacing ───────────────────────────────────────────
const C = __csgn.CONFIG
check('Dwell ≥ 6s main / ≥ 4s stats', C.DWELL_MAIN >= 6000 && C.DWELL_STATS >= 4000)
check('Roll slowed to ≥ 550ms', C.ROLL_MS >= 550)
const ph = __csgn.wipePhases(C.WIPE_MS)
check('League wipe has a real covered hold', ph.io + ph.hold + ph.io === C.WIPE_MS && ph.hold >= 300 && ph.io <= 560)
const st = __csgn.wipePhases(C.STINGER_MS)
check('Stinger buys hold time, not slower travel', st.io <= 560 && st.hold > ph.hold)

// ── Crypto dock card ────────────────────────────────────────────────────────
const coin = { sym: 'BTC', price: 98240, chg: 2.4, mc: 1.9e12, vol: 3.2e10, rank: 1, tag: 'TOP 50', spark: [1, 2, 3] }
const card = __csgn.renderCoinCard(coin)
check('Coin card: rank, sym, LED, tag, MC/VOL', card.includes('#1') && card.includes('BTC') && card.includes('digit') && card.includes('TOP 50') && card.includes('MC $1.9T'))
check('Big 7d chart canvas replaces the old corner spark', card.includes('c-chart') && card.includes('width="420"') && !card.includes('c-spark'))
check('No spark data → no chart canvas', !__csgn.renderCoinCard({ ...coin, spark: null }).includes('c-chart'))

// ── Firestore REST decode + Right Now group ─────────────────────────────────
const fsFixture = {
  fields: {
    rightNow: { arrayValue: { values: [
      { mapValue: { fields: { tag: { stringValue: 'BREAKING' }, text: { stringValue: 'SOL flips $300' } } } },
      { mapValue: { fields: { text: { stringValue: 'CSGN flagship 8PM ET' } } } },
    ] } },
    spotlight: { mapValue: { fields: {
      symbol: { stringValue: 'ANSEM' }, dexPair: { stringValue: 'FNzKy6x7' },
      dexChain: { stringValue: 'solana' }, note: { stringValue: 'Partner token' },
    } } },
  },
}
const rail = __csgn.decodeFs(fsFixture.fields.rightNow)
const spotCfg = __csgn.decodeFs(fsFixture.fields.spotlight)
check('decodeFs: rightNow array of 2 with tag/text', Array.isArray(rail) && rail.length === 2 && rail[0].tag === 'BREAKING' && rail[1].text === 'CSGN flagship 8PM ET')
check('decodeFs: spotlight map fields', spotCfg.symbol === 'ANSEM' && spotCfg.dexPair === 'FNzKy6x7' && spotCfg.dexChain === 'solana')
const rnGroup = __csgn.buildRightNowGroup([{ tag: 'BREAKING', text: 'SOL flips $300' }, { tag: 'CT', text: 'Ansem joins CSGN' }])
check('Right Now group: red pill league + 2 event items', rnGroup.league.label === 'Right Now' && rnGroup.league.className === 'league-rightnow' && rnGroup.items.length === 2)
const rnItem = __csgn.renderItem(rnGroup.items[0])
check('Right Now item renders red kicker tag + headline, no empty cell', rnItem.html.includes('ev-kick rn') && rnItem.html.includes('BREAKING') && rnItem.html.includes('SOL flips $300') && !rnItem.html.includes('class="cell"'))
check('Empty rail → no group', __csgn.buildRightNowGroup([]) === null && __csgn.buildRightNowGroup(null) === null)

// ── Coin spotlight: the RISING promoted box (compact card, gold accent) ─────
const spotHtml = __csgn.renderSpotlight({ symbol: 'ANSEM', note: 'Partner token' }, { price: 0.0421, chg: 12.4 })
check('Spotlight: promoted coin card with SPOTLIGHT tag, symbol, LED, note', spotHtml.includes('c-tag spot') && spotHtml.includes('SPOTLIGHT') && spotHtml.includes('ANSEM') && spotHtml.includes('digit') && spotHtml.includes('Partner token') && spotHtml.includes('▲'))
const spotNoPx = __csgn.renderSpotlight({ symbol: 'XYZ' }, { price: null, chg: null })
check('Spotlight without price shows dashes, never $0.00', spotNoPx.includes('c-dash') && !spotNoPx.includes('0.00'))

// ── $CSGN buy toast (rises green, reuses the coin-card shape) ────────────────
const buyHtml = __csgn.renderBuyCard({ usd: 1234, by: '@degen' })
check('Buy toast: green BUY tag + amount + buyer', buyHtml.includes('c-tag buy') && buyHtml.includes('+$1,234') && buyHtml.includes('@degen') && buyHtml.includes('c-buyamt'))

// ── Fans-on-the-board: the live viewer→on-air action counter card ───────────
check('Actions card hidden unless shown + has actions', __csgn.buildActionsGroup({ total: 5 }, false) === null && __csgn.buildActionsGroup({ total: 0 }, true) === null)
const actGrp = __csgn.buildActionsGroup({ total: 847, votes: 512, submissions: 300, spotlights: 35 }, true)
check('Actions card: FAN POWER pill + total + breakdown', actGrp.league.label === 'FAN POWER' && actGrp.items[0].title.includes('847') && actGrp.items[0].subtitle.includes('512 VOTES') && actGrp.items[0].subtitle.includes('35 SPOTLIGHTS'))

// ── Main chyron: admin-authored three lines, leads the rotation ─────────────
check('Chyron group null when blank', __csgn.buildChyronGroup(null) === null && __csgn.buildChyronGroup({ title: '  ' }) === null)
const chy = __csgn.buildChyronGroup({ kicker: 'CSGN ALERT', title: 'ANSEM JUST APED $50K INTO $CSGN', subtitle: 'watch it happen live · csgn.fun', pill: 'LIVE' })
check('Chyron group: pill label + one event item with all three lines', chy.league.label === 'LIVE' && chy.items.length === 1 && chy.items[0].kicker === 'CSGN ALERT' && chy.items[0].title.includes('ANSEM') && chy.items[0].subtitle.includes('csgn.fun'))
const chyCard = __csgn.renderEventCard(chy.items[0])
check('Chyron renders as a three-line event card (kicker/title/sub)', chyCard.includes('CSGN ALERT') && chyCard.includes('ANSEM') && chyCard.includes('event sub'))

// ── BREAKING normalize + two modes + optional second line ───────────────────
const nb = __csgn.normalizeBreaking
check('breaking: bare string → takeover, no 2nd line', JSON.stringify(nb('SEC sues X')) === JSON.stringify({ text: 'SEC sues X', text2: '', mode: 'takeover' }))
check('breaking: {text,text2} → takeover with 2nd line', nb({ text: 'A', text2: 'B' }).text2 === 'B' && nb({ text: 'A', text2: 'B' }).mode === 'takeover')
check('breaking: mode:"row" preserved', nb({ text: 'A', mode: 'row' }).mode === 'row')
check('breaking: unknown mode → takeover', nb({ text: 'A', mode: 'banner' }).mode === 'takeover')
check('breaking: empty/whitespace/no-text → null', nb('') === null && nb('  ') === null && nb({ text2: 'x' }) === null && nb(null) === null)
// applyBreaking drives the DOM: jsdom has headroom (innerHeight 768) so row mode
// lights the top bar and the second line lands; takeover fills both text + sub.
__csgn.applyBreaking(nb({ text: 'HEAD', text2: 'SUBLINE', mode: 'takeover' }))
check('applyBreaking takeover: overlay shown, both lines set, row hidden',
  !dom.window.document.getElementById('breaking').hidden &&
  dom.window.document.getElementById('brk-text').textContent === 'HEAD' &&
  dom.window.document.getElementById('brk-sub').textContent === 'SUBLINE' &&
  dom.window.document.getElementById('brk-row').hidden)
check('hasHeadroom true when the source is taller than the band (jsdom 768)', __csgn.hasHeadroom() === true)
__csgn.applyBreaking(nb({ text: 'ROWHEAD', text2: 'ROWSUB', mode: 'row' }))
check('applyBreaking row: top bar shown with both lines, takeover overlay hidden',
  !dom.window.document.getElementById('brk-row').hidden &&
  dom.window.document.getElementById('brk-row-text').textContent === 'ROWHEAD' &&
  dom.window.document.getElementById('brk-row-sub').textContent === 'ROWSUB' &&
  dom.window.document.getElementById('breaking').hidden)
__csgn.applyBreaking(null)
check('applyBreaking null clears both the overlay and the top bar',
  dom.window.document.getElementById('breaking').hidden && dom.window.document.getElementById('brk-row').hidden)

// ── $CSGN network beat: price card + live creator-fee card ──────────────────
const beat = __csgn.buildCsgnBeatGroup({ price: 0.0000038, chg: 5.2, mc: 3800, vol: 900 }, { name: 'CEO', usd: 42.5 }, { name: 'CEO' })
check('CSGN beat: 2 cards, $CSGN LIVE kicker, fee in USD', beat.items.length === 2 && beat.items[0].kicker === '$CSGN LIVE' && beat.items[1].title.includes('$42.50'))
const beatItem = __csgn.renderItem(beat.items[1])
check('CSGN fee card: gold kicker + green fee line, no game cell', beatItem.html.includes('ev-kick csgn') && beatItem.html.includes('ev-fee') && !beatItem.html.includes('class="cell"'))
const beatNoFee = __csgn.buildCsgnBeatGroup(null, null, null)
check('CSGN beat always present (1 card even with no data)', beatNoFee.items.length === 1 && beatNoFee.items[0].title.includes('$CSGN'))

// ── Governance beat + tonight's vote countdown ──────────────────────────────
const soon = new Date(Date.now() + 2 * 3600e3 + 14 * 60e3 + 30e3).toISOString()
check('shortCountdown: h/m, LIVE NOW, empty', __csgn.shortCountdown(soon) === '2h 14m' && __csgn.shortCountdown(new Date(Date.now() - 1000).toISOString()) === 'LIVE NOW' && __csgn.shortCountdown('') === '')
const gov = __csgn.buildGovernanceGroup([{ tag: 'CSGN GOVERNANCE', text: 'Holders pick tonight' }], { question: 'CFB dynasty or Black Ops?', options: ['CFB', 'BLACK OPS'], startISO: soon })
check('Governance group: beat + vote card with countdown + options', gov.items.length === 2 && gov.items[1].title === 'CFB DYNASTY OR BLACK OPS?' && gov.items[1].kicker.includes('STREAM IN 2h') && gov.items[1].subtitle.includes('CFB'))
check('Governance vote kicker uses gov accent', __csgn.renderItem(gov.items[1]).html.includes('ev-kick gov'))
check('Empty governance → no group', __csgn.buildGovernanceGroup([], null) === null)

// ── X post showcase (30s tweet cards) ───────────────────────────────────────
const twGroup = __csgn.buildTweetsGroup([{ name: 'Ansem', handle: '@blknoiz06', text: 'CSGN is the ESPN of crypto', avatar: '', verified: true }])
check('Tweets group: ON X pill + tweet item @ 30s dwell', twGroup.league.label === 'ON X' && twGroup.items.length === 1 && twGroup.items[0].kind === 'tweet' && twGroup.items[0].dwellMs === 30000)
const twItem = __csgn.renderItem(twGroup.items[0])
check('Tweet renders name + handle + verified badge + text + X logo', twItem.html.includes('Ansem') && twItem.html.includes('@blknoiz06') && twItem.html.includes('tw-verified') && twItem.html.includes('CSGN is the ESPN of crypto') && twItem.html.includes('tw-x'))
const twNoAvatar = __csgn.renderTweet({ name: 'Degen', handle: 'degen', text: 'gm', verified: false })
check('Tweet without avatar → initial placeholder, no verified badge', twNoAvatar.includes('tw-avatar ph') && twNoAvatar.includes('>D<') && !twNoAvatar.includes('tw-verified'))
check('Empty tweets → no group', __csgn.buildTweetsGroup([]) === null && __csgn.buildTweetsGroup(null) === null)

// ── $CSGN dock coin (network coin always present in the rotation) ────────────
const csgnCard = __csgn.renderCsgnCoinCard({ price: 0.0000038, chg: 5.2, mc: 3800, vol: 900 })
check('$CSGN dock coin: brand tag + star rank + CSGN symbol + LED digits', csgnCard.includes('c-tag csgn') && csgnCard.includes('c-rank csgn') && csgnCard.includes('CSGN') && csgnCard.includes('digit'))

console.log(failures ? `\n${failures} FAILURES` : '\nAll ticker smoke checks passed')
process.exit(failures ? 1 : 0)
