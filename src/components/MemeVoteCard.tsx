import { useEffect, useMemo, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { Check, Copy, ExternalLink, Search, TrendingDown, TrendingUp, Vote as VoteIcon, Wallet } from 'lucide-react'
import { db } from '@/config/firebase'
import { api } from '@/lib/api'
import { proveWallet } from '@/lib/walletProof'
import { usePhantomWallet } from '@/hooks/usePhantomWallet'
import { Button } from '@/components/ui/Button'
import { Notice } from '@/components/ui/Notice'
import {
  normalizeMemeBoard, rankMemeBoard, searchBoard, shortMint, compactUsd, memePrice,
  type MemeCoin, type VoteCell,
} from '@/lib/games/memeBoard'
import { formatTokens } from '@/lib/games/profile'

/**
 * THE MEME 100 — a ranked board you pick from.
 *
 * This used to be a text input: type a ticker, press vote. You could back a coin
 * that didn't exist, three people could spell the same coin three ways, and the
 * standings were a list of bare strings with no prices and no contract
 * addresses. A ranking nobody can audit is a suggestion box.
 *
 * Every row is now a real coin with a real mint, live price, market cap, 24h
 * volume and 24h change, ordered by a published power score you can check
 * against the numbers on the card. You back one by pressing it.
 *
 * Voting power is your on-chain $CSGN balance. Nothing is spent, locked or
 * burned — re-voting just moves your full weight to a different coin.
 */
export default function MemeVoteCard() {
  const { walletAddress, connect, signMessage, isConnecting } = usePhantomWallet()
  const [coins, setCoins] = useState<MemeCoin[]>([])
  const [tallies, setTallies] = useState<Record<string, VoteCell>>({})
  const [boardReady, setBoardReady] = useState(false)
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState('')
  const [myVote, setMyVote] = useState('')

  useEffect(() => {
    return onSnapshot(doc(db, 'public', 'memeBoard'), (snap) => {
      setBoardReady(true)
      setCoins(normalizeMemeBoard(snap.exists() ? snap.data().coins : []))
    }, () => setBoardReady(true))
  }, [])

  useEffect(() => {
    return onSnapshot(doc(db, 'public', 'memeVote'), (snap) => {
      const t = snap.exists() ? (snap.data().tallies as Record<string, VoteCell> | undefined) : undefined
      setTallies(t && typeof t === 'object' ? t : {})
    }, () => {})
  }, [])

  const ranked = useMemo(() => rankMemeBoard(coins, tallies), [coins, tallies])
  const filtered = useMemo(() => searchBoard(ranked, query), [ranked, query])
  // Ten rows reads as a board without becoming a wall; search and "show all"
  // reach the rest.
  const visible = expanded || query ? filtered : filtered.slice(0, 10)
  const totalVotes = ranked.reduce((sum, c) => sum + c.votes, 0)

  const castVote = async (address: string, symbol: string) => {
    setBusy(address); setErr(''); setMsg('')
    try {
      // connect() guarantees a LIVE session; a cached address does not — it may
      // have skipped the connect step, so the signature prompt never appears.
      const addr = await connect()
      if (!addr) throw new Error('Connect your Phantom wallet to vote.')
      const proof = await proveWallet(addr, signMessage)
      const res = await api.voteMeme(proof, address)
      setMyVote(address)
      setMsg(`Backed ${symbol} with ${formatTokens(res.weight)} $CSGN. Change it whenever you like.`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not cast your vote.')
    } finally {
      setBusy(null)
    }
  }

  const copyMint = (address: string) => {
    void navigator.clipboard?.writeText(address).then(() => {
      setCopied(address)
      setTimeout(() => setCopied(''), 1600)
    })
  }

  return (
    <section className="rounded-xl border border-white/[0.08] bg-white/[0.02]">
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-white/[0.06]">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2 min-w-0">
          <VoteIcon className="w-4 h-4 shrink-0 text-gray-400" /> Meme 100
        </h2>
        <span className="text-[11px] text-gray-500">
          {totalVotes > 0 ? `${formatTokens(totalVotes)} $CSGN voting` : 'No votes cast yet'}
        </span>
      </header>

      <div className="p-4 space-y-3">
        <p className="text-xs text-gray-500 leading-relaxed">
          Back a coin with your $CSGN. Your weight is whatever your wallet holds — nothing is spent,
          locked or burned, and you can move it any time. The rank blends holder votes, 24h volume,
          market cap and how much is actually happening on the chart.
        </p>

        {msg && <Notice tone="success" compact>{msg}</Notice>}
        {err && <Notice tone="error" compact>{err}</Notice>}

        {ranked.length > 6 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, ticker or contract address"
              className="w-full pl-9 pr-3 py-2 bg-white/[0.03] border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary-500/50"
            />
          </div>
        )}

        {!boardReady && <div className="h-16 rounded-lg bg-white/[0.02] animate-pulse" />}

        {boardReady && ranked.length === 0 && (
          <p className="text-xs text-gray-500 py-4 text-center">The board is being set up. Check back shortly.</p>
        )}

        {boardReady && ranked.length > 0 && visible.length === 0 && (
          <p className="text-xs text-gray-500 py-4 text-center">No coin matches "{query}".</p>
        )}

        {visible.map((coin) => {
          const up = coin.priceChangeH24Pct >= 0
          const mine = myVote === coin.address
          return (
            <div
              key={coin.address}
              className={`rounded-lg border px-3 py-2.5 transition-colors ${
                mine ? 'border-emerald-500/35 bg-emerald-500/[0.06]' : 'border-white/[0.06] bg-white/[0.015]'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-6 shrink-0 font-mono tabular-nums text-sm font-bold text-gray-500 text-center">
                  {coin.rank}
                </span>
                {coin.imageUrl ? (
                  <img src={coin.imageUrl} alt="" className="w-8 h-8 rounded-full object-cover bg-white/[0.04] shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[10px] font-bold text-gray-500 shrink-0">
                    {coin.symbol.slice(0, 3)}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="text-sm font-semibold text-white truncate">{coin.symbol}</span>
                    <span className="text-[11px] text-gray-500 truncate">{coin.name}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-0.5 text-[11px] text-gray-500">
                    <span className="font-mono">{memePrice(coin.priceUsd)}</span>
                    {coin.priced && (
                      <span className={`inline-flex items-center gap-0.5 font-mono ${up ? 'text-positive' : 'text-negative'}`}>
                        {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {Math.abs(coin.priceChangeH24Pct).toFixed(1)}%
                      </span>
                    )}
                    <span>MC {compactUsd(coin.marketCapUsd)}</span>
                    <span className="hidden sm:inline">VOL {compactUsd(coin.volumeH24Usd)}</span>
                  </div>
                </div>

                <Button
                  variant={mine ? 'ghost' : 'secondary'}
                  size="sm"
                  className="shrink-0"
                  isLoading={busy === coin.address}
                  disabled={isConnecting || Boolean(busy)}
                  onClick={() => void castVote(coin.address, coin.symbol)}
                >
                  {mine ? 'Backed' : 'Back'}
                </Button>
              </div>

              {/* The contract address is the coin's identity, so it sits on the
                  card where a voter can check it — not behind a link. */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 pl-9 text-[11px]">
                <button
                  type="button"
                  onClick={() => copyMint(coin.address)}
                  className="inline-flex items-center gap-1 font-mono text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
                  title={coin.address}
                >
                  {shortMint(coin.address)}
                  {copied === coin.address ? <Check className="w-3 h-3 text-positive" /> : <Copy className="w-3 h-3" />}
                </button>
                <a
                  href={coin.pairUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Chart <ExternalLink className="w-3 h-3" />
                </a>
                {coin.votes > 0 && (
                  <span className="text-gray-500">
                    {formatTokens(coin.votes)} $CSGN · {(coin.voteShare * 100).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          )
        })}

        {!query && filtered.length > 10 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="w-full text-xs text-gray-500 hover:text-gray-300 py-1.5 transition-colors cursor-pointer"
          >
            {expanded ? 'Show less' : `Show all ${filtered.length}`}
          </button>
        )}

        {!walletAddress && ranked.length > 0 && (
          <p className="flex items-center gap-1.5 text-[11px] text-gray-600">
            <Wallet className="w-3 h-3 shrink-0" />
            Connect Phantom when you back a coin. We read your balance — we never move it.
          </p>
        )}
      </div>
    </section>
  )
}
