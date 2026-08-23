import { useEffect, useRef, useState } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { Coins, ExternalLink } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { db } from '@/config/firebase'
import { api } from '@/lib/api'

/**
 * MEME 100 — what's on the board, and the two levers over it.
 *
 * The board itself is DISCOVERED, not curated: the poller pulls candidates from
 * what is actually trading on Solana, applies hard on-chain thresholds
 * (liquidity, 24h volume, pair age), and ranks what survives by real volume.
 * That ranking is the product's claim to being worth watching, so there is
 * deliberately no control here that sets a coin's POSITION. If a coin belongs at
 * the top, the volume puts it there; a hand-placed number one would make the
 * whole board a matter of opinion wearing a chart's clothes.
 *
 * The two levers that DO exist, and what each is honestly for:
 *
 *   PINNED — always considered, thresholds bypassed. This is how $CSGN stays on
 *   its own board on a quiet day, and how a coin the discovery feeds have not
 *   noticed yet gets a look. It does NOT set rank: a pinned coin with no volume
 *   still ranks last.
 *
 *   DENIED — never shown, whatever the numbers say. "It cleared the thresholds"
 *   and "we are happy to put it on television" are different questions.
 */

const SOLANA_MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

interface BoardCoin {
  address: string
  symbol: string
  volumeH24Usd: number
  liquidityUsd: number
  marketCapUsd: number
  /** Set when this row was HELD from an earlier build because the latest one
   *  came back thin. Stale data presented as live would be trading one lie for
   *  another, so it is marked here and on the public board. */
  carriedFrom?: string
}

const usd = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${Math.round(n)}`)

export default function MemeBoardCard() {
  const seeded = useRef(false)
  const [mints, setMints] = useState('')
  const [deny, setDeny] = useState('')
  const [coins, setCoins] = useState<BoardCoin[]>([])
  const [updatedAt, setUpdatedAt] = useState('')
  // Per-source counts from the last build. When the board is thin this is the
  // first thing to look at — it says WHICH provider went quiet, which took
  // three rounds of guessing to learn the hard way.
  const [sources, setSources] = useState<Array<{ source: string; found: number; contributed: number; ok: boolean; note?: string }>>([])
  const [rebuilding, setRebuilding] = useState(false)
  const [discovery, setDiscovery] = useState<{
    candidates?: number
    qualified?: number
    unresolved?: number
    unpriced?: number
    /** Rows held over from a previous build because this one came back thin.
     *  A full board with a high carry count is the failure that would
     *  otherwise be completely invisible — see topUpBoard. */
    carried?: number
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => onSnapshot(doc(db, 'config', 'memeBoard'), (snap) => {
    if (seeded.current) return
    seeded.current = true
    const d = snap.exists() ? snap.data() : {}
    setMints((Array.isArray(d.mints) ? d.mints : []).join('\n'))
    setDeny((Array.isArray(d.deny) ? d.deny : []).join('\n'))
  }, () => {}), [])

  useEffect(() => onSnapshot(doc(db, 'public', 'memeBoard'), (snap) => {
    const d = snap.exists() ? snap.data() : {}
    setCoins(Array.isArray(d.coins) ? (d.coins as BoardCoin[]).slice(0, 12) : [])
    setUpdatedAt(typeof d.updatedAt === 'string' ? d.updatedAt : '')
    setDiscovery(d.discovery ?? null)
    setSources(Array.isArray(d.sources) ? d.sources : [])
  }, () => {}), [])

  /**
   * Force a rebuild.
   *
   * The board is otherwise cut every five minutes by the poller, which means a
   * change to the sources or the thresholds took five minutes to evaluate —
   * long enough that debugging it turned into guesswork. This re-cuts on
   * demand and the source table above updates with it.
   */
  const rebuild = async () => {
    setRebuilding(true); setErr(''); setMsg('')
    try {
      const res = await api.memeBoard(true)
      setMsg(`Rebuilt — ${res.coins.length} coins on the board.`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Rebuild failed.')
    }
    setRebuilding(false)
  }

  const save = async () => {
    setBusy(true); setErr(''); setMsg('')
    const clean = (text: string) => text.split('\n').map((l) => l.trim()).filter(Boolean)
    const badMint = [...clean(mints), ...clean(deny)].find((m) => !SOLANA_MINT_RE.test(m))
    if (badMint) {
      setErr(`Not a Solana mint address: ${badMint.slice(0, 24)}…`)
      setBusy(false)
      return
    }
    try {
      await setDoc(doc(db, 'config', 'memeBoard'), {
        mints: clean(mints).slice(0, 40),
        deny: clean(deny).slice(0, 200),
        updatedAt: new Date().toISOString(),
      }, { merge: true })
      setMsg('Saved — the board picks this up on its next refresh (within 5 minutes).')
      setTimeout(() => setMsg(''), 4000)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed.')
    }
    setBusy(false)
  }

  const field = 'w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white font-mono placeholder-gray-600 focus:outline-none focus:border-primary-500/50'
  const label = 'block text-[11px] uppercase tracking-[0.14em] text-gray-500 mb-1.5'

  return (
    <Card hover={false} className="p-5 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Coins className="w-4 h-4 text-primary-400" /> Meme 100
        </h3>
        <div className="flex items-center gap-3">
          {msg && <span className="text-xs text-emerald-300">{msg}</span>}
          {err && <span className="text-xs text-red-300">{err}</span>}
          <Button size="sm" variant="secondary" isLoading={rebuilding} onClick={() => void rebuild()}>
            Rebuild now
          </Button>
        </div>
      </div>

      {/* ── WHERE THE COINS CAME FROM ──
          The board is the union of several independent sources; any one of
          them failing costs its coins and nothing else. This is how you tell
          "the thresholds are strict" apart from "Jupiter is down", which are
          the two explanations for a thin board and look identical without it. */}
      {sources.length > 0 && (
        <div>
          <p className={label}>Sources, last build</p>
          <div className="rounded-lg border border-white/[0.06] divide-y divide-white/[0.05] overflow-hidden">
            {sources.map((src) => (
              <div key={src.source} className="flex items-center gap-3 px-3 py-2 text-xs">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${src.ok ? 'bg-live' : 'bg-primary-500'}`} />
                <span className="font-mono text-gray-300 flex-1 truncate">{src.source}</span>
                <span className="font-mono text-gray-500 tabular-nums">{src.found} found</span>
                <span className="font-mono text-white tabular-nums w-16 text-right">+{src.contributed}</span>
                {src.note && <span className="text-primary-300/70 truncate max-w-[160px]">{src.note}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className={label}>On the board right now ({coins.length})</p>
        {coins.length === 0 ? (
          <p className="text-xs text-gray-500">
            Nothing published yet. Press Rebuild now — the source list above will say which
            provider answered and which did not.
          </p>
        ) : (
          <>
            <div className="rounded-lg border border-white/[0.06] divide-y divide-white/[0.05] overflow-hidden">
              {coins.map((coin, i) => (
                <div key={coin.address} className="flex items-center gap-3 px-3 py-2">
                  <span className="w-5 text-xs font-mono text-gray-600">{i + 1}</span>
                  <span className="text-sm font-semibold text-white w-20 truncate">{coin.symbol || '—'}</span>
                  {coin.carriedFrom && (
                    <span className="text-[9px] uppercase tracking-wider text-gold shrink-0" title={`Held from ${new Date(String(coin.carriedFrom)).toLocaleString()} — this build did not re-read it`}>
                      held
                    </span>
                  )}
                  <span className="text-xs font-mono text-gray-400">{usd(coin.volumeH24Usd)} vol</span>
                  <span className="text-xs font-mono text-gray-600 hidden sm:inline">{usd(coin.liquidityUsd)} liq</span>
                  <a
                    href={`https://dexscreener.com/solana/${coin.address}`}
                    target="_blank" rel="noopener noreferrer"
                    className="ml-auto text-gray-600 hover:text-cyan-400"
                    title={coin.address}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-gray-600">
              Ranked by real 24h volume{discovery?.candidates ? ` · ${discovery.qualified} of ${discovery.candidates} candidates cleared the thresholds` : ''}
              {discovery?.unresolved ? ` · ${discovery.unresolved} had no readable pair` : ''}
              {updatedAt && ` · updated ${new Date(updatedAt).toLocaleTimeString()}`}
            </p>
            {/* THE WARNING THAT MATTERS. A full board built from mostly held
                rows looks perfect and is not — the feeds are down and the only
                reason the page is not showing three coins is the carry-over.
                Without this line that state is invisible for up to a day. */}
            {(discovery?.carried ?? 0) > 0 && (
              <p className="mt-1 text-[11px] text-gold">
                {discovery!.carried} of these were held from the previous build — this run only
                found {discovery?.qualified ?? 0} fresh. The sources above say which provider
                stopped answering. Run <span className="font-mono">npm run meme:probe</span> locally
                for the full picture.
              </p>
            )}
          </>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="mb-pinned">Pinned mints — one per line</label>
          <textarea id="mb-pinned" rows={4} className={field} value={mints} onChange={(e) => setMints(e.target.value)} placeholder="Always considered, thresholds bypassed" />
          <p className="mt-1 text-[11px] text-gray-600 leading-relaxed">
            Guarantees a coin is <em>looked at</em>, never that it ranks. Volume decides position.
          </p>
        </div>
        <div>
          <label className={label} htmlFor="mb-deny">Denied mints — one per line</label>
          <textarea id="mb-deny" rows={4} className={field} value={deny} onChange={(e) => setDeny(e.target.value)} placeholder="Never shown, whatever the numbers say" />
          <p className="mt-1 text-[11px] text-gray-600 leading-relaxed">
            For coins that clear the thresholds but should not be on television.
          </p>
        </div>
      </div>

      <Button variant="primary" size="sm" isLoading={busy} onClick={() => void save()}>Save board settings</Button>
    </Card>
  )
}
