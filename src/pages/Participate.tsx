import { useCallback, useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { motion } from 'framer-motion'
import { Wallet, Megaphone, Check, Trophy, AlertCircle, Vote as VoteIcon, Flame } from 'lucide-react'
import { db } from '@/config/firebase'
import { api } from '@/lib/api'
import { proveWallet } from '@/lib/walletProof'
import { paySpotlight } from '@/lib/spotlightPay'
import { fetchCsgnBalance, CSGN_RIGHT_NOW_MIN } from '@/lib/csgnBalance'
import { usePhantomWallet } from '@/hooks/usePhantomWallet'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface VoteCfg { id: string; question: string; options: string[]; startISO?: string; status?: string }
interface Cell { tokens: number; wallets: number }
type Tally = Record<string, Cell>

const RN_MAX = 90

const fmtToken = (n: number): string =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(Math.round(n))
const fmtFull = (n: number): string => Math.round(n).toLocaleString('en-US')

export default function Participate() {
  const { walletAddress, connect, signMessage, isConnecting, balance: solBalance } = usePhantomWallet()
  const [balanceState, setBalanceState] = useState<number | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(false)

  const [vote, setVote] = useState<VoteCfg | null>(null)
  const [tallyState, setTallyState] = useState<{ id: string; tally: Tally }>({ id: '', tally: {} })
  const [busyOption, setBusyOption] = useState<number | null>(null)
  const [voteMsg, setVoteMsg] = useState<string | null>(null)
  const [voteErr, setVoteErr] = useState<string | null>(null)

  const [rnText, setRnText] = useState('')
  const [rnBusy, setRnBusy] = useState(false)
  const [rnMsg, setRnMsg] = useState<string | null>(null)
  const [rnErr, setRnErr] = useState<string | null>(null)

  // Coin Jukebox — pay SOL to spotlight a coin (TouchTunes-style)
  const [spotSol, setSpotSol] = useState(0.1)
  const [spotSymbol, setSpotSymbol] = useState('')
  const [spotPair, setSpotPair] = useState('')
  const [spotNote, setSpotNote] = useState('')
  const [spotBusy, setSpotBusy] = useState(false)
  const [spotMsg, setSpotMsg] = useState<string | null>(null)
  const [spotErr, setSpotErr] = useState<string | null>(null)

  // Meme-100 community vote (token-weighted, no burn)
  const [memeSymbol, setMemeSymbol] = useState('')
  const [memeBusy, setMemeBusy] = useState(false)
  const [memeMsg, setMemeMsg] = useState<string | null>(null)
  const [memeErr, setMemeErr] = useState<string | null>(null)
  const [memeTallies, setMemeTallies] = useState<Record<string, Cell>>({})

  // Current vote (config/ticker.vote)
  useEffect(() => {
    return onSnapshot(doc(db, 'config', 'ticker'), (snap) => {
      const data = snap.exists() ? snap.data() : {}
      const sol = Number(data.spotlightSol)
      if (sol > 0) setSpotSol(sol)
      const v = data.vote as Record<string, unknown> | undefined
      setVote(
        v && v.id && Array.isArray(v.options)
          ? { id: String(v.id), question: String(v.question || 'Tonight’s vote'), options: (v.options as unknown[]).map(String), startISO: v.startISO ? String(v.startISO) : undefined, status: v.status ? String(v.status) : 'open' }
          : null,
      )
    })
  }, [])

  // Live meme-100 community tally (world-readable public/memeVote).
  useEffect(() => {
    return onSnapshot(doc(db, 'public', 'memeVote'), (snap) => {
      const t = snap.exists() ? (snap.data().tallies as Record<string, Cell> | undefined) : undefined
      setMemeTallies(t && typeof t === 'object' ? t : {})
    }, () => {})
  }, [])

  // Live tally for the current vote — derived so switching votes needs no
  // synchronous reset (keeps setState out of the effect body).
  useEffect(() => {
    if (!vote?.id) return
    const id = vote.id
    return onSnapshot(doc(db, 'votes', id), (snap) => setTallyState({ id, tally: snap.exists() ? ((snap.data().tally as Tally) || {}) : {} }))
  }, [vote?.id])
  const tally: Tally = tallyState.id === vote?.id ? tallyState.tally : {}

  // Client-side balance (UI gating only; server re-checks authoritatively).
  const loadBalance = useCallback((addr: string) => {
    setBalanceLoading(true)
    fetchCsgnBalance(addr).then(setBalanceState).finally(() => setBalanceLoading(false))
  }, [])
  useEffect(() => {
    if (!walletAddress) return
    let cancelled = false
    void (async () => {
      setBalanceLoading(true)
      const b = await fetchCsgnBalance(walletAddress)
      if (!cancelled) { setBalanceState(b); setBalanceLoading(false) }
    })()
    return () => { cancelled = true }
  }, [walletAddress])
  const balance = walletAddress ? balanceState : null

  const ensureWallet = useCallback(async (): Promise<string> => {
    const addr = walletAddress || (await connect())
    if (!addr) throw new Error('Connect your Phantom wallet to continue.')
    return addr
  }, [walletAddress, connect])

  const doVote = async (option: number) => {
    if (!vote || vote.status === 'closed') return
    setVoteErr(null); setVoteMsg(null); setBusyOption(option)
    try {
      const addr = await ensureWallet()
      const proof = await proveWallet(addr, signMessage)
      const res = await api.castVote(proof, vote.id, option)
      setVoteMsg(`Vote counted — ${fmtToken(res.weight)} $CSGN behind “${vote.options[option]}”.`)
      loadBalance(addr)
    } catch (e) {
      setVoteErr(e instanceof Error ? e.message : 'Vote failed.')
    }
    setBusyOption(null)
  }

  const doSubmit = async () => {
    setRnErr(null); setRnMsg(null)
    const text = rnText.trim()
    if (text.length < 3) { setRnErr('Write a slightly longer message.'); return }
    setRnBusy(true)
    try {
      const addr = await ensureWallet()
      const proof = await proveWallet(addr, signMessage)
      await api.submitRightNow(proof, text)
      setRnMsg('You’re on the rail — it airs on the ticker within seconds.')
      setRnText('')
    } catch (e) {
      setRnErr(e instanceof Error ? e.message : 'Submission failed.')
    }
    setRnBusy(false)
  }

  // A pasted DexScreener URL → its pair address; otherwise use the value as-is.
  const extractPair = (raw: string): string => {
    const t = raw.trim()
    const m = t.match(/dexscreener\.com\/[^/]+\/([A-Za-z0-9]+)/)
    return m ? m[1] : t
  }
  const doSpotlight = async () => {
    setSpotErr(null); setSpotMsg(null)
    const symbol = spotSymbol.trim().toUpperCase()
    if (!/^[A-Z0-9$]{2,12}$/.test(symbol)) { setSpotErr('Enter a valid ticker symbol (2–12 characters).'); return }
    setSpotBusy(true)
    try {
      const addr = await ensureWallet()
      // Prove the wallet first so a later-rejected payment wastes no on-chain action.
      const proof = await proveWallet(addr, signMessage)
      // Pay SOL to the treasury (Phantom prompts + signs), then redeem the signature.
      const signature = await paySpotlight(addr, spotSol)
      const res = await api.jukeboxSpotlight(proof, signature, {
        symbol,
        dexPair: extractPair(spotPair) || undefined,
        note: spotNote.trim() || undefined,
      })
      setSpotMsg(`🎶 Paid ${res.sol} SOL — ${symbol} rises in the broadcast spotlight within a minute.`)
      setSpotSymbol(''); setSpotPair(''); setSpotNote('')
    } catch (e) {
      setSpotErr(e instanceof Error ? e.message : 'Spotlight failed.')
    }
    setSpotBusy(false)
  }
  const canBurnSpotlight = solBalance != null && solBalance >= spotSol

  const doVoteMeme = async () => {
    setMemeErr(null); setMemeMsg(null)
    const symbol = memeSymbol.trim().toUpperCase()
    if (!/^[A-Z0-9$]{2,12}$/.test(symbol)) { setMemeErr('Enter a valid ticker symbol (2–12 characters).'); return }
    setMemeBusy(true)
    try {
      const addr = await ensureWallet()
      const proof = await proveWallet(addr, signMessage)
      const res = await api.voteMeme(proof, symbol)
      setMemeMsg(`Vote counted — ${fmtToken(res.weight)} $CSGN of power behind $${symbol}.`)
      setMemeSymbol('')
      loadBalance(addr)
    } catch (e) {
      setMemeErr(e instanceof Error ? e.message : 'Meme vote failed.')
    }
    setMemeBusy(false)
  }
  // Community power ranking (by token weight); the ticker blends this with each
  // coin's live volume + market cap for the on-air pick.
  const memeRanked = Object.entries(memeTallies)
    .map(([sym, c]) => ({ sym, tokens: c?.tokens || 0, wallets: c?.wallets || 0 }))
    .filter((r) => r.tokens > 0)
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, 5)

  const options = vote?.options ?? []
  const cells = options.map((_, i) => tally[String(i)] || { tokens: 0, wallets: 0 })
  const totalTokens = cells.reduce((s, c) => s + c.tokens, 0)
  const totalWallets = cells.reduce((s, c) => s + c.wallets, 0)
  const leadIdx = cells.length ? cells.reduce((best, c, i) => (c.tokens > cells[best].tokens ? i : best), 0) : -1
  const hasVotes = totalTokens > 0
  const closed = vote?.status === 'closed'
  const canPostRightNow = balance != null && balance >= CSGN_RIGHT_NOW_MIN

  return (
    <motion.main
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8"
    >
      <header className="space-y-2">
        <h1 className="text-3xl sm:text-4xl font-display font-black uppercase tracking-tight">Holder Zone</h1>
        <p className="text-gray-400 text-sm sm:text-base">
          Your $CSGN is your voice. Vote tonight’s programming — weighted by the tokens you hold — and, at{' '}
          {fmtFull(CSGN_RIGHT_NOW_MIN)} $CSGN, put your own message on the live broadcast ticker.
        </p>
      </header>

      {/* Wallet status */}
      <Card hover={false} className="p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Wallet className="w-5 h-5 text-primary-400 shrink-0" />
          {walletAddress ? (
            <div className="min-w-0">
              <p className="text-xs text-gray-500">Connected</p>
              <p className="font-mono text-sm truncate">{walletAddress.slice(0, 4)}…{walletAddress.slice(-4)}</p>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Connect Phantom to vote or post to the ticker.</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {walletAddress && (
            <div className="text-right">
              <p className="text-xs text-gray-500">$CSGN balance</p>
              <p className="font-mono text-sm text-primary-300">{balanceLoading ? '…' : balance != null ? fmtFull(balance) : '—'}</p>
            </div>
          )}
          {!walletAddress && (
            <Button size="sm" onClick={() => void connect()} isLoading={isConnecting} leftIcon={<Wallet className="w-4 h-4" />}>
              Connect Phantom
            </Button>
          )}
        </div>
      </Card>

      {/* Vote */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <VoteIcon className="w-5 h-5 text-sky-400" />
          <h2 className="text-lg font-display font-bold uppercase tracking-wide">Tonight’s Vote</h2>
          {closed && <span className="text-xs font-bold uppercase text-red-400 border border-red-500/40 rounded px-2 py-0.5">Closed</span>}
        </div>

        {!vote ? (
          <Card hover={false} className="p-6 text-center text-gray-500 text-sm">No vote is live right now — check back before tonight’s show.</Card>
        ) : (
          <Card hover={false} className="p-5 space-y-4">
            <p className="text-xl font-display font-bold">{vote.question}</p>

            <div className="space-y-3">
              {options.map((opt, i) => {
                const c = cells[i]
                const pct = totalTokens > 0 ? (c.tokens / totalTokens) * 100 : 0
                const leading = hasVotes && i === leadIdx
                return (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        {leading && <Trophy className="w-4 h-4 text-amber-400 shrink-0" />}
                        <span className={`font-semibold truncate ${leading ? 'text-amber-300' : 'text-white'}`}>{opt}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`font-mono font-bold ${leading ? 'text-amber-300' : 'text-white'}`} title={`${fmtFull(c.tokens)} $CSGN`}>{fmtToken(c.tokens)}</span>
                        <span className="text-gray-500 text-xs ml-1">$CSGN</span>
                        <span className="text-gray-500 text-xs ml-2">· {c.wallets} {c.wallets === 1 ? 'wallet' : 'wallets'}</span>
                      </div>
                    </div>
                    <div className="h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${leading ? 'bg-gradient-to-r from-amber-500 to-yellow-400' : 'bg-gradient-to-r from-primary-600 to-primary-400'}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                    <Button
                      variant={leading ? 'gold' : 'secondary'}
                      size="sm"
                      className="w-full"
                      disabled={closed}
                      isLoading={busyOption === i}
                      onClick={() => void doVote(i)}
                    >
                      Vote with my $CSGN
                    </Button>
                  </div>
                )
              })}
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t border-white/[0.06]">
              <span>{fmtFull(totalTokens)} $CSGN cast · {totalWallets} {totalWallets === 1 ? 'wallet' : 'wallets'}</span>
              <span>Winner decided by tokens — one ballot per wallet, re-vote to move your weight.</span>
            </div>

            {voteMsg && <p className="text-sm text-emerald-400 flex items-center gap-1.5"><Check className="w-4 h-4" /> {voteMsg}</p>}
            {voteErr && <p className="text-sm text-red-400 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> {voteErr}</p>}
          </Card>
        )}
      </section>

      {/* Right Now submission */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-primary-400" />
          <h2 className="text-lg font-display font-bold uppercase tracking-wide">Get on the Ticker</h2>
        </div>
        <Card hover={false} className="p-5 space-y-3">
          <p className="text-sm text-gray-400">
            Hold at least <span className="text-primary-300 font-semibold">{fmtFull(CSGN_RIGHT_NOW_MIN)} $CSGN</span> to push one message to the live{' '}
            <span className="text-primary-300 font-semibold">RIGHT NOW</span> rail — once per day, kept clean for air.
          </p>

          {!walletAddress ? (
            <Button onClick={() => void connect()} isLoading={isConnecting} leftIcon={<Wallet className="w-4 h-4" />}>Connect Phantom to check eligibility</Button>
          ) : !canPostRightNow ? (
            <div className="flex items-start gap-2 text-sm text-amber-300/90 bg-amber-500/[0.06] border border-amber-500/20 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                You hold {balance != null ? fmtFull(balance) : '—'} $CSGN. You need {fmtFull(CSGN_RIGHT_NOW_MIN)} to post to the rail.
              </span>
            </div>
          ) : (
            <>
              <textarea
                value={rnText}
                onChange={(e) => setRnText(e.target.value.slice(0, RN_MAX))}
                maxLength={RN_MAX}
                rows={2}
                placeholder="Your message on the CSGN broadcast…"
                className="w-full rounded-xl bg-white/[0.04] border border-white/[0.1] focus:border-primary-500/60 outline-none px-3 py-2 text-sm resize-none"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{rnText.length}/{RN_MAX} · profanity-filtered · 1 per day</span>
                <Button size="sm" isLoading={rnBusy} onClick={() => void doSubmit()} leftIcon={<Megaphone className="w-4 h-4" />}>Push to RIGHT NOW</Button>
              </div>
            </>
          )}

          {rnMsg && <p className="text-sm text-emerald-400 flex items-center gap-1.5"><Check className="w-4 h-4" /> {rnMsg}</p>}
          {rnErr && <p className="text-sm text-red-400 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> {rnErr}</p>}
        </Card>
      </section>

      {/* Coin Jukebox — pay SOL to spotlight your coin (TouchTunes-style) */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-display font-bold uppercase tracking-wide">Coin Jukebox</h2>
        </div>
        <Card hover={false} className="p-5 space-y-3">
          <p className="text-sm text-gray-400">
            Pay <span className="text-amber-300 font-semibold">{spotSol} SOL</span> to play your coin into the broadcast’s{' '}
            <span className="text-amber-300 font-semibold">crypto spotlight</span> — like a jukebox for crypto TV. It rises on air within a minute, and the SOL goes to the <span className="text-amber-300 font-semibold">CSGN treasury</span> (creator payouts + distribution).
          </p>

          {!walletAddress ? (
            <Button onClick={() => void connect()} isLoading={isConnecting} leftIcon={<Wallet className="w-4 h-4" />}>Connect Phantom to play a coin</Button>
          ) : !canBurnSpotlight ? (
            <div className="flex items-start gap-2 text-sm text-amber-300/90 bg-amber-500/[0.06] border border-amber-500/20 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>You have {solBalance != null ? solBalance.toFixed(3) : '—'} SOL. You need {spotSol} SOL to play a spotlight.</span>
            </div>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 gap-2">
                <input value={spotSymbol} onChange={(e) => setSpotSymbol(e.target.value.slice(0, 12))} placeholder="Ticker symbol — e.g. BONK" className="w-full rounded-xl bg-white/[0.04] border border-white/[0.1] focus:border-amber-500/60 outline-none px-3 py-2 text-sm uppercase" />
                <input value={spotPair} onChange={(e) => setSpotPair(e.target.value)} placeholder="DexScreener URL or pair (optional)" className="w-full rounded-xl bg-white/[0.04] border border-white/[0.1] focus:border-amber-500/60 outline-none px-3 py-2 text-sm" />
              </div>
              <input value={spotNote} onChange={(e) => setSpotNote(e.target.value.slice(0, 90))} placeholder="Spotlight note (optional) — shown under the price" className="w-full rounded-xl bg-white/[0.04] border border-white/[0.1] focus:border-amber-500/60 outline-none px-3 py-2 text-sm" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Pays {spotSol} SOL · you sign in Phantom · goes to the CSGN treasury</span>
                <Button size="sm" variant="gold" isLoading={spotBusy} onClick={() => void doSpotlight()} leftIcon={<Flame className="w-4 h-4" />}>Play to Spotlight</Button>
              </div>
            </>
          )}

          {spotMsg && <p className="text-sm text-emerald-400 flex items-center gap-1.5"><Check className="w-4 h-4" /> {spotMsg}</p>}
          {spotErr && <p className="text-sm text-red-400 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> {spotErr}</p>}
        </Card>
      </section>

      {/* Meme-100 community vote (token-weighted, no burn) */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <VoteIcon className="w-5 h-5 text-cyan-400" />
          <h2 className="text-lg font-display font-bold uppercase tracking-wide">Vote the Meme 100</h2>
        </div>
        <Card hover={false} className="p-5 space-y-3">
          <p className="text-sm text-gray-400">
            Back a memecoin with your <span className="text-cyan-300 font-semibold">$CSGN voting power</span> — no burn, no stake, nothing leaves your wallet. Your weight = your balance. The board blends the community vote with each coin’s live <span className="text-cyan-300 font-semibold">volume + market cap</span> and airs the pick.
          </p>

          {memeRanked.length > 0 && (
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-3 space-y-1.5">
              {memeRanked.map((r, i) => (
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
              <input value={memeSymbol} onChange={(e) => setMemeSymbol(e.target.value.slice(0, 12))} placeholder="Memecoin ticker — e.g. WIF" className="flex-1 rounded-xl bg-white/[0.04] border border-white/[0.1] focus:border-cyan-500/60 outline-none px-3 py-2 text-sm uppercase" />
              <Button size="sm" isLoading={memeBusy} onClick={() => void doVoteMeme()} leftIcon={<VoteIcon className="w-4 h-4" />}>Cast vote</Button>
            </div>
          )}
          <p className="text-xs text-gray-500">One vote per wallet — re-voting moves your full weight. {balance != null && `Your power: ${fmtFull(balance)} $CSGN.`}</p>

          {memeMsg && <p className="text-sm text-emerald-400 flex items-center gap-1.5"><Check className="w-4 h-4" /> {memeMsg}</p>}
          {memeErr && <p className="text-sm text-red-400 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> {memeErr}</p>}
        </Card>
      </section>
    </motion.main>
  )
}
