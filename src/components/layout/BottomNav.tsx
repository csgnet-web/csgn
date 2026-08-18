import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CalendarDays, Clapperboard, Coins, Radio, User } from 'lucide-react'
import { useAuth } from '@/contexts/useAuth'
import { useAuthModal } from '@/contexts/useAuthModal'
import { useLiveSlot } from '@/contexts/useLiveSlot'

/**
 * THE BOTTOM BAR — the app's spine on a phone.
 *
 * Five destinations, always on screen, one tap apart. This is the single
 * biggest structural difference between something that reads as an app and
 * something that reads as a website: on a website you go BACK to a menu, and on
 * an app the menu never left.
 *
 * Rules it follows:
 *
 *  • FIVE items, never six. Past five the targets get too narrow for a thumb
 *    and the labels start truncating, which is where a tab bar stops being
 *    scannable and becomes a puzzle.
 *  • The destinations are VERBS, not sections. Watch, Schedule, Post, Token,
 *    You — each is something a person came here to do.
 *  • Nothing here is a dead end. Tapping Post while signed out opens the
 *    sign-in sheet in place; it does not bounce you to another page that then
 *    asks you to come back.
 *  • It respects the phone's home indicator (`safe-area-inset-bottom`), because
 *    a tab bar tucked under the gesture bar is a tab bar you mis-tap.
 *
 * Desktop keeps the top nav — a 1400px-wide window with five tabs pinned to the
 * bottom edge looks like a phone screenshot, not a desktop app.
 */

interface Tab {
  href: string
  label: string
  Icon: typeof Radio
  /** Signed-out taps open the auth sheet instead of navigating. */
  requiresAuth?: boolean
  /** Pulses when the network is on air. */
  liveDot?: boolean
}

const TABS: Tab[] = [
  { href: '/watch', label: 'Watch', Icon: Radio, liveDot: true },
  { href: '/schedule', label: 'Schedule', Icon: CalendarDays },
  { href: '/studio', label: 'Post', Icon: Clapperboard, requiresAuth: true },
  { href: '/participate', label: '$CSGN', Icon: Coins },
  { href: '/account', label: 'You', Icon: User, requiresAuth: true },
]

export function BottomNav() {
  const location = useLocation()
  const { user } = useAuth()
  const { openAuth } = useAuthModal()
  const { currentSlot } = useLiveSlot()

  const onAir = Boolean(currentSlot?.assignedName)

  const isActive = (href: string) =>
    href === '/watch'
      ? location.pathname === '/' || location.pathname === '/watch'
      : location.pathname === href || location.pathname.startsWith(`${href}/`)

  return (
    <nav
      aria-label="Primary"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.07] bg-[#06060c]/95 backdrop-blur-xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Hairline of brand colour along the top edge — the same device the PIP
          overlay uses. It reads as "this is one product" without spending a
          whole bar of colour on it. */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary-500/40 to-transparent" />

      <div className="grid grid-cols-5">
        {TABS.map(({ href, label, Icon, requiresAuth, liveDot }) => {
          const active = isActive(href)
          const locked = requiresAuth && !user

          const body = (
            <>
              <span className="relative">
                <Icon
                  className={`w-[22px] h-[22px] transition-colors ${active ? 'text-white' : 'text-gray-500'}`}
                  strokeWidth={active ? 2.4 : 1.9}
                />
                {liveDot && onAir && (
                  <span className="absolute -top-0.5 -right-1 flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-live opacity-70 animate-ping" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-live" />
                  </span>
                )}
              </span>
              <span
                className={`text-[10px] font-semibold tracking-wide transition-colors ${
                  active ? 'text-white' : 'text-gray-500'
                }`}
              >
                {label}
              </span>
              {active && (
                <motion.span
                  layoutId="bottomNavActive"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  className="absolute top-0 h-0.5 w-8 rounded-full bg-primary-500"
                />
              )}
            </>
          )

          const shell = 'relative flex flex-col items-center justify-center gap-1 py-2.5 cursor-pointer select-none'

          // A locked tab is a BUTTON, not a Link. Navigating to a page that only
          // says "sign in first" is a wasted screen; the sheet opens over
          // whatever they were already looking at instead.
          return locked ? (
            <button key={href} type="button" onClick={openAuth} className={shell} aria-label={`${label} — sign in`}>
              {body}
            </button>
          ) : (
            <Link key={href} to={href} className={shell} aria-current={active ? 'page' : undefined}>
              {body}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export default BottomNav
