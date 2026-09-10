import { Link, useLocation, useNavigate } from 'react-router-dom'
import { prefetchProps } from '@/lib/routePrefetch'
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
  const navigate = useNavigate()
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
      // z-[70] puts it above every page chrome layer (the sticky header is 50,
      // Watch's shell and its overlays sit below that) while staying under the
      // auth sheet at 100. A tab that is visible but covered by a transparent
      // element is the exact bug that made taps feel unreliable.
      // NO PADDING ON THE NAV ITSELF. This is the whole dead-click fix.
      //
      // The safe-area inset used to be padding here, which meant the strip above
      // the home indicator — a good 34px on a modern iPhone, right where a thumb
      // naturally lands — was nav background with no tab under it. It looked
      // like part of the button and did nothing. The inset now lives INSIDE each
      // tab, so every pixel of this bar belongs to a destination.
      className="lg:hidden fixed bottom-0 left-0 right-0 z-[70] border-t border-white/[0.07] bg-[#06060c]/95 backdrop-blur-xl"
      style={{
        // Kills the ~300ms synthetic-click delay some mobile browsers still add
        // when they cannot rule out a double-tap zoom. This is what makes a tap
        // feel instant rather than "sometimes".
        touchAction: 'manipulation',
      }}
      // Belt and braces. If a click ever does land on the nav itself — a
      // rounding gap between grid cells, a future decoration someone forgets to
      // mark inert — work out which fifth of the width it was in and go there
      // anyway. A tap in this bar must never do nothing.
      onClick={(e) => {
        if (e.target !== e.currentTarget) return
        const { left, width } = e.currentTarget.getBoundingClientRect()
        const tab = TABS[Math.min(TABS.length - 1, Math.max(0, Math.floor(((e.clientX - left) / width) * TABS.length)))]
        if (tab.requiresAuth && !user) openAuth()
        else navigate(tab.href)
      }}
    >
      {/* Hairline of brand colour along the top edge — the same device the PIP
          overlay uses. `pointer-events-none` because decoration that sits above
          a button and eats its clicks is the other half of this bug. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary-500/40 to-transparent" />

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
              {/* A plain element, not a layout animation. The shared-layout
                  version re-measured every tab on each route change, and during
                  that frame a press could land on a moving target. */}
              {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary-500" />}
            </>
          )

          // Each tab is a full grid cell, floor to ceiling, INCLUDING the home
          // indicator strip — see the note on the nav. No dead band between the
          // icon and the label, none at the edges, none underneath.
          const shell = 'relative flex flex-col items-center justify-center gap-1 pt-2.5 pb-2.5 min-h-[56px] w-full cursor-pointer select-none touch-manipulation active:bg-white/[0.07] transition-colors'
          const shellStyle = { paddingBottom: 'calc(0.625rem + env(safe-area-inset-bottom))' }

          // A locked tab is a BUTTON, not a Link. Navigating to a page that only
          // says "sign in first" is a wasted screen; the sheet opens over
          // whatever they were already looking at instead.
          return locked ? (
            <button key={href} type="button" onClick={openAuth} className={shell} style={shellStyle} aria-label={`${label} — sign in`}>
              {body}
            </button>
          ) : (
            <Link key={href} to={href} {...prefetchProps(href)} className={shell} style={shellStyle} aria-current={active ? 'page' : undefined}>
              {body}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export default BottomNav
