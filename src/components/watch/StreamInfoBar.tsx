import { Radio } from 'lucide-react'
import type { Slot } from '@/lib/slots'

/**
 * Streamer name / title / slot label row with live earnings readout and the
 * inline "Take this slot" claim button. Pure presentation — claim state and
 * handlers live in Watch.
 */
export default function StreamInfoBar({
  streamerName,
  streamTitle,
  slotLabel,
  currentSlot,
  canClaimCurrent,
  claiming,
  claimError,
  onClaimCurrent,
  stageOpen = false,
}: {
  streamerName: string
  streamTitle: string
  slotLabel: string
  currentSlot: Slot | null
  canClaimCurrent: boolean
  claiming: boolean
  claimError: string
  onClaimCurrent: () => void
  /** Nobody is programmed on this hour — headline it as an empty slate (muted
   *  gray) rather than shouting a name, so the row reads as "available". */
  stageOpen?: boolean
}) {
  const liveFeeSOL = currentSlot?.creatorFees?.feeOwedSOL ?? 0
  const liveFeeUSD = currentSlot?.creatorFees?.feeOwedUSD ?? 0
  const liveVolumeSOL = currentSlot?.creatorFees?.tradingVolumeSOL ?? 0
  const liveShareRate = currentSlot?.creatorFees?.streamerShareRate ?? (liveVolumeSOL > 0 ? liveFeeSOL / liveVolumeSOL : 0)

  // Remounting the <p> via key replays the shake animation on every fee change
  // without effect-driven state.
  const feePulseKey = `${currentSlot?.id ?? 'none'}:${liveFeeUSD}`

  return (
    <div className="shrink-0 flex items-start justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-white/[0.06]">
      <div className="min-w-0">
        {/* An unprogrammed hour reads as a muted blank slate; a booked one is
            headlined in white. Same element, different weight of voice. */}
        <h1
          className={`text-2xl sm:text-4xl font-black font-display tracking-tight leading-none truncate ${
            stageOpen ? 'text-gray-500' : 'text-white'
          }`}
        >
          {streamerName || <span className="text-gray-600">No Stream</span>}
        </h1>
        {streamTitle && (
          <p className="text-sm text-primary-300 font-medium mt-0.5 italic truncate">"{streamTitle}"</p>
        )}
        <p className="text-xs sm:text-sm text-gray-500 mt-1 font-mono">{slotLabel}</p>
        {canClaimCurrent && (
          <div className="mt-2 flex flex-col gap-1 items-start">
            <button
              type="button"
              onClick={onClaimCurrent}
              disabled={claiming}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 rounded-md text-[11px] font-bold text-emerald-200 uppercase tracking-wide whitespace-nowrap transition-colors disabled:opacity-60 disabled:cursor-wait cursor-pointer"
            >
              <Radio className="w-3 h-3 shrink-0" />
              {claiming ? 'Claiming…' : 'Go live now'}
            </button>
            {claimError && <span className="text-[11px] text-red-300">{claimError}</span>}
          </div>
        )}
      </div>
      <div className="shrink-0 text-right rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500 mb-0.5">Live Earnings</p>
        {/* Always a real number — an empty hour reads $0.00 / 0.00 SOL, never a
            dash, so the readout looks like a live meter sitting at zero. */}
        <p key={feePulseKey} className="text-2xl sm:text-3xl font-black font-mono text-yellow-400 animate-fee-shake leading-none">
          ${liveFeeUSD.toFixed(2)}
        </p>
        <p className="text-[11px] font-mono text-gray-400 mt-1">
          {liveFeeSOL > 0 ? liveFeeSOL.toFixed(4) : '0.00'} SOL
        </p>
        {liveVolumeSOL > 0 && (
          <p className="text-[10px] text-gray-600 mt-0.5">
            {liveVolumeSOL.toFixed(1)} vol · {(liveShareRate * 100).toFixed(2)}%
          </p>
        )}
      </div>
    </div>
  )
}
