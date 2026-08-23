import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Check, Clapperboard, Clock, ExternalLink, GripVertical, Link2,
  Lock, Radio, Scissors, Sparkles, Trash2, TrendingUp,
} from 'lucide-react'
import { useAuth } from '@/contexts/useAuth'
import { useSearchParams } from 'react-router-dom'
import TikTokImport from '@/components/studio/TikTokImport'
import { LowerThird } from '@/components/broadcast/LowerThird'
import { JUPITER_SWAP_URL } from '@/config/token'
import { usePhantomWallet } from '@/hooks/usePhantomWallet'
import { proveWallet } from '@/lib/walletProof'
import { SignInWall } from '@/components/auth/SignInWall'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import {
  looksLikeClipUrl, airtimeLabel, clipLength, supportsTrim, timecode, ON_AIR_STYLES, ON_AIR_MOTIONS,
  lookById, ON_AIR_LOOKS, CLIP_PLATFORM_LABELS, PLATFORM_STYLE,
  type ClipPlatform,
} from '@/lib/clipEmbed'
import { usePageMeta } from '@/hooks/usePageMeta'

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
  /** This broadcast day's LOCKED entitlement — fixed at 2 AM ET, and it does
   *  not move until the next cutover. */
  seconds: number
  /** What the playlist has laid down into the air still to come. Smaller than
   *  `seconds` late in the day, which is correct rather than a bug. */
  scheduledSeconds: number
  supplyShare: number
  capped: boolean
  /** Open air across the whole broadcast day — the entitlement denominator. */
  inventorySeconds: number
  /** Open air still to come today. */
  remainingSeconds: number
  dayKey: string
  lockedAt: string | null
  nextLockAt: string
  networkBlockEnabled: boolean
  builtAt: string | null
  /** Which of the four zeroes this is, decided server-side. 'ok' when > 0. */
  reason: 'ok' | 'no_clips' | 'no_wallet' | 'unreadable' | 'no_balance' | 'no_inventory'
  /** The wallet the allowance was counted against, or '' when none is linked. */
  walletAddress: string
  /** Live $CSGN balance. null means we could not read it — NOT that it is zero. */
  balance: number | null
  balanceError: string
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

/** A supply share as something a person reads. Tiny fractions are the norm
 *  here, so this never rounds a real holding down to "0%". */
function formatShare(fraction: number): string {
  const pct = Math.max(0, fraction) * 100
  if (pct <= 0) return '0%'
  if (pct >= 1) return `${pct.toFixed(1)}%`
  if (pct >= 0.01) return `${pct.toFixed(2)}%`
  return '<0.01%'
}

/**
 * THE HARD STOP, ON SCREEN.
 *
 * The number above this is fixed for the broadcast day and a member needs to
 * know that, because otherwise the honest behaviour looks broken: they buy more
 * $CSGN at lunchtime, refresh, and nothing changes. Saying when it was decided
 * and when it is decided again turns that from a bug report into a rule.
 *
 * The countdown is live because "tomorrow" is ambiguous at 1 AM — which is
 * exactly when somebody deciding whether to buy now or wait would be looking.
 */
function LockNotice({ airtime }: { airtime: Airtime }) {
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  const nextMs = Date.parse(airtime.nextLockAt)
  if (!Number.isFinite(nextMs)) return null
  const left = Math.max(0, nextMs - nowMs)
  const hours = Math.floor(left / 3_600_000)
  const mins = Math.floor((left % 3_600_000) / 60_000)

  return (
    <div className="relative mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-[11px]">
      <Lock className="w-3 h-3 text-gray-500 shrink-0" />
      <span className="text-gray-400">
        Set at 2:00 AM ET and fixed until the next one.
      </span>
      <span className="font-mono text-gray-300 tabular-nums">
        {hours > 0 ? `${hours}h ${String(mins).padStart(2, '0')}m` : `${mins}m`}
      </span>
      <span className="text-gray-600">to go.</span>
      <span className="w-full text-gray-600 leading-relaxed">
        Buy more now and it counts from the next one — that's what makes this number hold still.
      </span>
    </div>
  )
}

/**
 * THE ONE NEXT THING.
 *
 * The Studio shows a lot of true information and, before this, ended without
 * ever telling anybody what to do with it. That is the difference between a
 * dashboard and a product people come back to: a dashboard reports state, a
 * loop closes with an ask.
 *
 * Exactly ONE ask, chosen by where the member actually is. Two asks is the same
 * as none — the reader has to decide which matters, and deciding is the thing
 * they came here to avoid.
 *
 * The order below is the funnel, and it is deliberate: fill the airtime you
 * already have before being told to buy more. Selling upward to somebody who
 * has not used what they own is how a product feels like it is extracting
 * rather than serving.
 */
function NextStep({ clips, approvedSeconds, allowance, hasAirtime, onAddFocus }: {
  clips: Clip[]
  approvedSeconds: number
  allowance: number
  hasAirtime: boolean
  onAddFocus: () => void
}) {
  const spare = Math.max(0, allowance - approvedSeconds)
  const pending = clips.filter((c) => c.status === 'pending').length
  const rejected = clips.filter((c) => c.status === 'rejected').length

  // 1. Something needs fixing. Always first — it is the only state where the
  //    member is blocked rather than merely idle.
  if (rejected > 0) {
    return (
      <Nudge tone="warn" title={`${rejected} clip${rejected === 1 ? '' : 's'} didn't make it`}
        body="Open the reel below for the reason. Most rejections are a quick fix — music, or a link to the wrong post." />
    )
  }

  // 2. Empty reel and real airtime. The single highest-value action available.
  if (hasAirtime && clips.length === 0) {
    return (
      <Nudge tone="go" title={`${airtimeLabel(allowance)} of television is sitting empty`}
        body="Your $CSGN already earned it. Paste one link and it starts airing."
        cta="Add your first clip" onCta={onAddFocus} />
    )
  }

  // 3. Spare airtime. The repeatable loop — this is the one that should fire
  //    most often, and it is why the reel is a reel rather than a single slot.
  if (hasAirtime && spare > 30) {
    return (
      <Nudge tone="go" title={`${airtimeLabel(spare)} still unfilled today`}
        body="Add another clip and it goes into the same day's rotation."
        cta="Add another" onCta={onAddFocus} />
    )
  }

  // 4. Waiting on review. Nothing to do, and saying so is better than an ask
  //    they cannot act on.
  if (pending > 0) {
    return (
      <Nudge tone="wait" title={`${pending} clip${pending === 1 ? '' : 's'} in review`}
        body="We watch everything before it airs. You'll see it move to On air here when it clears." />
    )
  }

  // 5. Full. The only moment where selling more is the honest next step,
  //    because they have used everything they own.
  if (hasAirtime && spare <= 30 && clips.length > 0) {
    return (
      <Nudge tone="win" title="Your whole day is booked"
        body="Every second your $CSGN earned today has a clip in it. More $CSGN is the only way to get more time."
        cta="Get more $CSGN" href={JUPITER_SWAP_URL} />
    )
  }

  return null
}

function Nudge({ tone, title, body, cta, onCta, href }: {
  tone: 'go' | 'warn' | 'wait' | 'win'
  title: string
  body: string
  cta?: string
  onCta?: () => void
  href?: string
}) {
  const skin = tone === 'warn' ? 'border-primary-500/30 bg-primary-500/[0.07]'
    : tone === 'wait' ? 'border-white/[0.08] bg-white/[0.02]'
    : tone === 'win' ? 'border-gold/30 bg-gold/[0.06]'
    : 'border-live/30 bg-live/[0.06]'

  return (
    <section className={`rounded-2xl border p-5 ${skin}`}>
      <p className="text-sm font-bold text-white">{title}</p>
      <p className="mt-1 text-[12px] text-gray-400 leading-relaxed">{body}</p>
      {cta && href && (
        <a href={href} target="_blank" rel="noopener noreferrer" className="inline-block mt-3.5">
          <Button variant="primary" size="sm">{cta}</Button>
        </a>
      )}
      {cta && onCta && (
        <Button variant="primary" size="sm" className="mt-3.5" onClick={onCta}>{cta}</Button>
      )}
    </section>
  )
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
  reason: 'ok' | 'no_clips' | 'no_wallet' | 'unreadable' | 'no_balance' | 'no_inventory'
  balance: number | null
  onLinkWallet: () => void
  linking: boolean
  error: string
}) {
  // A read we could not make is NOT a balance of zero, and saying so is the
  // difference between "the network is having a moment" and "your tokens do
  // not count" — which is what a bare 0 said to a member holding 1.89M.
  if (reason === 'unreadable') {
    return (
      <div className="relative mt-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-4">
        <p className="text-sm font-bold text-white">We couldn't read your balance just now.</p>
        <p className="mt-1 text-[11px] text-gray-400 leading-relaxed">
          Your wallet is linked and your tokens are exactly where you left them — Solana's public
          RPC is rate-limiting us. This clears on its own; reload in a minute.
        </p>
      </div>
    )
  }

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
  usePageMeta({
    title: 'Studio — Put Your Clip on CSGN',
    description: "Paste a link to a YouTube, TikTok or Instagram post and it airs on the CSGN channel. See exactly how much airtime your $CSGN earns you and when your clip is next on.",
    path: '/studio',
  })

  const { user, loading } = useAuth()
  // How the TikTok round trip came back. The callback redirects here rather
  // than to a page of its own — there is nothing to say that is not better said
  // next to the picker it just filled.
  const [searchParams, setSearchParams] = useSearchParams()
  const tiktokReturn = searchParams.get('tiktok')
  const [clips, setClips] = useState<Clip[]>([])
  const [airtime, setAirtime] = useState<Airtime | null>(null)
  const [airings, setAirings] = useState<Array<{ startsAt: string; seconds: number; clipId: string }>>([])
  const [look, setLook] = useState('signal')
  const [style, setStyle] = useState('bar')
  // `entrance`, not `motion` — framer-motion's `motion` is imported into this
  // file and shadowing it silently broke every animated element on the page.
  const [entrance, setEntrance] = useState('cut')
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
      setEntrance(res.onAirMotion || 'cut')
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
  const saveIdentity = async (patch: { onAirLook?: string; onAirStyle?: string; onAirMotion?: string; showAvatarOnAir?: boolean }) => {
    if (patch.onAirLook) setLook(patch.onAirLook)
    if (patch.onAirStyle) setStyle(patch.onAirStyle)
    if (patch.onAirMotion) setEntrance(patch.onAirMotion)
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
  const pendingCount = sorted.filter((c) => c.status === 'pending').length
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
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">
                Your airtime · locked for today
              </p>
              <p className="mt-1 text-5xl font-black font-display text-white leading-none tracking-tight tabular-nums">
                {airtimeLabel(allowance)}
              </p>
              {/* THE RATIO, SPELLED OUT. This is the entire product promise and
                  it was previously only inferable from a sentence below the
                  fold. Three numbers, in the order somebody checks them: what
                  you hold, what share of supply that is, what it buys. */}
              {airtime?.balance != null && (
                <p className="mt-2 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[11px]">
                  <span className="font-mono text-white">{fmtCsgn(airtime.balance)} $CSGN</span>
                  <span className="text-gray-600">=</span>
                  <span className="font-mono text-primary-300">{formatShare(airtime.supplyShare)}</span>
                  <span className="text-gray-500">of supply</span>
                  <span className="text-gray-600">=</span>
                  <span className="font-mono text-primary-300">{formatShare(airtime.supplyShare)}</span>
                  <span className="text-gray-500">of the open air</span>
                </p>
              )}
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

            {/* WHAT IS ACTUALLY SCHEDULED, next to what is earned. Two different
                questions — "what did my bag buy" and "what is on the playlist
                right now" — and showing only the first made the gap between
                them look like a bug when it is just the review queue. */}
            {(airtime?.scheduledSeconds ?? 0) > 0 && (
              <p className="mt-2 text-[11px] text-gray-500">
                <span className="font-mono text-live">{airtimeLabel(airtime!.scheduledSeconds)}</span>{' '}
                laid down on the air still to come today.
              </p>
            )}
          </div>

          {hasAirtime ? (
            <>
              {/* THE DENOMINATOR, SAID OUT LOUD.
                  Clip airtime is one-to-one with your share of the supply, but
                  a share of WHAT was never stated — and it moves: with the
                  7 PM–3 AM master block reserved, clips divide a sixteen-hour
                  day; with it released, twenty-four. Somebody whose seconds
                  jumped overnight deserves the reason rather than a mystery. */}
              <p className="relative mt-3 text-[11px] text-gray-500 leading-relaxed">
                Out of {airtimeLabel(airtime?.inventorySeconds ?? 0)} of clip air today
                {airtime?.networkBlockEnabled === false
                  ? ' — a full 24-hour day, because the 7 PM–3 AM master block is released right now'
                  : ' — a 16-hour day, with 7 PM–3 AM ET reserved for the master block'}.
                One to one with your $CSGN: your share of the 1,000,000,000 supply is your share of the reel.
                {airtime?.capped && ' You are at the per-member ceiling, which exists so no one holder can take the whole channel.'}
              </p>
              {/* THE WORKING, SHOWN. Checkable against the chain and against
                  the market cap, which is what makes it a fact rather than
                  something to take on faith. */}
              {airtime?.balance != null && (
                <p className="relative mt-1.5 text-[11px] text-gray-600">
                  <span className="font-mono text-gray-400">{fmtCsgn(airtime.balance)} $CSGN</span>
                  {airtime.supplyShare > 0 && <> · {formatShare(airtime.supplyShare)} of supply</>}
                  {' '}in <span className="font-mono">{shortWallet(airtime.walletAddress)}</span>.
                </p>
              )}
              {airtime && <LockNotice airtime={airtime} />}
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

        {/* ── 2a. Import, for anyone with TikTok connected ──
            Above the paste box on purpose: ticking a video you already made is
            a smaller ask than fetching a link, so the smaller ask goes first. */}
        {tiktokReturn && (
          <div className={`rounded-xl border px-4 py-3 text-[13px] ${
            tiktokReturn === 'connected'
              ? 'border-live/30 bg-live/[0.08] text-white'
              : 'border-gold/30 bg-gold/[0.06] text-gold'
          }`}>
            {tiktokReturn === 'connected' && 'TikTok connected — your videos are below.'}
            {tiktokReturn === 'cancelled' && 'TikTok connection cancelled. Nothing changed.'}
            {tiktokReturn === 'expired' && 'That TikTok link expired. Start the connection again.'}
            {tiktokReturn === 'failed' && "TikTok didn't complete the connection. Try again in a moment."}
            <button
              type="button"
              onClick={() => setSearchParams({}, { replace: true })}
              className="ml-2 underline text-[12px] opacity-70 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        )}
        <TikTokImport onImported={load} />

        {/* ── 2. Post something ── */}
        <section id="csgn-add-clip" className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-4 scroll-mt-24">
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

        {/* ── 3. The reel ── */}
        <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Clapperboard className="w-4 h-4 text-primary-400" /> My Reel
              <span className="text-gray-600 font-normal">({sorted.length})</span>
            </h2>
            {/* WHAT IS ACTUALLY HAPPENING TO THEIR STUFF, at a glance. "Top airs
                first" described the sort order — true, and not the thing anybody
                opens this page to find out. */}
            <span className="flex items-center gap-2.5 text-[10px] uppercase tracking-wider">
              {approved.length > 0 && <span className="text-live">{approved.length} on air</span>}
              {pendingCount > 0 && <span className="text-gold">{pendingCount} in review</span>}
              {approved.length === 0 && pendingCount === 0 && <span className="text-gray-600">Top airs first</span>}
            </span>
          </div>

          {loadingClips ? (
            <div className="p-10 text-center"><div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" /></div>
          ) : sorted.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-sm text-gray-300 font-medium">Your reel is empty</p>
              <p className="mt-1.5 text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">
                Paste a link to something you already posted. It's on a real television channel
                within a few hours — you don't have to be there, and you don't have to make
                anything new.
              </p>
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

        {/* ── THE NEXT THING TO DO ──
            One ask, always, chosen from where the member actually is. A screen
            that shows state without ever suggesting an action is a dashboard;
            a screen that always has exactly one obvious next move is a loop.
            More than one ask is the same as none. */}
        <NextStep
          clips={sorted}
          approvedSeconds={approvedSeconds}
          allowance={allowance}
          hasAirtime={hasAirtime}
          onAddFocus={() => document.getElementById('csgn-add-clip')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
        />

        {/* ── 4. When you're on ── */}
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
        {/* ── 5. Your on-air look — LAST, on purpose ── */}
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
              // `key` forces a remount when any of the three change, which is
              // what replays the entrance — otherwise picking a new motion
              // shows nothing until the next page load, and a control whose
              // effect you cannot see is a control nobody trusts.
              key={`${style}-${entrance}-${look}`}
              style={style}
              motion={entrance}
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
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
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

          {/* ENTRANCE — how the card arrives, which is the part a viewer
              actually notices. Two segments with the same colour and a
              different entrance read as two different people. */}
          <div className="mt-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500">Entrance</p>
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ON_AIR_MOTIONS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => void saveIdentity({ onAirMotion: m.id })}
                  className={`rounded-xl border px-3 py-2.5 text-left transition-colors cursor-pointer ${
                    entrance === m.id
                      ? 'border-primary-500/50 bg-primary-500/[0.08]'
                      : 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]'
                  }`}
                >
                  <span className={`block text-xs font-bold ${entrance === m.id ? 'text-white' : 'text-gray-300'}`}>{m.label}</span>
                  <span className="block mt-0.5 text-[10px] text-gray-500 leading-snug">{m.hint}</span>
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


        <p className="text-[11px] text-gray-600 leading-relaxed px-1">
          Every clip is watched by a person before it airs. We never host your video — we point at
          your post, so the views and the follows stay on your account.
        </p>

      </div>
    </div>
  )
}
