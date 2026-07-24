import { useEffect, useRef, useState } from 'react'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { db } from '@/config/firebase'

// Admin controls for the config/ticker fields beyond the RIGHT NOW rail and coin
// spotlight: BREAKING, who's live / up next (also used by the over-live
// interstitial overlay), governance beats, and the token-weighted vote. Writes
// config/ticker (admin-only per firestore.rules); the OBS ticker + overlay poll
// it. The vote also seeds votes/{id} which the castVote function tallies into.

interface Beat { tag: string; text: string }
interface Cell { tokens: number; wallets: number }

const parseBeatLines = (raw: string, defTag: string): Beat[] =>
  raw.split('\n').map((line): Beat | null => {
    const t = line.trim()
    if (!t) return null
    const pipe = t.indexOf('|')
    const tag = pipe > -1 ? t.slice(0, pipe).trim().toUpperCase() : ''
    const text = pipe > -1 ? t.slice(pipe + 1).trim() : t
    return text ? { tag: tag || defTag, text } : null
  }).filter((b): b is Beat => b !== null).slice(0, 6)

interface Tweet { name: string; handle: string; text: string; avatar: string; verified: boolean }

// One post per line: "@handle | Name | tweet text" or "@handle | tweet text".
// Prefix the handle with ! to show the blue verified badge.
const parseTweetLines = (raw: string): Tweet[] =>
  raw.split('\n').map((line): Tweet | null => {
    const l = line.trim()
    if (!l) return null
    const parts = l.split('|')
    if (parts.length < 2) return null
    let handle = parts[0].trim()
    const verified = handle.startsWith('!')
    handle = handle.replace(/^!/, '').replace(/^@/, '').trim()
    const name = parts.length >= 3 ? parts[1].trim() : handle
    const text = (parts.length >= 3 ? parts.slice(2).join('|') : parts.slice(1).join('|')).trim()
    if (!handle || !text) return null
    return { handle, name: name || handle, text, avatar: '', verified }
  }).filter((t): t is Tweet => t !== null).slice(0, 10)

const serializeTweets = (tweets: Tweet[]): string =>
  tweets.map((t) => `${t.verified ? '!' : ''}@${t.handle}${t.name && t.name !== t.handle ? ` | ${t.name}` : ''} | ${t.text}`).join('\n')

const fmtToken = (n: number): string =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(Math.round(n))

export default function TickerControlsCard() {
  const seeded = useRef(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  // BREAKING
  const [breaking, setBreaking] = useState('')
  const [breaking2, setBreaking2] = useState('') // optional second line
  const [breakingRow, setBreakingRow] = useState(false) // own row above the ticker vs. full takeover
  const [breakingOn, setBreakingOn] = useState(false)
  // Main chyron — full control of the three headline lines (leads the rotation)
  const [chyKicker, setChyKicker] = useState('')
  const [chyTitle, setChyTitle] = useState('')
  const [chySub, setChySub] = useState('')
  const [chyPill, setChyPill] = useState('')
  const [chyronOn, setChyronOn] = useState(false)
  // Viewer → on-air action counter (public/onAirActions) + its on-air toggle
  const [actions, setActions] = useState({ total: 0, votes: 0, submissions: 0, spotlights: 0, buys: 0 })
  const [showActions, setShowActions] = useState(false)
  // Now live / up next
  const [liveName, setLiveName] = useState('')
  const [liveTitle, setLiveTitle] = useState('')
  const [nextName, setNextName] = useState('')
  const [nextStart, setNextStart] = useState('')
  // Governance beats
  const [govText, setGovText] = useState('')
  // X post showcase
  const [tweetsText, setTweetsText] = useState('')
  // Vote
  const [voteQ, setVoteQ] = useState('')
  const [voteOpts, setVoteOpts] = useState(['', '', '', ''])
  const [voteStart, setVoteStart] = useState('')
  const [currentVote, setCurrentVote] = useState<{ id: string; question: string; options: string[]; status?: string } | null>(null)
  const [tallyState, setTallyState] = useState<{ id: string; tally: Record<string, Cell> }>({ id: '', tally: {} })

  useEffect(() => {
    return onSnapshot(doc(db, 'config', 'ticker'), (snap) => {
      const d = snap.exists() ? snap.data() : {}
      const brkObj = d.breaking && typeof d.breaking === 'object' ? d.breaking : null
      const brk = typeof d.breaking === 'string' ? d.breaking : (brkObj ? String(brkObj.text || '') : '')
      setBreakingOn(!!brk)
      const chy = d.chyron && typeof d.chyron === 'object' ? d.chyron : null
      setChyronOn(!!(chy && (String(chy.title || '').trim() || String(chy.kicker || '').trim())))
      setShowActions(!!d.showActions)
      const v = d.vote && typeof d.vote === 'object' && d.vote.id
        ? { id: String(d.vote.id), question: String(d.vote.question || ''), options: Array.isArray(d.vote.options) ? d.vote.options.map(String) : [], status: d.vote.status ? String(d.vote.status) : 'open' }
        : null
      setCurrentVote(v)
      if (!seeded.current) {
        seeded.current = true
        setBreaking(brk)
        setBreaking2(brkObj ? String(brkObj.text2 || '') : '')
        setBreakingRow(brkObj ? String(brkObj.mode || '') === 'row' : false)
        if (chy) { setChyKicker(String(chy.kicker || '')); setChyTitle(String(chy.title || '')); setChySub(String(chy.subtitle || '')); setChyPill(String(chy.pill || '')) }
        if (d.nowLive) { setLiveName(String(d.nowLive.name || '')); setLiveTitle(String(d.nowLive.title || '')) }
        if (d.upNext) { setNextName(String(d.upNext.name || '')); setNextStart(String(d.upNext.startET || '')) }
        if (Array.isArray(d.governance)) setGovText(d.governance.map((g: Beat) => (g.tag && g.tag !== 'CSGN GOVERNANCE' ? `${g.tag} | ${g.text}` : g.text)).join('\n'))
        if (Array.isArray(d.tweets)) setTweetsText(serializeTweets(d.tweets as Tweet[]))
      }
    })
  }, [])

  useEffect(() => {
    return onSnapshot(doc(db, 'public', 'onAirActions'), (snap) => {
      const d = snap.exists() ? snap.data() : {}
      const n = (k: string) => Number(d[k]) || 0
      setActions({ total: n('total'), votes: n('votes'), submissions: n('submissions'), spotlights: n('spotlights'), buys: n('buys') })
    })
  }, [])

  useEffect(() => {
    if (!currentVote?.id) return
    const id = currentVote.id
    return onSnapshot(doc(db, 'votes', id), (snap) => setTallyState({ id, tally: snap.exists() ? ((snap.data().tally as Record<string, Cell>) || {}) : {} }))
  }, [currentVote?.id])
  const tally: Record<string, Cell> = tallyState.id === currentVote?.id ? tallyState.tally : {}

  const run = async (key: string, fn: () => Promise<void>, okMsg: string) => {
    setBusy(key); setErr(null); setMsg(null)
    try { await fn(); setMsg(okMsg) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Save failed. Check Firestore rules for config/ticker.') }
    setBusy(null)
  }
  const write = (data: Record<string, unknown>) => setDoc(doc(db, 'config', 'ticker'), { ...data, updatedAt: new Date().toISOString() }, { merge: true })

  const saveBreaking = () => run('brk', () => {
    const text = breaking.trim()
    const payload = text
      ? { text, text2: breaking2.trim(), mode: breakingRow ? 'row' : 'takeover' }
      : null
    return write({ breaking: payload })
  }, breaking.trim() ? (breakingRow ? 'BREAKING live as its own row above the ticker.' : 'BREAKING is live on the ticker.') : 'BREAKING cleared.')
  const clearBreaking = () => run('brkClear', async () => { await write({ breaking: null }); setBreaking(''); setBreaking2(''); setBreakingRow(false) }, 'BREAKING cleared.')
  const saveChyron = () => run('chy', () => {
    const title = chyTitle.trim(); const kicker = chyKicker.trim()
    const payload = (title || kicker)
      ? { kicker, title, subtitle: chySub.trim(), pill: chyPill.trim() }
      : null
    return write({ chyron: payload })
  }, chyTitle.trim() || chyKicker.trim() ? 'Main chyron is live on the ticker.' : 'Main chyron cleared.')
  const clearChyron = () => run('chyClear', async () => { await write({ chyron: null }); setChyKicker(''); setChyTitle(''); setChySub(''); setChyPill('') }, 'Main chyron cleared.')
  const toggleActions = () => run('actToggle', () => write({ showActions: !showActions }), !showActions ? 'Fan-action counter is now on air.' : 'Fan-action counter hidden from air.')
  const resetActions = () => run('actReset', () => setDoc(doc(db, 'public', 'onAirActions'), { total: 0, votes: 0, submissions: 0, spotlights: 0, buys: 0, since: new Date().toISOString(), updatedAt: new Date().toISOString() }), 'Fan-action counter reset for a new session.')
  const saveLive = () => run('live', () => write({ nowLive: liveName.trim() || liveTitle.trim() ? { name: liveName.trim(), title: liveTitle.trim() } : null }), 'Live-now updated.')
  const saveNext = () => run('next', () => write({ upNext: nextName.trim() || nextStart.trim() ? { name: nextName.trim(), startET: nextStart.trim() } : null }), 'Up-next updated.')
  const saveGov = () => run('gov', () => write({ governance: parseBeatLines(govText, 'CSGN GOVERNANCE') }), 'Governance beats updated.')
  const saveTweets = () => run('tweets', () => write({ tweets: parseTweetLines(tweetsText) }), 'X post rotation updated — 30s per card on the ticker.')

  const createVote = () => run('vote', async () => {
    const options = voteOpts.map((o) => o.trim()).filter(Boolean)
    if (!voteQ.trim() || options.length < 2) throw new Error('Add a question and at least two options.')
    const id = (crypto.randomUUID?.() || String(Date.now())).replace(/-/g, '').slice(0, 20)
    const startISO = voteStart ? new Date(voteStart).toISOString() : ''
    await setDoc(doc(db, 'votes', id), { tally: {}, options, status: 'open', question: voteQ.trim(), createdAt: new Date().toISOString() })
    await write({ vote: { id, question: voteQ.trim(), options, startISO, status: 'open' } })
  }, 'Vote is live — holders can now cast at /vote.')
  const closeVote = () => run('voteClose', async () => {
    if (!currentVote) return
    await write({ vote: { ...currentVote, status: 'closed' } })
    await setDoc(doc(db, 'votes', currentVote.id), { status: 'closed' }, { merge: true })
  }, 'Voting closed — the tally is frozen.')
  const clearVote = () => run('voteClear', async () => { await write({ vote: null }); setVoteQ(''); setVoteOpts(['', '', '', '']); setVoteStart('') }, 'Vote cleared.')

  const input = 'w-full rounded-lg bg-white/[0.04] border border-white/[0.1] focus:border-primary-500/60 outline-none px-3 py-2 text-sm'
  const label = 'block text-xs text-gray-400 font-medium mb-1'

  return (
    <Card hover={false} className="overflow-hidden">
      <div className="p-4 border-b border-white/[0.06]">
        <h3 className="font-semibold text-white">Broadcast Control — BREAKING · Live · Governance · Vote</h3>
        <p className="text-xs text-gray-500 mt-0.5">Writes config/ticker → OBS ticker + over-live overlay pick it up within seconds.</p>
      </div>
      <div className="p-4 sm:p-6 space-y-6">
        {/* BREAKING */}
        <div className="space-y-2">
          <label className={label}>BREAKING {breakingOn && <span className="text-red-400">● live now</span>}</label>
          <textarea value={breaking} onChange={(e) => setBreaking(e.target.value)} rows={2} placeholder="Headline — stays on air until cleared" className={input} />
          <input value={breaking2} onChange={(e) => setBreaking2(e.target.value)} placeholder="Second line (optional)" className={input} />
          <label className="flex items-center gap-2 text-xs text-gray-300 select-none cursor-pointer">
            <input type="checkbox" checked={breakingRow} onChange={(e) => setBreakingRow(e.target.checked)} className="accent-red-500 w-4 h-4" />
            Show as its own row above the ticker (two rows) — the ticker keeps running below.
            <span className="text-gray-500">Needs a taller OBS source (1930×240); at 110px it falls back to a full takeover.</span>
          </label>
          <div className="flex gap-2">
            <Button size="sm" variant="danger" isLoading={busy === 'brk'} onClick={saveBreaking}>Set BREAKING</Button>
            <Button size="sm" variant="secondary" isLoading={busy === 'brkClear'} onClick={clearBreaking}>Clear</Button>
          </div>
        </div>

        {/* Viewer → on-air action counter */}
        <div className="space-y-2 rounded-xl bg-white/[0.03] border border-white/[0.08] p-3">
          <div className="flex items-center justify-between">
            <label className={label + ' mb-0'}>Fans on the board — viewer → on-air actions {showActions && <span className="text-emerald-400">● on air</span>}</label>
            <span className="text-2xl font-bold font-mono text-white tabular-nums">{actions.total.toLocaleString('en-US')}</span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            {([['Votes', actions.votes], ['Headlines', actions.submissions], ['Spotlights', actions.spotlights], ['Buys', actions.buys]] as const).map(([k, v]) => (
              <div key={k} className="rounded-lg bg-white/[0.03] py-1.5">
                <div className="text-lg font-bold font-mono text-white tabular-nums">{v.toLocaleString('en-US')}</div>
                <div className="text-[10px] uppercase tracking-wide text-gray-500">{k}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant={showActions ? 'secondary' : 'gold'} isLoading={busy === 'actToggle'} onClick={toggleActions}>{showActions ? 'Hide from air' : 'Show on air'}</Button>
            <Button size="sm" variant="ghost" isLoading={busy === 'actReset'} onClick={resetActions}>Reset session</Button>
          </div>
          <p className="text-xs text-gray-500">Counts every token-weighted vote, holder headline, and coin-spotlight burn as it lands. Auto-increments server-side; flip it on air whenever you want to show the crowd steering the broadcast.</p>
        </div>

        {/* Main chyron — full control of the three headline lines */}
        <div className="space-y-2">
          <label className={label}>Main chyron — all three lines {chyronOn && <span className="text-emerald-400">● live now</span>}</label>
          <div className="grid sm:grid-cols-[1fr_auto] gap-2">
            <input value={chyKicker} onChange={(e) => setChyKicker(e.target.value)} placeholder="Kicker (small top line) — e.g. CSGN ALERT" className={input} />
            <input value={chyPill} onChange={(e) => setChyPill(e.target.value)} placeholder="Pill label (CSGN)" className={input + ' sm:w-40'} />
          </div>
          <input value={chyTitle} onChange={(e) => setChyTitle(e.target.value)} placeholder="Headline (big middle line) — auto-shrinks to fit, never clips" className={input} />
          <input value={chySub} onChange={(e) => setChySub(e.target.value)} placeholder="Subline (bottom line)" className={input} />
          <div className="flex gap-2">
            <Button size="sm" variant="gold" isLoading={busy === 'chy'} onClick={saveChyron}>Set chyron</Button>
            <Button size="sm" variant="secondary" isLoading={busy === 'chyClear'} onClick={clearChyron}>Clear</Button>
          </div>
        </div>

        {/* Now live + Up next */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className={label}>Live now (name · title)</label>
            <input value={liveName} onChange={(e) => setLiveName(e.target.value)} placeholder="Name" className={input} />
            <input value={liveTitle} onChange={(e) => setLiveTitle(e.target.value)} placeholder="Show title" className={input} />
            <Button size="sm" variant="secondary" isLoading={busy === 'live'} onClick={saveLive}>Save live now</Button>
          </div>
          <div className="space-y-2">
            <label className={label}>Up next (name · start ET)</label>
            <input value={nextName} onChange={(e) => setNextName(e.target.value)} placeholder="Name" className={input} />
            <input value={nextStart} onChange={(e) => setNextStart(e.target.value)} placeholder="10:00 PM ET" className={input} />
            <Button size="sm" variant="secondary" isLoading={busy === 'next'} onClick={saveNext}>Save up next</Button>
          </div>
        </div>

        {/* Governance beats */}
        <div className="space-y-2">
          <label className={label}>Governance beats (one per line · optional TAG | text)</label>
          <textarea value={govText} onChange={(e) => setGovText(e.target.value)} rows={3} placeholder={'Holders decide tonight’s stream\nBURN | 2.1M $CSGN burned this week'} className={input} />
          <Button size="sm" variant="secondary" isLoading={busy === 'gov'} onClick={saveGov}>Save governance</Button>
        </div>

        {/* X post showcase */}
        <div className="space-y-2">
          <label className={label}>X posts — 30s showcase · one per line: <span className="text-gray-500">@handle | Name | tweet text</span> (prefix ! for verified)</label>
          <textarea value={tweetsText} onChange={(e) => setTweetsText(e.target.value)} rows={4} placeholder={'!@blknoiz06 | Ansem | CSGN is the ESPN of crypto\n@CSGNet | Holders pick tonight’s stream — vote at csgn.fun'} className={input} />
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Keep a solid rotation — refresh every couple hours.</span>
            <Button size="sm" variant="secondary" isLoading={busy === 'tweets'} onClick={saveTweets}>Save X rotation</Button>
          </div>
        </div>

        {/* Vote */}
        <div className="space-y-3 border-t border-white/[0.06] pt-5">
          <div className="flex items-center justify-between">
            <label className={label + ' mb-0'}>Tonight’s vote (token-weighted)</label>
            {currentVote && <span className={`text-xs font-bold uppercase ${currentVote.status === 'closed' ? 'text-red-400' : 'text-emerald-400'}`}>{currentVote.status === 'closed' ? 'Closed' : 'Open'}</span>}
          </div>

          {currentVote && (
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-3 space-y-2">
              <p className="text-sm font-semibold">{currentVote.question}</p>
              {currentVote.options.map((o, i) => {
                const c = tally[String(i)] || { tokens: 0, wallets: 0 }
                return (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-gray-300 truncate">{o}</span>
                    <span className="font-mono text-gray-400 shrink-0" title={`${Math.round(c.tokens).toLocaleString('en-US')} $CSGN`}>{fmtToken(c.tokens)} $CSGN · {c.wallets}w</span>
                  </div>
                )
              })}
              <div className="flex gap-2 pt-1">
                {currentVote.status !== 'closed' && <Button size="sm" variant="secondary" isLoading={busy === 'voteClose'} onClick={closeVote}>Close voting</Button>}
                <Button size="sm" variant="ghost" isLoading={busy === 'voteClear'} onClick={clearVote}>Clear vote</Button>
              </div>
            </div>
          )}

          <input value={voteQ} onChange={(e) => setVoteQ(e.target.value)} placeholder="Question — e.g. CFB Dynasty or Black Ops tonight?" className={input} />
          <div className="grid grid-cols-2 gap-2">
            {voteOpts.map((o, i) => (
              <input key={i} value={o} onChange={(e) => setVoteOpts((prev) => prev.map((p, j) => (j === i ? e.target.value : p)))} placeholder={`Option ${i + 1}${i < 2 ? '' : ' (optional)'}`} className={input} />
            ))}
          </div>
          <div>
            <label className={label}>Stream start (for the on-air countdown)</label>
            <input type="datetime-local" value={voteStart} onChange={(e) => setVoteStart(e.target.value)} className={input} />
          </div>
          <Button size="sm" variant="gold" isLoading={busy === 'vote'} onClick={createVote}>Launch new vote</Button>
          <p className="text-xs text-gray-500">Launching a new vote resets the tally. Voting power = each wallet’s $CSGN balance.</p>
        </div>

        {msg && <p className="text-sm text-emerald-400">{msg}</p>}
        {err && <p className="text-sm text-red-400">{err}</p>}
      </div>
    </Card>
  )
}
