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
}: {
  streamerName: string
  streamTitle: string
  slotLabel: string
  currentSlot: Slot | null
  canClaimCurrent: boolean
  claiming: boolean
  claimError: string
  onClaimCurrent: () => void
}) {
  const liveFeeSOL = currentSlot?.creatorFees?.feeOwedSOL ?? 0
  const liveFeeUSD = currentSlot?.creatorFees?.feeOwedUSD ?? 0
  const liveVolumeSOL = currentSlot?.creatorFees?.tradingVolumeSOL ?? 0
  const liveShareRate = currentSlot?.creatorFees?.streamerShareRate ?? (liveVolumeSOL > 0 ? liveFeeSOL / liveVolumeSOL : 0)

  // Remounting the <p> via key replays the shake animation on every fee change
  // without effect-driven state.
  const feePulseKey = `${currentSlot?.id ?? 'none'}:${liveFeeUSD}`

  return (
    <div className="shrink-0 flex items-start justify-between px-5 py-4 border-b border-white/[0.06]">
      <div>
        <h1 className="text-3xl sm:text-4xl font-black font-display text-white tracking-tight leading-none">
          {streamerName || <span className="text-gray-600">No Stream</span>}
        </h1>
        {streamTitle && (
          <p className="text-sm text-primary-300 font-medium mt-0.5 italic">"{streamTitle}"</p>
        )}
        <p className="text-sm text-gray-400 mt-1 font-mono">{slotLabel}</p>
        {canClaimCurrent && (
          <div className="mt-3 flex flex-col gap-1">
            <button
              type="button"
              onClick={onClaimCurrent}
              disabled={claiming}
              className="inline-flex items-center justify-center gap-2 px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/40 rounded-lg text-xs font-bold text-emerald-200 uppercase tracking-wider transition-colors disabled:opacity-60 disabled:cursor-wait cursor-pointer"
            >
              <Radio className="w-3.5 h-3.5" />
              {claiming ? 'Claiming…' : 'Take this slot'}
            </button>
            {claimError && <span className="text-[11px] text-red-300">{claimError}</span>}
          </div>
        )}
      </div>
      <div className="text-right">
        {currentSlot ? (
          <>
            <p key={feePulseKey} className="text-2xl sm:text-3xl font-black font-mono text-yellow-400 animate-fee-shake">
              {liveFeeUSD > 0 ? `$${liveFeeUSD.toFixed(2)}` : '—'}
            </p>
            <p className="text-[11px] text-gray-500 uppercase tracking-wider mt-0.5">
              {liveVolumeSOL > 0
                ? `${liveFeeSOL.toFixed(6)} SOL · ${liveVolumeSOL.toFixed(2)} SOL vol · ${(liveShareRate * 100).toFixed(3)}%`
                : 'Live Earnings'}
            </p>
            {currentSlot.creatorFees?.marketCapTierLabel && (
              <p className="text-[11px] text-gray-600 mt-0.5">{currentSlot.creatorFees.marketCapTierLabel}</p>
            )}
          </>
        ) : (
          <>
            <p className="text-2xl sm:text-3xl font-black font-mono text-gray-600">—</p>
            <p className="text-[11px] text-gray-500 uppercase tracking-wider mt-0.5">Earnings</p>
          </>
        )}
      </div>
    </div>
  )
}
