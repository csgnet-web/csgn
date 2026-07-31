import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { Vote as VoteIcon, Wallet, Check, AlertCircle } from 'lucide-react'
import { db } from '@/config/firebase'
import { api } from '@/lib/api'
import { proveWallet } from '@/lib/walletProof'
import { usePhantomWallet } from '@/hooks/usePhantomWallet'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

// Self-contained Meme-100 vote widget so holders can cast / change their
// token-weighted vote from anywhere (Holder Zone, profile, …). Voting power =
// on-chain $CSGN balance; one ballot per wallet, re-voting moves the full weight.
// The ticker blends these votes with each coin's volume + market cap + social
// buzz into the on-air power ranking.
interface Cell { tokens: number; wallets: number }

const fmtToken = (n: number): string =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(Math.round(n))

export default function MemeVoteCard() {
  const { walletAddress, connect, signMessage, isConnecting } = usePhantomWallet()
  const [symbol, setSymbol] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [tallies, setTallies] = useState<Record<string, Cell>>({})

  useEffect(() => {
    return onSnapshot(doc(db, 'public', 'memeVote'), (snap) => {
      const t = snap.exists() ? (snap.data().tallies as Record<string, Cell> | undefined) : undefined
      setTallies(t && typeof t === 'object' ? t : {})
    }, () => {})
  }, [])

  const ranked = Object.entries(tallies)
    .map(([sym, c]) => ({ sym, tokens: c?.tokens || 0, wallets: c?.wallets || 0 }))
    .filter((r) => r.tokens > 0)
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 5)

  const doVote = async () => {
    setErr(null); setMsg(null)
    const sym = symbol.trim().toUpperCase()
    if (!/^[A-Z0-9$]{2,12}$/.test(sym)) { setErr('Enter a valid ticker symbol (2–12 characters).'); return }
    setBusy(true)
    try {
      // connect() guarantees a LIVE session; a cached address does not (it
      // skipped the connect step and the signature prompt never appeared).
      const addr = await connect()
      if (!addr) throw new Error('Connect your Phantom wallet to vote.')
      const proof = await proveWallet(addr, signMessage)
      const res = await api.voteMeme(proof, sym)
      setMsg(`Vote counted — ${fmtToken(res.weight)} $CSGN of power behind $${sym}. Change it anytime.`)
      setSymbol('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Meme vote failed.')
    }
    setBusy(false)
  }

  return (
    <Card hover={false} className="p-5 space-y-3">
      <h3 className="text-white font-semibold flex items-center gap-2"><VoteIcon className="w-4 h-4 text-cyan-400" /> Vote the Meme 100</h3>
      <p className="text-sm text-gray-400">Back a memecoin with your <span className="text-cyan-300 font-semibold">$CSGN voting power</span> — no burn, no stake. The board blends your vote with each coin’s volume, market cap and social buzz and airs the ranking. Change your vote anytime.</p>

      {ranked.length > 0 && (
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-3 space-y-1.5">
          {ranked.map((r, i) => (
            <div key={r.sym} className="flex items-center justify-between text-sm">
              <span className="text-gray-300"><span className="text-gray-500 font-mono mr-2">{i + 1}</span>${r.sym}</span>
              <span className="font-mono text-gray-400" title={`${Math.round(r.tokens).toLocaleString('en-US')} $CSGN · ${r.wallets} wallets`}>{fmtToken(r.tokens)} · {r.wallets}w</span>
            </div>
          ))}
        </div>
      )}

      {!walletAddress ? (
        <Button onClick={() => void connect()} isLoading={isConnecting} leftIcon={<Wallet className="w-4 h-4" />}>Connect Phantom to vote</Button>
      ) : (
        <div className="flex gap-2">
          <input value={symbol} onChange={(e) => setSymbol(e.target.value.slice(0, 12))} placeholder="Memecoin ticker — e.g. WIF" className="flex-1 rounded-xl bg-white/[0.04] border border-white/[0.1] focus:border-cyan-500/60 outline-none px-3 py-2 text-sm uppercase" />
          <Button size="sm" isLoading={busy} onClick={() => void doVote()} leftIcon={<VoteIcon className="w-4 h-4" />}>Cast vote</Button>
        </div>
      )}
      {msg && <p className="text-sm text-emerald-400 flex items-center gap-1.5"><Check className="w-4 h-4" /> {msg}</p>}
      {err && <p className="text-sm text-red-400 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> {err}</p>}
    </Card>
  )
}
