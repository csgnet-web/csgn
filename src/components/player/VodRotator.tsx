import { useEffect, useState } from 'react'
import IntermissionBoard from './IntermissionBoard'

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
}

const BOARD_BREAK_MS = 60_000

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

  // Board break between items (and before the first)
  useEffect(() => {
    if (!onBoard || items.length === 0) return
    const t = setTimeout(() => setOnBoard(false), BOARD_BREAK_MS)
    return () => clearTimeout(t)
  }, [onBoard, items.length])

  const advance = () => {
    setIndex((i) => (i + 1) % Math.max(items.length, 1))
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
          <div className="absolute left-8 bottom-8 rounded-lg bg-black/70 border border-white/10 px-3 py-2 backdrop-blur-sm">
            <p className="text-[11px] uppercase tracking-[0.18em] text-gray-400">On CSGN</p>
            <p className="text-lg font-bold text-white leading-tight">@{current.username}</p>
          </div>
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
