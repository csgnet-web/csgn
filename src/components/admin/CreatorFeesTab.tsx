// Creator-fee payouts, organized around the one question the admin actually has:
// "what still needs a decision from me?"
//
// Everything undecided sits at the top in full detail. The moment a slot is
// paid or declined it drops into the history ledger below, bucketed by
// day/week/month — reachable, auditable, and out of the way.
import { useState } from 'react'
import { Activity, CheckCircle2, DollarSign, Wallet, XCircle } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { HistoryLedger } from '@/components/admin/HistoryLedger'
import { isFeePending, type Slot } from '@/lib/slots'

interface AdminUser {
  uid: string
  walletAddress?: string
}

interface CreatorFeesTabProps {
  feeSlots: Slot[]
  feeSlotsLoading: boolean
  users: AdminUser[]
  feeActionLoading: string | null
  onEnterFees: (slot: Slot) => void
  onMarkPaid: (slot: Slot) => void
  onDecline: (slot: Slot, reason: string) => void
}

/** When the decision landed — what the history ledger buckets on. */
const decidedAt = (slot: Slot): string =>
  slot.creatorFees?.paidAt || slot.creatorFees?.declinedAt || slot.creatorFees?.updatedAt || slot.endTime

const sol = (n: number) => `${n.toFixed(6)} SOL`
const sumOwed = (slots: Slot[]) => slots.reduce((total, s) => total + (s.creatorFees?.feeOwedSOL || 0), 0)

export function CreatorFeesTab({
  feeSlots, feeSlotsLoading, users, feeActionLoading, onEnterFees, onMarkPaid, onDecline,
}: CreatorFeesTabProps) {
  // Decline reason is per-row — a single shared input would apply one admin's
  // note to whichever row they clicked last.
  const [decliningId, setDecliningId] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  const pending = feeSlots.filter(isFeePending)
  const decided = feeSlots.filter((s) => !isFeePending(s))
  const paid = decided.filter((s) => s.creatorFees?.paymentStatus === 'paid')
  const owed = sumOwed(pending)

  const walletFor = (slot: Slot) =>
    slot.creatorFees?.streamerWalletAddress || users.find((u) => u.uid === slot.assignedUid)?.walletAddress || ''

  /** Full working view — the numbers an admin needs to actually make the call. */
  const renderPending = (slot: Slot) => {
    const fees = slot.creatorFees
    const activity = slot.streamActivity
    const liveMinutes = activity?.liveCheckCount ?? 0
    const busy = feeActionLoading === slot.id

    return (
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-white">{slot.label}</span>
              <span className="text-xs text-gray-500">{new Date(slot.startTime).toLocaleDateString()}</span>
            </div>
            <p className="text-sm text-emerald-400 font-medium mt-0.5">{slot.assignedName}</p>
            {walletFor(slot) && (
              <p className="flex items-center gap-1 mt-1 text-xs text-gray-400 font-mono truncate">
                <Wallet className="w-3 h-3 shrink-0" />{walletFor(slot)}
              </p>
            )}
          </div>
          <div className="text-left sm:text-right shrink-0">
            <p className="text-xs text-gray-500">Owed to streamer</p>
            <p className="text-xl font-bold text-amber-300 font-mono">{fees ? sol(fees.feeOwedSOL) : '—'}</p>
          </div>
        </div>

        {fees ? (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {([
              ['Volume', `${fees.tradingVolumeSOL.toFixed(4)} SOL`],
              ['Tier', fees.marketCapTierLabel ?? 'n/a'],
              ['Creator fee', `${(fees.tradingVolumeSOL * (fees.creatorFeeRate ?? 0.003)).toFixed(6)} SOL`],
              ['Live minutes', activity ? `~${liveMinutes}m` : 'not logged'],
            ] as const).map(([label, value]) => (
              <div key={label} className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2">
                <p className="text-[11px] text-gray-500">{label}</p>
                <p className="text-xs text-white font-mono truncate">{value}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-gray-500">No fee record yet — enter the numbers to make it payable.</p>
        )}

        {activity && liveMinutes === 0 && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-400">
            <Activity className="w-3 h-3" /> No live samples captured — the channel looked offline for this slot.
          </p>
        )}

        {fees?.tierFeeBreakdown && fees.tierFeeBreakdown.length > 0 && (
          <details className="mt-2">
            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300">Tier &amp; channel breakdown</summary>
            <div className="mt-1.5 space-y-1">
              {fees.tierFeeBreakdown.map((tier, idx) => (
                <p key={`${slot.id}-tier-${idx}`} className="text-xs text-gray-400">
                  {tier.marketCapRange} · Vol {tier.volumeSOL.toFixed(4)} · Creator {(tier.creatorFeeRate * 100).toFixed(3)}% · Streamer {tier.streamerFeeSOL.toFixed(6)}
                </p>
              ))}
              {(fees.activeChannels ?? []).map((channel) => (
                <p key={`${slot.id}-ch-${channel.name}`} className="text-xs text-gray-400">{channel.name} · {channel.durationMinutes}m</p>
              ))}
            </div>
          </details>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" className="text-cyan-400 hover:text-cyan-300" onClick={() => onEnterFees(slot)}>
            <DollarSign className="w-3 h-3 mr-1" />{fees ? 'Edit numbers' : 'Enter fees'}
          </Button>
          <Button variant="gold" size="sm" isLoading={busy} disabled={!fees} onClick={() => onMarkPaid(slot)}>
            <CheckCircle2 className="w-3 h-3 mr-1" /> Mark paid
          </Button>
          {decliningId === slot.id ? (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why declined?"
                className="w-44 px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-red-500/50"
              />
              <Button
                variant="ghost" size="sm" className="text-red-400 hover:text-red-300" isLoading={busy}
                onClick={() => { onDecline(slot, reason); setDecliningId(null); setReason('') }}
              >
                Confirm
              </Button>
              <Button variant="ghost" size="sm" className="text-gray-500" onClick={() => { setDecliningId(null); setReason('') }}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost" size="sm" className="text-red-400 hover:text-red-300" disabled={!fees}
              onClick={() => { setDecliningId(slot.id); setReason('') }}
            >
              <XCircle className="w-3 h-3 mr-1" /> Decline
            </Button>
          )}
        </div>
      </div>
    )
  }

  /** Archive view — one line per decision, expandable for the receipts. */
  const renderDecided = (slot: Slot) => {
    const fees = slot.creatorFees
    const isPaid = fees?.paymentStatus === 'paid'
    return (
      <div className="px-4 sm:px-5 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <Badge variant={isPaid ? 'green' : 'red'}>{isPaid ? 'paid' : 'declined'}</Badge>
        <span className="text-sm text-white truncate">{slot.assignedName}</span>
        <span className="text-xs text-gray-500">{slot.label}</span>
        {fees?.declineReason && <span className="text-xs text-red-400 truncate">— {fees.declineReason}</span>}
        <span className={`ml-auto text-xs font-mono ${isPaid ? 'text-emerald-400' : 'text-gray-500'}`}>
          {fees ? sol(fees.feeOwedSOL) : '—'}
        </span>
        <button
          onClick={() => onEnterFees(slot)}
          className="text-[11px] text-gray-500 hover:text-cyan-400 cursor-pointer underline underline-offset-2"
        >
          view
        </button>
      </div>
    )
  }

  if (feeSlotsLoading) {
    return (
      <div className="py-16 text-center">
        <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-500">Loading completed slots...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* At-a-glance: what's owed, what's cleared. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          ['Awaiting decision', String(pending.length), pending.length > 0 ? 'text-amber-300' : 'text-gray-400'],
          ['Total owed', sumOwed(pending) > 0 ? sol(owed) : '0 SOL', 'text-amber-300'],
          ['Paid out', sol(sumOwed(paid)), 'text-emerald-400'],
          ['Decisions logged', String(decided.length), 'text-gray-300'],
        ] as const).map(([label, value, color]) => (
          <Card key={label} hover={false} className="p-3">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
            <p className={`mt-1 text-lg font-bold font-mono truncate ${color}`}>{value}</p>
          </Card>
        ))}
      </div>

      {/* The queue — loud on purpose. */}
      {pending.length > 0 ? (
        <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-500/[0.09] to-transparent overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-amber-500/20">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-200">
              <DollarSign className="w-4 h-4" />
              {pending.length} payout{pending.length !== 1 ? 's' : ''} awaiting your decision
            </h3>
            <span className="text-xs text-amber-300/80 font-mono">{sol(owed)} owed</span>
          </div>
          <div className="divide-y divide-amber-500/10">
            {pending.map((slot) => <div key={slot.id}>{renderPending(slot)}</div>)}
          </div>
        </div>
      ) : (
        <Card hover={false} className="p-6 text-center border-emerald-500/20 bg-emerald-500/[0.04]">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-white">All caught up</p>
          <p className="text-xs text-gray-400 mt-1">Every completed slot has been paid or declined.</p>
        </Card>
      )}

      <HistoryLedger
        title="Payout history"
        items={decided}
        at={decidedAt}
        keyOf={(slot) => slot.id}
        renderItem={renderDecided}
        summary={(items) => {
          const groupPaid = items.filter((s) => s.creatorFees?.paymentStatus === 'paid')
          const declined = items.length - groupPaid.length
          const parts: string[] = []
          if (groupPaid.length) parts.push(`${groupPaid.length} paid · ${sumOwed(groupPaid).toFixed(4)} SOL`)
          if (declined) parts.push(`${declined} declined`)
          return parts.join(' · ')
        }}
        emptyLabel="No payout decisions yet — they'll archive here by day, week, and month."
      />

      <p className="text-xs text-gray-500">
        Streamers earn 30% of pump.fun creator fees generated during their slot:
        <span className="font-mono text-cyan-400"> Volume × tier creator fee × 0.30</span>. Fee records are created
        automatically when a slot completes, including active-channel duration.
      </p>
    </div>
  )
}

export default CreatorFeesTab
