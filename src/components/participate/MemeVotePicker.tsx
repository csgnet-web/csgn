import { useEffect, useMemo, useState } from 'react'
import { Search, Check, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { normalizeMemeBoard, compactUsd, memePrice, type MemeCoin } from '@/lib/games/memeBoard'

/**
 * PICK A COIN TO BACK.
 *
 * ── What this replaced, and why it was broken ──────────────────────────────
 *
 * A free-text ticker box. Two problems with it, and the second one meant the
 * feature had never worked at all:
 *
 *  1. Tickers collide. $BONK, BONK and Bonk are three strings and one coin, and
 *     a tally keyed on what somebody typed is a tally nobody can audit. This is
 *     exactly why `voteMeme.ts` casts ballots against the MINT.
 *  2. The box sent the ticker anyway. `voteMeme` requires a base58 mint address
 *     and rejects anything else with `bad_mint` — so every vote ever cast from
 *     that field was refused before it reached the tally. The parameter was
 *     even named `address` in the API client; the page just passed a symbol
 *     into it.
 *
 * So the ballot is now a CHOICE, not a string. You pick from the hundred coins
 * that are actually on the board, and the address travels with the selection.
 *
 * ── The search ─────────────────────────────────────────────────────────────
 *
 * Matches symbol, name, and contract address, because those are the three ways
 * somebody arrives knowing which coin they mean. Pasting a full CA is a
 * first-class path: that is how a coin gets shared in a group chat, and the
 * person pasting it should not have to work out what its ticker is.
 *
 * A CA that matches nothing on the board says so plainly, and says why — the
 * board is a curated set with published on-chain thresholds, and "it is not on
 * the board" is a different answer from "no such coin".
 */

const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const MAX_RESULTS = 8

export function MemeVotePicker({
  value, onChange, disabled,
}: {
  /** The selected mint address, or '' for none. */
  value: string
  onChange: (coin: { address: string; symbol: string } | null) => void
  disabled?: boolean
}) {
  const [coins, setCoins] = useState<MemeCoin[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  // A coin resolved by pasting a contract address that is not on the board.
  const [looked, setLooked] = useState<MemeCoin | null>(null)
  const [looking, setLooking] = useState(false)
  const [lookErr, setLookErr] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await api.memeBoard()
        if (!cancelled) setCoins(normalizeMemeBoard(res.coins))
      } catch {
        // An unreachable board leaves the picker empty and says so below.
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const selected = useMemo(
    () => coins.find((c) => c.address === value) ?? (looked?.address === value ? looked : null),
    [coins, value, looked],
  )

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return coins.slice(0, MAX_RESULTS)
    return coins
      .filter((c) =>
        c.symbol.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q))
      .slice(0, MAX_RESULTS)
  }, [coins, query])

  // A pasted address that matches nothing on the board is not an error — the
  // board is the pick list, not the limit. Look it up live so a member can back
  // a coin that launched this morning.
  const pastedUnknownMint = MINT_RE.test(query.trim()) && results.length === 0

  useEffect(() => {
    const address = query.trim()
    if (!MINT_RE.test(address) || coins.some((c) => c.address === address)) {
      setLooked(null); setLookErr('')
      return
    }
    let cancelled = false
    setLooking(true); setLookErr('')
    // Debounced: somebody pasting an address produces one change event, but a
    // slow paste or an edit produces several, and each is an outbound lookup.
    const t = setTimeout(() => {
      void (async () => {
        try {
          const res = await api.lookupCoin(address)
          if (!cancelled) setLooked(normalizeMemeBoard([res.coin])[0] ?? null)
        } catch (err) {
          if (!cancelled) {
            setLooked(null)
            setLookErr(err instanceof Error ? err.message : 'Could not find that coin.')
          }
        } finally {
          if (!cancelled) setLooking(false)
        }
      })()
    }, 300)
    return () => { cancelled = true; clearTimeout(t); setLooking(false) }
  }, [query, coins])

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 py-3 text-sm text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading the board…
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {selected && !open ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => { setOpen(true); setQuery('') }}
          className="w-full flex items-center gap-3 rounded-xl border border-cyan-500/40 bg-cyan-500/[0.07] px-3 py-2.5 text-left cursor-pointer hover:bg-cyan-500/[0.12] transition-colors disabled:opacity-50"
        >
          {selected.imageUrl
            ? <img src={selected.imageUrl} alt="" className="w-8 h-8 rounded-full object-cover bg-white/5 shrink-0" />
            : <span className="w-8 h-8 rounded-full bg-white/[0.06] shrink-0" />}
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-white truncate">${selected.symbol}</span>
            <span className="block text-[11px] text-gray-500 truncate">{memePrice(selected.priceUsd)} · {compactUsd(selected.volumeH24Usd)} vol</span>
          </span>
          <span className="text-[11px] text-cyan-300 shrink-0">Change</span>
        </button>
      ) : (
        <>
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 focus-within:border-cyan-500/60 transition-colors">
            <Search className="w-4 h-4 text-gray-500 shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setOpen(true)}
              disabled={disabled}
              placeholder="Search the 100 — ticker, name or contract address"
              className="flex-1 min-w-0 bg-transparent py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none"
            />
          </div>

          {coins.length === 0 ? (
            <p className="text-[11px] text-gray-600 px-1">
              The board is empty right now, so there is nothing to vote on yet.
            </p>
          ) : pastedUnknownMint ? (
            <div className="space-y-2">
              {looking && (
                <p className="flex items-center gap-2 text-[11px] text-gray-500 px-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Looking that up on-chain…
                </p>
              )}
              {looked && (
                <>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => { onChange({ address: looked.address, symbol: looked.symbol }); setOpen(false); setQuery('') }}
                    className="w-full flex items-center gap-3 rounded-xl border border-cyan-500/30 bg-cyan-500/[0.05] px-3 py-2.5 text-left hover:bg-cyan-500/[0.1] cursor-pointer touch-manipulation disabled:opacity-50"
                  >
                    {looked.imageUrl
                      ? <img src={looked.imageUrl} alt="" className="w-7 h-7 rounded-full object-cover bg-white/5 shrink-0" />
                      : <span className="w-7 h-7 rounded-full bg-white/[0.06] shrink-0" />}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-white truncate">${looked.symbol}</span>
                      <span className="block text-[10px] text-gray-500 truncate">
                        {memePrice(looked.priceUsd)} · {compactUsd(looked.volumeH24Usd)} vol
                      </span>
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-gray-600 shrink-0">Off board</span>
                  </button>
                  <p className="text-[11px] text-gray-600 px-1">
                    Not on the board yet. You can still back it — your weight counts.
                  </p>
                </>
              )}
              {lookErr && !looking && <p className="text-[11px] text-amber-300/80 px-1">{lookErr}</p>}
            </div>
          ) : results.length === 0 ? (
            <p className="text-[11px] text-gray-600 px-1">Nothing on the board matches that.</p>
          ) : (
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] divide-y divide-white/[0.05] overflow-hidden">
              {results.map((c) => (
                <button
                  key={c.address}
                  type="button"
                  disabled={disabled}
                  onClick={() => { onChange({ address: c.address, symbol: c.symbol }); setOpen(false); setQuery('') }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/[0.04] cursor-pointer touch-manipulation disabled:opacity-50"
                >
                  {c.imageUrl
                    ? <img src={c.imageUrl} alt="" className="w-7 h-7 rounded-full object-cover bg-white/5 shrink-0" />
                    : <span className="w-7 h-7 rounded-full bg-white/[0.06] shrink-0" />}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-white truncate">${c.symbol}</span>
                    <span className="block text-[10px] font-mono text-gray-600 truncate">{c.address}</span>
                  </span>
                  <span className="text-[11px] text-gray-500 shrink-0">{compactUsd(c.volumeH24Usd)}</span>
                  {c.address === value && <Check className="w-4 h-4 text-cyan-400 shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default MemeVotePicker
