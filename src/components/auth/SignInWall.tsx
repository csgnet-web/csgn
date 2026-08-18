import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuthModal } from '@/contexts/useAuthModal'
import { SOCIAL_AUTH_ENABLED } from '@/config/authProviders'

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
 *  3. IT NAMES THE DOORS THAT ACTUALLY WORK. While the social providers are
 *     unconfigured (see config/authProviders.ts) it says wallet, because
 *     promising Google here and greying it out one tap later is the kind of
 *     small lie people notice.
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
        <p className="mt-4 text-[11px] text-gray-600">
          {SOCIAL_AUTH_ENABLED ? 'Google, X, wallet or email. No password.' : 'Connect a Phantom wallet. No password.'}
        </p>
      </div>
    </div>
  )
}

export default SignInWall
