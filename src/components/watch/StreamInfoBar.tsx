import { readAirtime, type AirtimeReason } from '@/lib/airtime'
import type { Slot } from '@/lib/slots'

/** The verdict, as a dot. Mirrors `airtimeTone`'s colours rather than munging
 *  its class string — a text- to bg- string replace is one Tailwind rename away
 *  from silently rendering an invisible dot. */
const AIRTIME_DOT: Record<AirtimeReason, string> = {
  full: 'bg-emerald-400',
  prorated: 'bg-amber-400',
  no_show: 'bg-red-400',
  unverified: 'bg-gray-500',
}

/**
 * WHO IS ON, IN ONE ROW.
 *
 * ── What this stopped being ────────────────────────────────────────────────
 *
 * A block: a 4xl display name, an italic title, a monospace slot label, and a
 * bordered card to the right containing the words "Live Earnings" over a 3xl
 * yellow dollar figure. Under a live video, on a phone, that is a dashboard —
 * and the largest, brightest thing on a viewer's screen was a number that means
 * nothing to a viewer, because it is the STREAMER's payout.
 *
 * The meter stays, because watching the money move while somebody is on air is
 * genuinely part of what this channel is. It is just no longer competing with
 * the picture: one line, at the size of a caption, next to the name it belongs
 * to. A streamer who wants the full working has it on /account.
 *
 * ── The rule for this row ──────────────────────────────────────────────────
 *
 * It answers "who am I watching" and nothing else. Anything that is not that
 * belongs below the fold or on another page.
 */
export default function StreamInfoBar({
  streamerName,
  streamTitle,
  slotLabel,
  currentSlot,
  stageOpen = false,
}: {
  streamerName: string
  streamTitle: string
  slotLabel: string
  currentSlot: Slot | null
  /** Nobody is programmed on this hour — headline it as an empty slate rather
   *  than shouting a name, so the row reads as "available". */
  stageOpen?: boolean
}) {
  // Already the PAYABLE number — the server applies verified airtime to
  // feeOwed* on every poll, so this meter only climbs while the channel is
  // genuinely on air.
  const liveFeeUSD = currentSlot?.creatorFees?.feeOwedUSD ?? 0
  const airtime = readAirtime(currentSlot?.creatorFees?.airtime)

  // Remounting via key replays the shake on every fee change, with no effect.
  const feePulseKey = `${currentSlot?.id ?? 'none'}:${liveFeeUSD}`

  return (
    <div className="shrink-0 flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-white/[0.06]">
      <div className="min-w-0">
        <h1
          className={`text-lg sm:text-2xl font-black font-display tracking-tight leading-none truncate ${
            stageOpen ? 'text-gray-400' : 'text-white'
          }`}
        >
          {streamerName || <span className="text-gray-600">No Stream</span>}
        </h1>
        {/* One caption line under the name, carrying whatever there is of the
            stream's own title and the hour. Both are optional; when neither
            exists the row is a single line, which is the common case. */}
        {(streamTitle || slotLabel) && (
          <p className="mt-0.5 text-[11px] sm:text-xs text-gray-500 truncate">
            {streamTitle && <span className="text-primary-300/90">{streamTitle}</span>}
            {streamTitle && slotLabel && <span className="text-gray-700"> · </span>}
            {slotLabel && <span className="font-mono text-gray-600">{slotLabel}</span>}
          </p>
        )}
      </div>

      {/* The meter, demoted to a caption. Still live, still shakes, no longer
          the loudest thing on a page whose job is to show a broadcast. The dot
          carries the airtime verdict that used to need its own line.
          HIDDEN ON AN UNPROGRAMMED HOUR. Nobody is earning during the clip
          reel, so "$0.00" there is not a meter sitting at zero — it is a number
          that means nothing, next to a name that already says so. */}
      {!stageOpen && (
        <div className="shrink-0 flex items-center gap-1.5">
          {airtime && <span className={`w-1.5 h-1.5 rounded-full ${AIRTIME_DOT[airtime.reason]}`} title={airtime.reason} />}
          <span
            key={feePulseKey}
            className={`text-sm sm:text-base font-black font-mono animate-fee-shake leading-none ${
              liveFeeUSD > 0 ? 'text-yellow-400' : 'text-gray-600'
            }`}
          >
            ${liveFeeUSD.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  )
}
