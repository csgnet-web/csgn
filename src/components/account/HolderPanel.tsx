import { useEffect, useState } from 'react'
import { Wallet } from 'lucide-react'
import { useLiveSlot } from '@/contexts/useLiveSlot'
import { fetchCsgnBalance } from '@/lib/csgnBalance'
import {
  holderStanding, tokensToNextEntry, formatTokens, type HolderStanding,
} from '@/lib/games/profile'
import { squaresAllowance, MAX_SQUARES_PER_WALLET } from '@/lib/games/squares'
import { lineupAllowance, MAX_LINEUPS } from '@/lib/games/startingFive'

/**
 * What the bag entitles you to.
 *
 * The whole no-deposit thesis, made concrete on one card: your balance is never
 * spent, locked or burned — it just decides how many entries you get. Showing
 * "3,400,000 more $CSGN for a 4th square" is the single most motivating line
 * this page can carry, and it's honest: nothing is being asked of the holder
 * except to hold.
 */
export default function HolderPanel({ walletAddress }: { walletAddress?: string }) {
  const { tokenStats } = useLiveSlot()
  // The fetched balance is stored WITH the wallet it belongs to, and the
  // rendered balance is derived by matching the two. That keeps the effect
  // write-only (no setState on the synchronous path) and, more usefully, means
  // switching wallets shows "—" until the new balance lands rather than briefly
  // attributing the previous wallet's bag to the new one.
  const [fetched, setFetched] = useState<{ wallet: string; balance: number } | null>(null)

  useEffect(() => {
    if (!walletAddress) return
    let cancelled = false
    void fetchCsgnBalance(walletAddress).then((b) => {
      if (!cancelled) setFetched({ wallet: walletAddress, balance: b })
    })
    return () => { cancelled = true }
  }, [walletAddress])

  const balance = walletAddress && fetched?.wallet === walletAddress ? fetched.balance : null
  const standing: HolderStanding = holderStanding(balance, tokenStats)
  const nextSquare = tokensToNextEntry(standing.balance, standing.supply, squaresAllowance, MAX_SQUARES_PER_WALLET)
  const nextLineup = tokensToNextEntry(standing.balance, standing.supply, lineupAllowance, MAX_LINEUPS)

  return (
    <section className="rounded-xl border border-white/[0.08] bg-white/[0.02]">
      <header className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-white/[0.06]">
        <h2 className="text-sm font-semibold text-white">Holder standing</h2>
        <span className="text-[11px] text-gray-500">Nothing is locked or spent</span>
      </header>

      <div className="p-5 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.14em] text-gray-500">$CSGN held</p>
            <p className="mt-1 text-2xl font-semibold font-mono tabular-nums text-white truncate">
              {standing.disconnected ? '—' : standing.balanceLabel}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.14em] text-gray-500">Share of supply</p>
            <p className="mt-1 text-2xl font-semibold font-mono tabular-nums text-white truncate">
              {standing.disconnected ? '—' : standing.shareLabel}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <Allowance
            label="Squares per board"
            value={standing.squares}
            max={standing.squaresMax}
            next={nextSquare}
          />
          <Allowance
            label="Starting 5 lineups"
            value={standing.lineups}
            max={standing.lineupsMax}
            next={nextLineup}
          />
        </div>

        {standing.disconnected && (
          <p className="flex items-start gap-2 text-xs text-gray-500 leading-relaxed">
            <Wallet className="w-4 h-4 shrink-0 mt-px text-gray-600" />
            Connect a Phantom wallet to read your balance. Everyone gets one free square
            and one free lineup either way.
          </p>
        )}
      </div>
    </section>
  )
}

function Allowance({ label, value, max, next }: { label: string; value: number; max: number; next: number | null }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-gray-300">{label}</span>
        <span className="font-mono tabular-nums text-sm text-white shrink-0">
          {value}<span className="text-gray-600"> / {max}</span>
        </span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div className="h-full rounded-full bg-primary-500/70" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 text-[11px] text-gray-500">
        {next === null
          ? 'Maxed — holding more adds no further entries.'
          : `Hold ${formatTokens(next)} more $CSGN for one more.`}
      </p>
    </div>
  )
}
