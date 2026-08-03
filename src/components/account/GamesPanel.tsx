import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { Gamepad2, Grid3X3 } from 'lucide-react'
import { db } from '@/config/firebase'
import { formatTokens, type GameStats } from '@/lib/games/profile'
import { PERFECT_CARD_PURSE_CSGN } from '@/lib/games/startingFive'
import { normalizeCadence } from '@/lib/games/schedule'
import { DEFAULT_ENTRY_FEE_CSGN, DEFAULT_RAKE_BPS, SQUARE_COUNT } from '@/lib/games/squares'

/**
 * The games, on the profile.
 *
 * Deliberately honest about state: the boards and slates aren't live yet, so
 * this renders the real configured purse and cadence with an explicit "not open
 * yet" rather than mock entries and invented winnings. A profile that shows
 * fabricated stats is worse than one that shows none — the first time a real
 * number appears, nobody believes it.
 *
 * `GameStats` on the user document is written server-side by the settlement job;
 * every field is optional and absent today, which is why each stat falls back to
 * a zero it can defend.
 */

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? 'AM' : 'PM'} ET`

export default function GamesPanel({ stats }: { stats?: GameStats }) {
  const [purse, setPurse] = useState(PERFECT_CARD_PURSE_CSGN)
  const [jackpot, setJackpot] = useState(0)
  const [cadence, setCadence] = useState(normalizeCadence(null))
  const [sqFee, setSqFee] = useState(DEFAULT_ENTRY_FEE_CSGN)
  const [sqRake, setSqRake] = useState(DEFAULT_RAKE_BPS)

  useEffect(() => {
    return onSnapshot(doc(db, 'config', 'games'), (snap) => {
      const d = snap.exists() ? snap.data() : {}
      const s5 = (d.startingFive ?? {}) as Record<string, unknown>
      const p = Number(s5.purseCsgn)
      const j = Number(s5.jackpotCsgn)
      setPurse(Number.isFinite(p) && p > 0 ? Math.floor(p) : PERFECT_CARD_PURSE_CSGN)
      setJackpot(Number.isFinite(j) && j > 0 ? Math.floor(j) : 0)
      setCadence(normalizeCadence(d.cadence))
      const sq = (d.squares ?? {}) as Record<string, unknown>
      const fee = Number(sq.entryFeeCsgn)
      const rake = Number(sq.rakeBps)
      setSqFee(Number.isFinite(fee) && fee >= 0 ? Math.floor(fee) : DEFAULT_ENTRY_FEE_CSGN)
      setSqRake(Number.isFinite(rake) && rake >= 0 ? Math.floor(rake) : DEFAULT_RAKE_BPS)
    }, () => {})
  }, [])

  const winnings = Math.max(0, Math.floor(stats?.winningsCsgn ?? 0))
  // Full-board prize, mirroring boardEconomics: gross less a floored rake.
  const sqGross = sqFee * SQUARE_COUNT
  const sqPrize = sqGross - Math.floor((sqGross * Math.min(10_000, sqRake)) / 10_000)

  return (
    <section className="rounded-xl border border-white/[0.08] bg-white/[0.02]">
      <header className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-white/[0.06]">
        <h2 className="text-sm font-semibold text-white">Games</h2>
        <span className="font-mono tabular-nums text-sm text-white">
          {formatTokens(winnings)} <span className="text-[11px] font-sans text-gray-500">$CSGN won</span>
        </span>
      </header>

      <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06]">
        <GameCard
          Icon={Gamepad2}
          title="Starting 5"
          cadence={`Daily · locks ${hourLabel(cadence.startingFiveLockHourET)}`}
          prizeLabel="Perfect card (5/5)"
          prizeValue={`${formatTokens(purse + jackpot)} $CSGN`}
          prizeNote={jackpot > 0 ? `includes ${formatTokens(jackpot)} rolled over` : 'free to enter'}
          rows={[
            ['Entries', String(stats?.startingFiveEntries ?? 0)],
            ['Perfect cards', String(stats?.startingFivePerfect ?? 0)],
            ['Best finish', stats?.startingFiveBestRank ? `#${stats.startingFiveBestRank}` : '—'],
          ]}
        />
        <GameCard
          Icon={Grid3X3}
          title="Squares"
          cadence={`Weekly · ${DAYS[cadence.squaresDayET]} ${hourLabel(cadence.squaresHourET)}`}
          prizeLabel="Full board pays"
          prizeValue={`${formatTokens(sqPrize)} $CSGN`}
          prizeNote={`${formatTokens(sqFee)} $CSGN per square · ${(sqRake / 100).toFixed(0)}% rake`}
          rows={[
            ['Boards played', String(stats?.squaresBoards ?? 0)],
            ['Periods won', String(stats?.squaresPeriodsWon ?? 0)],
            ['Best finish', '—'],
          ]}
        />
      </div>

      <p className="px-5 py-3 border-t border-white/[0.06] text-[11px] text-gray-500 leading-relaxed">
        Starting 5 is free — how many lineups you get depends on what you hold, never on what you
        spend. Squares is the one paid game: you buy squares into a pool, and how many you may buy
        is capped by your holdings. A short board pays a short prize. Boards open here once the
        first slate goes live.
      </p>
    </section>
  )
}

function GameCard({
  Icon, title, cadence, prizeLabel, prizeValue, prizeNote, rows,
}: {
  Icon: typeof Gamepad2
  title: string
  cadence: string
  prizeLabel: string
  prizeValue: string
  prizeNote: string
  rows: Array<[string, string]>
}) {
  return (
    <div className="p-5">
      <div className="flex items-start gap-3">
        <span className="shrink-0 w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-gray-400">
          <Icon className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white leading-tight">{title}</h3>
          <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{cadence}</p>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3.5 py-3">
        <p className="text-[11px] uppercase tracking-[0.14em] text-gray-500">{prizeLabel}</p>
        <p className="mt-1 font-mono tabular-nums text-lg font-semibold text-white leading-none">{prizeValue}</p>
        <p className="mt-1.5 text-[11px] text-gray-500">{prizeNote}</p>
      </div>

      <dl className="mt-4 space-y-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-3">
            <dt className="text-xs text-gray-500">{k}</dt>
            <dd className="font-mono tabular-nums text-xs text-gray-300 shrink-0">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
