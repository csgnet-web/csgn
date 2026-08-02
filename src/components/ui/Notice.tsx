import { AlertTriangle, CheckCircle2, Info, XCircle, type LucideIcon } from 'lucide-react'

/**
 * ONE notice. Every status message in the app renders through this.
 *
 * Before this component the app had at least five different shapes for "tell the
 * user something": an amber card with a button on the profile, a red flex row in
 * the auth modal, an emerald pill on /watch, a bare `<p className="text-xs
 * text-red-300">` under the wallet button, and an inline span in the admin
 * panel. Same job, five paddings, five icon sizes, three different reds.
 *
 * That isn't only ugly — it's why the two notices that actually MATTER (verify
 * your email; link Twitch before you can claim an hour) read like decoration
 * instead of instructions. A user can't learn what a notice looks like if every
 * one looks different.
 *
 * The rules this fixes in place:
 *
 *   • FOUR TONES, and they mean things. `info` is context, `success` is
 *     confirmation, `warning` is "you must do something", `error` is "it broke".
 *     A notice with an action is almost always a warning.
 *   • ONE LAYOUT: icon, title, body, action. Any part optional; the grid never
 *     changes, so a long body and a long action can't collide.
 *   • THE ACTION IS PART OF THE NOTICE. A message telling someone to do
 *     something, with no way to do it, is a complaint.
 */

export type NoticeTone = 'info' | 'success' | 'warning' | 'error'

const TONES: Record<NoticeTone, { icon: LucideIcon; wrap: string; icon_: string; title: string }> = {
  info: {
    icon: Info,
    wrap: 'border-white/[0.1] bg-white/[0.03]',
    icon_: 'text-gray-400',
    title: 'text-white',
  },
  success: {
    icon: CheckCircle2,
    wrap: 'border-emerald-500/25 bg-emerald-500/[0.07]',
    icon_: 'text-emerald-400',
    title: 'text-emerald-100',
  },
  warning: {
    icon: AlertTriangle,
    wrap: 'border-amber-500/25 bg-amber-500/[0.07]',
    icon_: 'text-amber-400',
    title: 'text-amber-100',
  },
  error: {
    icon: XCircle,
    wrap: 'border-red-500/25 bg-red-500/[0.07]',
    icon_: 'text-red-400',
    title: 'text-red-100',
  },
}

export interface NoticeProps {
  tone?: NoticeTone
  /** Bold first line. Omit for a single-line notice — the body carries it. */
  title?: string
  children?: React.ReactNode
  /** Right-hand action. Stacks below the text on narrow screens. */
  action?: React.ReactNode
  /** Tighter padding and smaller type, for inline form errors. */
  compact?: boolean
  className?: string
}

export function Notice({ tone = 'info', title, children, action, compact, className = '' }: NoticeProps) {
  const t = TONES[tone]
  const Icon = t.icon

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border ${t.wrap} ${compact ? 'px-3 py-2.5' : 'px-4 py-3.5'} ${className}`}
    >
      <div className="flex items-start gap-2.5 min-w-0 flex-1">
        <Icon className={`${compact ? 'w-4 h-4' : 'w-4 h-4'} shrink-0 mt-px ${t.icon_}`} />
        {/* min-w-0 is what lets long copy wrap instead of pushing the action
            off the card — the single most common notice bug. */}
        <div className="min-w-0">
          {title && (
            <p className={`${compact ? 'text-xs' : 'text-sm'} font-semibold ${t.title} leading-snug`}>{title}</p>
          )}
          {children && (
            <div className={`${compact ? 'text-xs' : 'text-xs sm:text-sm'} text-gray-400 leading-relaxed ${title ? 'mt-0.5' : ''}`}>
              {children}
            </div>
          )}
        </div>
      </div>
      {action && <div className="shrink-0 sm:ml-auto">{action}</div>}
    </div>
  )
}

/**
 * The two notices that gate everything, in one place.
 *
 * They exist as named exports rather than being written inline wherever they're
 * needed because they are the app's most important sentences and they must read
 * identically on the profile, in the claim flow, and on the schedule. Three
 * hand-written variants of "you need Twitch" is how a requirement starts
 * sounding optional.
 */

export function EmailNotice({ action }: { action?: React.ReactNode }) {
  return (
    <Notice tone="warning" title="Verify your email" action={action}>
      We sent you a link. Verifying unlocks slot claims and your creator-fee payouts.
    </Notice>
  )
}

export function TwitchNotice({ action }: { action?: React.ReactNode }) {
  return (
    <Notice tone="warning" title="Connect Twitch to claim a slot" action={action}>
      Your account is ready — Twitch is only needed to go on air. Link the channel you stream from
      and every open hour becomes claimable.
    </Notice>
  )
}
