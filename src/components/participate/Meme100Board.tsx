import { useEffect, useMemo, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { ChevronLeft, ChevronRight, ExternalLink, Info } from 'lucide-react'
import { db } from '@/config/firebase'
import { Card } from '@/components/ui/Card'
import {
  normalizeMemeBoard, rankMemeBoard, compactUsd, memePrice, POWER_WEIGHTS,
  type MemeCoin, type RankedMemeCoin, type VoteCell,
} from '@/lib/games/memeBoard'

/**
 * THE MEME 100 — the board itself, readable by anybody.
 *
 * Three decisions, all pointed at the same thing: this is a recruiting surface,
 * so it has to work for someone who has never signed in.
 *
 *  1. PUBLIC. It reads `public/memeBoard` and `public/memeVote`, both of which
 *     are world-readable by ID. A visitor sees the real board — not a teaser,
 *     and not a sign-in wall over the one thing worth looking at.
 *  2. TEN AT A TIME. A hundred rows is a scroll nobody finishes; ten is a page
 *     you read. Arrows rather than infinite scroll, because an endless list and
 *     a bottom tab bar fight each other on a phone.
 *  3. A SCORE, AND WHY. Every row carries 0–100, and opening one shows the four
 *     weighted terms behind it. A ranking whose formula is invisible is a
 *     ranking people assume is rigged.
 */

const PAGE_SIZE = 10

const TERMS: Array<{ key: keyof RankedMemeCoin['breakdown']; label: string; hint: string; weight: number }> = [
  { key: 'votes', label: 'Holder votes', hint: '$CSGN weight behind it', weight: POWER_WEIGHTS.votes },
  { key: 'volume', label: '24h volume', hint: 'what actually traded', weight: POWER_WEIGHTS.volume },
  { key: 'marketCap', label: 'Market cap', hint: 'how big it is', weight: POWER_WEIGHTS.marketCap },
  { key: 'buzz', label: 'Buzz', hint: 'turnover + how far it moved', weight: POWER_WEIGHTS.buzz },
]

/** Score colour, so the number registers before it is read. */
function scoreTone(score: number): string {
  if (score >= 60) return 'text-live'
  if (score >= 30) return 'text-gold'
  return 'text-gray-400'
}

export default function Meme100Board() {
  const [raw, setRaw] = useState<MemeCoin[]>([])
  const [votes, setVotes] = useState<Record<string, VoteCell>>({})
  const [page, setPage] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => onSnapshot(
    doc(db, 'public', 'memeBoard'),
    (snap) => { setRaw(normalizeMemeBoard(snap.exists() ? snap.data()?.coins : [])); setLoading(false) },
    () => setLoading(false),
  ), [])

  useEffect(() => onSnapshot(
    doc(db, 'public', 'memeVote'),
    (snap) => {
      const t = snap.exists() ? snap.data()?.tallies : null
      setVotes(t && typeof t === 'object' ? (t as Record<string, VoteCell>) : {})
    },
    () => {},
  ), [])

  const coins = useMemo(() => rankMemeBoard(raw, votes), [raw, votes])

  const pageCount = Math.max(1, Math.ceil(coins.length / PAGE_SIZE))
  // Clamped rather than stored: the board rebuilds every few minutes and can get
  // shorter underneath a reader who has paged to the end.
  const safePage = Math.min(page, pageCount - 1)
  const shown = useMemo(
    () => coins.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [coins, safePage],
  )

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-2 min-w-0">
          <h2 className="text-lg font-display font-bold uppercase tracking-wide">Meme 100</h2>
          <span className="text-[10px] uppercase tracking-wider text-gray-500 shrink-0">Live on-chain</span>
        </div>
        {coins.length > PAGE_SIZE && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setPage(Math.max(0, safePage - 1))}
              disabled={safePage === 0}
              aria-label="Previous ten"
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-gray-400 hover:text-white hover:bg-white/[0.07] disabled:opacity-25 cursor-pointer touch-manipulation"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 text-xs font-mono text-gray-500 tabular-nums whitespace-nowrap">
              {safePage * PAGE_SIZE + 1}–{Math.min(coins.length, (safePage + 1) * PAGE_SIZE)}
              <span className="text-gray-700"> / {coins.length}</span>
            </span>
            <button
              type="button"
              onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))}
              disabled={safePage >= pageCount - 1}
              aria-label="Next ten"
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-gray-400 hover:text-white hover:bg-white/[0.07] disabled:opacity-25 cursor-pointer touch-manipulation"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <Card hover={false} className="overflow-hidden">
        {loading ? (
          <div className="p-10 text-center"><div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : coins.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-gray-300 font-medium">The board is building</p>
            <p className="mt-1 text-xs text-gray-500">
              It's assembled from what's actually trading on Solana and refreshes every few minutes.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.05]">
            {shown.map((coin) => {
              const open = openId === coin.address
              return (
                <div key={coin.address}>
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : coin.address)}
                    aria-expanded={open}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] cursor-pointer touch-manipulation"
                  >
                    <span className="w-6 shrink-0 font-mono text-xs text-gray-600 tabular-nums">{coin.rank}</span>

                    {coin.imageUrl ? (
                      <img
                        src={coin.imageUrl}
                        alt=""
                        loading="lazy"
                        className="w-8 h-8 rounded-full shrink-0 bg-white/5 object-cover"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
                      />
                    ) : (
                      <span className="w-8 h-8 rounded-full shrink-0 bg-white/[0.06]" />
                    )}

                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-white truncate">${coin.symbol}</span>
                      <span className="block text-[11px] text-gray-500 truncate">
                        {memePrice(coin.priceUsd)} · {compactUsd(coin.volumeH24Usd)} vol
                      </span>
                    </span>

                    <span className="shrink-0 text-right">
                      <span className={`block text-xl font-black font-mono tabular-nums leading-none ${scoreTone(coin.score)}`}>
                        {coin.score}
                      </span>
                      <span className="block text-[9px] uppercase tracking-wider text-gray-600 mt-0.5">score</span>
                    </span>
                  </button>

                  {/* WHY it is there. Behind a tap so the list stays scannable,
                      but never more than one tap away. */}
                  {open && (
                    <div className="px-4 pb-4 pt-1 bg-white/[0.015]">
                      <div className="space-y-1.5">
                        {TERMS.map((term) => {
                          const value = coin.breakdown[term.key]
                          const max = Math.round(term.weight * 100)
                          return (
                            <div key={term.key}>
                              <div className="flex items-baseline justify-between gap-2 text-[11px]">
                                <span className="text-gray-300">{term.label}</span>
                                <span className="font-mono text-gray-500 tabular-nums">{value} / {max}</span>
                              </div>
                              <div className="mt-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-primary-500/70"
                                  style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%` }}
                                />
                              </div>
                              <p className="mt-0.5 text-[10px] text-gray-600">{term.hint}</p>
                            </div>
                          )
                        })}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px]">
                        <span className="text-gray-500">Cap {compactUsd(coin.marketCapUsd)}</span>
                        <span className="text-gray-500">24h {coin.priceChangeH24Pct >= 0 ? '+' : ''}{coin.priceChangeH24Pct.toFixed(1)}%</span>
                        <a
                          href={coin.pairUrl || `https://dexscreener.com/solana/${coin.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
                        >
                          Chart <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <p className="mt-2 font-mono text-[10px] text-gray-700 break-all">{coin.address}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      <p className="flex items-start gap-1.5 text-[11px] text-gray-600 leading-relaxed">
        <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
        <span>
          Score is out of 100: holder votes {Math.round(POWER_WEIGHTS.votes * 100)},
          volume {Math.round(POWER_WEIGHTS.volume * 100)},
          market cap {Math.round(POWER_WEIGHTS.marketCap * 100)},
          buzz {Math.round(POWER_WEIGHTS.buzz * 100)}. Tap a coin for its breakdown. Coins are
          discovered from live Solana trading, not from a list anyone types.
        </span>
      </p>
    </section>
  )
}
