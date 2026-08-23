import { useEffect, useState } from 'react'
import IntermissionBoard from './IntermissionBoard'
import ChannelIdent from './kit/ChannelIdent'

export interface VodItem {
  url: string
  seconds?: number
  title?: string
  /** Set for member clips: the post lives on YouTube/TikTok/Instagram and is
   *  rendered in an iframe. Absent for the admin playlist, whose entries are
   *  direct MP4/WebM files and play in a <video>. */
  platform?: string
  /** Who the clip belongs to, for on-screen credit. */
  username?: string
  /** The member's chosen on-air look id — decides the accent on their card. */
  look?: string
  /** Their chosen lower-third SHAPE. */
  style?: string
  /** How their card arrives — see ON_AIR_MOTIONS. */
  motion?: string
  /** Their profile picture, when they have one and left it switched on. */
  avatarUrl?: string
}

/** Mirrors ON_AIR_LOOKS in src/lib/clipEmbed.ts. Kept as plain classes rather
 *  than imported, because /player is composited into OBS and must not pull in
 *  anything it does not strictly need to paint a frame. */
const LOOK_ACCENT: Record<string, string> = {
  signal: 'bg-primary-500',
  money: 'bg-emerald-400',
  gold: 'bg-amber-400',
  ice: 'bg-cyan-400',
  violet: 'bg-violet-500',
  mono: 'bg-white',
  sunset: 'bg-orange-400',
  toxic: 'bg-lime-400',
  midnight: 'bg-indigo-400',
  blood: 'bg-red-500',
}

const LOOK_RING: Record<string, string> = {
  signal: 'ring-primary-500/50',
  money: 'ring-emerald-400/50',
  gold: 'ring-amber-400/50',
  ice: 'ring-cyan-400/50',
  violet: 'ring-violet-500/50',
  mono: 'ring-white/40',
  sunset: 'ring-orange-400/50',
  toxic: 'ring-lime-400/50',
  midnight: 'ring-indigo-400/50',
  blood: 'ring-red-500/50',
}

/**
 * THE MEMBER'S CREDIT CARD, on air.
 *
 * Three shapes, because a channel where every segment carries an identical grey
 * box is a channel where nobody's segment is recognisable as theirs — and that
 * recognition is most of what a member is actually buying with their bag.
 *
 * The avatar is a CIRCLE in all three. Everything else in the broadcast
 * furniture is rectangular, so the one round element on screen is always
 * somebody's face, which is what makes it read as a person at a glance and from
 * across a room.
 *
 * Deliberately NOT the app's `LowerThird` component: /player is composited into
 * OBS at 1920×1080 and must not pull the app's component tree in to paint a
 * frame. The sizes here are broadcast sizes, not UI sizes.
 */
const MOTION_CLASS: Record<string, string> = {
  cut: '',
  slide: 'csgn-lt-slide',
  wipe: 'csgn-lt-wipe',
  pop: 'csgn-lt-pop',
}

function ClipCredit({ username, look, style, motion, avatarUrl, title }: {
  username: string
  look?: string
  style?: string
  motion?: string
  avatarUrl?: string
  title?: string
}) {
  const anim = MOTION_CLASS[motion ?? 'cut'] ?? ''
  const accent = LOOK_ACCENT[look ?? 'signal'] ?? LOOK_ACCENT.signal
  const ring = LOOK_RING[look ?? 'signal'] ?? LOOK_RING.signal
  const avatar = avatarUrl
    ? (
      <img
        src={avatarUrl}
        alt=""
        className={`rounded-full object-cover bg-white/10 shrink-0 ring-2 ${ring}`}
        style={{ width: 56, height: 56 }}
        // A broken avatar must never leave a torn box on television.
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
      />
    )
    : null

  if (style === 'badge') {
    return (
      <div className={`absolute right-8 top-8 flex items-center gap-3.5 rounded-full bg-black/75 backdrop-blur-sm border border-white/10 py-2 pl-2 pr-6 ${anim}`}>
        {avatar ?? <span className={`w-3.5 h-3.5 ml-2 rounded-full ${accent}`} />}
        <span className="min-w-0">
          <span className="block text-xl font-black text-white leading-tight">@{username}</span>
          {title && <span className="block text-xs text-gray-400 truncate max-w-[320px]">{title}</span>}
        </span>
      </div>
    )
  }

  if (style === 'ticker') {
    return (
      <div className={`absolute inset-x-0 bottom-0 flex items-center gap-4 bg-black/80 backdrop-blur-sm border-t border-white/10 px-8 py-4 ${anim}`}>
        <span className={`w-2 h-12 rounded-full ${accent} shrink-0`} />
        {avatar}
        <span className="min-w-0 flex-1">
          <span className="block text-xl font-black text-white leading-tight">@{username}</span>
          {title && <span className="block text-xs text-gray-400 truncate">{title}</span>}
        </span>
        <span className="text-[11px] uppercase tracking-[0.18em] text-gray-500 shrink-0">On CSGN</span>
      </div>
    )
  }

  return (
    <div className={`absolute left-8 bottom-8 flex items-stretch overflow-hidden rounded-lg bg-black/70 border border-white/10 backdrop-blur-sm ${anim}`}>
      <span className={`w-1.5 ${accent} shrink-0`} />
      <span className="flex items-center gap-3.5 px-4 py-2.5">
        {avatar}
        <span className="min-w-0">
          <span className="block text-[11px] uppercase tracking-[0.18em] text-gray-400">On CSGN</span>
          <span className="block text-xl font-black text-white leading-tight">@{username}</span>
          {title && <span className="block text-xs text-gray-400 truncate max-w-[380px]">{title}</span>}
        </span>
      </span>
    </div>
  )
}

const BOARD_BREAK_MS = 60_000
/** The ident that plays as the channel hands over between segments. Short —
 *  it recurs constantly, and an ident that outstays its welcome is worse than
 *  no ident at all. */
const IDENT_MS = 2_600

/**
 * Intermission programming: rotates member clips and admin promo VODs with the
 * animated network board between items. Empty playlist → board only.
 *
 * Two kinds of item, one rotation:
 *
 *   • a member CLIP — a post on YouTube/TikTok/Instagram, rendered in an iframe.
 *     We never hosted the video; the platform did, and the embed is built
 *     server-side from the link they gave us.
 *   • an admin VOD — a direct MP4/WebM, rendered in a <video>.
 *
 * A <video> tells us when it ended; an iframe does not. So a clip gets a TIMER
 * set to the duration the schedule allocated it, and moves on when that expires.
 * Anything that fails to load advances too, because the one thing the network
 * must never do is sit on a broken segment.
 */
export default function VodRotator({ items }: { items: VodItem[] }) {
  const [index, setIndex] = useState(0)
  const [onBoard, setOnBoard] = useState(true)
  // The ident plays on every hand-over. This is what makes a rotation of other
  // people's clips read as ONE CHANNEL rather than as a playlist — the recurring
  // mark between segments is the entire signal.
  const [ident, setIdent] = useState(true)

  useEffect(() => {
    if (!ident) return
    const t = setTimeout(() => setIdent(false), IDENT_MS)
    return () => clearTimeout(t)
  }, [ident])

  // Board break between items (and before the first)
  useEffect(() => {
    if (!onBoard || items.length === 0) return
    const t = setTimeout(() => setOnBoard(false), BOARD_BREAK_MS)
    return () => clearTimeout(t)
  }, [onBoard, items.length])

  const advance = () => {
    setIndex((i) => (i + 1) % Math.max(items.length, 1))
    setIdent(true)
    setOnBoard(true)
  }

  const current = items.length > 0 ? items[index % items.length] : null
  const isEmbed = Boolean(current?.platform)

  // An iframe has no 'ended' event we can read across origins, so an embedded
  // clip runs on a clock. Slightly longer than the allotted segment so a slow
  // embed start does not clip the end off every single one.
  useEffect(() => {
    if (!current || !isEmbed || onBoard) return
    const t = setTimeout(advance, (current.seconds ?? 30) * 1000 + 1_500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.url, isEmbed, onBoard])

  // Ident first, then the board, then the clip. The order is the hand-over:
  // brand, context, content.
  if (ident) return <ChannelIdent onDone={() => setIdent(false)} />
  if (!current || onBoard) return <IntermissionBoard />

  if (isEmbed) {
    return (
      <div className="absolute inset-0 bg-black">
        <iframe
          key={current.url}
          src={current.url}
          title={current.title || 'CSGN clip'}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full border-0"
        />
        {/* Credit stays on screen for the whole segment. Somebody's post is on
            television; their name goes with it. */}
        {current.username && (
          <ClipCredit
            username={current.username}
            look={current.look}
            style={current.style}
            motion={current.motion}
            avatarUrl={current.avatarUrl}
            title={current.title}
          />
        )}
      </div>
    )
  }

  return (
    <div className="absolute inset-0 bg-black">
      <video
        key={current.url}
        src={current.url}
        autoPlay
        playsInline
        onEnded={advance}
        onError={advance}
        className="absolute inset-0 w-full h-full object-contain"
      />
      {current.title && (
        <div className="absolute bottom-10 left-12 px-4 py-2 rounded-lg bg-black/60 border border-white/[0.1]">
          <p className="text-sm font-bold tracking-[0.2em] uppercase text-gray-300">{current.title}</p>
        </div>
      )}
    </div>
  )
}
