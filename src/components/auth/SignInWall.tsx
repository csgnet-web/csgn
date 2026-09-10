import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuthModal } from '@/contexts/useAuthModal'
import { authDoorsLine, WALLET_DEFERRED } from '@/config/authProviders'

/**
 * ONE GATE, USED EVERYWHERE.
 *
 * Every signed-out wall in the app follows the same three rules, so it is one
 * component rather than three that drift:
 *
 *  1. IT SELLS, IT DOES NOT SCOLD. "Sign in required" tells somebody they did
 *     something wrong. A headline and a sentence about what is behind the door
 *     tells them why to open it.
 *  2. THE SHEET OPENS IN PLACE. No redirect to a sign-in page they then have to
 *     navigate back from — the modal opens over whatever they were looking at.
 *  3. IT NAMES THE DOORS THAT ACTUALLY WORK, and nothing else. The sentence
 *     comes from `authDoorsLine()` so this wall, the modal and anywhere else
 *     that makes the promise cannot disagree — promising Google here and
 *     greying it out one tap later is the kind of small lie people notice, on
 *     the one screen where trust is the entire ask.
 */
export function SignInWall({
  Icon, title, body, cta = 'Sign in',
}: {
  Icon: LucideIcon
  title: string
  body: string
  cta?: string
}) {
  const { openAuth } = useAuthModal()
  return (
    <div className="min-h-screen pt-24 lg:pt-28 pb-24 px-4">
      <div className="max-w-md mx-auto text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-600 to-primary-500 flex items-center justify-center mx-auto shadow-[0_12px_40px_-12px_rgba(255,35,70,0.6)]">
          <Icon className="w-7 h-7 text-white" />
        </div>
        <h1 className="mt-6 text-3xl font-black font-display text-white tracking-tight">{title}</h1>
        <p className="mt-3 text-sm text-gray-400 leading-relaxed">{body}</p>
        <Button variant="primary" size="lg" className="mt-7 w-full" onClick={openAuth}>{cta}</Button>
        <p className="mt-4 text-[11px] text-gray-600">{authDoorsLine()}</p>
        {/* The objection that actually costs sign-ups, answered before it is
            raised — but only once there is a door that does not need one. */}
        {WALLET_DEFERRED && (
          <p className="mt-1.5 text-[11px] text-gray-600">
            You only need a wallet when there are fees to pay you.
          </p>
        )}
      </div>
    </div>
  )
}

export default SignInWall
