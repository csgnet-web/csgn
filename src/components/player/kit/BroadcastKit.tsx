import type { ReactNode } from 'react'

/**
 * THE BROADCAST DESIGN KIT.
 *
 * ── The art direction, and why ─────────────────────────────────────────────
 *
 * Sports-network editorial: enormous condensed type, hard-edged colour
 * blocking, structural rules, and numbers treated as the hero rather than as
 * captions. The reference is the way a modern sports brand agency handles a
 * broadcast package — 160over90, Nike's campaign work, the ESPN documentary
 * strand. Confident, loud, and built out of type and geometry rather than
 * gradients and glass.
 *
 * Four rules everything here follows, and they are the difference between
 * "a website on television" and "a channel":
 *
 *  1. TYPE IS THE GRAPHIC. Not a label sitting on a graphic. If a card is
 *     working, deleting every decorative element leaves something that still
 *     reads across a room.
 *  2. HARD EDGES. No soft shadows, no glass blur, no rounded-everything. A
 *     broadcast graphic is cut, not faded — it has to survive compression at
 *     4 Mbps, and a subtle gradient is the first thing an encoder destroys.
 *  3. ONE ACCENT, USED STRUCTURALLY. Brand red is a rule, a bar, a fill — not
 *     a highlight sprinkled over six elements. A second accent colour is how a
 *     package stops looking like a package.
 *  4. MOTION MEANS SOMETHING CHANGED. Nothing floats, pulses or breathes for
 *     decoration. A move on screen tells a viewer the channel did something.
 *
 * ── Why these are components and not CSS ───────────────────────────────────
 *
 * Every one of these renders at 1920×1080 into an OBS browser source. Sizes
 * here are BROADCAST sizes — a 180px headline is normal, and anything under
 * about 24px is unreadable on a phone watching a re-stream. Keeping them in one
 * file is what stops the package drifting into six slightly different reds and
 * four slightly different letter-spacings.
 */

/* ─── Tokens ─── */

export const BROADCAST = {
  /** The structural accent. Used as fills and rules, never as a glow. */
  accent: '#ff2346',
  /** The secondary, for live states and positive numbers only. */
  live: '#35ff8a',
  gold: '#ffb020',
  ink: '#050507',
  paper: '#ffffff',
} as const

/* ─── Primitives ─── */

/**
 * A KICKER — the small all-caps line above a headline.
 *
 * The single most load-bearing element in a sports package: it is what tells a
 * viewer what KIND of thing they are looking at before they read the thing.
 * Wide tracking because at this size letter-spacing is the only thing that
 * distinguishes a label from a word.
 */
export function Kicker({ children, tone = 'accent', className = '' }: {
  children: ReactNode
  tone?: 'accent' | 'live' | 'mute' | 'paper'
  className?: string
}) {
  const color = tone === 'accent' ? 'text-[#ff2346]'
    : tone === 'live' ? 'text-[#35ff8a]'
    : tone === 'paper' ? 'text-white'
    : 'text-white/40'
  return (
    <p className={`font-black uppercase tracking-[0.42em] leading-none ${color} ${className}`}>
      {children}
    </p>
  )
}

/**
 * MEGA TYPE — the headline.
 *
 * Tight tracking and a leading under 1, because at 120px+ the default line
 * height opens a canyon between lines and the block stops reading as one
 * object. This is the single biggest difference between type that looks
 * designed and type that looks defaulted.
 */
export function Mega({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h1 className={`font-display font-black uppercase text-white leading-[0.84] tracking-[-0.03em] ${className}`}>
      {children}
    </h1>
  )
}

/**
 * A RULE — the horizontal bar that structures everything.
 *
 * Two weights on purpose. The heavy one separates sections; the hairline
 * separates rows within one. Using a single weight everywhere is what makes a
 * layout read as a table instead of as a designed page.
 */
export function Rule({ weight = 'heavy', tone = 'accent', className = '' }: {
  weight?: 'heavy' | 'hair'
  tone?: 'accent' | 'paper' | 'mute'
  className?: string
}) {
  const bg = tone === 'accent' ? 'bg-[#ff2346]' : tone === 'paper' ? 'bg-white' : 'bg-white/15'
  return <div className={`${weight === 'heavy' ? 'h-[6px]' : 'h-px'} ${bg} ${className}`} />
}

/**
 * A STAT — a number with a label under it.
 *
 * The number is enormous and the label is tiny, which is the correct ratio and
 * the one people get backwards. A viewer reads the figure from across a room
 * and the label only if they care what it is. Tabular figures so a ticking
 * number does not jitter the layout every second.
 */
export function Stat({ value, label, tone = 'paper', className = '' }: {
  value: ReactNode
  label: string
  tone?: 'paper' | 'accent' | 'live' | 'gold'
  className?: string
}) {
  const color = tone === 'accent' ? 'text-[#ff2346]'
    : tone === 'live' ? 'text-[#35ff8a]'
    : tone === 'gold' ? 'text-[#ffb020]'
    : 'text-white'
  return (
    <div className={className}>
      <p className={`font-display font-black tabular-nums leading-[0.85] tracking-[-0.02em] ${color}`}>
        {value}
      </p>
      <p className="mt-3 font-black uppercase tracking-[0.3em] text-white/35 leading-none">{label}</p>
    </div>
  )
}

/**
 * CORNER MARKS — the four registration brackets.
 *
 * Borrowed straight from broadcast furniture and film leader. They cost
 * nothing, they frame the safe area, and they are most of why a full-screen
 * card reads as "a graphic that was made" rather than "a slide". Inert.
 */
export function CornerMarks({ inset = 48, size = 56, tone = BROADCAST.accent }: {
  inset?: number
  size?: number
  tone?: string
}) {
  const arm = 'absolute pointer-events-none'
  const bar = { background: tone }
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* top-left */}
      <div className={arm} style={{ ...bar, left: inset, top: inset, width: size, height: 6 }} />
      <div className={arm} style={{ ...bar, left: inset, top: inset, width: 6, height: size }} />
      {/* top-right */}
      <div className={arm} style={{ ...bar, right: inset, top: inset, width: size, height: 6 }} />
      <div className={arm} style={{ ...bar, right: inset, top: inset, width: 6, height: size }} />
      {/* bottom-left */}
      <div className={arm} style={{ ...bar, left: inset, bottom: inset, width: size, height: 6 }} />
      <div className={arm} style={{ ...bar, left: inset, bottom: inset, width: 6, height: size }} />
      {/* bottom-right */}
      <div className={arm} style={{ ...bar, right: inset, bottom: inset, width: size, height: 6 }} />
      <div className={arm} style={{ ...bar, right: inset, bottom: inset, width: 6, height: size }} />
    </div>
  )
}

/**
 * A SLATE — the full-screen card everything else sits inside.
 *
 * Flat near-black with a single diagonal field of accent at low opacity. The
 * diagonal is the package's one recurring gesture: it appears here, in the
 * wipe, and behind the ident, which is what ties three unrelated graphics
 * together into something recognisable as one channel.
 */
export function Slate({ children, marks = true, className = '' }: {
  children: ReactNode
  marks?: boolean
  className?: string
}) {
  return (
    <div className={`absolute inset-0 overflow-hidden bg-[#050507] ${className}`}>
      {/* The diagonal field. A hard-edged clip path, not a gradient — an
          encoder at 4 Mbps turns a soft gradient into banding, and a hard
          shape survives any bitrate. */}
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{ background: BROADCAST.accent, clipPath: 'polygon(0 100%, 100% 0, 100% 100%, 0 100%)' }}
      />
      {/* A second, tighter wedge gives the field an edge to read against. */}
      <div
        className="absolute inset-0 opacity-[0.14]"
        style={{ background: BROADCAST.accent, clipPath: 'polygon(0 100%, 62% 100%, 100% 44%, 100% 100%)' }}
      />
      {marks && <CornerMarks />}
      <div className="relative w-full h-full">{children}</div>
    </div>
  )
}

/**
 * THE STRIPE FIELD — diagonal bars used as a transition and as texture.
 *
 * `progress` 0→1 sweeps it across the frame. Driven by the caller so a
 * transition can be timed against an actual state change rather than running
 * on its own clock and hoping.
 */
export function StripeField({ progress, tone = BROADCAST.accent }: { progress: number; tone?: string }) {
  const p = Math.max(0, Math.min(1, progress))
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        // Skewed hard-edged bars. `repeating-linear-gradient` with zero-length
        // stops is a stripe, not a gradient — no banding at any bitrate.
        background: `repeating-linear-gradient(115deg, ${tone} 0 90px, transparent 90px 180px)`,
        transform: `translateX(${(1 - p) * 140}%)`,
        opacity: p > 0 ? 1 : 0,
      }}
    />
  )
}
