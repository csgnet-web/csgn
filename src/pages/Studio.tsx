import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Check, Clapperboard, Clock, ExternalLink, GripVertical, Link2,
  Radio, Scissors, Sparkles, Trash2, TrendingUp,
} from 'lucide-react'
import { useAuth } from '@/contexts/useAuth'
import { LowerThird } from '@/components/broadcast/LowerThird'
import { usePhantomWallet } from '@/hooks/usePhantomWallet'
import { proveWallet } from '@/lib/walletProof'
import { SignInWall } from '@/components/auth/SignInWall'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import {
  looksLikeClipUrl, airtimeLabel, clipLength, supportsTrim, timecode, ON_AIR_STYLES,
  lookById, ON_AIR_LOOKS, CLIP_PLATFORM_LABELS, PLATFORM_STYLE,
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
  thumbnailUrl: string
  /** What actually airs — the full video, or the member's crop of it. */
  seconds: number
  /** The video's real full length, 0 when the platform would not say. */
  sourceSeconds: number
  trimStartSeconds: number
  trimEndSeconds: number
  /** True when the platform gave us the real runtime; false when we assumed it. */
  measured: boolean
  order: number
  status: string
  rejectReason: string | null
}

interface Airtime {
  /** What the member's $CSGN earns today, whether or not anything is approved. */
  seconds: number
  /** What the playlist has actually laid down for them. */
  scheduledSeconds: number
  supplyShare: number
  capped: boolean
  inventorySeconds: number
  networkBlockEnabled: boolean
  builtAt: string | null
  /** Which of the four zeroes this is, decided server-side. 'ok' when > 0. */
  reason: 'ok' | 'no_clips' | 'no_wallet' | 'no_balance' | 'no_inventory'
  /** The wallet the allowance was counted against, or '' when none is linked. */
  walletAddress: string
  /** Live $CSGN balance. null means we could not read it — NOT that it is zero. */
  balance: number | null
}

const STATUS: Record<string, { label: string; dot: string; text: string }> = {
  pending: { label: 'In review', dot: 'bg-gold', text: 'text-gold' },
  approved: { label: 'On air', dot: 'bg-live', text: 'text-live' },
  rejected: { label: 'Not accepted', dot: 'bg-primary-500', text: 'text-primary-400' },
}

/* ─── Poster frame ─── */

function Poster({ platform, thumbnailUrl, className = '' }: { platform: string; thumbnailUrl: string; className?: string }) {
  // The real poster frame, fetched server-side from the platform's own oEmbed
  // when the clip was submitted. A designed platform card stands in when the
  // provider gave us nothing — that beats a broken image every time.
  const poster = thumbnailUrl || null
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
  return (
    <SignInWall
      Icon={Clapperboard}
      title="Get on television."
      body="Post a link to something you already made. It airs on CSGN between the live blocks — you don't have to be there."
      cta="Sign in to post"
    />
  )
}

/**
 * The crop control.
 *
 * SHOWN ONLY WHEN IT IS NEEDED — that is the whole rule. A clip shorter than the
 * member's airtime airs in full and this never appears; asking somebody to trim
 * a video that already fits is busywork. It surfaces when the video is longer
 * than the time they have earned, which is the one case where a decision is
 * genuinely theirs to make: which part of it goes out.
 *
 * A slider, not two number fields. Nobody knows what second 47 of their own clip
 * looks like, but everybody can drag a window along a bar.
 */
function CropRow({
  clip, allowance, busy, onCrop,
}: {
  clip: Clip
  allowance: number
  busy: boolean
  onCrop: (clip: Clip, start: number, end: number) => void
}) {
  const source = clip.sourceSeconds
  const cropped = clip.trimStartSeconds > 0 || clip.trimEndSeconds > 0
  const [start, setStart] = useState(clip.trimStartSeconds)
  const [open, setOpen] = useState(false)

  // No measured length means there is nothing honest to crop against.
  if (source <= 0) return null

  const overruns = allowance > 0 && source > allowance
  if (!overruns && !cropped && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-gray-600 hover:text-gray-300 cursor-pointer touch-manipulation"
      >
        <Scissors className="w-3 h-3" /> Crop
      </button>
    )
  }

  // The window length is whatever fits: their airtime, or the whole video.
  const windowLength = Math.min(source, allowance > 0 ? allowance : source)
  const maxStart = Math.max(0, source - windowLength)
  const end = Math.min(source, start + windowLength)

  return (
    <div className="mt-2 rounded-lg border border-white/[0.07] bg-white/[0.02] p-2.5">
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="inline-flex items-center gap-1.5 text-gray-300">
          <Scissors className="w-3 h-3" />
          {overruns ? 'Longer than your airtime — pick the part that airs' : 'Pick the part that airs'}
        </span>
        <span className="font-mono text-gray-500 tabular-nums">
          {timecode(start)}–{timecode(end)}
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={maxStart}
        value={Math.min(start, maxStart)}
        onChange={(e) => setStart(Number(e.target.value))}
        disabled={busy || maxStart === 0}
        aria-label="Crop start"
        className="mt-2 w-full accent-primary-500 touch-manipulation"
      />

      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="text-[10px] text-gray-600">
          {clipLength(windowLength)} of {clipLength(source)}
          {!supportsTrim(clip.platform) && ' · this platform always starts at the beginning'}
        </span>
        <button
          type="button"
          disabled={busy || start === clip.trimStartSeconds}
          onClick={() => { onCrop(clip, start, end); setOpen(false) }}
          className="px-2.5 py-1 rounded-md bg-white/10 text-[11px] font-bold text-white disabled:opacity-30 cursor-pointer touch-manipulation"
        >
          Save crop
        </button>
      </div>
    </div>
  )
}

/** Jupiter, pre-loaded with our mint. The fastest path from "I want more
 *  airtime" to actually holding more, which is the only reason the button
 *  exists. */
export const JUPITER_SWAP_URL =
  'https://jup.ag/swap/SOL-GFV7fphvprMr1PYpYGPJort2QP7JJLEp3J1Buu7Zpump'

/** A supply share as something a person reads. Tiny fractions are the norm
 *  here, so this never rounds a real holding down to "0%". */
function formatShare(fraction: number): string {
  const pct = Math.max(0, fraction) * 100
  if (pct <= 0) return '0%'
  if (pct >= 1) return `${pct.toFixed(1)}%`
  if (pct >= 0.01) return `${pct.toFixed(2)}%`
  return '<0.01%'
}

/** $CSGN, readably. A raw 1800000 on a card is a number people misread. */
const fmtCsgn = (n: number): string =>
  n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(Math.round(n))

const shortWallet = (a: string): string => (a && a.length > 9 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a || '—')

/**
 * ZERO SECONDS, EXPLAINED.
 *
 * Four unrelated situations produce an allowance of zero and the member can act
 * on three of them. The screen used to say "hold $CSGN" for all four — so a
 * member holding 1.8 million $CSGN who had signed up with Google, and therefore
 * had no wallet on file, was told to go buy a token they already owned, with no
 * control anywhere in the app that would have fixed it.
 *
 * The server names the cause (`myClips` → `airtime.reason`); this renders one
 * next action for it and nothing else.
 */
function ZeroAirtime({
  reason, balance, onLinkWallet, linking, error,
}: {
  reason: 'ok' | 'no_clips' | 'no_wallet' | 'no_balance' | 'no_inventory'
  balance: number | null
  onLinkWallet: () => void
  linking: boolean
  error: string
}) {
  if (reason === 'no_clips') {
    return (
      <div className="relative mt-4 rounded-xl border border-live/25 bg-live/[0.06] p-4">
        <p className="text-sm font-bold text-white">You have airtime. Nothing is filling it yet.</p>
        <p className="mt-1 text-[11px] text-gray-400 leading-relaxed">
          Your $CSGN has already earned you the time above — it is yours whether or not you post.
          Add a link below and it goes on air as soon as it clears review.
        </p>
      </div>
    )
  }

  if (reason === 'no_wallet') {
    return (
      <div className="relative mt-4 rounded-xl border border-primary-500/25 bg-primary-500/[0.07] p-4">
        <p className="text-sm font-bold text-white">Connect your wallet to claim your airtime.</p>
        <p className="mt-1 text-[11px] text-gray-400 leading-relaxed">
          Your share of the day is worked out from the $CSGN you hold, and we have no wallet on file
          for this account yet — so it is currently counting zero. Connecting one is a signature, not
          a transaction: nothing moves and nothing is approved for spending.
        </p>
        <Button variant="primary" size="sm" className="mt-3" isLoading={linking} onClick={onLinkWallet}>
          Connect wallet
        </Button>
        {error && <p className="mt-2 text-[11px] text-red-300">{error}</p>}
      </div>
    )
  }

  if (reason === 'no_balance') {
    return (
      <div className="relative mt-4 rounded-xl border border-primary-500/25 bg-primary-500/[0.07] p-4">
        <p className="text-sm font-bold text-white">Hold $CSGN to get airtime.</p>
        <p className="mt-1 text-[11px] text-gray-400 leading-relaxed">
          Airtime is shared out by holdings — that is what the token is for. Watching, claiming a
          two-hour block and going live are all free and always will be; this part is not.
          {balance === null
            ? ' We could not read your balance just now, so this may simply be a bad connection to the chain — reload in a minute before buying anything.'
            : ' Your linked wallet is holding none right now.'}
        </p>
        <a href={JUPITER_SWAP_URL} target="_blank" rel="noopener noreferrer" className="inline-block mt-3">
          <Button variant="primary" size="sm">Get $CSGN on Jupiter</Button>
        </a>
      </div>
    )
  }

  // no_inventory — they did everything right and the day is simply full.
  return (
    <div className="relative mt-4 rounded-xl border border-white/[0.1] bg-white/[0.03] p-4">
      <p className="text-sm font-bold text-white">No open air in the next few hours.</p>
      <p className="mt-1 text-[11px] text-gray-400 leading-relaxed">
        Live blocks and the 7 PM–3 AM network block outrank clips, and right now they cover the
        schedule. Your reel is queued and picks up its share as soon as a gap opens.
      </p>
    </div>
  )
}

export default function Studio() {
  const { user, loading } = useAuth()
  const [clips, setClips] = useState<Clip[]>([])
  const [airtime, setAirtime] = useState<Airtime | null>(null)
  const [airings, setAirings] = useState<Array<{ startsAt: string; seconds: number; clipId: string }>>([])
  const [look, setLook] = useState('signal')
  const [style, setStyle] = useState('bar')
  const [showAvatar, setShowAvatar] = useState(true)
  const [socialAvatar, setSocialAvatar] = useState<{ provider: string; url: string } | null>(null)
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState(false)
  const [loadingClips, setLoadingClips] = useState(true)
  const [error, setError] = useState('')

  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [justAdded, setJustAdded] = useState('')

  const { connect, signMessage } = usePhantomWallet()
  const [linkingWallet, setLinkingWallet] = useState(false)
  const [walletError, setWalletError] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await api.myClips()
      setClips(res.clips)
      setAirtime(res.airtime)
      setAirings(res.airings)
      setLook(res.onAirLook || 'signal')
      setStyle(res.onAirStyle || 'bar')
      setShowAvatar(res.showAvatarOnAir !== false)
      setSocialAvatar(res.socialAvatar)
      setUsername(res.username || '')
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your studio.')
    }
    setLoadingClips(false)
  }, [])

  /**
   * Attach a wallet to this account.
   *
   * A SIGNATURE, NOT A TRANSACTION — the wallet signs a challenge string, which
   * proves control without moving anything or granting any spending approval.
   * That distinction is worth stating on the button, because "connect wallet"
   * has been trained by enough drainers that a careful person is right to pause.
   */
  const linkWallet = useCallback(async () => {
    setWalletError('')
    setLinkingWallet(true)
    try {
      const addr = await connect()
      if (!addr) throw new Error('Wallet connection was cancelled.')
      const proof = await proveWallet(addr, signMessage)
      await api.linkPhantom(proof)
      // Reload rather than patching state: linking changes the allowance, and
      // the server recomputes it on this call. Two sources for one number is
      // how they end up disagreeing.
      await load()
    } catch (err) {
      setWalletError(err instanceof Error ? err.message : 'Could not link that wallet.')
    }
    setLinkingWallet(false)
  }, [connect, signMessage, load])

  useEffect(() => {
    if (!user) return
    ;(async () => { await load() })()
  }, [user, load])

  const add = async () => {
    setBusy(true); setError('')
    try {
      const res = await api.submitClip(url.trim(), title.trim())
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

  /**
   * Crop a clip.
   *
   * Only ever NEEDED when a member's earned airtime is shorter than their
   * video — the full length airs otherwise, untouched. The window is bounded
   * server-side by the real runtime, so this can only ever select a piece of
   * their own clip.
   */
  const crop = async (clip: Clip, startSeconds: number, endSeconds: number) => {
    setBusy(true)
    setClips((prev) => prev.map((c) => (
      c.id === clip.id
        ? { ...c, trimStartSeconds: startSeconds, trimEndSeconds: endSeconds, seconds: endSeconds - startSeconds, status: 'pending' }
        : c
    )))
    try {
      await api.updateMyClip(clip.id, { action: 'update', trimStartSeconds: startSeconds, trimEndSeconds: endSeconds })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not crop that clip.')
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

  /** One save path for the whole on-air identity. Optimistic — the preview
   *  updates on tap and a failed write is not worth an error banner over the
   *  reel, because nothing about the member's content is at risk. */
  const saveIdentity = async (patch: { onAirLook?: string; onAirStyle?: string; showAvatarOnAir?: boolean }) => {
    if (patch.onAirLook) setLook(patch.onAirLook)
    if (patch.onAirStyle) setStyle(patch.onAirStyle)
    if (patch.showAvatarOnAir !== undefined) setShowAvatar(patch.showAvatarOnAir)
    try {
      const res = await api.setOnAirIdentity(patch)
      // The server re-reads the avatar off the ID token on every save, so this
      // is also how a changed picture on X finds its way here.
      if (res.socialAvatar) setSocialAvatar(res.socialAvatar)
    } catch {
      // Cosmetic.
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
  // Airtime is what the token buys. No holdings, no airtime — said plainly
  // rather than shown as a zero the member has to interpret.
  const hasAirtime = allowance > 0

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
            {/* Straight to a Jupiter swap for our mint. "Hold more" used to go
                to /account, which is a settings page — it told somebody who had
                just decided to buy to go and look at their own profile. */}
            <a href={JUPITER_SWAP_URL} target="_blank" rel="noopener noreferrer" className="shrink-0">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-semibold text-gray-300 hover:bg-white/[0.08]">
                <TrendingUp className="w-3.5 h-3.5" /> Hold more
              </span>
            </a>
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

          {hasAirtime ? (
            <>
              <p className="relative mt-3 text-[11px] text-gray-500 leading-relaxed">
                Out of {airtimeLabel(airtime?.inventorySeconds ?? 0)} of open air today
                {airtime?.networkBlockEnabled === false && ' — the 7 PM–3 AM block is open right now, so there is more of it'}.
                One to one with your $CSGN: hold twice as much, get twice as much.
                {airtime?.capped && ' You are at the per-member ceiling, which exists so no one holder can take the whole channel.'}
              </p>
              {/* THE WORKING, SHOWN. This number is checkable against the chain
                  and against the market cap, and showing the two inputs is what
                  makes it checkable rather than something to take on faith. */}
              {airtime?.balance != null && (
                <p className="relative mt-1.5 text-[11px] text-gray-600">
                  <span className="font-mono text-gray-400">{fmtCsgn(airtime.balance)} $CSGN</span>
                  {airtime.supplyShare > 0 && <> · {formatShare(airtime.supplyShare)} of supply</>}
                  {' '}in <span className="font-mono">{shortWallet(airtime.walletAddress)}</span>.
                </p>
              )}
            </>
          ) : (
            /* FOUR DIFFERENT ZEROES, four different things to do about it.
               This block used to say "hold $CSGN" for all of them — including to
               a member who held plenty but had never linked a wallet, which is
               both wrong and unfixable from the screen telling them. */
            <ZeroAirtime
              reason={airtime?.reason ?? 'no_clips'}
              balance={airtime?.balance ?? null}
              onLinkWallet={() => void linkWallet()}
              linking={linkingWallet}
              error={walletError}
            />
          )}
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

          {/* Live preview of the actual lower third, in the chosen shape. */}
          <div className="mt-4 relative h-28 rounded-xl overflow-hidden bg-black border border-white/[0.06]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(255,255,255,0.06),transparent_60%)]" />
            <LowerThird
              style={style}
              look={activeLook}
              username={username || 'you'}
              avatarUrl={showAvatar ? socialAvatar?.url ?? '' : ''}
            />
          </div>

          {/* COLOUR */}
          <div className="mt-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500">Colour</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {ON_AIR_LOOKS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => void saveIdentity({ onAirLook: l.id })}
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
          </div>

          {/* SHAPE — colour alone gives ten near-identical cards; the
              silhouette is what a viewer registers before they read a name. */}
          <div className="mt-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500">Shape</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {ON_AIR_STYLES.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => void saveIdentity({ onAirStyle: st.id })}
                  className={`rounded-xl border px-3 py-2.5 text-left transition-colors cursor-pointer ${
                    style === st.id
                      ? 'border-primary-500/50 bg-primary-500/[0.08]'
                      : 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]'
                  }`}
                >
                  <span className={`block text-xs font-bold ${style === st.id ? 'text-white' : 'text-gray-300'}`}>{st.label}</span>
                  <span className="block mt-0.5 text-[10px] text-gray-500 leading-snug">{st.hint}</span>
                </button>
              ))}
            </div>
          </div>

          {/* THE PICTURE. Only offered when there actually is one — a toggle for
              an avatar that does not exist is a control that does nothing. */}
          {socialAvatar ? (
            <label className="mt-4 flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 cursor-pointer hover:bg-white/[0.04] transition-colors">
              <img src={socialAvatar.url} alt="" className="w-9 h-9 rounded-full object-cover bg-white/5 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-white">Show my picture on air</span>
                <span className="block text-[10px] text-gray-500">
                  From your {socialAvatar.provider === 'twitter.com' ? 'X' : 'Google'} account.
                </span>
              </span>
              <input
                type="checkbox"
                checked={showAvatar}
                onChange={(e) => void saveIdentity({ showAvatarOnAir: e.target.checked })}
                className="h-4 w-4 shrink-0 accent-primary-500 cursor-pointer"
              />
            </label>
          ) : (
            <p className="mt-3 text-[11px] text-gray-600 leading-relaxed">
              Sign in with X and your profile picture rides along on your lower third.
            </p>
          )}
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

                      <Poster platform={clip.platform} thumbnailUrl={clip.thumbnailUrl} className="w-24 h-[54px] shrink-0" />

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
                          <span className="font-mono text-gray-500" title={clip.measured ? 'Runtime read from the platform' : 'The platform would not give a runtime, so this is our default'}>
                            {clipLength(clip.seconds)}{!clip.measured && '*'}
                          </span>
                          <a href={clip.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-gray-600 hover:text-cyan-400">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </p>

                        {clip.rejectReason && (
                          <p className="mt-1.5 text-[11px] text-primary-400 leading-snug">{clip.rejectReason}</p>
                        )}

                        <CropRow clip={clip} allowance={allowance} busy={busy} onCrop={crop} />
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
