import type { OnAirLook } from '@/lib/clipEmbed'

/**
 * A MEMBER'S LOWER THIRD — one component, two consumers.
 *
 * This renders in the Studio as a preview and on the broadcast overlay as the
 * real thing. That is the entire point of it existing: the previous preview was
 * a hand-built approximation living inside Studio.tsx, so "what I picked" and
 * "what went on television" were two independent pieces of markup that could
 * drift, and the only way to find out they had was to watch the channel.
 *
 * Three shapes, and they are genuinely different silhouettes rather than three
 * colours of the same box — a viewer registers the shape of a card before they
 * read the name in it, so shape is what makes a member's segment recognisable.
 *
 * The avatar is a CIRCLE in every shape. Circular is what reads as "a person"
 * at a glance and at distance; the rest of the broadcast furniture is square,
 * so the one round element on screen is always somebody's face.
 */
/** How the card arrives. Mirrors ON_AIR_MOTIONS — see src/lib/clipEmbed.ts.
 *  Pure CSS, all under 500ms, because an entrance still animating a third of
 *  the way through a short clip is an entrance nobody asked for. */
const MOTION_CLASS: Record<string, string> = {
  cut: '',
  slide: 'csgn-lt-slide',
  wipe: 'csgn-lt-wipe',
  pop: 'csgn-lt-pop',
}

export function LowerThird({
  style, look, username, avatarUrl, title, motion = 'cut',
}: {
  style: string
  look: OnAirLook
  username: string
  /** Empty string when there is none, or the member turned it off. */
  avatarUrl?: string
  title?: string
  motion?: string
}) {
  const anim = MOTION_CLASS[motion] ?? ''
  const avatar = avatarUrl
    ? (
      <img
        src={avatarUrl}
        alt=""
        className={`rounded-full object-cover bg-white/10 shrink-0 ring-2 ${look.ring}`}
        style={{ width: style === 'ticker' ? 28 : 40, height: style === 'ticker' ? 28 : 40 }}
        // A broken avatar must not leave a torn box on television. It removes
        // itself and the card falls back to the text-only layout.
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
      />
    )
    : null

  if (style === 'stack') {
    // Name over a solid block of the member's colour. The loudest option, and
    // the one that reads from furthest away — a whole corner of the frame
    // becomes theirs rather than a strip of it.
    return (
      <div className={`absolute left-4 bottom-4 overflow-hidden rounded-lg ${anim}`}>
        <div className={`${look.accent} px-4 py-2 flex items-center gap-2.5`}>
          {avatar}
          <span className="text-[9px] font-black uppercase tracking-[0.22em] text-black/70">On CSGN</span>
        </div>
        <div className="bg-black/80 backdrop-blur-sm px-4 py-2.5">
          <span className="block text-lg font-black text-white leading-tight truncate max-w-[280px]">@{username}</span>
          {title && <span className="block text-[10px] text-gray-400 truncate max-w-[280px]">{title}</span>}
        </div>
      </div>
    )
  }

  if (style === 'minimal') {
    // No box at all — a handle with a drop shadow. For somebody whose clip is
    // the graphic and who wants the frame back.
    return (
      <div className={`absolute left-6 bottom-6 flex items-center gap-2.5 ${anim}`}>
        {avatar}
        <span
          className="text-xl font-black text-white leading-none"
          style={{ textShadow: '0 2px 12px rgba(0,0,0,0.9)' }}
        >
          @{username}
        </span>
      </div>
    )
  }

  if (style === 'badge') {
    return (
      <div className={`absolute right-4 top-4 flex items-center gap-2.5 rounded-full bg-black/75 backdrop-blur-sm border border-white/10 py-1.5 pl-1.5 pr-4 ${anim}`}>
        {avatar ?? <span className={`w-2.5 h-2.5 ml-1 rounded-full ${look.accent}`} />}
        <span className="min-w-0">
          <span className="block text-sm font-black text-white leading-tight truncate">@{username}</span>
          {title && <span className="block text-[10px] text-gray-400 truncate max-w-[180px]">{title}</span>}
        </span>
      </div>
    )
  }

  if (style === 'ticker') {
    return (
      <div className={`absolute inset-x-0 bottom-0 flex items-center gap-3 bg-black/80 backdrop-blur-sm border-t border-white/10 px-4 py-2.5 ${anim}`}>
        <span className={`w-1.5 h-8 rounded-full ${look.accent} shrink-0`} />
        {avatar}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-black text-white leading-tight truncate">@{username}</span>
          {title && <span className="block text-[10px] text-gray-400 truncate">{title}</span>}
        </span>
        <span className="text-[9px] uppercase tracking-[0.18em] text-gray-500 shrink-0">On CSGN</span>
      </div>
    )
  }

  // 'bar' — the classic broadcast lower third, and the default.
  return (
    <div className={`absolute left-4 bottom-4 flex items-stretch rounded-lg bg-black/70 backdrop-blur-sm border border-white/10 overflow-hidden ${anim}`}>
      <span className={`w-1 ${look.accent} shrink-0`} />
      <span className="flex items-center gap-2.5 px-3 py-2">
        {avatar}
        <span className="min-w-0">
          <span className="block text-[9px] uppercase tracking-[0.18em] text-gray-400">On CSGN</span>
          <span className="block text-base font-black text-white leading-tight truncate">@{username}</span>
          {title && <span className="block text-[10px] text-gray-400 truncate max-w-[220px]">{title}</span>}
        </span>
      </span>
    </div>
  )
}

export default LowerThird
