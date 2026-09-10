import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { doc, onSnapshot } from 'firebase/firestore'
import { motion } from 'framer-motion'
import { Wallet, Megaphone, Check, Trophy, AlertCircle, Vote as VoteIcon, Flame, Coins } from 'lucide-react'
import { db } from '@/config/firebase'
import { api } from '@/lib/api'
import { proveWallet } from '@/lib/walletProof'
import { paySpotlightCsgn } from '@/lib/spotlightPay'
import { fetchCsgnBalance } from '@/lib/csgnBalance'
import { DEFAULT_TOKEN_GATES, normalizeTokenGates } from '@/lib/tokenGates'
import { usePhantomWallet } from '@/hooks/usePhantomWallet'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import Meme100Board from '@/components/participate/Meme100Board'
import { SignInWall } from '@/components/auth/SignInWall'
import MemeVotePicker from '@/components/participate/MemeVotePicker'
import { useAuth } from '@/contexts/useAuth'
import { usePageMeta } from '@/hooks/usePageMeta'

interface VoteCfg { id: string; question: string; options: string[]; startISO?: string; status?: string }

/** `public/jukebox`, exactly as jukeboxSpotlight publishes it. Nothing here
 *  decides the price — the auction rule lives in
 *  netlify/functions/_shared/jukebox.ts and the server re-derives it on every
 *  bid. This is the stored verdict, read for display. */
interface JukeboxWinner { symbol: string; bidCsgn: number; wonAt: string; wallet: string }
interface JukeboxDoc {
  symbol: string
  bidCsgn: number
  bidAt: string | null
  expiresAt: string | null
  nextBidCsgn: number
  baseFloorCsgn: number
  history: JukeboxWinner[]
}
const JUKEBOX_BASE_FLOOR_CSGN = 250_000
/** Mirrors JUKEBOX_TTL_MS in netlify/functions/_shared/jukebox.ts. Display only
 *  — the server decides when a bid actually expires; this just sizes the bar. */
const JUKEBOX_TTL_MS = 12 * 60 * 60 * 1000

/** A countdown, in the units somebody actually reads at each scale. Hours and
 *  minutes far out, minutes and seconds in the last hour — because "11h 04m" is
 *  what you want at the start of a reign and "04:12" is what you want at the
 *  end, when the auction is about to reopen. */
function countdown(msLeft: number): string {
  const total = Math.max(0, Math.floor(msLeft / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${m}:${String(sec).padStart(2, '0')}`
}
interface Cell { tokens: number; wallets: number }
type Tally = Record<string, Cell>

const RN_MAX = 90

const fmtToken = (n: number): string =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(Math.round(n))
const fmtFull = (n: number): string => Math.round(n).toLocaleString('en-US')

export default function Participate() {
  usePageMeta({
    title: '$CSGN — The Meme 100, Votes and the Coin Jukebox',
    description: "Back a memecoin on the Meme 100 with your $CSGN, vote on tonight's programming, and bid for the broadcast coin spotlight. Your weight is simply your on-chain balance.",
    path: '/participate',
  })

  const { user, loading: authLoading } = useAuth()
  const { walletAddress, connect, signMessage, isConnecting } = usePhantomWallet()
  const [balanceState, setBalanceState] = useState<number | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(false)

  // The Right Now threshold is server-owned (config/tokenGates) so the number on
  // screen is always the number the server will actually enforce.
  const [rightNowMin, setRightNowMin] = useState(DEFAULT_TOKEN_GATES.rightNowMinCsgn)
  useEffect(() => {
    return onSnapshot(doc(db, 'config', 'tokenGates'), (snap) => {
      setRightNowMin(normalizeTokenGates(snap.exists() ? snap.data() : null).rightNowMinCsgn)
    }, () => {})
  }, [])

  // A bid expires while somebody is looking at the page, so "is it still live"
  // has to be state that ticks, not a Date.now() read during render — that is
  // both impure and, worse, a screen that never notices the auction reopened.
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    // One second, because the jukebox panel shows a live countdown and a clock
    // that only moves every thirty seconds reads as broken. One setState a
    // second on a page this size costs nothing measurable.
    const t = setInterval(() => setNowMs(Date.now()), 1_000)
    return () => clearInterval(t)
  }, [])

  const [vote, setVote] = useState<VoteCfg | null>(null)
  const [tallyState, setTallyState] = useState<{ id: string; tally: Tally }>({ id: '', tally: {} })
  const [busyOption, setBusyOption] = useState<number | null>(null)
  const [voteMsg, setVoteMsg] = useState<string | null>(null)
  const [voteErr, setVoteErr] = useState<string | null>(null)

  const [rnText, setRnText] = useState('')
  const [rnBusy, setRnBusy] = useState(false)
  const [rnMsg, setRnMsg] = useState<string | null>(null)
  const [rnErr, setRnErr] = useState<string | null>(null)

  // Coin Jukebox — an open $CSGN auction for the broadcast spotlight.
  const [jukebox, setJukebox] = useState<JukeboxDoc | null>(null)
  const [spotBid, setSpotBid] = useState<number | null>(null)
  // The coin being bid for, as a CHOSEN mint — same picker the vote uses, so
  // any Solana contract address works and the ticker is read off the chain
  // rather than typed. A typed ticker put a string on television that resolved
  // to nothing.
  const [spotPick, setSpotPick] = useState<{ address: string; symbol: string } | null>(null)
  const [spotNote, setSpotNote] = useState('')
  const [spotBusy, setSpotBusy] = useState(false)
  const [spotMsg, setSpotMsg] = useState<string | null>(null)
  const [spotErr, setSpotErr] = useState<string | null>(null)

  // The standing bid, published to its own world-readable doc by
  // jukeboxSpotlight so this page never has to read admin-only config/ticker.
  useEffect(() => {
    return onSnapshot(doc(db, 'public', 'jukebox'), (snap) => {
      const d = snap.exists() ? snap.data() : null
      setJukebox(d ? {
        symbol: String(d.symbol || ''),
        bidCsgn: Number(d.bidCsgn) || 0,
        bidAt: d.bidAt ? String(d.bidAt) : null,
        expiresAt: d.expiresAt ? String(d.expiresAt) : null,
        nextBidCsgn: Number(d.nextBidCsgn) || 0,
        baseFloorCsgn: Number(d.baseFloorCsgn) || JUKEBOX_BASE_FLOOR_CSGN,
        history: Array.isArray(d.history) ? (d.history as JukeboxWinner[]) : [],
      } : null)
    }, () => {})
  }, [])


  // Meme-100 community vote (token-weighted, no burn). The ballot is a CHOSEN
  // coin, carrying its mint — never a typed ticker. See MemeVotePicker.
  const [memePick, setMemePick] = useState<{ address: string; symbol: string } | null>(null)
  const [memeBusy, setMemeBusy] = useState(false)
  const [memeMsg, setMemeMsg] = useState<string | null>(null)
  const [memeErr, setMemeErr] = useState<string | null>(null)

  // Current vote (config/ticker.vote)
  useEffect(() => {
    return onSnapshot(doc(db, 'config', 'ticker'), (snap) => {
      const data = snap.exists() ? snap.data() : {}
      const v = data.vote as Record<string, unknown> | undefined
      setVote(
        v && v.id && Array.isArray(v.options)
          ? { id: String(v.id), question: String(v.question || 'Tonight’s vote'), options: (v.options as unknown[]).map(String), startISO: v.startISO ? String(v.startISO) : undefined, status: v.status ? String(v.status) : 'open' }
          : null,
      )
    })
  }, [])

  // public/memeVote is subscribed to inside Meme100Board, which is the only
  // thing that reads the tallies now. One listener, one ranking.

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
    // connect() guarantees a LIVE session; a cached address does not (it
    // skipped the connect step and the signature prompt never appeared).
    const addr = await connect()
    if (!addr) throw new Error('Connect your Phantom wallet to continue.')
    return addr
  }, [connect])

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

  const doSpotlight = async () => {
    setSpotErr(null); setSpotMsg(null)
    if (!spotPick) { setSpotErr('Pick a coin, or paste its contract address.'); return }
    const bid = Math.floor(spotBid ?? minBid)
    if (!(bid >= minBid)) { setSpotErr(`The next bid has to be at least ${fmtFull(minBid)} $CSGN.`); return }
    setSpotBusy(true)
    try {
      const addr = await ensureWallet()
      // Prove the wallet first so a later-rejected bid wastes no on-chain action.
      const proof = await proveWallet(addr, signMessage)
      // Pay the treasury in $CSGN (Phantom prompts + signs), then redeem the
      // signature server-side, which re-reads the transfer on-chain.
      const signature = await paySpotlightCsgn(addr, bid)
      const res = await api.jukeboxSpotlight(proof, signature, {
        address: spotPick.address,
        note: spotNote.trim() || undefined,
      })
      setSpotMsg(`🎶 ${res.symbol} takes the spotlight for ${fmtToken(res.amount)} $CSGN — it rises on air within a minute.`)
      setSpotPick(null); setSpotNote(''); setSpotBid(null)
      loadBalance(addr)
    } catch (e) {
      setSpotErr(e instanceof Error ? e.message : 'Bid failed.')
    }
    setSpotBusy(false)
  }

  const doVoteMeme = async () => {
    setMemeErr(null); setMemeMsg(null)
    if (!memePick) { setMemeErr('Pick a coin from the board first.'); return }
    setMemeBusy(true)
    try {
      const addr = await ensureWallet()
      const proof = await proveWallet(addr, signMessage)
      // The MINT, not the symbol. The old code passed a typed ticker into a
      // parameter the server validates as base58 — so every vote was rejected
      // with `bad_mint` before it ever reached the tally.
      const res = await api.voteMeme(proof, memePick.address)
      // Hand the board the tallies the server just computed. No extra read, and
      // the ranking moves under the person who moved it.
      window.dispatchEvent(new CustomEvent('csgn:memeVoted', { detail: { tallies: res.tallies } }))
      setMemeMsg(`Vote counted — ${fmtToken(res.weight)} $CSGN of power behind $${res.symbol}.`)
      loadBalance(addr)
    } catch (e) {
      setMemeErr(e instanceof Error ? e.message : 'Meme vote failed.')
    }
    setMemeBusy(false)
  }

  // The community ranking used to be recomputed here from raw tallies. It now
  // lives in Meme100Board, which reads the same tallies AND the on-chain board
  // and runs the one published formula — so the standings on this page and the
  // standings on air cannot disagree.

  const options = vote?.options ?? []
  const cells = options.map((_, i) => tally[String(i)] || { tokens: 0, wallets: 0 })
  const totalTokens = cells.reduce((s, c) => s + c.tokens, 0)
  const totalWallets = cells.reduce((s, c) => s + c.wallets, 0)
  const leadIdx = cells.length ? cells.reduce((best, c, i) => (c.tokens > cells[best].tokens ? i : best), 0) : -1
  const hasVotes = totalTokens > 0
  const closed = vote?.status === 'closed'
  const canPostRightNow = balance != null && balance >= rightNowMin

  // The standing bid only sets the floor while it is LIVE. Once `expiresAt`
  // passes, the spotlight reopens at the base floor — the same rule the server
  // enforces in _shared/jukebox.ts, read here from the published verdict rather
  // than recomputed.
  const jukeboxExpiresMs = jukebox?.expiresAt ? Date.parse(jukebox.expiresAt) : NaN
  const holdsSpotlight = Boolean(jukebox && jukebox.bidCsgn > 0 && Number.isFinite(jukeboxExpiresMs) && jukeboxExpiresMs > nowMs)
  const baseFloor = jukebox?.baseFloorCsgn || JUKEBOX_BASE_FLOOR_CSGN
  const minBid = holdsSpotlight ? Math.max(baseFloor, jukebox!.nextBidCsgn || 0) : baseFloor
  const canAffordSpotlight = balance != null && balance >= minBid

  // Every surface on this page spends or weighs a balance, and each one writes
  // something against an account. Gating the whole page — the same wall Post
  // and You use — beats four separate half-states inside it.
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!user) {
    return (
      <SignInWall
        Icon={Coins}
        title="Your balance is your vote."
        body="Back a coin on the Meme 100, decide tonight’s programming, bid a coin onto the broadcast spotlight, and put your own line on the live ticker."
        cta="Sign in to take part"
      />
    )
  }

  return (
    <motion.main
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      // pt-24 clears the FIXED header (h-16, lg:h-20). This page had a bare
      // `py-10`, so the first thing on it — the Meme 100 heading — rendered
      // underneath the CSGN wordmark in the top-left. Every other page already
      // carries this offset; this one was missed when its own <header> was
      // removed and the board became the first element.
      className="max-w-3xl mx-auto px-4 sm:px-6 pt-24 lg:pt-28 pb-24 space-y-8"
    >
      {/* NO PAGE HEADER. The tab bar already says $CSGN, the wordmark is in the
          top bar, and a third "$CSGN" title with a paragraph under it collided
          with both. The sections below name themselves. */}

      {/* THE MEME 100 leads — it is the most interesting thing on the page. */}
      <Meme100Board />

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
              {balanceLoading ? (
                <p className="font-mono text-sm text-gray-500">…</p>
              ) : balance != null ? (
                <p className="font-mono text-sm text-primary-300">{fmtFull(balance)}</p>
              ) : (
                // NOT a zero. A balance we could not read is its own state, and
                // saying so is the difference between "the chain is busy" and
                // "your tokens don't count" — which is what a bare 0 said here
                // to a wallet holding 1.89 million.
                <button
                  type="button"
                  onClick={() => loadBalance(walletAddress)}
                  className="font-mono text-sm text-amber-300/90 hover:text-amber-200 cursor-pointer underline underline-offset-2 decoration-dotted"
                  title="We could not reach Solana just now"
                >
                  Retry
                </button>
              )}
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
            Hold <span className="text-primary-300 font-semibold">{fmtFull(rightNowMin)} $CSGN</span> to put one line on the
            live rail. Once a day.
          </p>

          {!walletAddress ? (
            <Button onClick={() => void connect()} isLoading={isConnecting} leftIcon={<Wallet className="w-4 h-4" />}>Connect Phantom to check eligibility</Button>
          ) : !canPostRightNow ? (
            <div className="flex items-start gap-2 text-sm text-amber-300/90 bg-amber-500/[0.06] border border-amber-500/20 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                You hold {balance != null ? fmtFull(balance) : '—'} $CSGN. You need {fmtFull(rightNowMin)} to post to the rail.
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

      {/* Coin Jukebox — an open $CSGN auction for the broadcast spotlight */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-display font-bold uppercase tracking-wide">Coin Jukebox</h2>
        </div>
        <Card hover={false} className="p-5 space-y-4">
          <p className="text-sm text-gray-400">
            Highest bid holds the spotlight on air for{' '}
            <span className="text-amber-300 font-semibold">twelve hours</span>. Paid in $CSGN to the{' '}
            <Link to="/treasury" className="text-amber-300 font-semibold underline underline-offset-2">treasury</Link>, never burned.
          </p>

          {/* WHO HOLDS IT NOW, FOR HOW LONG, AND WHAT IT COST.
              An auction with an invisible standing bid is a price list with
              extra steps — the number to beat is the product, and the clock
              running down on it is what makes the whole thing feel live. */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.16em] text-amber-400/80">On the spotlight</p>
                <p className="mt-1 text-2xl font-black font-display text-white truncate">
                  {holdsSpotlight ? `$${jukebox!.symbol}` : 'Open'}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {holdsSpotlight
                    ? <>Won with <span className="font-mono text-amber-300">{fmtFull(jukebox!.bidCsgn)} $CSGN</span></>
                    : 'No live bid — it opens at the floor.'}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500">Next bid from</p>
                <p className="mt-1 font-mono text-lg font-bold text-amber-300 tabular-nums">{fmtFull(minBid)}</p>
                <p className="text-[10px] text-gray-600">$CSGN</p>
              </div>
            </div>

            {/* THE CLOCK. A twelve-hour reign with no visible countdown is just
                a number that changes when you happen to reload. */}
            {holdsSpotlight && (
              <div className="mt-3 pt-3 border-t border-amber-500/15">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-gray-500">Holds for</span>
                  <span className="font-mono text-sm font-bold text-white tabular-nums">
                    {countdown(jukeboxExpiresMs - nowMs)}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-[width] duration-1000 ease-linear"
                    style={{ width: `${Math.max(0, Math.min(100, ((jukeboxExpiresMs - nowMs) / JUKEBOX_TTL_MS) * 100))}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {!walletAddress ? (
            <Button onClick={() => void connect()} isLoading={isConnecting} leftIcon={<Wallet className="w-4 h-4" />}>Connect Phantom to bid</Button>
          ) : !canAffordSpotlight ? (
            <div className="flex items-start gap-2 text-sm text-amber-300/90 bg-amber-500/[0.06] border border-amber-500/20 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                You hold {balance != null ? fmtFull(balance) : '—'} $CSGN. The next bid needs {fmtFull(minBid)}.
              </span>
            </div>
          ) : (
            <>
              <MemeVotePicker value={spotPick?.address ?? ''} onChange={setSpotPick} disabled={spotBusy} />
              <input value={spotNote} onChange={(e) => setSpotNote(e.target.value.slice(0, 90))} placeholder="Spotlight note (optional) — shown under the price" className="w-full rounded-xl bg-white/[0.04] border border-white/[0.1] focus:border-amber-500/60 outline-none px-3 py-2 text-sm" />

              {/* Prefilled with the minimum, because the common case is "just
                  take it" and making somebody compute the raise is friction on
                  the one screen where they are trying to give us money. */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Your bid, in $CSGN</label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={minBid}
                  step={1000}
                  value={spotBid ?? minBid}
                  onChange={(e) => setSpotBid(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                  className="w-full rounded-xl bg-white/[0.04] border border-white/[0.1] focus:border-amber-500/60 outline-none px-3 py-2 text-sm font-mono tabular-nums"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-gray-500">You sign in Phantom · paid to the CSGN treasury</span>
                <Button size="sm" variant="gold" disabled={!spotPick} isLoading={spotBusy} onClick={() => void doSpotlight()} leftIcon={<Flame className="w-4 h-4" />}>
                  {spotPick
                    ? `Bid ${fmtToken(Math.max(minBid, spotBid ?? minBid))} for $${spotPick.symbol}`
                    : 'Pick a coin to bid on'}
                </Button>
              </div>
            </>
          )}

          {spotMsg && <p className="text-sm text-emerald-400 flex items-center gap-1.5"><Check className="w-4 h-4" /> {spotMsg}</p>}
          {spotErr && <p className="text-sm text-red-400 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> {spotErr}</p>}

          {/* PREVIOUS WINNERS. An auction with no visible history has no
              reference price — a first-time bidder cannot tell whether the
              floor is cheap or absurd. This is the comparable. */}
          {(jukebox?.history?.length ?? 0) > 0 && (
            <div className="pt-3 border-t border-white/[0.06]">
              <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500">Previous winners</p>
              <ul className="mt-2 space-y-1.5">
                {jukebox!.history.slice(0, 6).map((w, i) => (
                  <li key={`${w.symbol}-${w.wonAt}-${i}`} className="flex items-baseline justify-between gap-3 text-[11px]">
                    <span className="font-semibold text-gray-300 truncate">${w.symbol}</span>
                    <span className="flex items-baseline gap-2 shrink-0">
                      <span className="font-mono text-amber-300/80 tabular-nums">{fmtToken(w.bidCsgn)}</span>
                      <span className="text-gray-600">
                        {new Date(w.wonAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
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
            Back a coin with your <span className="text-cyan-300 font-semibold">$CSGN</span>. Nothing leaves your wallet —
            your weight is your balance, and it is the biggest term in the on-air ranking.
          </p>

          {!walletAddress ? (
            <Button onClick={() => void connect()} isLoading={isConnecting} leftIcon={<Wallet className="w-4 h-4" />}>Connect Phantom to vote</Button>
          ) : (
            <div className="space-y-3">
              <MemeVotePicker value={memePick?.address ?? ''} onChange={setMemePick} disabled={memeBusy} />
              <Button
                size="sm"
                className="w-full"
                disabled={!memePick}
                isLoading={memeBusy}
                onClick={() => void doVoteMeme()}
                leftIcon={<VoteIcon className="w-4 h-4" />}
              >
                {memePick ? `Back $${memePick.symbol} with my $CSGN` : 'Pick a coin to back'}
              </Button>
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
