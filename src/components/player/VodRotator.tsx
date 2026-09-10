import { useEffect, useState } from 'react'
import IntermissionBoard from './IntermissionBoard'
import ChannelIdent from './kit/ChannelIdent'
import { pickByClock, DEFAULT_BOARD_BREAK_MS, type ReelPlayout } from '@/lib/reel'

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
  /** WHEN the scheduler said this segment airs. Present on member segments,
   *  absent on the admin VOD playlist (which has no place on the clock).
   *  Only read in `clock` playout — see src/lib/reel.ts. */
  startsAt?: string
  endsAt?: string
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
 * FIVE shapes — one for each entry in ON_AIR_STYLES. It was three for a while,
 * and the other two silently fell through to the bar: a member picked Stack or
 * Minimal in /studio, was shown a preview of it, and then went out on air
 * wearing somebody else's card. A chooser with options that do not exist on the
 * receiving end is worse than a chooser with three options.
 *
 * Shapes matter, because a channel where every segment carries an identical grey
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

  // STACK — the member's handle over a colour block, the biggest of the five.
  if (style === 'stack') {
    return (
      <div className={`absolute left-8 bottom-8 overflow-hidden rounded-lg ${anim}`}>
        <div className={`h-1.5 w-full ${accent}`} />
        <div className="flex items-center gap-4 bg-black/75 backdrop-blur-sm border border-t-0 border-white/10 px-6 py-4">
          {avatar}
          <span className="min-w-0">
            <span className="block text-3xl font-black text-white leading-none tracking-tight">@{username}</span>
            {title && <span className="mt-1.5 block text-xs text-gray-400 truncate max-w-[420px]">{title}</span>}
          </span>
        </div>
      </div>
    )
  }

  // MINIMAL — the handle and nothing else. No box, so it has to carry its own
  // legibility over an unknown video: a hard shadow rather than a panel.
  if (style === 'minimal') {
    return (
      <div className={`absolute left-8 bottom-8 flex items-center gap-3 ${anim}`}>
        <span className={`w-1.5 h-8 rounded-full ${accent} shrink-0`} />
        <span
          className="text-2xl font-black text-white leading-none"
          style={{ textShadow: '0 2px 12px rgba(0,0,0,0.9), 0 0 3px rgba(0,0,0,0.9)' }}
        >
          @{username}
        </span>
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

/** Default gap between two clips in loop playout. A prop now, not a constant —
 *  see the note on DEFAULT_BOARD_BREAK_MS in src/lib/reel.ts for why a minute
 *  is the right order of magnitude for four minutes of content and the wrong
 *  one for a full reel. */
const BOARD_BREAK_MS = DEFAULT_BOARD_BREAK_MS
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
 *
 * TWO PLAYOUTS, one component. `loop` rotates the list with a board break
 * between items, stretching whatever content exists across the whole day.
 * `clock` reads the timestamps the scheduler wrote and plays each segment in
 * the minute it was booked for, which is what makes the time quoted in /studio
 * literally true. Which one the channel should run is a programming decision,
 * not a technical one — src/lib/reel.ts states both sides; loop is the default
 * because it is what the channel already does.
 */
export default function VodRotator({
  items,
  playout = 'loop',
  boardBreakMs = BOARD_BREAK_MS,
}: {
  items: VodItem[]
  /** 'loop' stretches what content exists across the day (the default, and what
   *  the channel has always done); 'clock' plays each segment in the minute the
   *  scheduler booked it for. See src/lib/reel.ts. */
  playout?: ReelPlayout
  boardBreakMs?: number
}) {
  const [index, setIndex] = useState(0)
  const [onBoard, setOnBoard] = useState(true)
  // The ident plays on every hand-over. This is what makes a rotation of other
  // people's clips read as ONE CHANNEL rather than as a playlist — the recurring
  // mark between segments is the entire signal.
  const [ident, setIdent] = useState(true)
  // Clock playout: the instant the schedule is being read at. Re-stamped when
  // the current decision expires, which re-asks `pickByClock`. One timer per
  // decision, never a poll — and Date.now() stays out of render.
  const [clockNow, setClockNow] = useState(() => Date.now())

  useEffect(() => {
    if (!ident) return
    const t = setTimeout(() => setIdent(false), IDENT_MS)
    return () => clearTimeout(t)
  }, [ident])

  // Board break between items (and before the first). Loop playout only — on
  // the clock, the gaps between segments ARE the board break, and inserting
  // another one would push every segment past the minute it was promised for.
  useEffect(() => {
    if (playout === 'clock' || !onBoard || items.length === 0) return
    const t = setTimeout(() => setOnBoard(false), boardBreakMs)
    return () => clearTimeout(t)
  }, [playout, onBoard, items.length, boardBreakMs])

  const advance = () => {
    setIndex((i) => (i + 1) % Math.max(items.length, 1))
    setIdent(true)
    setOnBoard(true)
  }

  // WHAT IS ON. Loop asks the rotation; clock asks the schedule.
  const pick = playout === 'clock' ? pickByClock(items, clockNow) : null
  const current = playout === 'clock'
    ? (pick && pick.index >= 0 ? items[pick.index] : null)
    : (items.length > 0 ? items[index % items.length] : null)
  const isEmbed = Boolean(current?.platform)

  // Clock playout: sleep until this decision expires — the end of the segment
  // on air, or the start of the next one. Infinity (nothing left scheduled
  // today) sets no timer at all; the next schedule snapshot wakes it instead.
  useEffect(() => {
    if (playout !== 'clock' || !pick || !Number.isFinite(pick.holdMs)) return
    const t = setTimeout(() => setClockNow(Date.now()), Math.max(250, pick.holdMs))
    return () => clearTimeout(t)
    // Primitive deps on purpose: `pick` is a fresh object every render, and
    // depending on it would tear the timer down and rebuild it each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playout, items, pick?.index, pick?.holdMs])

  // An iframe has no 'ended' event we can read across origins, so an embedded
  // clip runs on a clock. Slightly longer than the allotted segment so a slow
  // embed start does not clip the end off every single one. Clock playout does
  // not advance on a timer — the schedule already said when this segment ends.
  useEffect(() => {
    if (playout === 'clock' || !current || !isEmbed || onBoard) return
    const t = setTimeout(advance, (current.seconds ?? 30) * 1000 + 1_500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.url, isEmbed, onBoard, playout])

  // Ident first, then the board, then the clip. The order is the hand-over:
  // brand, context, content.
  if (ident) return <ChannelIdent onDone={() => setIdent(false)} />
  if (!current || (playout === 'loop' && onBoard)) return <IntermissionBoard />

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
        onEnded={playout === 'clock' ? undefined : advance}
        onError={playout === 'clock' ? undefined : advance}
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
