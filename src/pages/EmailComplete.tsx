import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Mail } from 'lucide-react'
import { useAuth } from '@/contexts/useAuth'
import { Button } from '@/components/ui/Button'
import { CsgnLogo } from '@/components/ui/CsgnLogo'

/**
 * Where an email sign-in link lands.
 *
 * Firebase needs the ORIGINAL address to redeem a link, which it normally has
 * in localStorage from the device that asked for it. Opening the link on a
 * different device — phone link, desktop mail client — means that storage is
 * empty, so this page asks for the address instead of failing. That one branch
 * is the difference between "works everywhere" and "works if you happen to open
 * your email on the same browser you started in".
 */
export default function EmailComplete() {
  const { completeEmailLink } = useAuth()
  const navigate = useNavigate()
  const [state, setState] = useState<'working' | 'needs-email' | 'done' | 'error'>('working')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  // A link is single-use; running the exchange twice (StrictMode double-mount)
  // turns a good link into an "already used" error.
  const attempted = useRef(false)

  useEffect(() => {
    if (attempted.current) return
    attempted.current = true
    ;(async () => {
      try {
        await completeEmailLink(window.location.href)
        setState('done')
        setTimeout(() => navigate('/watch', { replace: true }), 1200)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not finish signing in.'
        if (message.includes('Enter the email')) setState('needs-email')
        else { setError(message); setState('error') }
      }
    })()
  }, [completeEmailLink, navigate])

  const submit = async () => {
    setError('')
    try {
      await completeEmailLink(window.location.href, email.trim())
      setState('done')
      setTimeout(() => navigate('/watch', { replace: true }), 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not finish signing in.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <CsgnLogo className="h-8 w-auto mx-auto" />

        {state === 'working' && (
          <>
            <div className="mt-8 w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="mt-4 text-sm text-gray-400">Signing you in…</p>
          </>
        )}

        {state === 'done' && (
          <>
            <CheckCircle2 className="mt-8 w-10 h-10 text-emerald-400 mx-auto" />
            <p className="mt-4 text-lg font-semibold text-white">You're in.</p>
            <p className="mt-1 text-sm text-gray-400">Taking you to the network…</p>
          </>
        )}

        {state === 'needs-email' && (
          <>
            <Mail className="mt-8 w-8 h-8 text-gray-400 mx-auto" />
            <p className="mt-4 text-sm text-white font-medium">One more thing</p>
            <p className="mt-1 text-xs text-gray-400 leading-relaxed">
              You opened this link on a different device. Type the address it was sent to and
              you're done.
            </p>
            <input
              type="email"
              inputMode="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void submit() }}
              placeholder="your@email.com"
              className="mt-4 w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 text-center focus:outline-none focus:border-primary-500/50"
            />
            <Button variant="primary" size="md" className="mt-3 w-full" onClick={() => void submit()} disabled={!email.trim()}>
              Finish signing in
            </Button>
          </>
        )}

        {state === 'error' && (
          <>
            <p className="mt-8 text-sm text-white font-medium">That link didn't work</p>
            <p className="mt-2 text-xs text-gray-400 leading-relaxed">{error}</p>
            <p className="mt-2 text-xs text-gray-500 leading-relaxed">
              Sign-in links expire and can only be used once. Ask for a fresh one.
            </p>
            <Button variant="secondary" size="md" className="mt-5" onClick={() => navigate('/watch')}>
              Back to CSGN
            </Button>
          </>
        )}

        {error && state === 'needs-email' && <p className="mt-3 text-xs text-red-300">{error}</p>}
      </div>
    </div>
  )
}
