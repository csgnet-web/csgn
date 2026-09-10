import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Clapperboard, Coins, Radio } from 'lucide-react'
import { useAuth } from '@/contexts/useAuth'
import { useAuthModal } from '@/contexts/useAuthModal'
import { CsgnLogo } from '@/components/ui/CsgnLogo'
import { markIntroSeen, shouldShowIntro } from '@/lib/firstRun'

/**
 * WHAT THIS IS, ONCE, IN TWENTY WORDS.
 *
 * ── The register ───────────────────────────────────────────────────────────
 *
 * Not an onboarding carousel. Not a tour with dots along the bottom and a
 * "next" button four times. One screen, three lines, two buttons — because the
 * thing being explained genuinely is three lines long, and a product that needs
 * four slides to introduce itself is a product nobody finishes being introduced
 * to.
 *
 * The three lines are the three things a person can DO, in the order of how
 * much they have to commit: watch (nothing), post (a link), hold (money). Each
 * is a verb and a consequence, and nothing else — no benefits copy, no "why
 * CSGN", no paragraph. If a line here needs a sentence to make sense, the
 * product needs fixing, not the sentence.
 *
 * ── Why the second button is the small one ─────────────────────────────────
 *
 * "Start watching" is primary because it costs nothing and it is what the page
 * behind this sheet is already doing. Leading with sign-up on a stranger's
 * first second is how a channel becomes a landing page — the tab bar is one tap
 * away, permanently, and it is a better salesman than a modal.
 */
export default function Intro() {
  const location = useLocation()
  const { user, loading } = useAuth()
  const { openAuth } = useAuthModal()

  // Decided ONCE, on mount, from the route this person actually arrived on.
  // Deliberately not re-evaluated as they navigate: an intro that appears three
  // screens into a session is not an intro, it is an interruption.
  const [open, setOpen] = useState(false)
  const [decided, setDecided] = useState(false)

  useEffect(() => {
    // Wait for auth to settle. Showing "here is what CSGN is" to a returning
    // member for the half-second before their session resolves is the single
    // most annoying version of this component.
    if (loading || decided) return
    setDecided(true)
    setOpen(shouldShowIntro({
      pathname: location.pathname,
      search: location.search,
      signedIn: Boolean(user),
    }))
    // Only the first settled auth state matters — see above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, decided])

  const dismiss = () => {
    markIntroSeen()
    setOpen(false)
  }

  // Escape closes, like every other sheet on the site.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center">
      {/* The channel stays visible behind it. A person should be able to see
          that there is something playing while they read what it is. */}
      <button
        type="button"
        aria-label="Close"
        onClick={dismiss}
        className="absolute inset-0 bg-black/85 backdrop-blur-sm cursor-default"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="csgn-intro-title"
        className="relative w-full sm:max-w-sm bg-[#080a0f] border border-white/[0.08] rounded-t-3xl sm:rounded-2xl shadow-2xl px-6 pb-8 pt-6 sm:pt-8"
      >
        <div className="sm:hidden -mt-2 mb-4 flex justify-center">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        <div className="flex justify-center">
          <CsgnLogo className="h-7 w-auto" />
        </div>

        <h2 id="csgn-intro-title" className="mt-6 text-center text-[28px] leading-tight font-black text-white tracking-tight">
          Crypto TV,<br />on 24 hours a day.
        </h2>

        {/* Three verbs. The order is how much each one costs you. */}
        <ul className="mt-7 space-y-4">
          <Line Icon={Radio} title="Watch" note="Always something on." />
          <Line Icon={Clapperboard} title="Post a clip" note="It airs between the live streams." />
          <Line Icon={Coins} title="Hold $CSGN" note="Your share of the token is your share of the day." />
        </ul>

        <button
          type="button"
          onClick={dismiss}
          className="mt-8 w-full rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 py-3.5 text-[15px] font-bold text-white shadow-lg shadow-primary-600/25 cursor-pointer"
        >
          Start watching
        </button>

        <button
          type="button"
          onClick={() => { dismiss(); openAuth() }}
          className="mt-3 w-full py-2 text-[13px] font-medium text-gray-400 hover:text-white cursor-pointer"
        >
          Get on the channel
        </button>
      </div>
    </div>
  )
}

/** One row: an icon, a verb, and what it gets you. Never more. */
function Line({ Icon, title, note }: { Icon: typeof Radio; title: string; note: string }) {
  return (
    <li className="flex items-start gap-3.5">
      <span className="mt-0.5 w-9 h-9 shrink-0 rounded-xl bg-white/[0.05] border border-white/[0.07] flex items-center justify-center">
        <Icon className="w-4 h-4 text-primary-400" />
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-bold text-white leading-tight">{title}</span>
        <span className="block text-[13px] text-gray-400 leading-snug">{note}</span>
      </span>
    </li>
  )
}
