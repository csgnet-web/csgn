import { useEffect, useRef, useState } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { Gamepad2, Grid3X3, Radio, Timer } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { db } from '@/config/firebase'
import {
  normalizeBanner, normalizeCadence, resolveBanner, DEFAULT_BANNER_LINES,
  type GameId, type BannerMode,
} from '@/lib/games/schedule'
import { PERFECT_CARD_PURSE_CSGN, type PrizeMode } from '@/lib/games/startingFive'
import { DEFAULT_ENTRY_FEE_CSGN, DEFAULT_RAKE_BPS, SQUARE_COUNT } from '@/lib/games/squares'

/**
 * GAME CONTROL — sets the game, the countdown, and the strip on /watch.
 *
 * Writes two admin-only documents:
 *   config/gameBanner   the headline + countdown + rotating lines on /watch
 *   config/games        the purse, prize mode and weekly Squares cadence
 *
 * The strip used to be four constants in Watch.tsx, so announcing a game — or
 * putting a clock on it — meant a deploy. Same pattern as the ticker chyron:
 * one Firestore write changes what's on screen, everywhere, immediately.
 */

const GAMES: Array<{ id: GameId; label: string; Icon: typeof Gamepad2 }> = [
  { id: 'starting5', label: 'Starting 5', Icon: Gamepad2 },
  { id: 'squares', label: 'Squares', Icon: Grid3X3 },
  { id: 'none', label: 'No game', Icon: Radio },
]

const MODES: Array<{ id: BannerMode; label: string; hint: string }> = [
  { id: 'auto', label: 'Auto', hint: 'Headline + clock as set below' },
  { id: 'manual', label: 'Manual', hint: 'Same, but never auto-derived' },
  { id: 'off', label: 'Off', hint: 'Fall back to the default network copy' },
]

const PRIZE_MODES: Array<{ id: PrizeMode; label: string; hint: string }> = [
  { id: 'perfect_split', label: 'Split', hint: 'Every 5/5 card shares the purse' },
  { id: 'perfect_lottery', label: 'Lottery', hint: 'One 5/5 card drawn takes it all' },
  { id: 'leaderboard', label: 'Leaderboard', hint: 'Top 10 by points, rank curve' },
]

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** `datetime-local` speaks local wall-clock with no zone; these convert to and
 *  from the ISO instant we actually store, so a countdown set at 8pm means 8pm
 *  on the operator's clock rather than 8pm UTC. */
function isoToLocalInput(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const d = new Date(t - new Date(t).getTimezoneOffset() * 60_000)
  return d.toISOString().slice(0, 16)
}
const localInputToIso = (value: string): string => {
  const t = Date.parse(value)
  return Number.isFinite(t) ? new Date(t).toISOString() : ''
}

const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? 'AM' : 'PM'}`

export default function GameControlsCard() {
  const seeded = useRef(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Banner
  const [mode, setMode] = useState<BannerMode>('auto')
  const [game, setGame] = useState<GameId>('none')
  const [headline, setHeadline] = useState('')
  const [countdownLabel, setCountdownLabel] = useState('LOCKS IN')
  const [countdownAt, setCountdownAt] = useState('')
  const [linesText, setLinesText] = useState('')
  const [href, setHref] = useState('')

  // Games
  const [purse, setPurse] = useState(String(PERFECT_CARD_PURSE_CSGN))
  const [prizeMode, setPrizeMode] = useState<PrizeMode>('perfect_split')
  const [jackpot, setJackpot] = useState('0')
  const [squaresDay, setSquaresDay] = useState(0)
  const [squaresHour, setSquaresHour] = useState(13)
  const [squaresFee, setSquaresFee] = useState(String(DEFAULT_ENTRY_FEE_CSGN))
  const [squaresRake, setSquaresRake] = useState(String(DEFAULT_RAKE_BPS))
  const [lockHour, setLockHour] = useState(12)

  // Ticks the preview once a second so the clock below is the real clock.
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    return onSnapshot(doc(db, 'config', 'gameBanner'), (snap) => {
      // Seed the form once, then leave it alone — re-seeding on every snapshot
      // would wipe out what the operator is mid-way through typing.
      if (seeded.current) return
      seeded.current = true
      const b = normalizeBanner(snap.exists() ? snap.data() : null)
      setMode(b.mode)
      setGame(b.game)
      setHeadline(b.headline)
      setCountdownLabel(b.countdownLabel)
      setCountdownAt(isoToLocalInput(b.countdownTo))
      setLinesText(b.lines.join('\n'))
      setHref(b.href)
    }, () => {})
  }, [])

  const gamesSeeded = useRef(false)
  useEffect(() => {
    return onSnapshot(doc(db, 'config', 'games'), (snap) => {
      if (gamesSeeded.current) return
      gamesSeeded.current = true
      const d = snap.exists() ? snap.data() : {}
      const c = normalizeCadence(d.cadence)
      setSquaresDay(c.squaresDayET)
      setSquaresHour(c.squaresHourET)
      setLockHour(c.startingFiveLockHourET)
      const s5 = (d.startingFive ?? {}) as Record<string, unknown>
      setPurse(String(Number(s5.purseCsgn) > 0 ? Math.floor(Number(s5.purseCsgn)) : PERFECT_CARD_PURSE_CSGN))
      setJackpot(String(Math.max(0, Math.floor(Number(s5.jackpotCsgn) || 0))))
      const pm = s5.prizeMode
      if (pm === 'perfect_split' || pm === 'perfect_lottery' || pm === 'leaderboard') setPrizeMode(pm)
      const sq = (d.squares ?? {}) as Record<string, unknown>
      const fee = Number(sq.entryFeeCsgn)
      const rake = Number(sq.rakeBps)
      setSquaresFee(String(Number.isFinite(fee) && fee >= 0 ? Math.floor(fee) : DEFAULT_ENTRY_FEE_CSGN))
      setSquaresRake(String(Number.isFinite(rake) && rake >= 0 ? Math.floor(rake) : DEFAULT_RAKE_BPS))
    }, () => {})
  }, [])

  const flash = (ok: string) => { setMsg(ok); setErr(null); setTimeout(() => setMsg(null), 2500) }
  const fail = (e: unknown) => { setErr(e instanceof Error ? e.message : 'Save failed.'); setMsg(null) }

  const saveBanner = async () => {
    setBusy(true)
    try {
      const lines = linesText.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 8)
      await setDoc(doc(db, 'config', 'gameBanner'), {
        mode, game, headline: headline.trim(), countdownLabel: countdownLabel.trim(),
        countdownTo: localInputToIso(countdownAt),
        lines: lines.length ? lines : [...DEFAULT_BANNER_LINES],
        href: href.trim(),
        updatedAt: new Date().toISOString(),
      }, { merge: true })
      flash('Banner updated — /watch is already showing it.')
    } catch (e) { fail(e) } finally { setBusy(false) }
  }

  const saveGames = async () => {
    setBusy(true)
    try {
      await setDoc(doc(db, 'config', 'games'), {
        cadence: { squaresDayET: squaresDay, squaresHourET: squaresHour, startingFiveLockHourET: lockHour },
        startingFive: {
          purseCsgn: Math.max(0, Math.floor(Number(purse) || 0)),
          jackpotCsgn: Math.max(0, Math.floor(Number(jackpot) || 0)),
          prizeMode,
        },
        squares: {
          cadence: 'weekly',
          entryFeeCsgn: Math.max(0, Math.floor(Number(squaresFee) || 0)),
          rakeBps: Math.min(10_000, Math.max(0, Math.floor(Number(squaresRake) || 0))),
        },
        updatedAt: new Date().toISOString(),
      }, { merge: true })
      flash('Game settings saved.')
    } catch (e) { fail(e) } finally { setBusy(false) }
  }

  const clearCountdown = async () => {
    setCountdownAt('')
    setBusy(true)
    try {
      await setDoc(doc(db, 'config', 'gameBanner'), { countdownTo: '', updatedAt: new Date().toISOString() }, { merge: true })
      flash('Countdown cleared — the strip is back to rotating copy.')
    } catch (e) { fail(e) } finally { setBusy(false) }
  }

  // Exactly what /watch will render, from the same pure resolver.
  const preview = resolveBanner(
    normalizeBanner({
      mode, game, headline, countdownLabel,
      countdownTo: localInputToIso(countdownAt),
      lines: linesText.split('\n').map((l) => l.trim()).filter(Boolean),
      href,
    }),
    nowMs,
    DEFAULT_BANNER_LINES,
  )

  // Full-board economics, mirrored from boardEconomics: gross, floored rake, prize.
  const squaresGross = Math.max(0, Math.floor(Number(squaresFee) || 0)) * SQUARE_COUNT
  const squaresRakeCsgn = Math.floor((squaresGross * Math.min(10_000, Math.max(0, Math.floor(Number(squaresRake) || 0)))) / 10_000)
  const squaresFullBoardPrize = squaresGross - squaresRakeCsgn

  const field = 'w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary-500/50'
  const label = 'block text-[11px] uppercase tracking-[0.14em] text-gray-500 mb-1.5'
  const pill = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
      active ? 'bg-primary-500/20 border-primary-500/40 text-white' : 'bg-white/[0.03] border-white/10 text-gray-400 hover:text-white'
    }`

  return (
    <Card hover={false} className="p-5 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Timer className="w-4 h-4 text-primary-400" /> Game Control
        </h3>
        {msg && <span className="text-xs text-emerald-300">{msg}</span>}
        {err && <span className="text-xs text-red-300">{err}</span>}
      </div>

      {/* Live preview of the /watch strip */}
      <div>
        <p className={label}>Preview — the strip on /watch</p>
        <div className="rounded-lg border border-white/10 bg-gradient-to-r from-red-600 to-red-500 px-3 py-2 flex items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-white font-black tracking-[0.25em] text-sm uppercase">LIVE</span>
          </div>
          <div className="flex-1 min-w-0 flex items-center justify-end gap-2 text-right">
            {preview.kind === 'countdown' && preview.countdown ? (
              <>
                <span className="truncate text-[10px] sm:text-xs font-black uppercase tracking-[0.12em] text-white/85">{preview.headline}</span>
                <span className="hidden sm:inline shrink-0 text-[10px] uppercase tracking-[0.16em] text-white/50">{preview.label}</span>
                <span className={`shrink-0 font-mono font-black tabular-nums text-sm ${preview.countdown.urgent ? 'text-amber-300' : 'text-white'}`}>
                  {preview.countdown.display}
                </span>
              </>
            ) : (
              <span className="truncate font-mono text-[11px] uppercase tracking-[0.08em] text-white/85">
                {preview.lines?.[0]}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Banner controls */}
      <div className="space-y-4">
        <div>
          <p className={label}>Game on the strip</p>
          <div className="flex flex-wrap gap-2">
            {GAMES.map(({ id, label: l, Icon }) => (
              <button key={id} type="button" onClick={() => setGame(id)} className={`${pill(game === id)} inline-flex items-center gap-1.5`}>
                <Icon className="w-3.5 h-3.5" /> {l}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className={label}>Strip mode</p>
          <div className="flex flex-wrap gap-2">
            {MODES.map(({ id, label: l, hint }) => (
              <button key={id} type="button" onClick={() => setMode(id)} className={pill(mode === id)} title={hint}>{l}</button>
            ))}
          </div>
          <p className="text-[11px] text-gray-600 mt-1.5">{MODES.find((m) => m.id === mode)?.hint}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="gc-headline">Headline</label>
            <input id="gc-headline" className={field} value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="STARTING 5 — TONIGHT'S SLATE" maxLength={120} />
          </div>
          <div>
            <label className={label} htmlFor="gc-cdlabel">Countdown label</label>
            <input id="gc-cdlabel" className={field} value={countdownLabel} onChange={(e) => setCountdownLabel(e.target.value)} placeholder="LOCKS IN" maxLength={24} />
          </div>
          <div>
            <label className={label} htmlFor="gc-cdat">Counts down to (your local time)</label>
            <input id="gc-cdat" type="datetime-local" className={field} value={countdownAt} onChange={(e) => setCountdownAt(e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="gc-href">Link (optional)</label>
            <input id="gc-href" className={field} value={href} onChange={(e) => setHref(e.target.value)} placeholder="/participate" maxLength={200} />
          </div>
        </div>

        <div>
          <label className={label} htmlFor="gc-lines">Rotating lines — one per line, shown when no countdown is running</label>
          <textarea id="gc-lines" rows={4} className={`${field} font-mono text-xs`} value={linesText} onChange={(e) => setLinesText(e.target.value)} placeholder={DEFAULT_BANNER_LINES.join('\n')} />
          <p className="text-[11px] text-gray-600 mt-1">The strip is a 4-face prism. Fewer than four lines cycle to fill it.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="sm" onClick={() => void saveBanner()} isLoading={busy}>Save strip</Button>
          <Button variant="secondary" size="sm" onClick={() => void clearCountdown()} disabled={busy || !countdownAt}>Clear countdown</Button>
        </div>
      </div>

      {/* Game settings */}
      <div className="border-t border-white/10 pt-5 space-y-4">
        <p className={label}>Starting 5 — daily</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className={label} htmlFor="gc-purse">Purse ($CSGN)</label>
            <input id="gc-purse" className={`${field} font-mono`} value={purse} onChange={(e) => setPurse(e.target.value)} inputMode="numeric" />
          </div>
          <div>
            <label className={label} htmlFor="gc-jackpot">Carried jackpot ($CSGN)</label>
            <input id="gc-jackpot" className={`${field} font-mono`} value={jackpot} onChange={(e) => setJackpot(e.target.value)} inputMode="numeric" />
          </div>
          <div>
            <label className={label} htmlFor="gc-lockhour">Locks at (ET)</label>
            <select id="gc-lockhour" className={field} value={lockHour} onChange={(e) => setLockHour(Number(e.target.value))}>
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
            </select>
          </div>
        </div>
        <div>
          <p className={label}>Prize mode</p>
          <div className="flex flex-wrap gap-2">
            {PRIZE_MODES.map(({ id, label: l, hint }) => (
              <button key={id} type="button" onClick={() => setPrizeMode(id)} className={pill(prizeMode === id)} title={hint}>{l}</button>
            ))}
          </div>
          <p className="text-[11px] text-gray-600 mt-1.5">{PRIZE_MODES.find((p) => p.id === prizeMode)?.hint}</p>
        </div>

        <p className={`${label} pt-2`}>Squares — weekly, pooled</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="gc-sqday">Board closes on</label>
            <select id="gc-sqday" className={field} value={squaresDay} onChange={(e) => setSquaresDay(Number(e.target.value))}>
              {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="gc-sqhour">Entries close / digits drawn (ET)</label>
            <select id="gc-sqhour" className={field} value={squaresHour} onChange={(e) => setSquaresHour(Number(e.target.value))}>
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
            </select>
          </div>
          <div>
            <label className={label} htmlFor="gc-sqfee">Entry fee per square ($CSGN)</label>
            <input id="gc-sqfee" className={`${field} font-mono`} value={squaresFee} onChange={(e) => setSquaresFee(e.target.value)} inputMode="numeric" />
          </div>
          <div>
            <label className={label} htmlFor="gc-sqrake">Rake (basis points)</label>
            <input id="gc-sqrake" className={`${field} font-mono`} value={squaresRake} onChange={(e) => setSquaresRake(e.target.value)} inputMode="numeric" />
          </div>
        </div>
        {/* What a full board actually pays, computed the same way the engine
            does — so nobody has to reverse-engineer the rake from a rate card. */}
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-gray-500">Full board ({SQUARE_COUNT} squares) pays</p>
          <p className="mt-1 font-mono tabular-nums text-lg font-semibold text-white leading-none">
            {squaresFullBoardPrize.toLocaleString()} $CSGN
          </p>
          <p className="mt-1.5 text-[11px] text-gray-500">
            {squaresGross.toLocaleString()} gross · {squaresRakeCsgn.toLocaleString()} rake
            ({(Number(squaresRake) / 100 || 0).toFixed(1)}%). A short board pays a short prize.
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={() => void saveGames()} isLoading={busy}>Save game settings</Button>
      </div>
    </Card>
  )
}
