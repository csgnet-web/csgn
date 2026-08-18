import { useEffect, useRef, useState } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { Coins, ExternalLink } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { db } from '@/config/firebase'

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
}

const usd = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${Math.round(n)}`)

export default function MemeBoardCard() {
  const seeded = useRef(false)
  const [mints, setMints] = useState('')
  const [deny, setDeny] = useState('')
  const [coins, setCoins] = useState<BoardCoin[]>([])
  const [updatedAt, setUpdatedAt] = useState('')
  const [discovery, setDiscovery] = useState<{ candidates?: number; qualified?: number } | null>(null)
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
  }, () => {}), [])

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
        {msg && <span className="text-xs text-emerald-300">{msg}</span>}
        {err && <span className="text-xs text-red-300">{err}</span>}
      </div>

      <div>
        <p className={label}>On the board right now</p>
        {coins.length === 0 ? (
          <p className="text-xs text-gray-500">
            Nothing published yet. The poller builds this from live on-chain data every five minutes —
            if it stays empty, check that the function is running.
          </p>
        ) : (
          <>
            <div className="rounded-lg border border-white/[0.06] divide-y divide-white/[0.05] overflow-hidden">
              {coins.map((coin, i) => (
                <div key={coin.address} className="flex items-center gap-3 px-3 py-2">
                  <span className="w-5 text-xs font-mono text-gray-600">{i + 1}</span>
                  <span className="text-sm font-semibold text-white w-20 truncate">{coin.symbol || '—'}</span>
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
              {updatedAt && ` · updated ${new Date(updatedAt).toLocaleTimeString()}`}
            </p>
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
