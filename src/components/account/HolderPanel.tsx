import { useEffect, useState } from 'react'
import { Wallet } from 'lucide-react'
import { useLiveSlot } from '@/contexts/useLiveSlot'
import { fetchCsgnBalance } from '@/lib/csgnBalance'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/config/firebase'
import { holderStanding, formatTokens, type HolderStanding } from '@/lib/holdings'
import { normalizeTokenGates, DEFAULT_TOKEN_GATES } from '@/lib/tokenGates'

/**
 * What the bag entitles you to.
 *
 * The whole no-deposit thesis, made concrete on one card: your balance is never
 * spent, locked or burned — it only decides how far your voice carries. Showing
 * "3,400,000 more $CSGN to put a line on the broadcast" is the most motivating
 * line this page can carry, and it's honest: nothing is being asked of the
 * holder except to hold.
 *
 * Every gate named here is a PROMOTION gate, never an access gate — an account,
 * a slot and going live are free and stay free (master-plan.md §5). Read the
 * live threshold from config/tokenGates rather than a constant, so the card and
 * the server that enforces it can never drift.
 */
export default function HolderPanel({ walletAddress }: { walletAddress?: string }) {
  const { tokenStats } = useLiveSlot()
  // The fetched balance is stored WITH the wallet it belongs to, and the
  // rendered balance is derived by matching the two. That keeps the effect
  // write-only (no setState on the synchronous path) and, more usefully, means
  // switching wallets shows "—" until the new balance lands rather than briefly
  // attributing the previous wallet's bag to the new one.
  // `balance: null` means WE COULD NOT READ IT, which is not zero. Keeping the
  // distinction in state is what lets the panel say so instead of showing a
  // holder a zero that reads as an accusation about their own wallet.
  const [fetched, setFetched] = useState<{ wallet: string; balance: number | null } | null>(null)
  const [rightNowMin, setRightNowMin] = useState(DEFAULT_TOKEN_GATES.rightNowMinCsgn)

  useEffect(() => onSnapshot(
    doc(db, 'config', 'tokenGates'),
    (snap) => setRightNowMin(normalizeTokenGates(snap.data()).rightNowMinCsgn),
    () => setRightNowMin(DEFAULT_TOKEN_GATES.rightNowMinCsgn),
  ), [])

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
  const rightNowShort = Math.max(0, rightNowMin - standing.balance)

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

        <Gate
          label="Right Now rail"
          note="Put your own line on the broadcast ticker."
          unlocked={!standing.disconnected && rightNowShort === 0}
          short={standing.disconnected ? null : rightNowShort}
        />

        {standing.disconnected && (
          <p className="flex items-start gap-2 text-xs text-gray-500 leading-relaxed">
            <Wallet className="w-4 h-4 shrink-0 mt-px text-gray-600" />
            Connect a Phantom wallet to read your balance. Watching, posting clips and
            going live never require one.
          </p>
        )}
      </div>
    </section>
  )
}

/** One promotion gate: what it is, and exactly how far away it is. `short` is
 *  null when there's no wallet to measure against — an unknown distance, which
 *  is different from a large one and must not read as a rejection. */
function Gate({ label, note, unlocked, short }: { label: string; note: string; unlocked: boolean; short: number | null }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-gray-300">{label}</span>
        <span className={`text-xs font-semibold shrink-0 ${unlocked ? 'text-emerald-400' : 'text-gray-500'}`}>
          {unlocked ? 'Unlocked' : 'Locked'}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-gray-500 leading-relaxed">{note}</p>
      {!unlocked && short !== null && short > 0 && (
        <p className="mt-1.5 text-[11px] text-primary-300">
          Hold {formatTokens(short)} more $CSGN to unlock.
        </p>
      )}
    </div>
  )
}
