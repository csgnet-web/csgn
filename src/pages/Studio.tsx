import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, ExternalLink, Film, Plus, Radio, Trash2, TrendingUp } from 'lucide-react'
import { useAuth } from '@/contexts/useAuth'
import { api } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  looksLikeClipUrl, airtimeLabel, clipLength,
  CLIP_DEFAULT_SECONDS, CLIP_MIN_SECONDS, CLIP_MAX_SECONDS,
  CLIP_PLATFORM_LABELS, type ClipPlatform,
} from '@/lib/clipEmbed'

/**
 * STUDIO — the producer's desk.
 *
 * One screen that answers three questions in the order a member asks them:
 *
 *   1. How much of the day is mine?      ← the token's whole purpose, up top
 *   2. What am I putting on?             ← the reel, in the order it airs
 *   3. When am I actually on television?  ← real clock times, not "soon"
 *
 * Everything here READS numbers the server already published. The allowance and
 * the air times come out of `public/airtimeSchedule`, which is the same document
 * /player runs from — so what this screen promises and what goes out are the
 * same thing by construction, not by two implementations agreeing.
 */

interface Clip {
  id: string
  platform: string
  sourceUrl: string
  title: string
  seconds: number
  order: number
  status: string
  rejectReason: string | null
}

interface Airtime {
  seconds: number
  capped: boolean
  inventorySeconds: number
  networkBlockEnabled: boolean
  builtAt: string | null
}

const STATUS_TONE: Record<string, { label: string; variant: 'gold' | 'green' | 'red' | 'default' }> = {
  pending: { label: 'In review', variant: 'gold' },
  approved: { label: 'On air', variant: 'green' },
  rejected: { label: 'Not accepted', variant: 'red' },
}

export default function Studio() {
  const { user, profile, loading } = useAuth()
  const [clips, setClips] = useState<Clip[]>([])
  const [airtime, setAirtime] = useState<Airtime | null>(null)
  const [airings, setAirings] = useState<Array<{ startsAt: string; seconds: number; clipId: string }>>([])
  const [busy, setBusy] = useState(false)
  const [loadingClips, setLoadingClips] = useState(true)
  const [error, setError] = useState('')

  const [url, setUrl] = useState('')
  const [seconds, setSeconds] = useState(CLIP_DEFAULT_SECONDS)
  const [title, setTitle] = useState('')

  // No setState before the first await: the reload runs from an effect, and a
  // synchronous state write there is both a lint error and a wasted render. The
  // initial spinner comes from the initial state instead, and every later reload
  // is covered by `busy` on whichever control triggered it.
  const load = useCallback(async () => {
    try {
      const res = await api.myClips()
      setClips(res.clips)
      setAirtime(res.airtime)
      setAirings(res.airings)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your studio.')
    }
    setLoadingClips(false)
  }, [])

  // Same shape as Dashboard's loader: an async IIFE inside the effect, so no
  // state is written on the effect's synchronous path.
  useEffect(() => {
    if (!user) return
    ;(async () => { await load() })()
  }, [user, load])

  const add = async () => {
    setBusy(true)
    setError('')
    try {
      await api.submitClip(url.trim(), seconds, title.trim())
      setUrl(''); setTitle(''); setSeconds(CLIP_DEFAULT_SECONDS)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that link.')
    }
    setBusy(false)
  }

  const move = async (clip: Clip, direction: -1 | 1) => {
    const sorted = [...clips].sort((a, b) => a.order - b.order)
    const index = sorted.findIndex((c) => c.id === clip.id)
    const swap = sorted[index + direction]
    if (!swap) return
    setBusy(true)
    try {
      // Swap the two order values. Two writes rather than renumbering the whole
      // reel, so a failure leaves one pair out of order rather than the lot.
      await api.updateMyClip(clip.id, { action: 'update', order: swap.order })
      await api.updateMyClip(swap.id, { action: 'update', order: clip.order })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reorder.')
    }
    setBusy(false)
  }

  const remove = async (clip: Clip) => {
    setBusy(true)
    try {
      await api.updateMyClip(clip.id, { action: 'remove' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove that clip.')
    }
    setBusy(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen pt-24 pb-24">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <Film className="w-10 h-10 text-gray-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white">Your studio</h1>
          <p className="mt-3 text-sm text-gray-400 leading-relaxed">
            Sign in to put a clip on the network. It takes one tap and no wallet.
          </p>
          <Link to="/watch" className="inline-block mt-6">
            <Button variant="primary" size="md">Go to CSGN</Button>
          </Link>
        </div>
      </div>
    )
  }

  const sorted = [...clips].sort((a, b) => a.order - b.order)
  const approvedSeconds = sorted.filter((c) => c.status === 'approved').reduce((s, c) => s + c.seconds, 0)
  const allowance = airtime?.seconds ?? 0
  const usedPct = allowance > 0 ? Math.min(100, Math.round((approvedSeconds / allowance) * 100)) : 0
  const canAdd = looksLikeClipUrl(url) && !busy

  return (
    <div className="min-h-screen pt-24 lg:pt-28 pb-24">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 space-y-6">

        <header>
          <h1 className="text-3xl sm:text-4xl font-bold font-display text-white leading-tight">Studio</h1>
          <p className="mt-2 text-sm text-gray-400 leading-relaxed">
            Post a link, pick the order, and it goes out on CSGN between the live hours.
            You don't have to be there.
          </p>
        </header>

        {/* ── 1. How much of the day is mine ── */}
        <Card hover={false} className="p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.16em] text-gray-500">Your airtime today</p>
              <p className="mt-1 text-4xl font-black font-mono text-white leading-none">
                {airtimeLabel(allowance)}
              </p>
              <p className="mt-2 text-xs text-gray-500 leading-relaxed">
                Out of {airtimeLabel(airtime?.inventorySeconds ?? 0)} of open air
                {airtime?.networkBlockEnabled === false && ' (the 7 PM–3 AM block is open right now, so there is more of it)'}.
                {' '}Your share follows what you hold — hold more $CSGN, get more of the day.
              </p>
            </div>
            <Link to="/account">
              <Button variant="secondary" size="sm"><TrendingUp className="w-3.5 h-3.5 mr-1.5" /> Holdings</Button>
            </Link>
          </div>

          {allowance > 0 && (
            <div className="mt-4">
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="text-gray-400">{airtimeLabel(approvedSeconds)} approved and ready</span>
                <span className="font-mono text-gray-500">{usedPct}% of your slot filled</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div className="h-full rounded-full bg-primary-500/70" style={{ width: `${usedPct}%` }} />
              </div>
              {approvedSeconds < allowance && (
                <p className="mt-1.5 text-[11px] text-primary-300">
                  You have {airtimeLabel(allowance - approvedSeconds)} of unused airtime. Add another clip and it gets used.
                </p>
              )}
            </div>
          )}

          {airtime?.capped && (
            <p className="mt-3 text-[11px] text-gray-500 leading-relaxed">
              You're at the per-member ceiling for a single day. It exists so no one holder can take the
              whole channel — everything above it goes back to everybody else.
            </p>
          )}
        </Card>

        {/* ── 2. Add something ── */}
        <Card hover={false} className="p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Plus className="w-4 h-4 text-primary-400" /> Add a clip
          </h2>
          <p className="text-xs text-gray-500 leading-relaxed">
            Paste the link to a post you've already made on YouTube, TikTok or Instagram. We don't
            host it — we point at yours, so the views and the follows stay with your account.
          </p>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.tiktok.com/@you/video/…"
            className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary-500/50"
          />
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[10rem]">
              <label htmlFor="clip-title" className="block text-[11px] uppercase tracking-[0.14em] text-gray-500 mb-1.5">Title (optional)</label>
              <input
                id="clip-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                placeholder="What is it?"
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary-500/50"
              />
            </div>
            <div className="w-32">
              <label htmlFor="clip-seconds" className="block text-[11px] uppercase tracking-[0.14em] text-gray-500 mb-1.5">Seconds</label>
              <input
                id="clip-seconds"
                type="number"
                min={CLIP_MIN_SECONDS}
                max={CLIP_MAX_SECONDS}
                value={seconds}
                onChange={(e) => setSeconds(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-primary-500/50"
              />
            </div>
          </div>
          {url && !looksLikeClipUrl(url) && (
            <p className="text-xs text-amber-400">That needs to be a YouTube, TikTok or Instagram link.</p>
          )}
          <Button variant="primary" size="sm" disabled={!canAdd} isLoading={busy} onClick={() => void add()}>
            Add to my reel
          </Button>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </Card>

        {/* ── 3. The reel, in the order it airs ── */}
        <Card hover={false} className="overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Film className="w-4 h-4 text-gray-400" /> Your reel
              <span className="text-gray-500 font-normal">({sorted.length})</span>
            </h2>
            <span className="text-[11px] text-gray-500">Top of the list airs first</span>
          </div>

          {loadingClips ? (
            <div className="p-8 text-center"><div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
          ) : sorted.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-gray-400">Nothing in your reel yet.</p>
              <p className="mt-1 text-xs text-gray-500">Add a link above and it'll be on the network once it's checked.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {sorted.map((clip, index) => {
                const tone = STATUS_TONE[clip.status] ?? STATUS_TONE.pending
                return (
                  <div key={clip.id} className="px-5 py-3.5 flex items-start gap-3">
                    <span className="mt-1 text-xs font-mono text-gray-600 w-5 shrink-0">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-white truncate">{clip.title || 'Untitled clip'}</span>
                        <Badge variant={tone.variant}>{tone.label}</Badge>
                      </div>
                      <p className="mt-1 text-[11px] text-gray-500 flex flex-wrap items-center gap-x-2">
                        <span>{CLIP_PLATFORM_LABELS[clip.platform as ClipPlatform] ?? clip.platform}</span>
                        <span>·</span>
                        <span className="font-mono">{clipLength(clip.seconds)}</span>
                        <a href={clip.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-gray-500 hover:text-cyan-400">
                          <ExternalLink className="w-3 h-3" /> open
                        </a>
                      </p>
                      {clip.rejectReason && (
                        <p className="mt-1 text-[11px] text-red-400 leading-snug">{clip.rejectReason}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => void move(clip, -1)}
                        disabled={busy || index === 0}
                        className="px-1.5 py-1 text-xs text-gray-500 hover:text-white disabled:opacity-25 cursor-pointer"
                        title="Move up"
                      >↑</button>
                      <button
                        onClick={() => void move(clip, 1)}
                        disabled={busy || index === sorted.length - 1}
                        className="px-1.5 py-1 text-xs text-gray-500 hover:text-white disabled:opacity-25 cursor-pointer"
                        title="Move down"
                      >↓</button>
                      <button
                        onClick={() => void remove(clip)}
                        disabled={busy}
                        className="px-1.5 py-1 text-gray-600 hover:text-red-400 disabled:opacity-25 cursor-pointer"
                        title="Remove"
                      ><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* ── 4. When am I on television ── */}
        <Card hover={false} className="p-5">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" /> You're on at
          </h2>
          {airings.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500 leading-relaxed">
              Nothing scheduled yet. Once a clip is approved it lands in the next rebuild of the
              schedule, and the exact times show up here.
            </p>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap gap-2">
                {airings.map((a, i) => (
                  <span key={`${a.clipId}-${i}`} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.07] px-2.5 py-1.5 text-xs font-mono text-emerald-300">
                    <Radio className="w-3 h-3" />
                    {new Date(a.startsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-gray-500 leading-relaxed">
                Real times, not estimates — this is the same schedule the broadcast runs from. If
                somebody claims one of those hours and goes live, their stream wins and your clip
                moves to the next opening.
              </p>
            </>
          )}
        </Card>

        <p className="text-xs text-gray-500 leading-relaxed">
          Every clip is watched by a person before it airs. Nothing goes out unreviewed —
          it's a real broadcast, and one bad segment is everybody's problem.
          {profile?.username && <> You'll be credited on screen as <span className="font-mono text-gray-400">@{profile.username}</span>.</>}
        </p>

      </div>
    </div>
  )
}
