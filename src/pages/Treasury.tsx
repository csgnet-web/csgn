import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Copy, ExternalLink, Landmark, Flame, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { useLiveSlot } from '@/contexts/useLiveSlot'
import {
  TREASURY_ADDRESS,
  TREASURY_SOLSCAN_URL,
  TREASURY_RULES,
  fetchTreasuryBalances,
  type TreasuryBalances,
} from '@/lib/treasury'
import { compact } from '@/lib/format'

const usd = (n: number) => `$${compact(n)}`

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="glass-panel px-5 py-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">{label}</p>
      <p className="text-2xl sm:text-3xl font-black font-mono text-white mt-1 tabular-nums">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function Treasury() {
  const { tokenStats } = useLiveSlot()
  const [balances, setBalances] = useState<TreasuryBalances>({ sol: null, csgn: null })
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchTreasuryBalances()
      .then((b) => { if (!cancelled) setBalances(b) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const copy = () => {
    void navigator.clipboard?.writeText(TREASURY_ADDRESS).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    })
  }

  const solPrice = tokenStats?.solPriceUsd ?? 0
  const csgnPrice = tokenStats?.priceUsd ?? 0
  const solUsd = balances.sol != null && solPrice > 0 ? balances.sol * solPrice : null
  const csgnUsd = balances.csgn != null && csgnPrice > 0 ? balances.csgn * csgnPrice : null
  const totalUsd = (solUsd ?? 0) + (csgnUsd ?? 0)

  const dash = loading ? '…' : '—'

  return (
    <div className="min-h-screen pt-24 lg:pt-32 pb-24">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero */}
        <div className="text-center mb-14">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Badge variant="blue" className="mb-6">The Treasury</Badge>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-black font-display tracking-tight text-white mb-5"
          >
            We don't burn. <span className="text-gradient">We publish.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-gray-400 leading-relaxed max-w-2xl mx-auto"
          >
            Everything the network earns goes to one public address under published rules.
            A burn is a press release you can only do once. A rule-bound public treasury is a
            balance sheet — the same "supply won't dump on you" promise, kept while the capital
            stays productive.
          </motion.p>
        </div>

        {/* Live balances */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Landmark className="w-5 h-5 text-primary-400" />
            <h2 className="text-sm font-black tracking-[0.2em] uppercase text-gray-400">Live On-Chain Balance</h2>
            <span className={`ml-1 w-1.5 h-1.5 rounded-full ${loading ? 'bg-gray-600' : 'bg-positive animate-pulse'}`} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Stat
              label="SOL"
              value={balances.sol != null ? balances.sol.toLocaleString('en-US', { maximumFractionDigits: 2 }) : dash}
              sub={solUsd != null ? usd(solUsd) : 'USD —'}
            />
            <Stat
              label="$CSGN"
              value={balances.csgn != null ? compact(balances.csgn) : dash}
              sub={csgnUsd != null ? usd(csgnUsd) : 'USD —'}
            />
            <Stat
              label="Total (est. USD)"
              value={totalUsd > 0 ? usd(totalUsd) : dash}
              sub="SOL + $CSGN at live price"
            />
          </div>
        </div>

        {/* Address */}
        <div className="glass-panel px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 mb-16">
          <span className="text-[10px] uppercase tracking-[0.18em] text-gray-500 shrink-0">Treasury Address</span>
          <button
            type="button"
            onClick={copy}
            title="Copy treasury address"
            className="min-w-0 inline-flex items-center gap-2 text-left cursor-pointer group"
          >
            <span className="text-[11px] sm:text-xs font-mono text-gray-300 truncate">{TREASURY_ADDRESS}</span>
            {copied
              ? <Check className="w-3.5 h-3.5 shrink-0 text-positive" />
              : <Copy className="w-3.5 h-3.5 shrink-0 text-gray-500 group-hover:text-white transition-colors" />}
          </button>
          <a
            href={TREASURY_SOLSCAN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="sm:ml-auto shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-primary-300 hover:text-primary-200 transition-colors"
          >
            View on Solscan <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* The rules */}
        <div className="flex items-center gap-2 mb-5">
          <ShieldCheck className="w-5 h-5 text-primary-400" />
          <h2 className="text-sm font-black tracking-[0.2em] uppercase text-gray-400">The Rules, Published Up Front</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-16">
          {TREASURY_RULES.map((rule, i) => (
            <motion.div
              key={rule.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="glass-panel p-5"
            >
              <h3 className="text-white font-display font-bold text-lg mb-1.5">{rule.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{rule.body}</p>
            </motion.div>
          ))}
        </div>

        {/* Why not burn */}
        <div className="glass-panel p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-3">
            <Flame className="w-5 h-5 text-primary-400" />
            <h2 className="text-lg font-display font-bold text-white">Why we don't burn $CSGN</h2>
          </div>
          <p className="text-sm text-gray-400 leading-relaxed">
            A burn buys exactly one thing: proof that supply won't come back to hit the market. It
            buys that by destroying capital, permanently, once. We buy the same credibility a better
            way — a public address anyone can watch, a stated hold window, a published drip cap, and a
            stated purpose. The reassurance is identical; the capital stays working for creators,
            distribution, and liquidity instead of going up in smoke. That's a stronger answer to
            "why don't you burn," not a weaker one.
          </p>
        </div>
      </div>
    </div>
  )
}
