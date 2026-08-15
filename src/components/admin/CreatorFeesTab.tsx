// Creator-fee payouts, organized around the one question the admin actually has:
// "what still needs a decision from me?"
//
// Everything undecided sits at the top in full detail. The moment a slot is
// paid or declined it drops into the history ledger below, bucketed by
// day/week/month — reachable, auditable, and out of the way.
//
// The undecided half is grouped BY MEMBER, because that is how the money moves:
// SOL creator fees are still sent by hand (docs/plan-twitch-first-claim.md
// §5.3–5.5), and an admin sends one transfer covering every hour a streamer is
// owed for, not one transfer per slot. A flat list of slots made them do that
// grouping in their head, every time, against a wallet address they had to
// match by eye.
import { useState } from 'react'
import { Activity, CheckCircle2, DollarSign, Wallet, WalletMinimal, XCircle } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { HistoryLedger } from '@/components/admin/HistoryLedger'
import { airtimeLabel, airtimeNote, airtimeTone, readAirtime } from '@/lib/airtime'
import { isFeePending, type Slot } from '@/lib/slots'

interface AdminUser {
  uid: string
  walletAddress?: string
  username?: string
  displayName?: string
}

interface CreatorFeesTabProps {
  feeSlots: Slot[]
  feeSlotsLoading: boolean
  users: AdminUser[]
  /** Slot id for a per-slot action, member uid for a group payout. */
  feeActionLoading: string | null
  onEnterFees: (slot: Slot) => void
  onMarkGroupPaid: (uid: string, slots: Slot[], txSignature: string) => void
  onDecline: (slot: Slot, reason: string) => void
}

/** When the decision landed — what the history ledger buckets on. */
const decidedAt = (slot: Slot): string =>
  slot.creatorFees?.paidAt || slot.creatorFees?.declinedAt || slot.creatorFees?.updatedAt || slot.endTime

const sol = (n: number) => `${n.toFixed(6)} SOL`
const sumOwed = (slots: Slot[]) => slots.reduce((total, s) => total + (s.creatorFees?.feeOwedSOL || 0), 0)

/** Same shape the server enforces (adminMarkFeesPaid.ts) — checked here too so
 *  a typo is caught before it costs a round trip, never INSTEAD of there. */
const TX_SIGNATURE_RE = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/

interface MemberGroup {
  uid: string
  name: string
  username: string
  wallet: string
  slots: Slot[]
  owed: number
}

export function CreatorFeesTab({
  feeSlots, feeSlotsLoading, users, feeActionLoading, onEnterFees, onMarkGroupPaid, onDecline,
}: CreatorFeesTabProps) {
  // Decline reason and payout signature are both per-row/per-group — a single
  // shared input would apply one admin's note to whichever row they clicked last.
  const [decliningId, setDecliningId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [signatures, setSignatures] = useState<Record<string, string>>({})
  const [sigError, setSigError] = useState<Record<string, string>>({})

  const pending = feeSlots.filter(isFeePending)
  const decided = feeSlots.filter((s) => !isFeePending(s))
  const paid = decided.filter((s) => s.creatorFees?.paymentStatus === 'paid')
  const owed = sumOwed(pending)

  const walletFor = (slot: Slot) =>
    slot.creatorFees?.streamerWalletAddress || users.find((u) => u.uid === slot.assignedUid)?.walletAddress || ''

  // The payable axis: undecided slots that actually owe something, gathered per
  // member. Everything else undecided (a zero-fee hour) still needs a decision,
  // so it gets its own quiet list rather than vanishing.
  const payable = pending.filter((s) => (s.creatorFees?.feeOwedSOL || 0) > 0 && !s.creatorFees?.paidAt)
  const payableIds = new Set(payable.map((s) => s.id))
  const nothingOwed = pending.filter((s) => !payableIds.has(s.id))

  const groups: MemberGroup[] = [...payable
    .reduce((map, slot) => {
      const uid = slot.assignedUid || ''
      return map.set(uid, [...(map.get(uid) ?? []), slot])
    }, new Map<string, Slot[]>())]
    .map(([uid, slots]) => {
      const member = users.find((u) => u.uid === uid)
      return {
        uid,
        name: member?.displayName || slots[0].assignedName || 'Unknown member',
        username: member?.username || '',
        wallet: slots.map(walletFor).find(Boolean) || '',
        slots: slots.slice().sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()),
        owed: sumOwed(slots),
      }
    })
    // Biggest debt first — it is the one most worth getting wrong-free.
    .sort((a, b) => b.owed - a.owed)

  const held = groups.filter((g) => !g.wallet)

  const submitGroup = (group: MemberGroup) => {
    const signature = (signatures[group.uid] || '').trim()
    if (!TX_SIGNATURE_RE.test(signature)) {
      setSigError((prev) => ({ ...prev, [group.uid]: 'Paste the transaction signature from the transfer.' }))
      return
    }
    setSigError((prev) => ({ ...prev, [group.uid]: '' }))
    onMarkGroupPaid(group.uid, group.slots, signature)
    setSignatures((prev) => ({ ...prev, [group.uid]: '' }))
  }

  /** Full working view — the numbers an admin needs to actually make the call. */
  const renderPending = (slot: Slot) => {
    const fees = slot.creatorFees
    const activity = slot.streamActivity
    const liveMinutes = activity?.liveCheckCount ?? 0
    const airtime = readAirtime(fees?.airtime)
    const busy = feeActionLoading === slot.id

    return (
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-white">{slot.label}</span>
              <span className="text-xs text-gray-500">{new Date(slot.startTime).toLocaleDateString()}</span>
            </div>
            {/* The name stays on the row even inside a member group — an admin
                reading a receipt later should not have to scroll up for it. */}
            <p className="text-sm text-emerald-400 font-medium mt-0.5">{slot.assignedName}</p>
          </div>
          <div className="text-left sm:text-right shrink-0">
            <p className="text-xs text-gray-500">Owed to streamer</p>
            <p className="text-xl font-bold text-amber-300 font-mono">{fees ? sol(fees.feeOwedSOL) : '—'}</p>
            {/* Gross is kept beside it whenever airtime moved the number, so
                "why is this less than the volume implies" is answered on sight. */}
            {airtime && airtime.fraction < 1 && (
              <p className="text-[11px] text-gray-500 font-mono">of {sol(fees?.grossFeeSOL ?? 0)} gross</p>
            )}
          </div>
        </div>

        {fees ? (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {([
              ['Volume', `${fees.tradingVolumeSOL.toFixed(4)} SOL`],
              ['Tier', fees.marketCapTierLabel ?? 'n/a'],
              ['Creator fee', `${(fees.tradingVolumeSOL * (fees.creatorFeeRate ?? 0.003)).toFixed(6)} SOL`],
              ['Airtime', airtimeLabel(airtime) ?? (activity ? `~${liveMinutes}m` : 'not logged')],
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

        {airtime ? (
          <p className={`mt-2 flex items-center gap-1.5 text-xs ${airtimeTone(airtime)}`}>
            <Activity className="w-3 h-3 shrink-0" /> {airtimeNote(airtime)}
          </p>
        ) : activity && liveMinutes === 0 && (
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

  /** One member, every hour they are owed for, and the single action that
   *  settles all of it against one transaction. */
  const renderGroup = (group: MemberGroup) => {
    const busy = feeActionLoading === group.uid
    const hasWallet = Boolean(group.wallet)

    return (
      <div
        key={group.uid || group.name}
        className={`rounded-2xl border overflow-hidden ${
          hasWallet ? 'border-amber-500/30 bg-gradient-to-b from-amber-500/[0.09] to-transparent' : 'border-white/10 bg-white/[0.02] opacity-70'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 sm:px-5 py-3 border-b border-white/[0.06]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-white truncate">{group.name}</span>
              {group.username && <span className="text-xs text-gray-500">@{group.username}</span>}
              <Badge variant={hasWallet ? 'gold' : 'default'}>{group.slots.length} slot{group.slots.length !== 1 ? 's' : ''}</Badge>
            </div>
            {hasWallet ? (
              <p className="flex items-center gap-1 mt-1 text-xs text-gray-400 font-mono truncate">
                <Wallet className="w-3 h-3 shrink-0" />{group.wallet}
              </p>
            ) : (
              // The nudge list: we owe them, we cannot pay them, and the only
              // thing standing in the way is a wallet they haven't connected.
              <p className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                <WalletMinimal className="w-3 h-3 shrink-0" /> No wallet on file — {sol(group.owed)} held until they connect one
              </p>
            )}
          </div>
          <div className="text-left sm:text-right shrink-0">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Total owed</p>
            <p className={`text-lg font-bold font-mono ${hasWallet ? 'text-amber-300' : 'text-gray-400'}`}>{sol(group.owed)}</p>
          </div>
        </div>

        <div className="divide-y divide-white/[0.06]">
          {group.slots.map((slot) => <div key={slot.id}>{renderPending(slot)}</div>)}
        </div>

        {hasWallet && (
          <div className="px-4 sm:px-5 py-3 border-t border-amber-500/20 bg-black/20">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={signatures[group.uid] || ''}
                onChange={(e) => setSignatures((prev) => ({ ...prev, [group.uid]: e.target.value }))}
                placeholder="Transaction signature"
                className="flex-1 min-w-[16rem] px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white font-mono placeholder-gray-500 focus:outline-none focus:border-amber-400/50"
              />
              <Button variant="gold" size="sm" isLoading={busy} onClick={() => submitGroup(group)}>
                <CheckCircle2 className="w-3 h-3 mr-1" /> Mark {group.slots.length} paid
              </Button>
            </div>
            {sigError[group.uid] && <p className="mt-1.5 text-xs text-red-400">{sigError[group.uid]}</p>}
            <p className="mt-1.5 text-[11px] text-gray-500">
              Send the {sol(group.owed)} first, then paste the signature. It is recorded as the receipt — nothing here
              moves SOL, and the signature is not verified on-chain.
            </p>
          </div>
        )}
      </div>
    )
  }

  /** Archive view — one line per decision, expandable for the receipts. */
  const renderDecided = (slot: Slot) => {
    const fees = slot.creatorFees
    const status = fees?.paymentStatus ?? 'pending'
    const tone = status === 'paid' ? 'green' : status === 'void' ? 'default' : 'red'
    const label = status === 'void' ? 'no-show' : status
    return (
      <div className="px-4 sm:px-5 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <Badge variant={tone}>{label}</Badge>
        <span className="text-sm text-white truncate">{slot.assignedName}</span>
        <span className="text-xs text-gray-500">{slot.label}</span>
        {fees?.declineReason && <span className="text-xs text-red-400 truncate">— {fees.declineReason}</span>}
        {fees?.paidTxSignature && (
          <a
            href={`https://solscan.io/tx/${fees.paidTxSignature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-gray-500 hover:text-cyan-400 font-mono truncate max-w-[10rem]"
            title={fees.paidTxSignature}
          >
            {fees.paidTxSignature.slice(0, 8)}…
          </a>
        )}
        <span className={`ml-auto text-xs font-mono ${status === 'paid' ? 'text-emerald-400' : 'text-gray-500'}`}>
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
          ['Members owed', String(groups.length), groups.length > 0 ? 'text-amber-300' : 'text-gray-400'],
          ['Total owed', owed > 0 ? sol(owed) : '0 SOL', 'text-amber-300'],
          ['Held (no wallet)', sol(sumOwed(held.flatMap((g) => g.slots))), held.length > 0 ? 'text-gray-300' : 'text-gray-500'],
          ['Paid out', sol(sumOwed(paid)), 'text-emerald-400'],
        ] as const).map(([label, value, color]) => (
          <Card key={label} hover={false} className="p-3">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
            <p className={`mt-1 text-lg font-bold font-mono truncate ${color}`}>{value}</p>
          </Card>
        ))}
      </div>

      {/* The queue — loud on purpose, one card per member. */}
      {groups.length > 0 ? (
        <div className="space-y-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-200">
            <DollarSign className="w-4 h-4" />
            {groups.length} member{groups.length !== 1 ? 's' : ''} awaiting payment · {sol(owed)}
          </h3>
          {groups.map(renderGroup)}
        </div>
      ) : (
        <Card hover={false} className="p-6 text-center border-emerald-500/20 bg-emerald-500/[0.04]">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-sm font-semibold text-white">All caught up</p>
          <p className="text-xs text-gray-400 mt-1">Every completed slot has been paid, declined or settled at zero.</p>
        </Card>
      )}

      {/* Undecided but owing nothing. Still needs a decision, so it stays
          visible — quietly, because there is no money waiting on it. */}
      {nothingOwed.length > 0 && (
        <Card hover={false} className="overflow-hidden">
          <div className="px-4 sm:px-5 py-3 border-b border-white/[0.06]">
            <h3 className="text-sm font-semibold text-gray-300">
              No payout due <span className="text-gray-500 font-normal">({nothingOwed.length})</span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Completed hours that generated nothing to pay.</p>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {nothingOwed.map((slot) => <div key={slot.id}>{renderPending(slot)}</div>)}
          </div>
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
          const voided = items.filter((s) => s.creatorFees?.paymentStatus === 'void').length
          const declined = items.length - groupPaid.length - voided
          const parts: string[] = []
          if (groupPaid.length) parts.push(`${groupPaid.length} paid · ${sumOwed(groupPaid).toFixed(4)} SOL`)
          if (declined) parts.push(`${declined} declined`)
          if (voided) parts.push(`${voided} no-show`)
          return parts.join(' · ')
        }}
        emptyLabel="No payout decisions yet — they'll archive here by day, week, and month."
      />

      <p className="text-xs text-gray-500">
        Streamers earn 30% of pump.fun creator fees generated during their slot:
        <span className="font-mono text-cyan-400"> Volume × tier creator fee × 0.30</span>, scaled by verified airtime —
        the share of Twitch checks that found the channel live. Hours with too few checks to judge pay in full and are
        flagged here for review.
      </p>
    </div>
  )
}

export default CreatorFeesTab
