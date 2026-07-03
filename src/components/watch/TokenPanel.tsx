import { useEffect, useRef, useState } from 'react'
import { Check, Copy, ExternalLink, MessageCircle, TrendingDown, TrendingUp } from 'lucide-react'
import { useLiveSlot } from '@/contexts/useLiveSlot'
import { fetchTokenStats, type TokenStatsSnapshot } from '@/lib/dexscreener'
import { CSGN_MINT } from '@/lib/slots'
import { X_HANDLE, X_PROFILE_URL } from '@/lib/social'

const STALE_MS = 3 * 60 * 1000
const VERY_STALE_MS = 10 * 60 * 1000

function formatPrice(price: number): string {
  if (price <= 0) return '—'
  if (price >= 1) return `$${price.toFixed(2)}`
  if (price >= 0.01) return `$${price.toFixed(4)}`
  return `$${Number(price.toPrecision(3)).toFixed(Math.max(0, -Math.floor(Math.log10(price)) + 2))}`
}

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 })

function formatUsdCompact(value: number): string {
  return value > 0 ? `$${compact.format(value)}` : '—'
}

function StatTile({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500">{label}</p>
      <p className={`text-sm font-black font-mono mt-1 ${accent ?? 'text-white'}`}>{value}</p>
    </div>
  )
}

/**
 * Live $CSGN token panel — replaces the old Twitch chat sidebar.
 * Reads public/tokenStats (server-written every ~60s); falls back to a single
 * client-side DexScreener fetch only if the doc is missing or very stale.
 */
export default function TokenPanel({ broadcastUrl }: { broadcastUrl: string | null }) {
  const { tokenStats, nowMs } = useLiveSlot()
  const [fallbackStats, setFallbackStats] = useState<TokenStatsSnapshot | null>(null)
  const fallbackTriedRef = useRef(false)
  const [copied, setCopied] = useState(false)

  const serverAgeMs = tokenStats ? nowMs - Date.parse(tokenStats.updatedAt) : Infinity
  const isStale = serverAgeMs > STALE_MS
  const isVeryStale = serverAgeMs > VERY_STALE_MS

  useEffect(() => {
    if (!isVeryStale || fallbackTriedRef.current) return
    fallbackTriedRef.current = true
    void fetchTokenStats().then((snap) => { if (snap) setFallbackStats(snap) })
  }, [isVeryStale])

  const stats = !isVeryStale && tokenStats ? tokenStats : (fallbackStats ?? tokenStats)
  const change = stats?.priceChangeH24Pct ?? 0
  const changePositive = change >= 0
  const chatUrl = broadcastUrl ?? X_PROFILE_URL
  const dexUrl = stats?.pairUrl || `https://dexscreener.com/solana/${CSGN_MINT}`
  const pumpUrl = `https://pump.fun/coin/${CSGN_MINT}`

  const handleCopy = () => {
    void navigator.clipboard?.writeText(CSGN_MINT).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Price header */}
      <div className="glass-panel px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500">$CSGN</p>
            <p className="text-2xl font-black font-mono text-white mt-1">{stats ? formatPrice(stats.priceUsd) : '—'}</p>
          </div>
          {stats && (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold font-mono ${
              changePositive ? 'bg-positive/10 text-positive' : 'bg-negative/10 text-negative'
            }`}>
              {changePositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {changePositive ? '+' : ''}{change.toFixed(2)}%
            </span>
          )}
        </div>
        {isStale && stats && (
          <p className="text-[10px] text-gray-600 mt-2 uppercase tracking-wider animate-live-pulse">updating…</p>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2.5">
        <StatTile label="Market Cap" value={formatUsdCompact(stats?.marketCapUsd ?? 0)} />
        <StatTile label="24h Volume" value={formatUsdCompact(stats?.volumeH24Usd ?? 0)} />
        <StatTile label="Liquidity" value={formatUsdCompact(stats?.liquidityUsd ?? 0)} />
        <StatTile label="SOL" value={stats?.solPriceUsd ? `$${stats.solPriceUsd.toFixed(2)}` : '—'} />
      </div>

      {/* Contract address */}
      <button
        type="button"
        onClick={handleCopy}
        className="glass-panel w-full px-3.5 py-3 flex items-center gap-2.5 text-left hover:bg-white/[0.06] transition-colors cursor-pointer group"
        title="Copy contract address"
      >
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-[0.18em] text-gray-500">Contract</p>
          <p className="text-[11px] font-mono text-gray-300 truncate mt-0.5">{CSGN_MINT}</p>
        </div>
        {copied
          ? <Check className="w-4 h-4 shrink-0 text-positive" />
          : <Copy className="w-4 h-4 shrink-0 text-gray-500 group-hover:text-white transition-colors" />}
      </button>

      {/* Join the chat on X */}
      <a
        href={chatUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-2 w-full px-4 py-3 bg-white hover:bg-gray-200 text-black rounded-xl text-sm font-black uppercase tracking-wider transition-colors"
      >
        <MessageCircle className="w-4 h-4" />
        Join the chat on X
      </a>
      <p className="text-[10px] text-gray-600 text-center -mt-2">
        Chat lives in the broadcast post replies on @{X_HANDLE}
      </p>

      {/* Market links */}
      <div className="grid grid-cols-2 gap-2.5">
        <a
          href={dexUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.16] text-xs font-bold text-gray-300 hover:text-white uppercase tracking-wider transition-all"
        >
          DexScreener <ExternalLink className="w-3 h-3" />
        </a>
        <a
          href={pumpUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.16] text-xs font-bold text-gray-300 hover:text-white uppercase tracking-wider transition-all"
        >
          pump.fun <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  )
}
