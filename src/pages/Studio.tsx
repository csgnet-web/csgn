import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Check, Clapperboard, Clock, ExternalLink, GripVertical, Link2,
  Radio, Sparkles, Trash2, TrendingUp,
} from 'lucide-react'
import { useAuth } from '@/contexts/useAuth'
import { useAuthModal } from '@/contexts/useAuthModal'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import {
  looksLikeClipUrl, airtimeLabel, clipLength, clipPoster, cutForSeconds,
  lookById, CLIP_CUTS, ON_AIR_LOOKS, CLIP_PLATFORM_LABELS, PLATFORM_STYLE,
  type ClipPlatform,
} from '@/lib/clipEmbed'

/**
 * STUDIO — the producer's desk.
 *
 * The design brief was "make it feel like posting, not like filing a form", and
 * three decisions carry that:
 *
 *  1. NO SECONDS FIELD. A number input is a chore that asks the wrong question.
 *     Members pick a CUT — Sting, Short, Standard, Feature, Block — the way an
 *     editor picks a bumper. Same underlying seconds, none of the typing.
 *  2. THE REEL IS A PICTURE. A proportional bar shows every segment laid end to
 *     end against the airtime their bag earns them, so "how much have I got
 *     left" is a glance, not arithmetic.
 *  3. THEY OWN A LOOK. One tap picks the colour of the lower third that carries
 *     their name on the broadcast. It is the difference between "I pasted a
 *     link" and "that's my segment".
 *
 * Everything numeric is READ from `public/airtimeSchedule` — the same document
 * the broadcast runs from — so what this promises and what airs cannot drift.
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

const STATUS: Record<string, { label: string; dot: string; text: string }> = {
  pending: { label: 'In review', dot: 'bg-gold', text: 'text-gold' },
  approved: { label: 'On air', dot: 'bg-live', text: 'text-live' },
  rejected: { label: 'Not accepted', dot: 'bg-primary-500', text: 'text-primary-400' },
}

/* ─── Poster frame ─── */

function Poster({ platform, sourceUrl, className = '' }: { platform: string; sourceUrl: string; className?: string }) {
  const videoId = sourceUrl.match(/[?&]v=([^&]+)/)?.[1] ?? ''
  const poster = clipPoster(platform, videoId)
  const style = PLATFORM_STYLE[platform] ?? { gradient: 'from-white/10 to-white/[0.02]', mark: '■' }

  return (
    <div className={`relative overflow-hidden rounded-lg bg-gradient-to-br ${style.gradient} ${className}`}>
      {poster ? (
        <img
          src={poster}
          alt=""
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
          // A thumbnail that 404s must not leave a broken-image glyph on a
          // screen that is meant to look designed.
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-2xl text-white/25">{style.mark}</span>
      )}
      <span className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-lg" />
    </div>
  )
}

/* ─── Signed out ─── */

function LockedStudio() {
  const { openAuth } = useAuthModal()
  return (
    <div className="min-h-screen pt-24 lg:pt-28 pb-24 px-4">
      <div className="max-w-md mx-auto text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-600 to-primary-500 flex items-center justify-center mx-auto shadow-[0_12px_40px_-12px_rgba(255,35,70,0.6)]">
          <Clapperboard className="w-7 h-7 text-white" />
        </div>
        <h1 className="mt-6 text-3xl font-black font-display text-white tracking-tight">Get on television.</h1>
        <p className="mt-3 text-sm text-gray-400 leading-relaxed">
          Post a link to something you already made. It airs on CSGN between the live blocks —
          you don't have to be there, and you don't need a wallet.
        </p>
        {/* The sheet opens over this page. No bounce to another screen that
            then asks them to come back. */}
        <Button variant="primary" size="lg" className="mt-7 w-full" onClick={openAuth}>
          Sign in to post
        </Button>
        <p className="mt-4 text-[11px] text-gray-600">Google, X, wallet or email. No password.</p>
      </div>
    </div>
  )
}

export default function Studio() {
  const { user, loading } = useAuth()
  const [clips, setClips] = useState<Clip[]>([])
  const [airtime, setAirtime] = useState<Airtime | null>(null)
  const [airings, setAirings] = useState<Array<{ startsAt: string; seconds: number; clipId: string }>>([])
  const [look, setLook] = useState('signal')
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState(false)
  const [loadingClips, setLoadingClips] = useState(true)
  const [error, setError] = useState('')

  const [url, setUrl] = useState('')
  const [cutId, setCutId] = useState('standard')
  const [title, setTitle] = useState('')
  const [justAdded, setJustAdded] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await api.myClips()
      setClips(res.clips)
      setAirtime(res.airtime)
      setAirings(res.airings)
      setLook(res.onAirLook || 'signal')
      setUsername(res.username || '')
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your studio.')
    }
    setLoadingClips(false)
  }, [])

  useEffect(() => {
    if (!user) return
    ;(async () => { await load() })()
  }, [user, load])

  const add = async () => {
    setBusy(true); setError('')
    try {
      const cut = CLIP_CUTS.find((c) => c.id === cutId) ?? CLIP_CUTS[2]
      const res = await api.submitClip(url.trim(), cut.seconds, title.trim())
      setUrl(''); setTitle('')
      setJustAdded(res.clip.id)
      setTimeout(() => setJustAdded(''), 2200)
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
    // Optimistic: the list reorders under the thumb immediately. A reorder that
    // waits on a round trip feels broken even when it is working.
    setClips((prev) => prev.map((c) =>
      c.id === clip.id ? { ...c, order: swap.order } : c.id === swap.id ? { ...c, order: clip.order } : c,
    ))
    try {
      await api.updateMyClip(clip.id, { action: 'update', order: swap.order })
      await api.updateMyClip(swap.id, { action: 'update', order: clip.order })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reorder.')
      await load()
    }
    setBusy(false)
  }

  const setClipCut = async (clip: Clip, seconds: number) => {
    setBusy(true)
    setClips((prev) => prev.map((c) => (c.id === clip.id ? { ...c, seconds } : c)))
    try {
      await api.updateMyClip(clip.id, { action: 'update', seconds })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the cut.')
      await load()
    }
    setBusy(false)
  }

  const remove = async (clip: Clip) => {
    setBusy(true)
    setClips((prev) => prev.filter((c) => c.id !== clip.id))
    try {
      await api.updateMyClip(clip.id, { action: 'remove' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove that clip.')
      await load()
    }
    setBusy(false)
  }

  const chooseLook = async (id: string) => {
    setLook(id)
    try {
      await api.setOnAirLook(id)
    } catch {
      // Cosmetic; a failed save is not worth an error banner over the reel.
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!user) return <LockedStudio />

  const sorted = [...clips].sort((a, b) => a.order - b.order)
  const approved = sorted.filter((c) => c.status === 'approved')
  const approvedSeconds = approved.reduce((s, c) => s + c.seconds, 0)
  const allowance = airtime?.seconds ?? 0
  const filledPct = allowance > 0 ? Math.min(100, (approvedSeconds / allowance) * 100) : 0
  const activeLook = lookById(look)
  const canAdd = looksLikeClipUrl(url) && !busy
  const selectedCut = CLIP_CUTS.find((c) => c.id === cutId) ?? CLIP_CUTS[2]

  return (
    <div className="min-h-screen pt-20 lg:pt-28 pb-24">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 space-y-5">

        {/* ── Header ── */}
        <header className="pt-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary-400">Studio</p>
          <h1 className="mt-1.5 text-4xl sm:text-5xl font-black font-display text-white tracking-[-0.02em] leading-[0.95]">
            Your reel,<br />on the network.
          </h1>
        </header>

        {/* ── 1. The number that matters ── */}
        <section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-transparent p-5">
          <div className="absolute -top-24 -right-16 w-56 h-56 rounded-full bg-primary-500/10 blur-3xl pointer-events-none" />

          <div className="relative flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">Airtime today</p>
              <p className="mt-1 text-5xl font-black font-display text-white leading-none tracking-tight tabular-nums">
                {airtimeLabel(allowance)}
              </p>
            </div>
            <Link to="/account" className="shrink-0">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-semibold text-gray-300 hover:bg-white/[0.08]">
                <TrendingUp className="w-3.5 h-3.5" /> Hold more
              </span>
            </Link>
          </div>

          {/* THE REEL BAR — every approved segment, proportional, in order.
              This is the "picture of your reel" the whole screen is built on. */}
          <div className="relative mt-5">
            <div className="flex h-3 gap-[3px] rounded-full overflow-hidden bg-white/[0.05]">
              {approved.map((clip) => (
                <motion.div
                  key={clip.id}
                  layout
                  className={`${activeLook.accent} h-full first:rounded-l-full`}
                  style={{ width: `${allowance > 0 ? (clip.seconds / allowance) * 100 : 0}%` }}
                  title={`${clip.title || 'Clip'} · ${clipLength(clip.seconds)}`}
                />
              ))}
              {filledPct < 100 && <div className="flex-1 h-full bg-white/[0.04]" />}
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-3 text-[11px]">
              <span className="text-gray-400">
                <span className="font-mono text-white">{airtimeLabel(approvedSeconds)}</span> booked
              </span>
              <span className="font-mono text-gray-600">
                {airtimeLabel(Math.max(0, allowance - approvedSeconds))} spare
              </span>
            </div>
          </div>

          <p className="relative mt-3 text-[11px] text-gray-500 leading-relaxed">
            Out of {airtimeLabel(airtime?.inventorySeconds ?? 0)} of open air today
            {airtime?.networkBlockEnabled === false && ' — the 7 PM–3 AM block is open right now, so there is more of it'}.
            Your share follows your $CSGN: hold twice as much, get twice as much.
            {airtime?.capped && ' You are at the per-member ceiling, which exists so no one holder can take the whole channel.'}
          </p>
        </section>

        {/* ── 2. Post something ── */}
        <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-primary-400" />
            <h2 className="text-sm font-bold text-white">Add a clip</h2>
            <span className="ml-auto text-[10px] uppercase tracking-wider text-gray-600">YouTube · TikTok · Instagram</span>
          </div>

          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a link to your post"
            className="w-full px-4 py-3.5 bg-white/[0.04] border border-white/10 rounded-xl text-[15px] text-white placeholder-gray-600 focus:outline-none focus:border-primary-500/50 focus:bg-white/[0.06] transition-colors"
          />

          {/* CUTS instead of a seconds field. */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500 mb-2">How long a cut?</p>
            <div className="flex flex-wrap gap-2">
              {CLIP_CUTS.map((cut) => {
                const active = cut.id === cutId
                return (
                  <button
                    key={cut.id}
                    type="button"
                    onClick={() => setCutId(cut.id)}
                    className={`px-3 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                      active
                        ? 'border-primary-500/50 bg-primary-500/15 shadow-[0_0_0_3px_rgba(255,35,70,0.08)]'
                        : 'border-white/[0.08] bg-white/[0.02] hover:border-white/20'
                    }`}
                  >
                    <span className={`block text-xs font-bold ${active ? 'text-white' : 'text-gray-300'}`}>{cut.label}</span>
                    <span className="block text-[10px] font-mono text-gray-500">{cut.seconds}s</span>
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-[11px] text-gray-600">{selectedCut.hint}</p>
          </div>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder="Name it (optional)"
            className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-primary-500/50"
          />

          {url && !looksLikeClipUrl(url) && (
            <p className="text-xs text-gold">That needs to be a YouTube, TikTok or Instagram link.</p>
          )}
          {error && <p className="text-xs text-primary-400">{error}</p>}

          <Button variant="primary" size="lg" className="w-full" disabled={!canAdd} isLoading={busy} onClick={() => void add()}>
            Add to my reel
          </Button>
        </section>

        {/* ── 3. Your look ── */}
        <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary-400" />
            <h2 className="text-sm font-bold text-white">Your on-air look</h2>
          </div>
          <p className="mt-1 text-[11px] text-gray-500 leading-relaxed">
            The card that carries your name while your clip is on television.
          </p>

          {/* Live preview of the actual lower third. */}
          <div className="mt-4 relative h-24 rounded-xl overflow-hidden bg-black border border-white/[0.06]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(255,255,255,0.06),transparent_60%)]" />
            <div className="absolute left-4 bottom-4 rounded-lg bg-black/70 backdrop-blur-sm border border-white/10 pl-0 overflow-hidden flex">
              <span className={`w-1 ${activeLook.accent}`} />
              <span className="px-3 py-2">
                <span className="block text-[9px] uppercase tracking-[0.18em] text-gray-400">On CSGN</span>
                <span className="block text-base font-black text-white leading-tight">@{username || 'you'}</span>
              </span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {ON_AIR_LOOKS.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => void chooseLook(l.id)}
                className={`relative w-11 h-11 rounded-xl bg-gradient-to-br ${l.gradient} ring-2 transition-all cursor-pointer ${
                  look === l.id ? `${l.ring} scale-105` : 'ring-transparent opacity-60 hover:opacity-100'
                }`}
                title={l.label}
                aria-label={l.label}
              >
                {look === l.id && <Check className="absolute inset-0 m-auto w-4 h-4 text-white drop-shadow" />}
              </button>
            ))}
          </div>
        </section>

        {/* ── 4. The reel ── */}
        <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Clapperboard className="w-4 h-4 text-gray-400" /> Running order
              <span className="text-gray-600 font-normal">({sorted.length})</span>
            </h2>
            <span className="text-[10px] uppercase tracking-wider text-gray-600">Top airs first</span>
          </div>

          {loadingClips ? (
            <div className="p-10 text-center"><div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
          ) : sorted.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm text-gray-300 font-medium">Nothing in your reel yet</p>
              <p className="mt-1 text-xs text-gray-500">Paste a link above. It's on television once it's checked.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              <AnimatePresence initial={false}>
                {sorted.map((clip, index) => {
                  const status = STATUS[clip.status] ?? STATUS.pending
                  const cut = cutForSeconds(clip.seconds)
                  return (
                    <motion.div
                      key={clip.id}
                      layout
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      className={`p-3.5 flex gap-3 ${justAdded === clip.id ? 'bg-primary-500/[0.07]' : ''}`}
                    >
                      <div className="flex flex-col items-center gap-1 pt-1 shrink-0">
                        <button
                          onClick={() => void move(clip, -1)}
                          disabled={busy || index === 0}
                          className="text-gray-600 hover:text-white disabled:opacity-20 text-xs cursor-pointer"
                          aria-label="Move up"
                        >▲</button>
                        <GripVertical className="w-3 h-3 text-gray-700" />
                        <button
                          onClick={() => void move(clip, 1)}
                          disabled={busy || index === sorted.length - 1}
                          className="text-gray-600 hover:text-white disabled:opacity-20 text-xs cursor-pointer"
                          aria-label="Move down"
                        >▼</button>
                      </div>

                      <Poster platform={clip.platform} sourceUrl={clip.sourceUrl} className="w-24 h-[54px] shrink-0" />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-white truncate">{clip.title || 'Untitled clip'}</p>
                          <button
                            onClick={() => void remove(clip)}
                            disabled={busy}
                            className="shrink-0 text-gray-700 hover:text-primary-400 disabled:opacity-30 cursor-pointer"
                            aria-label="Remove"
                          ><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>

                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                          <span className={`inline-flex items-center gap-1 font-semibold ${status.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />{status.label}
                          </span>
                          <span className="text-gray-600">{CLIP_PLATFORM_LABELS[clip.platform as ClipPlatform] ?? clip.platform}</span>
                          <a href={clip.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-gray-600 hover:text-cyan-400">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </p>

                        {/* Change the cut inline. Still no number to type. */}
                        <div className="mt-2 flex flex-wrap gap-1">
                          {CLIP_CUTS.map((c) => (
                            <button
                              key={c.id}
                              onClick={() => void setClipCut(clip, c.seconds)}
                              disabled={busy}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors cursor-pointer disabled:opacity-40 ${
                                cut.seconds === c.seconds
                                  ? 'bg-white/15 text-white'
                                  : 'bg-white/[0.03] text-gray-500 hover:text-gray-300'
                              }`}
                            >
                              {c.seconds}s
                            </button>
                          ))}
                        </div>

                        {clip.rejectReason && (
                          <p className="mt-1.5 text-[11px] text-primary-400 leading-snug">{clip.rejectReason}</p>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          )}
        </section>

        {/* ── 5. When you're on ── */}
        <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" /> You're on at
          </h2>
          {airings.length === 0 ? (
            <p className="mt-2.5 text-xs text-gray-500 leading-relaxed">
              Nothing scheduled yet. Approved clips land in the next rebuild and the exact times
              show up here.
            </p>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap gap-2">
                {airings.map((a, i) => (
                  <span
                    key={`${a.clipId}-${i}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-live/25 bg-live/[0.08] px-2.5 py-1.5 text-xs font-bold font-mono text-live"
                  >
                    <Radio className="w-3 h-3" />
                    {new Date(a.startsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-gray-500 leading-relaxed">
                Real times — this is the schedule the broadcast runs from. If somebody claims one of
                those two-hour blocks and goes live, their stream wins and your clip moves to the
                next opening.
              </p>
            </>
          )}
        </section>

        <p className="text-[11px] text-gray-600 leading-relaxed px-1">
          Every clip is watched by a person before it airs. We never host your video — we point at
          your post, so the views and the follows stay on your account.
        </p>

      </div>
    </div>
  )
}
